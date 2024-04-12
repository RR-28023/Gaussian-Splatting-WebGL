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
    renderSpeed: 500,
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

function showLoading() {
    // console.log("Show Loading")
    document.querySelector('#loading-container').style.opacity = "1"
}

function hideLoading() {
    // console.log("Hide Loading");
    document.querySelector("#canvas").style.opacity = "1";
    document.querySelector("#loading-container").style.opacity = "0";
}

window.addEventListener("load", loadProgress);

const details = {
    loadingPage: true,
    initGui: "",
    isDynamicScene: "",
    loadScene: "",
    loadComplete: ""
  };



function loadProgress() {
  // Get DOM element
  const target = document.querySelector(".loadingbar");
  const counter = target.querySelector("span");

  function getProgress(board) {
    let maxLength = 100;
    // Put them into array to get length of form
    let lengthOfBoard = Object.values(board).length;

    // Get possible mark of each field
    let jumps = maxLength / lengthOfBoard;
    let progress = 0;
    for (let field in board) {
      // If field is filled add it's mark to progress
      if (board[field]) {
        progress += jumps;
      }
    }
    return progress;
  }

  // Utilise value calculated from loader
  function implimentLoad() {
    // Simulate a delay
    setTimeout(() => {
      let progress = Math.round(getProgress(details));
      counter.innerText = `${progress}% `;
      target.style.width = `${getProgress(details)}% `;
    }, 50);
  }
  implimentLoad();
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
            // document.querySelector('#loading-container').style.opacity = 0
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
    details.initGui = true;

    // Setup gizmo renderer
    await gizmoRenderer.init()

    // Load scene
    await loadScene(settings.scene, settings.back)
    details.loadComplete = true;

}

async function loadScene(scene_name, back_name) {
    // Instantiate the camera
    const CameraParameters = await fetch(`models/${scene_name}/${scene_name}.json`)
    const defaultCameraParameters = await CameraParameters.json()

    cam = new Camera(defaultCameraParameters)
    cam.disableMovement = true
    // if (scene_name.includes('dynamic')) {
    if (defaultCameraParameters.isDynamic) {
        details.isDynamicScene = true;
        console.log("Loading Dynamic Scene");
        // Load the background PLY data
        const frames_data = await loadFramesPly(scene_name);
        // Load the first frame
        window.frame_idx = 0;
            loadNextFrame(frames_data, CameraParameters.backgroundColorHEX);
            hideLoading();
        // Wait 3 seconds for the first frame to be loaded before starting the interval
        await sleep(3000);
            function loadLoop() {
                loadNextFrame(frames_data, CameraParameters.backgroundColorHEX, settings.renderSpeed);
                setTimeout(loadLoop, settings.renderSpeed);
            }
            loadLoop();
    } else {
        // Load the a static scene
        console.log("Loading Static Scene");
        details.isDynamicScene = true;
        await loadStaticScene(scene_name, CameraParameters.backgroundColorHEX);
    }
    cam.disableMovement = false
    document.body.style.backgroundColor = defaultCameraParameters.backgroundColorHEX;
    details.loadScene = true;

}


async function sendGaussianDataToWorker(scene_data) {

    var data_to_send = scene_data
    gaussianCount = scene_data.positions.length / 3
    settings.maxGaussians = gaussianCount
    worker.postMessage({gaussians: { ...data_to_send, count: gaussianCount }})

}


async function loadNextFrame(frames_data, backgroundColorHEX) {

    // Send gaussian data to the worker
    gaussianCount = frames_data[window.frame_idx].positions.length / 3
    // console.log(`Sending frame ${window.frame_idx} to worker`)
    await sendGaussianDataToWorker(frames_data[window.frame_idx])
    // Append the back data to the data elements if it exists
    cam.update(is_dynamic = true)
    document.getElementById('frameNumber').innerText = `Frame: ${window.frame_idx}`;
    document.body.style.backgroundColor = backgroundColorHEX;
    window.frame_idx += 1
    if (window.frame_idx >= frames_data.length) window.frame_idx = 0

    // Update GUI
    // settings.maxGaussians = gaussianCount
    // maxGaussianController.max(gaussianCount)
    // maxGaussianController.updateDisplay()

}

async function loadFramesPly(frames_folder) {
    console.log("Loading Frames")
    showLoading();
    data = []
    let i=1
    let reader = []
    let contentLength = []
    while (true){
        response = await fetch(`models/${frames_folder}/${String(i).padStart(5, '0')}.ply`)
        if (response.ok){
            contentLength.push(parseInt(response.headers.get('content-length')))
            reader.push(response.body.getReader())
            // console.log(i, details);
            details["frame"+i] = "";
            i++;
        }
        else {
            break
        }
    }
    let n_frames = reader.length
    for (let i = 0; i < reader.length; i++) {
        // Download .ply file and monitor the progress
        // let start = performance.now()
        const content = await downloadPly(reader[i], contentLength[i])
        // Load and pre-process gaussian data from .ply file
        frame_ply_data = await loadPly(content.buffer)
        data.push(frame_ply_data)
        // console.log(`Frame ${i}/${n_frames} loaded in ${((performance.now() - start) / 1000).toFixed(3)}s`)
        // console.log(`Frame ${i}/${n_frames} loaded`);
        console.log(`Frame ${i}/${n_frames} loaded`, details);
        details["frame"+i] = true;
        // const progress = ((i + 1) /n_frames) * 100
        // document.querySelector('#loading-bar').style.width = progress + '%'
        // document.querySelector('#loading-text').textContent = `Downloading 3D frames (${(i + 1)}/${n_frames}) ... ${progress.toFixed(2)}%`
    }
    return data
}



// Load a .ply scene specified as a name (URL fetch) or local file
async function loadStaticScene(scene_name, background_data, backgroundColorHEX) {
    // gl.clearColor(0, 0, 0, 0)
    // gl.clear(gl.COLOR_BUFFER_BIT)
    // document.querySelector('#loading-container').style.opacity = 1
    showLoading()
    let response = await fetch(`models/${scene_name}/${scene_name}.ply`);

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
    // delete data.scales

    // Send gaussian data to the worker
    // console.log(`Sending static gaussian data to worker`)
    await sendGaussianDataToWorker(data)
    document.body.style.backgroundColor = backgroundColorHEX;
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
    hideLoading();
}

function requestRender(...params) {
    if (renderFrameRequest != null)
        cancelAnimationFrame(renderFrameRequest)

    renderFrameRequest = requestAnimationFrame(() => render(...params))
}

// Render a frame on the canvas
function render(width, height, res) {
    // Update canvas size
    const resolution = res ?? settings.renderResolution
    const canvasWidth = width ?? Math.round(canvasSize[0] * resolution)
    const canvasHeight = height ?? Math.round(canvasSize[1] * resolution)

    if (gl.canvas.width != canvasWidth || gl.canvas.height != canvasHeight) {
        gl.canvas.width = canvasWidth
        gl.canvas.height = canvasHeight
    }

    // Setup viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)

    // Update camera
    cam.update()

    // Original implementation parameters
    const W = gl.canvas.width
    const H = gl.canvas.height
    const tan_fovy = Math.tan(cam.fov_y * 0.5)
    const tan_fovx = tan_fovy * W / H
    const focal_y = H / (2 * tan_fovy)
    const focal_x = W / (2 * tan_fovx)

    gl.uniform1f(gl.getUniformLocation(program, 'W'), W)
    gl.uniform1f(gl.getUniformLocation(program, 'H'), H)
    gl.uniform1f(gl.getUniformLocation(program, 'focal_x'), focal_x)
    gl.uniform1f(gl.getUniformLocation(program, 'focal_y'), focal_y)
    gl.uniform1f(gl.getUniformLocation(program, 'tan_fovx'), tan_fovx)
    gl.uniform1f(gl.getUniformLocation(program, 'tan_fovy'), tan_fovy)
    gl.uniform1f(gl.getUniformLocation(program, 'scale_modifier'), settings.scalingModifier)
    gl.uniform3fv(gl.getUniformLocation(program, 'boxmin'), sceneMin)
    gl.uniform3fv(gl.getUniformLocation(program, 'boxmax'), sceneMax)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projmatrix'), false, cam.vpm)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'viewmatrix'), false, cam.vm)

    // Custom parameters
    gl.uniform1i(gl.getUniformLocation(program, 'show_depth_map'), settings.debugDepth)

    // Draw
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, settings.maxGaussians)

    // Draw gizmo
    gizmoRenderer.render()

    renderFrameRequest = null

    // Progressively draw with higher resolution after the camera stops moving
    let nextResolution = Math.floor(resolution * 4 + 1) / 4
    if (nextResolution - resolution < 0.1) nextResolution += .25

    if (nextResolution <= 1 && !cam.needsWorkerUpdate && !isWorkerSorting) {
        const nextWidth = Math.round(canvasSize[0] * nextResolution)
        const nextHeight = Math.round(canvasSize[1] * nextResolution)

        if (renderTimeout != null)
            clearTimeout(renderTimeout)

        renderTimeout = setTimeout(() => requestRender(nextWidth, nextHeight, nextResolution), 200)
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
    // console.log(`Gravity center at [${mean_pos[0].toFixed(3)},${mean_pos[1].toFixed(3)},${mean_pos[2].toFixed(3)}]`)
}


window.onload = main