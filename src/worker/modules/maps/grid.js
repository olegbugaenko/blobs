import {GameModule} from "../../shared/game-module";

export class Grid extends GameModule {

    constructor() {
        if(Grid.instance) {
            return Grid.instance;
        }
        super();
        Grid.instance = this;

    }

    init(cellSize, width, height) {
        this.cellSize = cellSize;
        this.numCols = width / cellSize;
        this.numRows = height / cellSize;
        this.cells = Array.from({ length: Math.ceil(width / cellSize) }, (item, col) =>
            Array.from({ length: Math.ceil(height / cellSize) }, (it2, row) => ({ col, row, blobs: [], food: [], trees: [], decorations: [] }))
        );
    }

    addBlob(blob) {
        const { x, y, id } = blob;
        const cell = this.getCell(x, y);
        cell.blobs.push(id);
        blob.cell = cell;
    }

    addFood(food) {
        const { x, y, id } = food;
        const cell = this.getCell(x, y);
        cell.food.push(id);
        food.cell = cell;
    }

    addTree(tree) {
        const { x, y, id } = tree;
        const cell = this.getCell(x, y);
        cell.trees.push(id);
        tree.cell = cell;
    }

    addDecoration(decoration) {
        const { x, y, id } = decoration;
        const cell = this.getCell(x, y);
        cell.decorations.push(id);
        decoration.cell = cell;
    }

    removeBlob(blob) {
        const { x, y, id } = blob;
        // const cell = this.getCell(x, y);
        blob.cell.blobs = blob.cell.blobs.filter(blobId => blobId !== id);
        return blob;
    }

    removeFood(food) {
        const { x, y, id } = food;
        const cell = this.getCell(x, y);
        cell.food = cell.food.filter(foodId => foodId !== id);
    }

    removeTree(tree) {
        const { x, y, id } = tree;
        const cell = this.getCell(x, y);
        cell.trees = cell.trees.filter(treeId => treeId !== id);
    }

    removeDecoration(decoration) {
        const {x, y, id} = decoration;
        const cell = this.getCell(x, y);
        cell.decorations = cell.decorations.filter(decorationId => decorationId !== id);
    }

    clearCellDecorations(cell) {
        cell.decorations = [];
    }

    moveBlob(blob) {
        try {
            const newCell = this.getCell(blob.x, blob.y);
            const oldCell = blob.cell;
            if(newCell !== oldCell) {
                //console.log(`BlobMoved ${blob.id}: `, oldCell, newCell);
                const removed = this.removeBlob(blob);
                this.addBlob(blob);
                // console.log(`AfterBlobMoved ${blob.id}: `, blob.cell, oldCell);
            }
        } catch (e) {
            console.warn('Invalid cell: ', blob, this.cells.length, Math.floor(blob.x / this.cellSize), this.cells[Math.floor(blob.x / this.cellSize)]);
        }

    }

    getCell(x, y) {
        if(x < 0) {
            x = 0;
        }
        if( y < 0 ) {
            y = 0;
        }
        if(x >= this.numCols * this.cellSize) {
            x = (this.numCols - 0.5) * this.cellSize;
        }
        if(y >= this.numRows * this.cellSize) {
            y = (this.numRows - 0.5) * this.cellSize;
        }
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        return this.cells[col][row];
    }

    // To find nearby food
    getNearbyFood(x, y, range) {
        const nearby = [];
        const baseCol = Math.floor(x / this.cellSize);
        const baseRow = Math.floor(y / this.cellSize);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const col = baseCol + dx;
                const row = baseRow + dy;
                if (col >= 0 && col < this.cells.length && row >= 0 && row < this.cells[col].length) {
                    nearby.push(...this.cells[col][row].food);
                }
            }
        }
        return nearby;
    }

    getNearbyBlob(x, y, range) {
        const nearby = [];
        const baseCol = Math.floor(x / this.cellSize);
        const baseRow = Math.floor(y / this.cellSize);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const col = baseCol + dx;
                const row = baseRow + dy;
                if (col >= 0 && col < this.cells.length && row >= 0 && row < this.cells[col].length) {
                    nearby.push(...this.cells[col][row].blobs);
                }
            }
        }
        return nearby;
    }

    getNearbyTree(x, y, range) {
        const nearby = [];
        const baseCol = Math.floor(x / this.cellSize);
        const baseRow = Math.floor(y / this.cellSize);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const col = baseCol + dx;
                const row = baseRow + dy;
                if (col >= 0 && col < this.cells.length && row >= 0 && row < this.cells[col].length) {
                    nearby.push(...this.cells[col][row].trees);
                }
            }
        }
        return nearby;
    }

    getNearbyDecorations(x, y, range) {
        const nearby = [];
        const baseCol = Math.floor(x / this.cellSize);
        const baseRow = Math.floor(y / this.cellSize);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const col = baseCol + dx;
                const row = baseRow + dy;
                if (col >= 0 && col < this.cells.length && row >= 0 && row < this.cells[col].length) {
                    nearby.push(...this.cells[col][row].decorations);
                }
            }
        }
        return nearby;
    }

    getNearbyCells(x, y, range) {
        const nearby = [];
        const baseCol = Math.floor(x / this.cellSize);
        const baseRow = Math.floor(y / this.cellSize);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const col = baseCol + dx;
                const row = baseRow + dy;
                if (col >= 0 && col < this.cells.length && row >= 0 && row < this.cells[col].length) {
                    nearby.push({ row, col, decorations: this.cells[col][row].decorations });
                }
            }
        }

        return nearby;
    }

    getCellsAdjucentToBlobs(range = 3) {
        const nearbySet = new Set();
        for (let col = 0; col < this.cells.length; col++) {
            for (let row = 0; row < this.cells[col].length; row++) {
                if (this.cells[col][row].blobs.length > 0) {
                    nearbySet.add(this.cells[col][row]);
                } else {
                    // Check adjacent cells within the specified range
                    for (let i = -range; i <= range; i++) {
                        for (let j = -range; j <= range; j++) {
                            const adjCol = col + i;
                            const adjRow = row + j;
                            if (
                                adjCol >= 0 &&
                                adjCol < this.cells.length &&
                                adjRow >= 0 &&
                                adjRow < this.cells[adjCol].length &&
                                this.cells[adjCol][adjRow].blobs.length > 0
                            ) {
                                nearbySet.add(this.cells[adjCol][adjRow]);
                            }
                        }
                    }
                }
            }
        }
        // Convert the set back to an array before returning
        return [...nearbySet];
    }



    generateMiniMap(size = 100, cameraTarget = { x: 0, y: 0, z: 0}) {
        const grid = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => ({ blobs: 0 }))
        );

        let totalBlobs = 0;

        // Count blobs in each cell
        this.cells.forEach(row => {
            row.forEach(cell => {
                const numBlobs = cell.blobs.length;
                totalBlobs += numBlobs;
                const miniMapX = Math.floor(cell.col * size / this.numCols);
                const miniMapY = Math.floor(cell.row * size / this.numRows);
                grid[miniMapX][miniMapY].blobs += numBlobs;
                /*if(numBlobs > 0) {
                    console.log('MM: ', miniMapX, miniMapY, numBlobs, cell.blobs);
                }*/

            });
        });

        // Calculate camera position
        const cameraX = Math.floor((size/2) + (cameraTarget.x / (this.numCols*this.cellSize)) * size);
        const cameraY = Math.floor((size/2) + (cameraTarget.z / (this.numRows*this.cellSize)) * size);

        return {
            grid,
            camera: { x: cameraX, y: cameraY },
            size,
            totalBlobs
        };
    }

}