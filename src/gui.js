const SORTING_ALGORITHMS = [
    'count sort',
    'quick sort',
    'Array.sort'
]

let maxGaussianController = null
let camController = {
    texts: {
        'default': 'When in calibration mode, you can click on 3 points in your scene to define the ground and orientate the camera accordingly.',
        'calibrating': 'Click on 3 points in your scene to define a plane.',
        'calibrated': 'Click on Apply to orientate the camera so that the defined plane is parallel to the ground.'
    }
}

// Init settings GUI panel
function initGUI() {
    const gui = new lil.GUI({title: 'Settings'})

    const sceneNames = Object.entries(modelsList).map(([name,]) => `${name}`)
    const backNames = ['None', 'living room']
    settings.scene = sceneNames[0]
    settings.back = backNames[0]
    gui.add(settings, 'scene', sceneNames).name('Scene').listen().onChange((scene) => loadScene(scene, settings.back))

    // gui.add(settings, 'back', backNames).name('Background').listen().onChange((back) => loadScene(settings.scene, back))

    gui.add(settings, 'renderResolution', 0.1, 1, 0.01).name('Preview Resolution')
    gui
      .add(settings, "renderSpeed", 1, 1000, 1)
      .name("Render Speed (ms)")
      .onChange(() => {
        console.log("Render speed changed to: ", settings.renderSpeed);
      });

    maxGaussianController = gui.add(settings, 'maxGaussians', 1, settings.maxGaussians, 1).name('Max Gaussians')
        .onChange(() => {
            cam.needsWorkerUpdate = true
            cam.updateWorker()
        })

    gui.add(settings, 'scalingModifier', 0.01, 1, 0.01).name('Scaling Modifier')
        .onChange(() => requestRender())


    // Other settings
    // const otherFolder = gui.addFolder('Other Settings').close()

    // otherFolder.add(settings, 'sortingAlgorithm', SORTING_ALGORITHMS).name('Sorting Algorithm')

    // otherFolder.add(settings, 'sortTime').name('Sort Time').disable().listen()

    // otherFolder.addColor(settings, 'bgColor').name('Background Color')
    //     .onChange(value => {
    //     document.body.style.backgroundColor = value
    //     requestRender()
    // })
    // otherFolder.add(settings, 'speed', 0.01, 2, 0.01).name('Camera Speed')

    // otherFolder.add(settings, 'fov', 30, 110, 1).name('FOV')
    //     .onChange(value => {
    //     cam.fov_y = value * Math.PI / 180
    //     requestRender()
    // })

    // otherFolder.add(settings, 'debugDepth').name('Show Depth Map')
    //     .onChange(() => requestRender())

    // Add option to chose spherical harmonics degree to use, must be between 0 and 3
    // otherFolder.add(settings, 'shDegree', 0, 3, 1).name('SH Degree')
    //    .onChange(() => loadScene({ default_file: settings.scene }))

    // Camera calibration folder
    addCameraCalibrationFolder(gui)

    // Camera controls folder
    addControlsFolder(gui)

    // Github panel
    addIGZLink(gui)
}

function addCameraCalibrationFolder(gui) {
    const folder = gui.addFolder('Camera Calibration').close()
    const p = document.createElement('p')
    p.className = 'controller'
    p.textContent = camController.texts['default']

    camController.p = p

    camController.resetCalibration = () => {
        cam.resetCalibration()
        camController.finish.disable()
        camController.start.name('Start Calibration')
        camController.start.updateDisplay()
        p.textContent = camController.texts['default']
    }

    camController.start = folder.add(settings, 'calibrateCamera').name('Start Calibration')
        .onChange(() => {
            if (cam.isCalibrating) {
                camController.resetCalibration()
                requestRender()
            }
            else {
                cam.isCalibrating = true
                camController.start.name('Abort Calibration')
                camController.start.updateDisplay()
                p.textContent = camController.texts['calibrating']
            }
        })

    camController.finish = folder.add(settings, 'finishCalibration').name('Apply changes').disable()
        .onChange(() => {
            cam.isCalibrating = false
            cam.finishCalibration()

            camController.finish.disable()
            camController.start.name('Calibrate Camera')
            camController.start.updateDisplay()
            camController.showGizmo.show()
            p.textContent = camController.texts['default']
        })

    camController.showGizmo = folder.add(settings, 'showGizmo').name('Show Plane').hide()
        .onChange(() => requestRender())

    // Camera calibration text info
    folder.children[0].domElement.parentNode.insertBefore(p, folder.children[0].domElement)
}

function addControlsFolder(gui) {
    const controlsFolder = gui.addFolder("Controls").close();
    controlsFolder
      .add(settings, "freeFly")
      .name("Free Flying")
      .listen()
      .onChange((value) => {
        cam.freeFly = value;
        requestRender();
      })

    // Free-fly text info
    const controlsHelp = document.createElement('div')
    controlsHelp.style.padding = '4px'
    controlsHelp.style.lineHeight = '1.2'
    controlsHelp.innerHTML = `
        <u>Freefly controls:</u><br>
        <span class='ctrl-key'>WASD, ZQSD</span>: forward/left/backward/right <br>
        <span class='ctrl-key'>Shift/Space</span>: move down/up <br>
        <br>
        <u>Orbit controls:</u><br>
        <span class='ctrl-key'>Left click + drag</span>: rotate around target <br>
        <span class='ctrl-key'>Mouse wheel</span>: zoom in/out
    `
    controlsFolder.domElement.lastChild.appendChild(controlsHelp)
}

function addIGZLink(gui) {
    const IntelygenzLogo = `
    <div style="margin-right: 4px">
        <svg width="30" height="28" viewBox="100 0 700 700" xmlns="http://www.w3.org/2000/svg">
            <path d="M 443.1 217 L 286.9 529.2 H 339.7 L 443 322.6 L 546.3 529.2 H 599.1 L 443.1 217 Z M 392.3 529.2 H 493.6 L 443 426.8 L 392.3 529.2 Z" fill="#fff"></path>
        </svg>
    </div>`;

    const igzElm = document.createElement('div')
    igzElm.style.display = 'flex'
    igzElm.style.justifyContent = 'center'
    igzElm.style.alignItems = 'center'
    igzElm.style.borderTop = '1px solid #424242'
    igzElm.style.padding = '4px 0'

    const igzLink = document.createElement('p')
    igzLink.style.color = 'white'
    // igzLink.href = "https://intelygenz.com/";
    igzLink.textContent = 'Made by Intelygenz'
    // igzLink.target = '_blank'
    // igzLink.rel = 'noopener noreferrer'
    igzElm.innerHTML = IntelygenzLogo
    igzElm.appendChild(igzLink)

    gui.domElement.appendChild(igzElm)
}