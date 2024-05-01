import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid";

export class MapViewport extends GameModule {

    position;
    map;
    staticsToSend = {};

    constructor() {
        if(MapViewport.instance) {
            return MapViewport.instance;
        }
        super();
        MapViewport.instance = this;
        this.eventHandler.registerHandler('camera-position', payload => {
            console.log('cam: ', payload);
            this.position = payload;
            this.staticsToSend = {
                trees: true,
                food: true,
            }
        })
    }

    init(map) {
        this.map = map;
        this.staticsToSend = {

        }
    }

    filterVisible(objects) {
        const MAX_DISTANCE = 500;
        if(!this.position || !this.map) {
            return [];
        }
        const cameraPosition = this.position.position;
        const cameraTarget = this.position.target;
        return objects.filter(object => {
            const dx = object.x - cameraPosition.x - this.map.width / 2;
            const dy = object.y - cameraPosition.y - this.map.height / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= MAX_DISTANCE;
        })
    }

    setStaticsSent(key) {
        this.staticsToSend[key] = false;
    }

    shouldSend(key) {
        return this.staticsToSend[key];
    }

}