import {GameModule} from "../../shared/game-module";
import {Blobs} from "./blobs";
import {Food} from "./food";
import {Grid} from "./grid";
import {Tree} from "./trees";
import {MapViewport} from "./map-viewport";
import {applyGaussianBlur} from "../../shared/terrain-utils";
import {Decorations} from "./decorations";
import {SeededRandom} from "../../shared/seed";

export class GameMap extends GameModule {

    map = null;

    instance;

    isRunningMap = false;

    constructor() {
        if(GameMap.instance) {
            return GameMap.instance;
        }
        super();
        this.seed = '';
        this.blobs = new Blobs(this);
        this.food = new Food(this);
        this.tree = new Tree(this);
        this.grid = new Grid();
        this.decorations = new Decorations(this);
        this.mapViewport = new MapViewport();
        this.eventHandler.registerHandler('init-map', (payload) => {
            // TODO: Check if load existing
            let isNewMap = false;
            if(!this.seed) {
                isNewMap = true;
                this.seed = this.initializeRandomSeed();
                console.log('Creating new Map');
                this.map = {
                    width: payload.width || 100,
                    height: payload.height || 100,
                    pointsPerSample: 20,
                    samplesPerChunk: 5
                }
            }

            console.log('Generate heights');
            this.generateHeights();
            console.log('Heights generated', this.map.heightsData);
            const mapSize = this.map.width * this.map.height;
            new Grid().init(25, this.map.width, this.map.height);
            this.mapViewport.init(this.map);
            console.log('Map initialized: ', payload);
            this.postMap();
            if(isNewMap) {
                this.blobs.seedLife(10, this.map);
                this.food.seedFood(mapSize / 3000, this.map);
            } else {
                console.log('Using values from previously loaded map');
            }
            this.tree.seedTree(mapSize / 1000, this.map);
            // this.tree.addTree(4512, 5155, this.map);
        })
        GameMap.instance = this;
    }

    initializeRandomSeed() {
        return `${Math.random()*1000000000}`;
    }

    generateHeights(maxH = 50) {
        const numW = this.map.width / this.map.pointsPerSample;
        const numH = this.map.height / this.map.pointsPerSample;
        this.map.heights = [];
        this.map.widthSegments = numW;
        this.map.depthSegments = numH;
        this.map.chunkSize = this.map.samplesPerChunk;
        this.map.numChunksWidth = numW / this.map.samplesPerChunk;
        this.map.numChunksHeight = numH / this.map.samplesPerChunk;
        console.log('numH vs numW: ', numH, numW);
        this.map.heightsData = {};
        const rand = new SeededRandom(this.seed);

        // Initialize a full height map
        let fullHeightMap = {};
        for (let x = 0; x < numW; x++) {
            for (let y = 0; y < numH; y++) {
                fullHeightMap[`${x *  this.map.pointsPerSample},${y *  this.map.pointsPerSample}`] = rand.nextDouble() * maxH;
            }
        }

        fullHeightMap = applyGaussianBlur(fullHeightMap, numW, numH, this.map.pointsPerSample);

        // Create chunks using the full height map
        for(let ci = 0; ci < this.map.numChunksHeight; ci++) {
            for(let cj = 0; cj < this.map.numChunksWidth; cj++) {
                const chX = cj * this.map.samplesPerChunk *  this.map.pointsPerSample;
                const chY = ci * this.map.samplesPerChunk *  this.map.pointsPerSample;
                const chKey = `${chX},${chY}`;
                this.map.heightsData[chKey] = {
                    x: chX + this.map.samplesPerChunk *  this.map.pointsPerSample / 2,
                    y: chY + this.map.samplesPerChunk *  this.map.pointsPerSample / 2,
                    key: chKey,
                    width: this.map.samplesPerChunk *  this.map.pointsPerSample,
                    height: this.map.samplesPerChunk *  this.map.pointsPerSample,
                    map: {}
                };

                for (let i = 0; i <= this.map.samplesPerChunk; i++) {
                    for (let j = 0; j <= this.map.samplesPerChunk; j++) {
                        const xCoord = chX + j * this.map.pointsPerSample;
                        const yCoord = chY + i * this.map.pointsPerSample;
                        const z = fullHeightMap[`${xCoord},${yCoord}`];
                        this.map.heightsData[chKey].map[`${j * this.map.pointsPerSample},${i * this.map.pointsPerSample}`] = z;
                        if (i < this.map.samplesPerChunk && j < this.map.samplesPerChunk) {
                            this.map.heights.push({ x: xCoord, y: z, z: yCoord });
                        }
                    }
                }
            }
        }
    }

    getZByXY(x, y) {
        if (!this.map || !this.map.heightsData) return 0;

        // Constants: Adjust these as per your actual setup
        const chunkSize = this.map.pointsPerSample * this.map.samplesPerChunk;

        // Calculate which chunk the point falls into
        const chunkX = Math.floor(x / chunkSize);
        const chunkY = Math.floor(y / chunkSize);
        const chunkKey = `${chunkX * chunkSize},${chunkY * chunkSize}`;

        // Retrieve the chunk from the stored data
        const chunk = this.map.heightsData[chunkKey];
        if (!chunk) {
            console.error('No chunk found for the given coordinates.', chunkKey);
            return 0; // Or any other default value
        }

        // Calculate local coordinates within the chunk
        const localX = x - chunkX * chunkSize;
        const localY = y - chunkY * chunkSize;

        // Retrieve the nearest grid points for interpolation
        // Ensuring that we do not exceed the boundaries of the chunk
        const baseX = Math.floor(localX / this.map.pointsPerSample) * this.map.pointsPerSample;
        const baseY = Math.floor(localY / this.map.pointsPerSample) * this.map.pointsPerSample;
        const nextX = Math.min(baseX + this.map.pointsPerSample, chunk.width);
        const nextY = Math.min(baseY + this.map.pointsPerSample, chunk.height);

        // Get the heights from the four nearest corner points
        const Q11 = chunk.map[`${baseX},${baseY}`]; // Bottom-left
        const Q21 = chunk.map[`${nextX},${baseY}`]; // Bottom-right
        const Q12 = chunk.map[`${baseX},${nextY}`]; // Top-left
        const Q22 = chunk.map[`${nextX},${nextY}`]; // Top-right

        // Calculate the relative positions within the cell
        const dx = (localX - baseX) / this.map.pointsPerSample;
        const dy = (localY - baseY) / this.map.pointsPerSample;

        // Perform bilinear interpolation
        const interpolatedHeight = (Q11 * (1 - dx) * (1 - dy)) +
            (Q21 * dx * (1 - dy)) +
            (Q12 * (1 - dx) * dy) +
            (Q22 * dx * dy);

        if (isNaN(interpolatedHeight)) {
            console.warn(`Interpolated height is NaN. Check data points: Q11=${Q11}, Q21=${Q21}, Q12=${Q12}, Q22=${Q22}`);
        }

        return interpolatedHeight || 0;
    }



    postMap() {
        this.eventHandler.sendData('map-data', {...this.map, heightsData: undefined, heights: undefined})
    }

    displayTerrain() {
        if(!this.map.heightsData) return;
        const viewPort = new MapViewport();

        // if(!)

        if(viewPort.shouldSend('terrain')) {
            const terrainChunks = Object.values(this.map.heightsData);

            const terrainArr = viewPort.filterVisible(terrainChunks, 1000, 2);
            this.eventHandler.sendData('map-heights', { terrain: terrainArr.map(terrain => ({
                    ...terrain,
                    displayX: terrain.x - this.map.width / 2,
                    displayY: terrain.y - this.map.height / 2,
                }))
            })
            viewPort.setStaticsSent('terrain');
        }

    }

    tick(dT) {
        if(this.map) {
            this.blobs.tick(dT);
            this.tree.tick(dT);
            this.food.tick(dT);

        }
    }

    process(dT) {
        if(this.map) {
            const now = performance.now();
            this.blobs.process(dT);
            this.food.process(dT);
            this.decorations.process(dT);
            this.displayTerrain();
            const n2 = performance.now();
            console.log('TTP: ', n2 - now);

            const minimap = this.grid.generateMiniMap(100, this.mapViewport.position?.target);
            this.eventHandler.sendData('minimap', minimap);
        }
    }

    saveMap() {
        const saveObject = {};

        saveObject.blobs = this.blobs.saveBlobs();
        saveObject.food = this.food.saveFood();
        saveObject.view = this.mapViewport.saveView();
        saveObject.seed = this.seed;
        saveObject.mapProps = {
            ...this.map,
            heightsData: undefined,
            heights: undefined
        };
        return saveObject;
    }

    loadMap(obj) {
        this.blobs.loadBlobs(obj.blobs);
        this.food.loadFood(obj.food);
        this.tree.removeAll();
        this.decorations.removeAll();
        this.mapViewport.loadView(obj.view);
        this.seed = obj.seed;
        this.map = obj.mapProps;
    }

}