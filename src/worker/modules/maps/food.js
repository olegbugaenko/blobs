import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid";
import {MapViewport} from "./map-viewport";

export class Food extends GameModule {

    food = {};
    map;
    instance;
    selectedFood;

    constructor() {
        if(Food.instance) {
            return Food.instance;
        }
        super();
        Food.instance = this;
        this.eventHandler.registerHandler('select-food', payload => {
            if(payload.id) {
                this.selectedFood = this.food[payload.id];
            } else {
                this.selectedFood = null;
            }
            this.eventHandler.sendData('selected-food-data', this.selectedFood);
        })
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

    foodDrain(id, reason) {
        new Grid().removeFood(this.food[id]);
        delete this.food[id];
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
        Object.values(this.food).forEach(food => {
            if(food.amount <= 0) {
                this.foodDrain(food.id)
            }
        });

        if(this.selectedFood) {
            this.eventHandler.sendData('selected-food-data', this.dataToDisplay(this.selectedFood));
        }

        this.displayFood();

    }

    displayFood() {
        const foods = Object.values(this.food);
        const viewPort = new MapViewport();
        const foodArr = viewPort.filterVisible(foods);

        // if(!)
        this.eventHandler.sendData('food-coordinates', { food: foodArr.map(food => ({
                ...food,
                displayX: food.x - this.map.width / 2,
                displayY: food.y - this.map.height / 2,
                angle: food.angle,
            }))
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