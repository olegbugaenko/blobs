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

    foodExists(id) {
        return this.food[id] ? true : false;
    }

    seedFood(amount, map) {
        this.map = map;
        const foods = Array.from({length: amount}, (_, id) => {
            const angle = Math.random() * 2 * Math.PI; // Random angle in radians
            return {
                id,
                x: Math.random() * map.width,
                y: Math.random() * map.height,
                angle,
                type: '',
                amount: 200
            };
        });

        foods.forEach(food => this.addFood(food));
        let totals = 0;
        let adjacents = 0;
        let totalFoods = 0;
        let totalCells = 0;
        new Grid().cells.forEach(column => {
            column.forEach(cell => {
                totalCells++;
                totalFoods += cell.food.length;
                adjacents += cell.adjacentFood;
                if(cell.adjacentFood <= 0) {
                    totals += 1;
                }
            })
        })
        console.log('AGI: Cells with poor food found: ', totals, this.food);
        console.log('AGI: Total cells: ', totalCells, totalFoods, adjacents);

    }

    addFood(food) {
        this.food[food.id] = food;
        new Grid().addFood(food);
        new Grid().foodAmt = (new Grid().foodAmt || 0) + 1;
    }

    generateFood(x, y, amount, type) {
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
        this.addFood(food);
        this.foodGrown++;
    }

    generateWherePoor(amount, type) {
        const cellsPoorFood = [];
        let totals = 0;
        let adjacents = 0;
        let totalFoods = 0;
        let totalCells = 0;
        new Grid().cells.forEach(column => {
            column.forEach(cell => {
                totalCells++;
                totalFoods += cell.food.length;
                adjacents += cell.adjacentFood;
                if(cell.adjacentFood <= 0) {
                    totals += 1;
                    cellsPoorFood.push(cell);
                }
            })
        })
        console.log('Cells with poor food found: ', cellsPoorFood.length, totals);
        console.log('Total cells: ', totalCells, totalFoods, adjacents);
        const cellToGenerate = cellsPoorFood[Math.floor(Math.random()*(cellsPoorFood.length-0.001))];
        if(cellToGenerate) {
            console.log('cellToGenerate', cellToGenerate);
            const {x,y} = (new Grid()).randomCellCoordinates(cellToGenerate);
            this.generateFood(x,y,amount,type);
        }
    }

    removeFood(id) {
        new Grid().removeFood(this.food[id]);
        delete this.food[id];
    }

    foodDrain(id, reason) {
        this.removeFood(id);
        this.foodEaten++;
    }

    searchClosestFood(x, y, range) {
        const foodNearby = (new Grid()).getNearbyFood(x, y, range);
        let maxDistance = range;
        let closestFood = null;
        foodNearby.forEach(foodId => {
            const item = this.food[foodId];
            const dist = Math.sqrt((x - item.x) ** 2 + (y - item.y) ** 2);
            if(dist < maxDistance) {
                maxDistance = dist;
                closestFood = item;
            }
        });
        if(maxDistance > range) {
            return null;
        }
        return closestFood;
    }

    tick(dT) {


    }

    eatFood(food, amt) {
        food.amount -= amt;
        if(food.amount <= 0) {
            this.foodDrain(food.id)
        }
    }

    process(dT) {

        if(this.selectedFood) {
            this.eventHandler.sendData('selected-food-data', this.dataToDisplay(this.selectedFood));
        }

        // randomly add
        const chance = dT*this.gameMap.map.width*this.gameMap.map.height / 5000000000;

        if(Math.random() < chance) {
            this.generateWherePoor(200, '');
        }

        this.displayFood();
    }

    displayFood() {

        const viewPort = new MapViewport();
        const foods = Object.values(this.food);
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

    dataToSaveFood(food) {
        return {
            id: food.id,
            angle: food.angle,
            x: food.x,
            y: food.y,
            type: food.type,
            amount: food.amount
        }
    }

    saveFood() {
        const saveObject = {}
        saveObject.totalFood = Object.keys(this.food).length;

        // store directly only food that's nearby to blobs
        // implement logic based on cells (2D array of objects with 'food' and 'blobs' arrays)
        // to call  this.dataToSaveFood only on these food items that has blobs also
        const interestingCells = (new Grid()).getCellsAdjucentToBlobs();

        const foodIds = interestingCells.reduce((acc, cell) => ([...acc, ...cell.food]), []);

        saveObject.items = {};
        foodIds.forEach(id => {
            saveObject.items[id] = this.dataToSaveFood(this.food[id]);
        })
        return saveObject;
    }

    loadFood(saveObject) {
        Object.keys(this.food).forEach(id => {
            this.removeFood(id);
        });

        Object.values(saveObject.items).forEach(food => {
            this.addFood(food);
        })
    }

}