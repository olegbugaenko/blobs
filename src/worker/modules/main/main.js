import {GameModule} from "../../shared/game-module";
import { GameMap } from "../maps/game-map";

export class Main extends GameModule {

    instance;

    constructor() {
        super();
        this.gameMap = new GameMap();

        this.eventHandler.registerHandler('initialize', payload => {
            console.log('initializing worker...');
            this.eventHandler.sendData('initialized', {});
            setInterval(() => {
                this.tick.apply(this, [1/60]);
            }, 1000 / 60);
            setInterval(() => {
                this.process.apply(this, [0.5]);
            }, 500);
        })

        this.eventHandler.registerHandler('save-game', payload => {
            const data = this.saveGame();
            // const stringified = JSON.stringify(data);
            this.eventHandler.sendData('game-saved', data);
        })

        this.eventHandler.registerHandler('load-game', payload => {
            const data = this.loadGame(payload);
            // const stringified = JSON.stringify(data);
            this.eventHandler.sendData('game-loaded', data);
        })

        Main.instance = this;
    }

    tick(dT) {
        this.gameMap.tick(dT);
    }

    process(dT) {
        this.gameMap.process(dT);
    }

    saveGame() {
        return {
            map: this.gameMap.saveMap()
        }
    }

    loadGame(obj) {
        this.gameMap.loadMap(obj.map);
        const final = { loaded: true, page: 'map' };
        this.eventHandler.sendData()
    }


}