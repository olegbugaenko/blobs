import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid";
import {MapViewport} from "./map-viewport";
import {SeededRandom} from "../../shared/seed";

export class Tree extends GameModule {

    trees = {};
    map;
    instance;
    selectedTree;

    constructor(gameMap) {
        if(Tree.instance) {
            return Tree.instance;
        }
        super();
        Tree.instance = this;
        this.gameMap = gameMap;
    }

    seedTree(amount, map) {
        this.map = map;
        const seed = this.gameMap.seed; // Get the map seed for consistency
        const rand = new SeededRandom(seed);

        this.trees = Array.from({ length: amount }, (_, id) => {
            const x = rand.nextDouble() * map.width;
            const y = rand.nextDouble() * map.height;
            const angle = rand.nextDouble() * 2 * Math.PI;
            const type = `${rand.nextInt(0, 2)}`; // Assuming 3 types of trees

            return {
                id,
                x,
                y,
                angle,
                type: `v${type}`,
                amount: 200
            };
        }).reduce((acc, item) => { acc[item.id] = item; return acc }, {});

        Object.values(this.trees).forEach(tree => {
            new Grid().addTree(tree);
        });
    }

    addTree(x, y, map) {
        this.map = map;
        this.trees = Array.from({length: 1}, (_, id) => {
            const angle = Math.random() * 2 * Math.PI; // Random angle in radians
            const type = Math.floor(Math.random()*3)
            return {
                id,
                x,
                y,
                angle,
                type: `v${type}`,
                amount: 200
            };
        }).reduce((acc, item) => { acc[item.id] = item; return acc}, {});

        Object.values(this.trees).forEach(tree => {
            new Grid().addTree(tree);
        })
    }

    removeAll() {
        Object.values(this.trees).forEach(tree => {
            new Grid().removeTree(tree);
        })
        this.trees = {};
    }

    tick() {
        this.displayTrees();
    }

    displayTrees() {
        const trees = Object.values(this.trees);
        const viewPort = new MapViewport();
        const gameMap = this.gameMap;
        const treesArr = viewPort.filterVisible(trees, 200, 0.5);
        // console.log('VTREE: ', trees, treesArr);
        // if(!)
        if(viewPort.shouldSend('trees')) {
            this.eventHandler.sendData('tree-coordinates', { trees: treesArr.map(tree => ({
                    ...tree,
                    displayX: tree.x - this.map.width / 2,
                    displayY: tree.y - this.map.height / 2,
                    displayZ: gameMap.getZByXY(tree.x, tree.y),
                    angle: tree.angle,
                    type: tree.type
                }))
            })
            viewPort.setStaticsSent('trees');
        }

    }


    searchNearbyTrees(x, y, range) {
        const nearbyTrees = (new Grid()).getNearbyTree(x, y, range);

        return nearbyTrees;
    }

}