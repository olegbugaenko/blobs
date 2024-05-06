import {GameModule} from "../../shared/game-module";
import {MapViewport} from "./map-viewport";
import {Grid} from "./grid";
import {SeededRandom} from "../../shared/seed";

export class Decorations extends GameModule {
    constructor(gameMap) {
        if(Decorations.instance) {
            return Decorations.instance;
        }
        super();
        const baseSeed = gameMap.seed;
        this.gameMap = gameMap;
        Decorations.instance = this;
        this.seedGen = new SeededRandom(gameMap.seed)
        this.baseSeed = baseSeed;
        // this.cellSize = 100; // Size of the grid cell
        this.currentCells = new Map();
        this.decorations = {};
        this.grid = new Grid();
    }

    getCellSeed(x, y) {
        // Hash function to combine base seed with cell coordinates
        return this.baseSeed + "_" + x + "_" + y;
    }

/*
    updateCameraPosition(cameraPosition) {
        // Determine the grid cells the camera sees
        const minX = Math.floor(cameraPosition.x / this.cellSize);
        const minY = Math.floor(cameraPosition.z / this.cellSize);
        const maxX = minX + 1; // Assuming the camera sees at least 2x2 cells
        const maxY = minY + 1;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                if (!this.currentCells.has(key)) {
                    this.generateObjectsForCell(x, y);
                }
            }
        }

        // Optionally, remove objects not in the visible range anymore
        this.currentCells.forEach((value, key) => {
            if (!this.isCellInView(key, minX, maxX, minY, maxY)) {
                this.removeObjectsFromCell(key);
            }
        });
    }
*/

    generateObjectsForCell(x, y) {
        const seed = this.getCellSeed(x, y);
        const rand = new SeededRandom(seed);
        const objects = [];
        const count = rand.nextInt(0, 1); // Random number of objects
        // console.log('Amount to generate: ', count, rand.seed);

        for (let i = 0; i < count; i++) {
            const localX = rand.nextDouble() * this.grid.cellSize;
            const localY = rand.nextDouble() * this.grid.cellSize;
            const angle = rand.nextDouble() * 2 * Math.PI;
            const type = rand.nextInt(0, 5); // Assuming some object types

            // Create and place your object in the scene
            objects.push({
                id: `${Math.random()*100000000}`,
                x: localX + x * this.grid.cellSize,
                y: localY + y * this.grid.cellSize,
                z: 0,
                angle,
                type
            });
        }

        for(const deco of objects) {
            this.addDecoration(deco);
        }

        return objects;
        // this.currentCells.set(`${x},${y}`, objects);
    }

    addDecoration(decoration) {
        const grid = new Grid();
        this.decorations[decoration.id] = decoration;
        grid.addDecoration(decoration);
    }

    removeAll() {
        Object.values(this.decorations).forEach(decoration => {
            this.removeObject(decoration);
        })
    }

    removeObjectsFromCell(key) {
        // Remove objects from the scene
        const objects = this.currentCells.get(key);
        objects.forEach(obj => obj.removeFromScene());
        this.currentCells.delete(key);
    }

    removeObject(decoration) {
        this.grid.removeDecoration(decoration);
        delete this.decorations[decoration.id];
    }

    isCellInView(key, minX, maxX, minY, maxY) {
        const [x, y] = key.split(',').map(Number);
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    process(dT) {


        const viewPort = new MapViewport();

        const visibleIds = this.grid.getNearbyDecorations(viewPort.getCameraCoords().x, viewPort.getCameraCoords().y, 4);

        if(viewPort.shouldRegenerateSeeded) {
            console.log('Regenerating decors: ', this.decorations);
            // const nearbyCellsToRegenerate = this.grid.getNearbyCells(viewPort.position.position.x, viewPort.position.position.y, 4);

            for (const decorId of Object.keys(this.decorations)) {
                if (!visibleIds.includes(decorId)) {
                    this.removeObject(this.decorations[decorId]);
                }
            }
            console.log('Deleted decors: ', this.decorations, viewPort.getCameraCoords());

            // Generate objects for cells within the viewport
            this.grid.getNearbyCells(viewPort.getCameraCoords().x, viewPort.getCameraCoords().y, 4).forEach(({ row, col, decorations }) => {
                if(!decorations.length) {
                    const objs = this.generateObjectsForCell(col, row);
                    visibleIds.push(...objs.map(({ id }) => id));
                }
            });

            console.log('Regenerated: ', this.decorations, visibleIds);

        }

        if(!viewPort.shouldSend('decorations') && !viewPort.shouldRegenerateSeeded) return;
        const visibleDecorations = visibleIds.map(id => this.decorations[id]);
        console.log('Sending decors: ', visibleDecorations, viewPort.getCameraCoords());
        this.eventHandler.sendData('decorations-coordinates', {
            decorations: visibleDecorations.map(decoration => ({
                id: decoration.id,
                x: decoration.x,
                y: decoration.y,
                displayX: decoration.x - this.gameMap.map.width / 2,
                displayY: decoration.y - this.gameMap.map.height / 2,
                displayZ: this.gameMap.getZByXY(decoration.x, decoration.y),
                type: decoration.type,
                angle: decoration.angle,
            }))
        });
        viewPort.setStaticsSent('decorations');
        viewPort.shouldRegenerateSeeded = false;
    }
}
