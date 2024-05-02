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

        Main.instance = this;
    }

    tick(dT) {
        this.gameMap.tick(dT);
    }

    process(dT) {
        this.gameMap.process(dT);
    }


}