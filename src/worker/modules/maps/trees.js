import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid";
import {MapViewport} from "./map-viewport";

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
        this.trees = Array.from({length: amount}, (_, id) => {
            const angle = Math.random() * 2 * Math.PI; // Random angle in radians
            const type = Math.floor(Math.random()*3)
            return {
                id,
                x: Math.random() * map.width,
                y: Math.random() * map.height,
                angle,
                type: `v${type}`,
                amount: 200
            };
        }).reduce((acc, item) => { acc[item.id] = item; return acc}, {});

        Object.values(this.trees).forEach(tree => {
            new Grid().addTree(tree);
        })
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

    tick() {
        this.displayTrees();
    }

    displayTrees() {
        const trees = Object.values(this.trees);
        const viewPort = new MapViewport();
        const gameMap = this.gameMap;
        const treesArr = viewPort.filterVisible(trees);
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