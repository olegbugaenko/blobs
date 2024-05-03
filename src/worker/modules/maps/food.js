import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid";
import {MapViewport} from "./map-viewport";

export class Food extends GameModule {

    food = {};
    map;
    instance;
    selectedFood;

    constructor(gameMap) {
        if(Food.instance) {
            return Food.instance;
        }
        super();
        Food.instance = this;
        this.gameMap = gameMap;
        this.eventHandler.registerHandler('select-food', payload => {
            if(payload.id) {
                this.selectedFood = this.food[payload.id];
            } else {
                this.selectedFood = null;
            }
            this.eventHandler.sendData('selected-food-data', this.selectedFood);
        })
        this.foodEaten = 0;
        this.foodGrown = 0;
    }

    seedFood(amount, map) {
        this.map = map;
        this.food = Array.from({length: amount}, (_, id) => {
            const angle = Math.random() * 2 * Math.PI; // Random angle in radians
            return {
                id,
                x: Math.random() * map.width,
                y: Math.random() * map.height,
                angle,
                type: '',
                amount: 200
            };
        }).reduce((acc, item) => { acc[item.id] = item; return acc}, {});

        Object.values(this.food).forEach(food => {
            new Grid().addFood(food);
        })

    }

    addFood(x, y, amount, type) {
        const id = `${Math.random()*10000}`;
        const angle = Math.random() * 2 * Math.PI;
        const food = {
            id,
            x,
            y,
            angle,
            type,
            amount
        }
        this.food[id] = food;
        new Grid().addFood(food);
        this.foodGrown++;
    }

    foodDrain(id, reason) {
        new Grid().removeFood(this.food[id]);
        delete this.food[id];
        this.foodEaten++;
    }

    searchClosestFood(x, y, range) {
        const foodNearby = (new Grid()).getNearbyFood(x, y, range);
        let maxDistance = 1000;
        let closestFood = null;
        foodNearby.forEach(foodId => {
            const item = this.food[foodId];
            const dist = Math.sqrt((x - item.x) ** 2 + (y - item.y) ** 2);
            if(dist < maxDistance) {
                maxDistance = dist;
                closestFood = item;
            }
        });
        return closestFood;
    }

    tick(dT) {


    }

    process(dT) {
        Object.values(this.food).forEach(food => {
            if(food.amount <= 0) {
                this.foodDrain(food.id)
            }
        });

        if(this.selectedFood) {
            this.eventHandler.sendData('selected-food-data', this.dataToDisplay(this.selectedFood));
        }

        // randomly add
        const chance = dT*0.1;

        if(Math.random() < chance) {
            this.addFood(this.map.width*Math.random(), this.map.height*Math.random(),200, '');
        }

        this.displayFood();
    }

    displayFood() {
        const foods = Object.values(this.food);
        const viewPort = new MapViewport();
        const foodArr = viewPort.filterVisible(foods);

        if(!viewPort.isUIReady) return;
        this.eventHandler.sendData('food-coordinates', { food: foodArr.map(food => ({
                ...food,
                displayX: food.x - this.map.width / 2,
                displayY: food.y - this.map.height / 2,
                displayZ: this.gameMap.getZByXY(food.x, food.y),
                angle: food.angle,
            })),
            stats: {
                foodEaten: this.foodEaten,
                foodGrown: this.foodGrown,
                totalFood: foodArr.length,
            }
        })
    }

    dataToDisplay(food) {
        return {
            ...food,
            displayX: Math.round(food.x - this.map.width / 2),
            displayY: Math.round(food.y - this.map.height / 2),
            angle: food.angle,
            age: `${Math.floor(food.age)} years, ${Math.round((food.age % 1) * 365)} days`
        }
    }

}