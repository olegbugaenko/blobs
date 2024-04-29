import {GameModule} from "../../shared/game-module";
import {Blobs} from "./blobs";
import {Food} from "./food";
import {Grid} from "./grid";
import {Tree} from "./trees";

export class GameMap extends GameModule {

    map = null;

    instance;

    constructor() {
        if(GameMap.instance) {
            return GameMap.instance;
        }
        super();
        this.blobs = new Blobs();
        this.food = new Food();
        this.tree = new Tree();
        this.eventHandler.registerHandler('init-map', (payload) => {
            this.map = {
                width: payload.width || 100,
                height: payload.height || 100,
            }
            new Grid().init(5, this.map.width, this.map.height);
            console.log('Map initialized: ', payload);
            this.postMap();
            this.blobs.seedLife(200, this.map);
            this.food.seedFood(1000, this.map);
            this.tree.seedTree(500, this.map);
        })
        GameMap.instance = this;
    }

    postMap() {
        this.eventHandler.sendData('map-data', this.map)
    }

    tick(dT) {
        if(this.map) {
            this.blobs.tick(dT);
        }
    }

}