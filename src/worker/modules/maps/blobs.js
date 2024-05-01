import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid.js";
import {Main} from "../main/main";
import {MapViewport} from "./map-viewport";

export class Blobs extends GameModule {

    blobs = {};
    map;
    instance;
    selectedBlob;

    constructor() {
        if(Blobs.instance) {
            return Blobs.instance;
        }
        super();
        Blobs.instance = this;
        this.eventHandler.registerHandler('select-blob', payload => {
            if(payload.id) {
                this.selectedBlob = this.blobs[payload.id];
            } else {
                this.selectedBlob = null;
            }
            this.eventHandler.sendData('selected-blob-data', this.selectedBlob);
        })
    }

    seedLife(amount, map) {
        this.isFirstRender = true;
        this.map = map;
        this.blobs = Array.from({length: amount}, (_, id) => {
            const angle = Math.random() * 2 * Math.PI; // Random angle in radians
            const speed = 0.5 + 0.5 * Math.random();
            return {
                id,
                speed,
                x: Math.random() * map.width,
                y: Math.random() * map.height,
                dx: 0,
                dy: 0,
                angle,
                age: 1 + Math.random(),
                foodCapacity: 100,
                food: 60 + Math.random()*40,
            };
        }).reduce((acc, item) => { acc[item.id] = item; return acc}, {});
        Object.values(this.blobs).forEach(blob => {
            new Grid().addBlob(blob);
            console.log('Blob added: ', blob);
        })
    }

    handleBlobDeathProbability(blob, dT) {
        const BLOB_MAX_AGE = 2;
        const factor = Math.max(0, blob.age - BLOB_MAX_AGE) / BLOB_MAX_AGE;
        /*if(blob.id === 1) {
            console.log('Blob die check', factor, dT, blob.age);
        }*/

        if(Math.random() < factor*dT) {
            this.blobDie(blob.id, 'AGE');
        }
    }

    blobDie(id, reason) {
        new Grid().removeBlob(this.blobs[id])
        delete this.blobs[id];
        this.eventHandler.sendData('delete-blob', { id })
    }

    searchClosestFood(blob) {
        const foodNearby = Main.instance.gameMap.food.searchClosestFood(blob.x, blob.y, 5);

        if(foodNearby) {
            blob.closestFood = foodNearby;
        }
    }

    avoidObstacles(blob) {
        // Assuming obstacles are stored in a grid with cell properties like x, y, and radius
        const obstacles = (new Grid()).getNearbyTree(blob.x, blob.y, 1);

        // Check if any obstacle is within a certain distance from the blob
        const avoidanceRadius = 2; // Adjust as needed
        const nearbyObstacles = obstacles.filter(obstacle => {
            const distance = Math.sqrt((blob.x - obstacle.x) ** 2 + (blob.y - obstacle.y) ** 2);
            return distance < avoidanceRadius + (obstacle.radius || 0.25);
        });

        if (nearbyObstacles.length > 0) {
            // Calculate average direction to move away from obstacles
            let avgDx = 0;
            let avgDy = 0;
            nearbyObstacles.forEach(obstacle => {
                const dx = blob.x - obstacle.x;
                const dy = blob.y - obstacle.y;
                const distance = Math.sqrt(dx ** 2 + dy ** 2);
                avgDx += dx / distance;
                avgDy += dy / distance;
            });
            avgDx /= nearbyObstacles.length;
            avgDy /= nearbyObstacles.length;

            // Adjust blob's direction away from obstacles
            blob.dx += avgDx;
            blob.dy += avgDy;
        }
    }

    makeDecisions(blob, dT) {
        blob.action = 'Idle';
        blob.animation = '';
        if(blob.eatingFood) {
            blob.action = 'Eating';
            blob.animation = 'Eat';
        }
        if(blob.eatingFood && blob.food >= blob.foodCapacity) {
            blob.eatingFood = undefined;
        }
        if(blob.food < blob.foodCapacity * 0.5) {
            blob.isHungry = true;
            blob.action = `Going to eat`;
            if(!blob.eatingFood && !blob.closestFood) {
                this.searchClosestFood(blob);
                blob.action = 'Look for food';
            }
        } else {
            blob.isHungry = false;
            blob.closestFood = undefined;
        }
        if(blob.isHungry && !blob.eatingFood && blob.closestFood) {
            blob.action = `Going to eat at ${blob.closestFood.x - this.map.width / 2}:${blob.closestFood.y - this.map.height / 2}`;
            const distance = Math.sqrt(
                (blob.x - blob.closestFood.x) ** 2 +
                (blob.y - blob.closestFood.y) ** 2
            );
            if(distance <= 0.5) {
                blob.eatingFood = blob.closestFood;
                blob.action = 'Eating';
                blob.dx = 0;
                blob.dy = 0;
                blob.animation = 'Eat'
            } else {
                const directionX = (blob.closestFood.x - blob.x) / distance;
                const directionY = (blob.closestFood.y - blob.y) / distance;
                blob.dx = blob.speed * directionX;
                blob.dy = blob.speed * directionY;
                blob.angle = Math.atan2(directionY, directionX);
            }
        }

        if(blob.action === 'Idle') {
            // choose if I wanna move
            blob.idlingTimer = (blob.idlingTimer || 0) + dT;
            if(blob.idlingTimer > 10) {
                blob.idlingTimer = 0;
                if(Math.random() > 0.4) {
                    const angle = Math.random() * 2 * Math.PI;
                    blob.dx = blob.speed * Math.cos(angle);
                    blob.dy = blob.speed * Math.sin(angle);
                    blob.angle = angle;
                } else {
                    blob.dx = 0;
                    blob.dy = 0;
                }
            }

        } else {
            blob.idlingTimer = 0;
        }

        const isMoving = Math.abs(blob.dx) > 0 || Math.abs(blob.dy) > 0;
        if(isMoving) {
            this.avoidObstacles(blob);

            const magnitude = Math.sqrt(blob.dx ** 2 + blob.dy ** 2);
            if (magnitude !== 0) {
                blob.dx = blob.speed * (blob.dx / magnitude);
                blob.dy = blob.speed * (blob.dy / magnitude);
            }
            blob.animation = 'Walk'
        }

        if(!blob.animation) {
            blob.idleAnimCooldown = (blob.idleAnimCooldown || 0) + dT;

            if(blob.idleAnimCooldown > 5) {
                blob.idleAnimCooldown = 0;

                const p = Math.random();
                if(p < 0.1) {
                    blob.animation = 'Jump'
                } else if(p < 0.2) {
                    blob.animation = 'Watchout'
                }

                blob.pAnimation = blob.animation;
            } else {
                blob.animation = blob.pAnimation;
            }

        }

    }

    tick(dT) {
        Object.values(this.blobs).forEach(blob => {
            const pX = blob.x;
            const pY = blob.y;
            blob.x += blob.dx*dT;
            blob.y += blob.dy*dT;
            blob.age += (dT / (5*365));
            blob.food -= dT / 5; // food consumption

            // logic to gather food
            this.makeDecisions(blob, dT);

            if(blob.eatingFood) {
                blob.food += 2 * dT;
                blob.eatingFood.amount -= 2 * dT;
            }

            // Reverse direction on boundary collision
            if (blob.x > this.map.width || blob.x < 0) {
                blob.dx *= -1;
                blob.angle = Math.atan2(blob.dy, blob.dx); // Recalculate angle
            }
            if (blob.y > this.map.height || blob.y < 0) {
                blob.dy *= -1;
                blob.angle = Math.atan2(blob.dy, blob.dx); // Recalculate angle
            }
            new Grid().moveBlob(blob, pX, pY);
            this.handleBlobDeathProbability(blob, dT);
        });

        this.displayBlobs();

        if(this.selectedBlob) {
            this.eventHandler.sendData('selected-blob-data', this.dataToDisplay(this.selectedBlob));
        }

    }

    displayBlobs() {
        let blobsArr = Object.values(this.blobs);

        // if(!this.isFirstRender) {
            blobsArr = new MapViewport().filterVisible(blobsArr);
        // }

        this.eventHandler.sendData('blobs-coordinates', { blobs: blobsArr.map(blob => ({
                ...blob,
                displayX: blob.x - this.map.width / 2,
                displayY: blob.y - this.map.height / 2,
                angle: blob.angle,
                cellX: blob.cell.col,
                cellY: blob.cell.row,
                animation: blob.animation
            }))
        })
        this.isFirstRender = false;
    }

    dataToDisplay(blob) {
        return {
            ...blob,
            displayX: Math.round(blob.x - this.map.width / 2),
            displayY: Math.round(blob.y - this.map.height / 2),
            angle: blob.angle,
            age: `${Math.floor(blob.age)} years, ${Math.round((blob.age % 1) * 365)} days`,
            cellX: blob.cell.col,
            cellY: blob.cell.row,
            action: blob.action,
            animation: blob.animation,
            foodStat: `${Math.round(blob.food)} / ${Math.round(blob.foodCapacity)}`
        }
    }

}