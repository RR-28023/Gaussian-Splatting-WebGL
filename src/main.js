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
let dynamic_frame = -1;
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
    uploadFile: () => document.querySelector('#input').click(),

    // Camera calibration
    calibrateCamera: () => { },
    finishCalibration: () => { },
    showGizmo: true
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
    const back_data = await load_background()    

    // Load the default scene
    await loadScene({ default_file: settings.scene , background_data: back_data})
}

async function load_background() {
    background_scene = 'living room'
    response = await fetch(`models/${background_scene}.ply`)
    contentLength = parseInt(response.headers.get('content-length'))
    reader = response.body.getReader()
    background_data = []
    const content = await downloadPly(reader, contentLength)    
    return await loadPly(content.buffer)
}

// Load a .ply scene specified as a name (URL fetch) or local file
async function loadScene({ scene, file, default_file, background_data}) {
    let reset_camera = false;
    if (!default_file.includes('dynamic')) {dynamic_frame = -1}
    if (dynamic_frame == -1) {
        reset_camera = true
        if (stopInterval){
            clearInterval(stopInterval);
            stopInterval = null;
        } 
        data = []
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        if (cam) cam.disableMovement = true
        document.querySelector('#loading-container').style.opacity = 1

        let reader = []
        let contentLength =[]
        if (default_file != null) {
            let response = await fetch(`models/${default_file}.ply`)
            if (!response.ok){
                dynamic_frame = 0
                let more_files = true
                let i=1
                while (more_files){
                    response = await fetch(`models/${default_file}/frame_${i}.ply`)
                    if (response.ok){
                        contentLength.push(parseInt(response.headers.get('content-length')))
                        reader.push(response.body.getReader())
                        i++
                    }
                    else {
                        more_files = false
                    }
                }
            }
            else{
                contentLength = [parseInt(response.headers.get('content-length'))]
                reader = [response.body.getReader()]
            }
        }
        // Create a StreamableReader from a URL Response object
        else if (scene != null) {
            scene = scene.split('(')[0].trim()
            const url = `https://huggingface.co/kishimisu/3d-gaussian-splatting-webgl/resolve/main/${scene}.ply`
            const response = await fetch(url)
            contentLength = [parseInt(response.headers.get('content-length'))]
            reader = [response.body.getReader()]
        }
        // Create a StreamableReader from a File object
        else if (file != null) {
            contentLength = [file.size]
            reader = [file.stream().getReader()]
            settings.scene = 'custom'
        }
        else
            throw new Error('No scene or file specified')
        for (let i = 0; i < reader.length; i++) {
            // Download .ply file and monitor the progress
            const content = await downloadPly(reader[i], contentLength[i])
            // Load and pre-process gaussian data from .ply file
            data.push(await loadPly(content.buffer))
        }
        
        // Print gravity center
        getGravityCenter(data[0])
        
        // Remove scales from  (only needed for gravity center calculation)
        for (let data_value of data) {
            data_value.scales = null;
        }
    }
    // Send gaussian data to the worker
    console.log(`Sending frame ${dynamic_frame} to worker`)
    idx = Math.max(0, dynamic_frame)
    gaussianCount = data[idx].positions.length / 3
    document.getElementById('frameNumber').innerText = `Frame: ${dynamic_frame}`;

    // Append the back data to the data elements if it exists
    data_to_send = data[idx]

    if (background_data) {
        gaussianCount += background_data.positions.length / 3
        data_to_send = {
            positions: [...data_to_send.positions, ...background_data.positions],
            colors: [...data_to_send.colors, ...background_data.colors],
            opacities: [...data_to_send.opacities, ...background_data.opacities],
            cov3Ds: [...data_to_send.cov3Ds, ...background_data.cov3Ds],
        }
    }

    worker.postMessage({gaussians: { ...data_to_send, count: gaussianCount }})
    document.body.style.backgroundColor = settings.bgColor


    // Setup camera
    let cameraParameters = {}
    cameraParameters = (scene || default_file) ? defaultCameraParameters[scene || default_file] : {}
    cam = reset_camera ? new Camera(cameraParameters) : cam
    cam.disableMovement = false
    dynamic_frame > 0 ? cam.update(true):cam.update()

    // Update GUI
    settings.maxGaussians = gaussianCount
    maxGaussianController.max(gaussianCount)
    maxGaussianController.updateDisplay()
    if (dynamic_frame == 0  && !stopInterval) {
            stopInterval = setInterval(() => loadScene({default_file:settings.scene}), 500);
        }
    // if in dynamic, increase the numbered frame
    if (dynamic_frame > -1) {
        dynamic_frame += 1
        if (dynamic_frame >= data.length) dynamic_frame = 0
    }

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
    console.log(`Gravity center at [${mean_pos[0].toFixed(3)},${mean_pos[1].toFixed(3)},${mean_pos[2].toFixed(3)}]`)
}


window.onload = main