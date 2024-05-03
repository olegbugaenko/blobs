export function applyGaussianBlur(fullHeightMap, numW, numH, pointsPerSample) {
    const kernelSize = 3;  // 3x3 kernel
    const sigma = 1.0;     // Standard deviation for Gaussian distribution
    const kernel = createGaussianKernel(kernelSize, sigma);

    const newHeightMap = {};

    for (let x = 0; x < numW; x++) {
        for (let y = 0; y < numH; y++) {
            const weightedSum = applyKernel(x, y, numW, numH, fullHeightMap, kernel, pointsPerSample);
            const currentKey = `${x * pointsPerSample},${y * pointsPerSample}`;
            newHeightMap[currentKey] = weightedSum;
        }
    }

    return newHeightMap;
}

function createGaussianKernel(size, sigma) {
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;

    for (let x = 0; x < size; x++) {
        kernel[x] = [];
        for (let y = 0; y < size; y++) {
            const xDistance = x - center;
            const yDistance = y - center;
            const value = Math.exp(-(xDistance * xDistance + yDistance * yDistance) / (2 * sigma * sigma));
            kernel[x][y] = value;
            sum += value;
        }
    }

    // Normalize the kernel
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            kernel[x][y] /= sum;
        }
    }

    return kernel;
}

function applyKernel(x, y, numW, numH, heightMap, kernel, pointsPerSample) {
    let weightedSum = 0;
    const kernelSize = kernel.length;
    const center = Math.floor(kernelSize / 2);

    for (let i = 0; i < kernelSize; i++) {
        for (let j = 0; j < kernelSize; j++) {
            const nx = x + (i - center);
            const ny = y + (j - center);
            if (nx >= 0 && nx < numW && ny >= 0 && ny < numH) {
                const key = `${nx * pointsPerSample},${ny * pointsPerSample}`;
                const height = heightMap[key];
                weightedSum += height * kernel[i][j];
            }
        }
    }

    return weightedSum;
}
