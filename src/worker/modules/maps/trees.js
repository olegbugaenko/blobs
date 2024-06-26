import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid";
import {MapViewport} from "./map-viewport";

export class Tree extends GameModule {

    trees = {};
    map;
    instance;
    selectedTree;

    constructor() {
        if(Tree.instance) {
            return Tree.instance;
        }
        super();
        Tree.instance = this;
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

    tick() {
        this.displayTrees();
    }

    displayTrees() {
        const trees = Object.values(this.trees);
        const treesArr = new MapViewport().filterVisible(trees);

        this.eventHandler.sendData('tree-coordinates', { trees: treesArr.map(tree => ({
                ...tree,
                displayX: tree.x - this.map.width / 2,
                displayY: tree.y - this.map.height / 2,
                angle: tree.angle,
                type: tree.type
            }))
        })
    }


    searchNearbyTrees(x, y, range) {
        const nearbyTrees = (new Grid()).getNearbyTree(x, y, range);

        return nearbyTrees;
    }

}