const data = {}
let gaussians
let depthIndex
let isAvatar

onmessage = function(event) {
    // Init web worker event
    if (event.data.gaussians) {
        // If here, we have received a new static scene or a new frame in a dynamic video
        gaussians = event.data.gaussians
        gaussians.totalCount = gaussians.count

        depthIndex = new Uint32Array(gaussians.count)

        // console.log(`[Worker] Received ${gaussians.count} gaussians`)

        data.positions = new Float32Array(gaussians.count * 3)
        data.colors = new Float32Array(gaussians.count * 3)
        data.opacities = new Float32Array(gaussians.count)
        data.cov3Da = new Float32Array(gaussians.count * 3)
        data.cov3Db = new Float32Array(gaussians.count * 3)    

        // If no opacities are provided, we can infer that the data is for an avatar
        // this is a bit hacky, I guess ideally we would pass a variable declaring whether
        // the data is for an avatar or not
        if (!gaussians.opacities) {
            isAvatar = true
        }
        else {
            isAvatar = false
        } 
    
    }
    // Sort gaussians event
    else if (event.data.viewMatrix) {
        const { viewMatrix, maxGaussians, sortingAlgorithm } = event.data

        
        gaussians.count = Math.min(gaussians.totalCount, maxGaussians)
        
        // Sort the gaussians!
        let start = performance.now()
        sortGaussiansByDepth(depthIndex, gaussians, viewMatrix, sortingAlgorithm)
        const sortTime = `${((performance.now() - start)/1000).toFixed(3)}s`
        console.log(`[Worker] Sorted ${gaussians.count} gaussians in ${sortTime}. Algorithm: ${sortingAlgorithm}`)

        n_sh_coeffs = event.data.n_sh_coeffs
        
        start = performance.now()

        // Update arrays containing the data
        for (let j = 0; j < gaussians.count; j++) {
            const i = depthIndex[j]
            if (n_sh_coeffs > 3) {
                campos = { x: event.data.campos[0], y: event.data.campos[1], z: event.data.campos[2]}
                colors = computeColorFromSH(i, n_sh_coeffs, gaussians.positions, campos, gaussians.harmonics)
            }
            else {
                colors = { x: gaussians.colors[i*3], y: gaussians.colors[i*3+1], z: gaussians.colors[i*3+2] }
            }
            data.colors[j*3] = colors.x
            data.colors[j*3+1] = colors.y
            data.colors[j*3+2] = colors.z

            data.positions[j*3] = gaussians.positions[i*3]
            data.positions[j*3+1] = gaussians.positions[i*3+1]
            data.positions[j*3+2] = gaussians.positions[i*3+2]

            let cov3Ds;
            if (isAvatar) {
                data.opacities[j] = 1.0
                scale = gaussians.scales[i]
                // This is the upper triangle of teh Cov matrix when the scale is constant
                // and the rotation is the identity
                cov3Ds = new Float32Array([scale**2, 0, 0, scale**2, 0, scale**2])
            }
            else {
                data.opacities[j] = gaussians.opacities[i]
                cov3Ds = gaussians.cov3Ds.slice(i*6, i*6+6)
            }

            // Split the covariance matrix into two vec3
            // so they can be used as vertex shader attributes
            data.cov3Da[j*3] = cov3Ds[0] //gaussians.cov3Ds[i*6]
            data.cov3Da[j*3+1] = cov3Ds[1] //gaussians.cov3Ds[i*6+1]
            data.cov3Da[j*3+2] = cov3Ds[2] //gaussians.cov3Ds[i*6+2]

            data.cov3Db[j*3] = cov3Ds[3] //gaussians.cov3Ds[i*6+3]
            data.cov3Db[j*3+1] = cov3Ds[4] //gaussians.cov3Ds[i*6+4]
            data.cov3Db[j*3+2] = cov3Ds[5] //gaussians.cov3Ds[i*6+5]
        }

        const reindexTime = `${((performance.now() - start)/1000).toFixed(3)}s`
        console.log(`[Worker] Re-indexed ${gaussians.count} gaussians in ${reindexTime}. Algorithm: ${sortingAlgorithm}`)

        postMessage({
            data, sortTime,
        })
    }
}

function sortGaussiansByDepth(depthIndex, gaussians, viewMatrix, sortingAlgorithm) {
    const calcDepth = (i) => gaussians.positions[i*3] * viewMatrix[2] +
                             gaussians.positions[i*3+1] * viewMatrix[6] +
                             gaussians.positions[i*3+2] * viewMatrix[10]

    // Default javascript sort [~0.9s]
    if (sortingAlgorithm == 'Array.sort') {
        const indices = new Array(gaussians.count)
            .fill(0)
            .map((_, i) => ({
                depth: calcDepth(i),
                index: i
            }))
            .sort((a, b) => a.depth - b.depth)
            .map(v => v.index)

        depthIndex.set(indices)
    }
    // Quick sort algorithm (Hoare partition scheme) [~0.4s]
    else if (sortingAlgorithm == 'quick sort') {
        const depths = new Float32Array(gaussians.count)

        for (let i = 0; i < gaussians.count; i++) {
            depthIndex[i] = i
            depths[i] = calcDepth(i)
        }

        quicksort(depths, depthIndex, 0, gaussians.count - 1)
    }
    // 16 bit single-pass counting sort [~0.3s]
    // https://github.com/antimatter15/splat
    else if (sortingAlgorithm == 'count sort') {
        let maxDepth = -Infinity;
        let minDepth = Infinity;
        let sizeList = new Int32Array(gaussians.count);

        for (let i = 0; i < gaussians.count; i++) {
            const depth = (calcDepth(i) * 4096) | 0

            sizeList[i] = depth
            maxDepth = Math.max(maxDepth, depth)
            minDepth = Math.min(minDepth, depth)
        }
        
        let depthInv = (256 * 256) / (maxDepth - minDepth);
        let counts0 = new Uint32Array(256*256);
        for (let i = 0; i < gaussians.count; i++) {
            sizeList[i] = ((sizeList[i] - minDepth) * depthInv) | 0;
            counts0[sizeList[i]]++;
        }
        let starts0 = new Uint32Array(256*256);
        for (let i = 1; i < 256*256; i++) starts0[i] = starts0[i - 1] + counts0[i - 1];
        for (let i = 0; i < gaussians.count; i++) depthIndex[starts0[sizeList[i]]++] = i;
    }
}

// Quicksort algorithm - https://en.wikipedia.org/wiki/Quicksort#Hoare_partition_scheme
function quicksort(A, B, lo, hi) {
    if (lo < hi) {
        const p = partition(A, B, lo, hi) 
        quicksort(A, B, lo, p)
        quicksort(A, B, p + 1, hi) 
    }
}
function partition(A, B, lo, hi) {
    const pivot = A[Math.floor((hi - lo)/2) + lo]
    let i = lo - 1 
    let j = hi + 1
  
    while (true) {
        do { i++ } while (A[i] < pivot)
        do { j-- } while (A[j] > pivot)
    
        if (i >= j) return j
        
        let tmp = A[i]; A[i] = A[j]; A[j] = tmp // Swap A
            tmp = B[i]; B[i] = B[j]; B[j] = tmp // Swap B
    }    
}

function computeColorFromSH(idx, n_sh_coeffs, means, campos, shs) {
    // Assuming means, campos, and shs are arrays of {x, y, z}
    // Vector subtraction to get direction
    SH_C0 = 0.28209479177387814
    SH_C1 = 0.4886025119029199
    SH_C2 = [1.0925484305920792, -1.0925484305920792, 0.31539156525252005, -1.0925484305920792, 0.5462742152960396]
    SH_C3 = [-0.5900435899266435, 2.890611442640554, -0.4570457994644658, 0.3731763325901154, -0.4570457994644658, 1.445305721320277, -0.5900435899266435]

    let dir = {
        x: means[idx*3] - campos.x,
        y: means[idx*3 + 1] - campos.y,
        z: means[idx*3 + 2] - campos.z
    };

    // Function to calculate vector length
    function length(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    // Normalize the direction vector
    let dirLength = length(dir);
    dir = {
        x: dir.x / dirLength,
        y: dir.y / dirLength,
        z: dir.z / dirLength
    };

    // Accessing spherical harmonics coefficients
    let sh = [];
    for (let i = 0; i < n_sh_coeffs / 3 ; i++) {
        sh.push([shs[idx*n_sh_coeffs + i*3],
                shs[idx*n_sh_coeffs + i*3 + 1],
                shs[idx*n_sh_coeffs + i*3 + 2]
        ]);
    }
    result = sh[0].map(el => el * SH_C0);

    // Further calculations based on the degree of spherical harmonics
    
    if (n_sh_coeffs > 3) { // degree > 0
        let x = dir.x;
        let y = dir.y;
        let z = dir.z;
    
        result = result.map((el, i) => 
            el 
            - sh[1].map(el => el * SH_C1 * y)[i]
            - sh[2].map(el => el * SH_C1 * z)[i] 
            - sh[3].map(el => el * SH_C1 * x)[i]
        )

        if (n_sh_coeffs > 12) { // degree > 1
            xx = x * x, yy = y * y, zz = z * z
            xy = x * y, yz = y * z, xz = x * z
            result = result.map((el, i) => 
                el 
                + SH_C2[0] * xy * sh[4][i]
                + SH_C2[1] * yz * sh[5][i]
                + SH_C2[2] * (2.0 * zz - xx - yy) * sh[6][i]
                + SH_C2[3] * xz * sh[7][i]
                + SH_C2[4] * (xx - yy) * sh[8][i]
            )
            if (n_sh_coeffs > 27) { // degree > 2
                result = result.map((el, i) =>
                    el 
                    + SH_C3[0] * y * (3.0 * xx - yy) * sh[9][i]
                    + SH_C3[1] * xy * z * sh[10][i]
                    + SH_C3[2] * y * (4.0 * zz - xx - yy) * sh[11][i]
                    + SH_C3[3] * z * (2.0 * zz - 3.0 * xx - 3.0 * yy) * sh[12][i]
                    + SH_C3[4] * x * (4.0 * zz - xx - yy) * sh[13][i]
                    + SH_C3[5] * z * (xx - yy) * sh[14][i]
                    + SH_C3[6] * x * (xx - 3.0 * yy) * sh[15][i]
                )

            }
        }
    }

    // Adding 0.5 to the result (assuming vector addition)
    result = { x: result[0] + 0.5, y: result[1] + 0.5, z: result[2] + 0.5 };

    // Clamp it to 0:
    result.x = Math.max(result.x, 0);
    result.y = Math.max(result.y, 0);
    result.z = Math.max(result.z, 0);

    return result;
}