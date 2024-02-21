const defaultCameraParameters = {
    'torso': {
        up: [-0.015, 0.903, 0.790],
        target:  [-0.878, 1.406,-0.146], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [1.20, 1.6, 5], //[theta, phi, radius],
        min_phi: 1.55,
        max_phi: 1.9
    },
    // 'torso.cleaned': {
    //     up: [-0.015, 0.903, 0.790],
    //     target:  [-0.878, 1.406,-0.146], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [1.20, 1.6, 6], //[theta, phi, radius],
    //     min_phi: 1.55,
    //     max_phi: 1.9
    // },
    // 'torso': {
    //     up: [-0.015, 0.903, 0.790],
    //     target:  [-0.878, 1.406,-0.146], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [0.85, 1.8, 6], //[theta, phi, radius],
    //     min_phi: 1.2
    // },  
    // 'first frame': {
    //      up: [0.026, 0.980, 0.197],
    //      target:  [0.294,0.662,0.218], 
    //      defaultCameraMode: 'orbit',
    //      size: '?',
    //      camera: [4.9, 2.2, 3], //[theta, phi, radius],
    //      min_phi: 1.2
    // }, 
//     'lancia hotwheel': {
//         up: [0.004, 0.831, 0.557],
//         target:  [0.086,2.104,1.882], 
//         defaultCameraMode: 'orbit',
//         size: '?',
//         camera: [2.06, 2.1, 6], //[theta, phi, radius],
//         min_phi: 2.0,
//         min_radius: 3.5
//    }, 
    'first frame': {
         up: [0.026, 0.980, 0.197],
         target:  [0.294,0.662,0.218], 
         defaultCameraMode: 'orbit',
         size: '?',
         camera: [4.9, 2.2, 3], //[theta, phi, radius],
         min_phi: 1.2
    }, 
    // 'Hotwheel blue max degree 3': {
    //     up: [0.010, 0.620, 0.784],
    //     target:  [0.373,1.331,1.886], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [3.12, 2.30, 12], //[theta, phi, radius],
    //     min_phi: 1.8
    // }, 
    // 'Hotwheel red': {
    //     up: [-0.058, 0.954, 0.294],
    //     target:  [-0.231,0.991,0.844], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [4.37, 1.98, 7], //[theta, phi, radius],
    //     min_phi: 1.8,
    //     max_phi: 2.5,
    //     min_radius: 3.7 
    // }, 
    // 'Hotwheel blue': {
    //     up: [0.010, 0.620, 0.784],
    //     target:  [0.373,1.331,1.886], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [3.12, 2.30, 9], //[theta, phi, radius],
    //     min_phi: 1.8,
    //     min_radius: 4.5
    // },
    // 'Hotwheel yellow van': {
    //     up: [0.073, 0.920, 0.386],
    //     target:  [0.056,1.356,1.574], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [2.76, 2.03, 5], //[theta, phi, radius],
    //     min_phi: 1.8,
    //     max_phi: 2.5,
    //     min_radius: 4 
    // },
    // 'Hotwheel blue - Higher detail (slower)': {
    //     up: [0.010, 0.620, 0.784],
    //     target:  [0.373,1.331,1.886], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [3.12, 2.30, 12], //[theta, phi, radius],
    //     min_phi: 1.9
    // }, 
    // 'Hotwheel yellow van - Higher detail (slower)': {
    //     up: [0.073, 0.920, 0.386],
    //     target:  [0.056,1.356,1.574], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [2.76, 2.03, 5], //[theta, phi, radius],
    //     min_phi: 1.8,
    //     max_phi: 2.5,
    //     min_radius: 4 
    // },
    'colleen_and_ram_dynamic': {
        up: [-0.031, +0.999, -0.010],
        target: [0.214, 0.305, 0.259],
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [3.28, 1.65, 3], //[theta, phi, radius],
        min_phi: 1.0,
        max_phi: 6.0,
        min_radius: 2
    },
    // 'test': {
    //     up: [-0.102, -0.054, -0.993],
    //     target: [0.094, 0.574, 0.895],
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [6.52, 1.65, 7], //[theta, phi, radius],
    //     min_phi: 1.0,
    //     max_phi: 2.5,
    //     min_radius: 3.7
    // },
    'Hotwheel red': {
        up: [-0.058, 0.954, 0.294],
        target:  [-0.231,0.991,0.844], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [4.37, 1.98, 7], //[theta, phi, radius],
        min_phi: 1.8,
        max_phi: 2.5,
        min_radius: 3.7
    }, 
    'Hotwheel blue': {
        up: [0.010, 0.620, 0.784],
        target:  [0.373,1.331,1.886], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [3.12, 2.30, 9], //[theta, phi, radius],
        min_phi: 1.8,
        min_radius: 4.5
    },
    'Hotwheel yellow van': {
        up: [0.073, 0.920, 0.386],
        target:  [0.056,1.356,1.574], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [2.76, 2.03, 5], //[theta, phi, radius],
        min_phi: 1.8,
        max_phi: 2.5,
        min_radius: 4 
    },
    'Hotwheel blue - Higher detail (slower)': {
        up: [0.010, 0.620, 0.784],
        target:  [0.373,1.331,1.886], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [3.12, 2.30, 12], //[theta, phi, radius],
        min_phi: 1.9
    }, 
    'Hotwheel yellow van - Higher detail (slower)': {
        up: [0.073, 0.920, 0.386],
        target:  [0.056,1.356,1.574], 
        defaultCameraMode: 'orbit',
        size: '?',
        camera: [2.76, 2.03, 5], //[theta, phi, radius],
        min_phi: 1.8,
        max_phi: 2.5,
        min_radius: 4         
    },
    // 'Hotwheel yellow van cleaned': {
    //     up: [0.073, 0.920, 0.386],
    //     target:  [0.056,1.356,1.574], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [2.76, 2.03, 7], //[theta, phi, radius],
    //     min_phi: 1.8,
    //     max_phi: 2.5,
    //     min_radius: 4 
    // },
    // 'xsara carlos sainz': {
    //     up: [0.095, 0.862, 0.498],
    //     target:  [-0.642, 1.176, 1.681], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [4.1, 2.0, 7], //[theta, phi, radius],
    //     min_phi: 1.9,
    //     max_phi: 3.0,
    //     min_radius: 4 
    // },  
    // 'red_car_600imgs_90k': {
    //     up: [0.055, 0.946, 0.319],
    //     target:  [-0.231,0.991,0.844], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [4.37, 1.98, 4], //[theta, phi, radius],
    //     min_phi: 1.5
    // }, 
    // 'red_car': {
    //     up: [-0.080, 0.886, 0.458],
    //     target:  [0.215,1.786,0.964], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [-2.75, 1.80, 4], //[theta, phi, radius],
    //     min_phi: 1.75
    // },
    // 'blue_car': {
    //     up: [-0.014, 0.645, 0.764],
    //     target:  [-0.262,1.820,2.290],
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [9.54, 1.99, 4], //[theta, phi, radius],
    //     min_phi: 1.88  // It also accepts max_phi
    // },
    // 'bag': {
    //     up: [-0.131503164768219,0.36319607496261597,0.9223857522010803],
    //     target: [0.1269, 1.74, 1.89], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [4.77, 2.00, 4.5], //[theta, phi, radius],
    //     min_phi: 1.75
    // },
    // 'sneakers': {
    //     up: [-0.131, 0.1322, 0.982],
    //     target: [0.08796, 0.43057, 2.667364], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [2.815, 2.0, 4], //[theta, phi, radius],
    //     min_phi: 1.7,
    // },
    // 'camper': {
    //     up: [+0.52, -0.675, -0.5183],
    //     target: [-0.130, -0.0187, -0.53496], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [4.74, 2.05, 4], //[3.34, 1.64, 4], //[theta, phi, radius],
    // },
    // 'golf': {
    //     up: [0.009902715682983398,0.31472811102867126,0.9491302371025085],
    //     target: [-0.4284291777755183,0.515804616465936,2.933792871923287], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [4.63, 1.72, 5.5], //[3.34, 1.64, 4], //[theta, phi, radius],
    //     min_phi: 1.95
    // },
    // 'red car': {
    //     up: [-0.07178903371095657,0.8717256188392639,0.48470693826675415],
    //     target:  [0.3406993506200396,1.8151092300188236,0.9849917127819064], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [3.235, 1.95, 2.5], //[theta, phi, radius],
    //     min_phi: 1.75
    // },
    // 'blue car': {
    //     up: [ -0.056267619132995605,0.8368156552314758,0.544585645198822],
    //     target:  [-0.2549465228938901,2.529700795571348,1.3776932680297473], 
    //     defaultCameraMode: 'orbit',
    //     size: '?',
    //     camera: [11, 2, 4], //[theta, phi, radius],
    //     min_phi: 1.75
    // }
}
