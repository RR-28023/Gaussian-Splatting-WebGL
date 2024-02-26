let gl, program
let cam = null
let worker = null
let isWorkerSorting = false
let canvasSize = [0, 0]

let renderFrameRequest = null
let renderTimeout = null

let gaussianCount
let sceneMin, sceneMax

let gizmoRenderer = new GizmoRenderer()
let positionBuffer, positionData, opacityData
let data = []
let stopInterval;

const settings = {
    renderResolution: 0.9,
    maxGaussians: 1e6,
    scalingModifier: 1,
    sortingAlgorithm: 'count sort',
    bgColor: '#ffffff',
    speed: 0.07,
    fov: 35.58,
    debugDepth: false,
    freeFly: false,
    sortTime: 'NaN',
    // shDegree: 2,
    // maxShDegree: 3,

    // Camera calibration
    calibrateCamera: () => { },
    finishCalibration: () => { },
    showGizmo: true
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    // Setup webgl context and buffers
    const { glContext, glProgram, buffers } = await setupWebglContext()
    gl = glContext; program = glProgram // Handy global vars

    if (gl == null || program == null) {
        document.querySelector('#loading-text').style.color = `red`
        document.querySelector('#loading-text').textContent = `Could not initialize the WebGL context.`
        throw new Error('Could not initialize WebGL')
    }

    // Setup web worker for multi-threaded sorting
    worker = new Worker('src/worker-sort.js')

    // Event that receives sorted gaussian data from the worker
    worker.onmessage = e => {
        const { data, sortTime } = e.data

        if (getComputedStyle(document.querySelector('#loading-container')).opacity != 0) {
            document.querySelector('#loading-container').style.opacity = 0
            cam.disableMovement = false
        }

        const updateBuffer = (buffer, data) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
        }

        updateBuffer(buffers.color, data.colors)
        updateBuffer(buffers.center, data.positions)
        updateBuffer(buffers.opacity, data.opacities)
        updateBuffer(buffers.covA, data.cov3Da)
        updateBuffer(buffers.covB, data.cov3Db)

        // Needed for the gizmo renderer
        positionBuffer = buffers.center
        positionData = data.positions
        opacityData = data.opacities

        settings.sortTime = sortTime

        isWorkerSorting = false
        requestRender()
    }

    // Setup GUI
    initGUI()

    // Setup gizmo renderer
    await gizmoRenderer.init()

    // Load scene
    await loadScene(settings.scene, settings.back)

}

async function loadScene(scene_name, back_name) {
    // Instantiate the camera
    cam = new Camera(defaultCameraParameters[scene_name])
    cam.disableMovement = true
    var back_data = null
    if (back_name != 'None') {
        var back_data = await loadBackgroundPly(back_name)
    }
    if (scene_name.includes('dynamic')) {
        // Load the background PLY data
        const frames_data = await loadFramesPly(scene_name)
        // Load the first frame
        window.frame_idx = 0
        loadNextFrame(frames_data, back_data)
        // Wait 3 seconds for the first frame to be loaded before starting the interval
        await sleep(3000)
        stopInterval = setInterval(() => loadNextFrame(frames_data, back_data), 500);
        //await load_next_frame(frames_data, back_data)
    }
    else {
        // Load the a static scene
        await loadStaticScene(scene_name, back_data)
    }
    cam.disableMovement = false

}

async function sendGaussianDataToWorker(scene_data, background_data) {

    var data_to_send = scene_data
    gaussianCount = scene_data.positions.length / 3
    if (background_data) {
        start = performance.now()
        gaussianCount += background_data.positions.length / 3

        data_to_send.positions = data_to_send.positions.concat(background_data.positions)
        data_to_send.colors = data_to_send.colors.concat(background_data.colors)
        data_to_send.opacities = data_to_send.opacities.concat(background_data.opacities)
        data_to_send.cov3Ds = data_to_send.cov3Ds.concat(background_data.cov3Ds)
        const appendTime = `${((performance.now() - start)/1000).toFixed(3)}s`
        console.log(`[Frame loader] Appended background data in ${appendTime}`)
    }
    settings.maxGaussians = gaussianCount
    worker.postMessage({gaussians: { ...data_to_send, count: gaussianCount }})

}


async function loadNextFrame(frames_data, background_data) {

    // Send gaussian data to the worker
    gaussianCount = frames_data[window.frame_idx].positions.length / 3
    console.log(`Sending frame ${window.frame_idx} to worker`)
    await sendGaussianDataToWorker(frames_data[window.frame_idx], background_data)
    // Append the back data to the data elements if it exists
    cam.update(is_dynamic=true)
    document.getElementById('frameNumber').innerText = `Frame: ${window.frame_idx}`;
    document.body.style.backgroundColor = settings.bgColor
    window.frame_idx += 1
    if (window.frame_idx >= frames_data.length) window.frame_idx = 0

    // Update GUI
    // settings.maxGaussians = gaussianCount
    // maxGaussianController.max(gaussianCount)
    // maxGaussianController.updateDisplay()

}

// async function loadFramesPly(frames_folder) {
//     data = []
//     let i=1
//     let reader = []
//     let contentLength = []
//     while (true){
//         response = await fetch(`models/${frames_folder}/frame_${i}.ply`)
//         if (response.ok){
//             contentLength.push(parseInt(response.headers.get('content-length')))
//             reader.push(response.body.getReader())
//             i++
//         }
//         else {
//             break
//         }
//     }
//     const n_frames = i

//     // CARBALLO TODO : PODRÍA SER QUE ESTE FOR ESTÉ LASTRANDO TODO PORQUE CADA VEZ HACE DOS AWAITS

//     for (let i = 0; i < reader.length; i++) {
//         // Download .ply file and monitor the progress
//         const content = await downloadPly(reader[i], contentLength[i])
//         // Load and pre-process gaussian data from .ply file
//         frame_ply_data = await loadPly(content.buffer)
//         delete frame_ply_data.scales
//         data.push(frame_ply_data)
//         const progress = ((i + 1) /n_frames) * 100
//         document.querySelector('#loading-bar').style.width = progress + '%'
//         document.querySelector('#loading-text').textContent = `Downloading 3D frames (${(i + 1)}/${n_frames}) ... ${progress.toFixed(2)}%`
//     }
//     return data
// }

async function loadFramesPly(frames_folder) {
  const data = [];
  let i = 1;
  const reader = [];
  const contentLength = [];
  const progressBar = document.querySelector("#loading-bar");
  const progressText = document.querySelector("#loading-text");

  // Descargar todos los archivos PLY
  while (true) {
    const response = await fetch(`models/${frames_folder}/frame_${i}.ply`);
    if (!response.ok) break;

    contentLength.push(parseInt(response.headers.get("content-length")));
    reader.push(response.body.getReader());
    i++;
  }
  const n_frames = i - 1;

  // Descargar y procesar los archivos PLY
  for (let i = 0; i < n_frames; i++) {
    // Descargar .ply y monitorear el progreso
    const content = await downloadPly(reader[i], contentLength[i]);
    // Cargar y preprocesar datos gaussianos del archivo .ply
    const frame_ply_data = await loadPly(content.buffer);
    delete frame_ply_data.scales;
    data.push(frame_ply_data);

    // Actualizar la barra de progreso
    const progress = ((i + 1) / n_frames) * 100;
    progressBar.style.width = progress + "%";
    progressText.textContent = `Downloading 3D frames (${i + 1}/${n_frames}) ... ${progress.toFixed(2)}%`;
  }
  return data;
}

async function loadBackgroundPly(back_name) {
    response = await fetch(`models/${back_name}.ply`)
    contentLength = parseInt(response.headers.get('content-length'))
    reader = response.body.getReader()
    background_data = []
    const content = await downloadPly(reader, contentLength)    
    back_data = await loadPly(content.buffer)
    // getGravityCenter(back_data)        
    delete back_data.scales
    return back_data
}

// Load a .ply scene specified as a name (URL fetch) or local file
async function loadStaticScene(scene_name, background_data) {
    // gl.clearColor(0, 0, 0, 0)
    // gl.clear(gl.COLOR_BUFFER_BIT)
    document.querySelector('#loading-container').style.opacity = 1
    let response = await fetch(`models/${scene_name}.ply`)
    
    if (response.ok) {
        contentLength = parseInt(response.headers.get('content-length'))
        reader = response.body.getReader()
    }
    
    else {
        throw new Error('Scene .ply not found')
    }    
    // Download .ply file and monitor the progress
    const content = await downloadPly(reader, contentLength)
    // Load and pre-process gaussian data from .ply file
    data = await loadPly(content.buffer)
    
    // Print gravity center
    getGravityCenter(data)
    delete data.scales
    
    // Send gaussian data to the worker
    console.log(`Sending static gaussian data to worker`)
    await sendGaussianDataToWorker(data, background_data)
    document.body.style.backgroundColor = settings.bgColor
    cam.update(is_dynamic=false)


    // Setup camera
    // let cameraParameters = {}
    // cameraParameters = defaultCameraParameters[scene_name]
    // cam = reset_camera ? new Camera(cameraParameters) : cam
    // cam.disableMovement = false

    // Update GUI
    settings.maxGaussians = gaussianCount
    maxGaussianController.max(gaussianCount)
    maxGaussianController.updateDisplay()

}

function requestRender(...params) {
    if (renderFrameRequest != null)
        cancelAnimationFrame(renderFrameRequest)

    renderFrameRequest = requestAnimationFrame(() => render(...params))
}

// Render a frame on the canvas
// function render(width, height, res) {
//     // Update canvas size
//     const resolution = res ?? settings.renderResolution
//     const canvasWidth = width ?? Math.round(canvasSize[0] * resolution)
//     const canvasHeight = height ?? Math.round(canvasSize[1] * resolution)

//     if (gl.canvas.width != canvasWidth || gl.canvas.height != canvasHeight) {
//         gl.canvas.width = canvasWidth
//         gl.canvas.height = canvasHeight
//     }

//     // Setup viewport
//     gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
//     gl.clearColor(0, 0, 0, 0)
//     gl.clear(gl.COLOR_BUFFER_BIT)
//     gl.useProgram(program)

//     // Update camera
//     cam.update()

//     // Original implementation parameters
//     const W = gl.canvas.width
//     const H = gl.canvas.height
//     const tan_fovy = Math.tan(cam.fov_y * 0.5)
//     const tan_fovx = tan_fovy * W / H
//     const focal_y = H / (2 * tan_fovy)
//     const focal_x = W / (2 * tan_fovx)

//     gl.uniform1f(gl.getUniformLocation(program, 'W'), W)
//     gl.uniform1f(gl.getUniformLocation(program, 'H'), H)
//     gl.uniform1f(gl.getUniformLocation(program, 'focal_x'), focal_x)
//     gl.uniform1f(gl.getUniformLocation(program, 'focal_y'), focal_y)
//     gl.uniform1f(gl.getUniformLocation(program, 'tan_fovx'), tan_fovx)
//     gl.uniform1f(gl.getUniformLocation(program, 'tan_fovy'), tan_fovy)
//     gl.uniform1f(gl.getUniformLocation(program, 'scale_modifier'), settings.scalingModifier)
//     gl.uniform3fv(gl.getUniformLocation(program, 'boxmin'), sceneMin)
//     gl.uniform3fv(gl.getUniformLocation(program, 'boxmax'), sceneMax)
//     gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projmatrix'), false, cam.vpm)
//     gl.uniformMatrix4fv(gl.getUniformLocation(program, 'viewmatrix'), false, cam.vm)

//     // Custom parameters
//     gl.uniform1i(gl.getUniformLocation(program, 'show_depth_map'), settings.debugDepth)

//     // Draw
//     gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, settings.maxGaussians)

//     // Draw gizmo
//     gizmoRenderer.render()

//     renderFrameRequest = null

//     // Progressively draw with higher resolution after the camera stops moving
//     let nextResolution = Math.floor(resolution * 4 + 1) / 4
//     if (nextResolution - resolution < 0.1) nextResolution += .25

//     if (nextResolution <= 1 && !cam.needsWorkerUpdate && !isWorkerSorting) {
//         const nextWidth = Math.round(canvasSize[0] * nextResolution)
//         const nextHeight = Math.round(canvasSize[1] * nextResolution)

//         if (renderTimeout != null)
//             clearTimeout(renderTimeout)

//         renderTimeout = setTimeout(() => requestRender(nextWidth, nextHeight, nextResolution), 200)
//     }
// }

function render(width, height, res) {
  const resolution = res || settings.renderResolution;
  const canvasWidth = width || Math.round(canvasSize[0] * resolution);
  const canvasHeight = height || Math.round(canvasSize[1] * resolution);

  if (gl.canvas.width !== canvasWidth || gl.canvas.height !== canvasHeight) {
    gl.canvas.width = canvasWidth;
    gl.canvas.height = canvasHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);

  cam.update();

  const W = gl.canvas.width;
  const H = gl.canvas.height;
  const tan_fovy = Math.tan(cam.fov_y * 0.5);
  const tan_fovx = (tan_fovy * W) / H;
  const focal_y = H / (2 * tan_fovy);
  const focal_x = W / (2 * tan_fovx);

  const uniforms = {
    W: W,
    H: H,
    focal_x: focal_x,
    focal_y: focal_y,
    tan_fovx: tan_fovx,
    tan_fovy: tan_fovy,
    scale_modifier: settings.scalingModifier,
    boxmin: sceneMin,
    boxmax: sceneMax,
    projmatrix: cam.vpm,
    viewmatrix: cam.vm,
    show_depth_map: settings.debugDepth ? 1 : 0,
  };

  Object.keys(uniforms).forEach((name) => {
    const value = uniforms[name];
    const location = gl.getUniformLocation(program, name);
    if (location !== null) {
      if (Array.isArray(value)) {
        switch (value.length) {
          case 3:
            gl.uniform3fv(location, value);
            break;
          // Handle other lengths if necessary
          default:
            break;
        }
      } else if (value instanceof Float32Array) {
        gl.uniformMatrix4fv(location, false, value);
      } else if (typeof value === "number") {
        gl.uniform1f(location, value);
      }
    }
  });

  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, settings.maxGaussians);
  gizmoRenderer.render();
  renderFrameRequest = null;

  const nextResolution = Math.floor(resolution * 4 + 1) / 4 + 0.25;
  if (nextResolution <= 1 && !cam.needsWorkerUpdate && !isWorkerSorting) {
    const nextWidth = Math.round(canvasSize[0] * nextResolution);
    const nextHeight = Math.round(canvasSize[1] * nextResolution);

    if (renderTimeout != null) clearTimeout(renderTimeout);

    renderTimeout = setTimeout(() => requestRender(nextWidth, nextHeight, nextResolution), 200);
  }
}

// Create function to calculate the gravity center
function getGravityCenter(data) {
    let sumX = 0, sumY = 0, sumZ = 0, sumScale = 0

    for (let i = 0; i < data.positions.length; i += 3) {
        let avg_scale = (data.scales[i] + data.scales[i + 1] + data.scales[i + 2]) / 3
        sumX += data.positions[i] * avg_scale
        sumY += data.positions[i + 1] * avg_scale
        sumZ += data.positions[i + 2] * avg_scale
        // Get t
        sumScale += avg_scale
    }
    let mean_pos = [sumX / sumScale, sumY / sumScale, sumZ / sumScale]
    console.log(`Gravity center at [${mean_pos[0].toFixed(3)},${mean_pos[1].toFixed(3)},${mean_pos[2].toFixed(3)}]`)
}


window.onload = main