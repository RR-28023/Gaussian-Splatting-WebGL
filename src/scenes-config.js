const defaultCameraParameters = {
    'yellow car pnts pruning + less blurry frames': {
        up: [-0.082, 0.713, 0.696],
        target:  [0.275,1.424,2.019], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [0.6, 1.96, 4], //[theta, phi, radius],
        min_phi: 1.75
    },
    'red car images texture': {
        up: [0.033, 0.837, 0.547],
        target:  [0.301,1.870,0.750],
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [11.42, 1.94, 4], //[theta, phi, radius],
        min_phi: 1.90  // It also accepts max_phi
    },
    'blue car floaters pruning': {
        up: [-0.014, 0.645, 0.764],
        target:  [-0.262,1.820,2.290],
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [9.54, 1.99, 4], //[theta, phi, radius],
        min_phi: 1.88  // It also accepts max_phi
    },
    'bag': {
        up: [-0.131503164768219,0.36319607496261597,0.9223857522010803],
        target: [0.1269, 1.74, 1.89], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [4.77, 2.00, 4.5], //[theta, phi, radius],
        min_phi: 1.75
    },
    'sneakers': {
        up: [-0.131, 0.1322, 0.982],
        target: [0.08796, 0.43057, 2.667364], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [2.815, 2.0, 4], //[theta, phi, radius],
        min_phi: 1.7,
    },
    'camper': {
        up: [+0.52, -0.675, -0.5183],
        target: [-0.130, -0.0187, -0.53496], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [4.74, 2.05, 4], //[3.34, 1.64, 4], //[theta, phi, radius],
    },
    'golf': {
        up: [0.009902715682983398,0.31472811102867126,0.9491302371025085],
        target: [-0.4284291777755183,0.515804616465936,2.933792871923287], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [4.63, 1.72, 5.5], //[3.34, 1.64, 4], //[theta, phi, radius],
        min_phi: 1.95
    },
    'yellow car': {
        up: [ -0.06171373650431633,0.7797079682350159,0.6230946183204651],
        target:  [0.3880559352499739,1.5167793830914043,1.9232708279015884], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [4.52, 1.750, 2.5], //[theta, phi, radius],
        min_phi: 1.75
    },
    'red car': {
        up: [-0.07178903371095657,0.8717256188392639,0.48470693826675415],
        target:  [0.3406993506200396,1.8151092300188236,0.9849917127819064], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [3.235, 1.95, 2.5], //[theta, phi, radius],
        min_phi: 1.75
    },
    'blue car': {
        up: [ -0.056267619132995605,0.8368156552314758,0.544585645198822],
        target:  [-0.2549465228938901,2.529700795571348,1.3776932680297473], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [11, 2, 4], //[theta, phi, radius],
        min_phi: 1.75
    }
}
