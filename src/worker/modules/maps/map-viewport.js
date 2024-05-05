import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid";

export class MapViewport extends GameModule {

    position;
    map;
    staticsToSend = {};
    shouldRegenerateSeeded = false;

    constructor() {
        if(MapViewport.instance) {
            return MapViewport.instance;
        }
        super();
        MapViewport.instance = this;
        this.isUIReady = false;
        this.eventHandler.registerHandler('camera-position', payload => {
            console.log('cam: ', payload);
            this.position = payload;
            if(!this.isUIReady) {
                return;
            }
            this.staticsToSend = {
                trees: true,
                food: true,
                terrain: true,
                decorations: true,
            }
            this.shouldRegenerateSeeded = true;
        })
        this.eventHandler.registerHandler('assets-loaded', payload => {
            this.isUIReady = true;
            this.staticsToSend = {
                trees: true,
                food: true,
                terrain: true,
            }
            this.shouldRegenerateSeeded = true;
        })
    }

    init(map) {
        this.map = map;
        this.staticsToSend = {

        }
        this.shouldRegenerateSeeded = false;
    }

    checkVisibility(object) {
        const MAX_DISTANCE = 500;
        if(!this.position || !this.map) {
            return [];
        }
        const cameraPosition = this.position.position;
        const cameraTarget = this.position.target;

        const dx = object.x - cameraTarget.x - this.map.width / 2;
        const dy = object.y - cameraTarget.z - this.map.height / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= MAX_DISTANCE;
    }

    getCameraCoords() {
        if(!this.position?.target) {
            return {
                x: this.map.width / 2,
                y: this.map.height / 2
            }
        }
        return {
            x: this.position?.target.x + this.map.width / 2,
            y: this.position?.target.z + this.map.height / 2
        }
    }

    filterVisible(objects, thsh = 500, mult = 1) {
        const MAX_DISTANCE = thsh;
        const rdist = Math.min(MAX_DISTANCE, 50*mult / this.position.zoom);
        if(!this.position || !this.map) {
            return [];
        }
        const cameraPosition = this.position.position;
        const cameraTarget = this.position.target;
        return objects.filter(object => {
            const dx = object.x - cameraTarget.x - this.map.width / 2;
            const dy = object.y - cameraTarget.z - this.map.height / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= rdist;
        })
    }

    setStaticsSent(key) {
        this.staticsToSend[key] = false;
    }

    setSeededRegenerated() {
        this.shouldRegenerateSeeded = false;
    }

    shouldSend(key) {
        return this.staticsToSend[key];
    }

    saveView() {
        return {
            camera: this.position,
        }
    }

    loadView(obj) {
        this.position = obj.camera;
    }

}