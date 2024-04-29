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
            Array.from({ length: Math.ceil(height / cellSize) }, (it2, row) => ({ col, row, blobs: [], food: [], trees: [] }))
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

    removeBlob(blob) {
        const { x, y, id } = blob;
        const cell = this.getCell(x, y);
        cell.blobs = cell.blobs.filter(blobId => blobId !== id);
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

    moveBlob(blob) {
        try {
            const newCell = this.getCell(blob.x, blob.y);
            const oldCell = blob.cell;
            if(newCell !== oldCell) {
                const removed = this.removeBlob(blob);
                this.addBlob(blob);
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
}