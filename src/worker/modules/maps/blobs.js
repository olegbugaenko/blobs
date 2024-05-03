import {GameModule} from "../../shared/game-module";
import {Grid} from "./grid.js";
import {Main} from "../main/main";
import {MapViewport} from "./map-viewport";

export class Blobs extends GameModule {

    blobs = {};
    map;
    instance;
    selectedBlob;

    constructor(gameMap) {
        if(Blobs.instance) {
            return Blobs.instance;
        }
        super();
        this.visibleBlobs = {};
        this.nonVisibleBlobs = {};
        Blobs.instance = this;
        this.gameMap = gameMap;
        this.eventHandler.registerHandler('select-blob', payload => {
            if(payload.id) {
                this.selectedBlob = this.blobs[payload.id];
            } else {
                this.selectedBlob = null;
            }
            // this.eventHandler.sendData('selected-blob-data', this.dataToDisplay(this.selectedBlob));
        })
        this.blobBorn = 0;
        this.blobDied = 0;
    }

    seedLife(amount, map) {
        this.isFirstRender = true;
        this.map = map;
        this.blobs = Array.from({length: amount}, (_, id) => {
            const angle = Math.random() * 2 * Math.PI; // Random angle in radians
            const speed = 0.4 + 0.3 * Math.random();
            return {
                id,
                speed,
                x: Math.random() * Math.min(map.width, 30*Math.sqrt(amount)) + map.width / 2,
                y: Math.random() * Math.min(map.height, 30*Math.sqrt(amount)) + map.height / 2,
                dx: 0,
                dy: 0,
                angle,
                age: 1 + Math.random(),
                foodCapacity: 100,
                food: 60 + Math.random()*40,
                sex: Math.floor(Math.random() * 2),
                lastBreedTime: -Infinity,
                isPregnant: false,
                pregnancyTime: 0
            };
        }).reduce((acc, item) => { acc[item.id] = item; return acc}, {});
        Object.values(this.blobs).forEach(blob => {
            new Grid().addBlob(blob);
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
        console.log('Blob died because of '+reason);
        this.blobDied++;
        // this.eventHandler.sendData('delete-blob', { id })
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

    moveRandomPoint(blob) {
        if(!blob.randomPoint) {
            const rD = 100;
            const angle = Math.random() * 2 * Math.PI;
            blob.randomPoint = {
                x: rD * Math.cos(angle),
                y: rD * Math.sin(angle),
            }
            blob.angle = angle;
        }

        const dist = Math.sqrt(
            (blob.randomPoint.x - blob.x) ** 2
            + (blob.randomPoint.y - blob.y) ** 2
        )

        if(dist < 1) {
            blob.randomPoint = undefined
        } else {
            blob.dx = blob.speed * Math.cos(blob.angle);
            blob.dy = blob.speed * Math.sin(blob.angle);
        }

    }

    moveTowards(blob, target, distance) {
        blob.randomPoint = undefined;
        if(!target) {
            console.warn('Invalid target!', blob, target);
            return;
        }
        if(distance < 0.1) {
            blob.dx = 0;
            blob.dy = 0;
            return;
        }
        const directionX = (target.x - blob.x) / distance;
        const directionY = (target.y - blob.y) / distance;
        blob.dx = blob.speed * directionX;
        blob.dy = blob.speed * directionY;
        blob.angle = Math.atan2(directionY, directionX);
    }


    manageIdleState(blob, dT) {
        blob.idlingTimer = (blob.idlingTimer || 0) + dT;
        if (blob.idlingTimer > 10) {
            blob.idlingTimer = 0;
            if (Math.random() > 0.4) {
                const angle = Math.random() * 2 * Math.PI;
                blob.dx = blob.speed * Math.cos(angle);
                blob.dy = blob.speed * Math.sin(angle);
                blob.angle = angle;
            } else {
                blob.dx = 0;
                blob.dy = 0;
            }
        }
    }

    attemptToBreed(blob, dT) {
        blob.wantToBreed = false;
        // Check if blob is ready to breed
        if (blob.food > blob.foodCapacity * 0.5 && (blob.age - blob.lastBreedTime > 0.5) && blob.age > 1) {
            blob.wantToBreed = true;
            blob.action = 'Look for partner';
            if(!blob.potentialPartner || blob.potentialPartner.wantToBreed == false) {
                blob.potentialPartner = undefined;
                const others = new Grid().getNearbyBlob(blob.x, blob.y, 3);
                const potentialPartners = others
                    .map(o => this.blobs[o])
                    .filter(other => other && (other.sex !== blob.sex) && other.wantToBreed)
                    .sort((a, b) => {
                        const distA = Math.sqrt((blob.x - a.x) ** 2 + (blob.y - a.y) ** 2);
                        const distB = Math.sqrt((blob.x - b.x) ** 2 + (blob.y - b.y) ** 2);
                        return distA - distB;
                    });

                blob.potentialPartner = potentialPartners[0];
                // console.log('SET POT PAR: ', potentialPartners, others);
            }

            if(blob.potentialPartner) {
                blob.action = 'Found partner';
                const distance = Math.sqrt((blob.x - blob.potentialPartner.x) ** 2 + (blob.y - blob.potentialPartner.y) ** 2)
                if(distance < 1) {
                    blob.dx = 0;
                    blob.dy = 0;
                    blob.potentialPartner.dx = 0;
                    blob.potentialPartner.dy = 0;
                    if (blob.sex === 1) { // Female
                        blob.isPregnant = true;
                        blob.pregnancyTime = 30; // days
                    } else
                    if (blob.potentialPartner.sex === 1) { // Female
                        blob.potentialPartner.isPregnant = true;
                        blob.potentialPartner.pregnancyTime = 30; // days
                    }
                    // Reset breeding timers
                    blob.lastBreedTime = blob.age;
                    blob.potentialPartner.lastBreedTime = blob.potentialPartner.age;
                } else {
                    // console.log('blb: ', blob, blob.potentialPartner, distance);
                    this.moveTowards(blob, blob.potentialPartner, distance);
                }
            } else {
                // walk randomly seeking for...
                this.moveRandomPoint(blob);
            }

        } else {
            blob.wantToBreed = false;
        }

        if (blob.isPregnant) {
            blob.pregnancyTime -= dT;
            if (blob.pregnancyTime <= 0) {
                this.spawnChildren(blob);
                blob.isPregnant = false;
            }
        }
    }

    spawnChildren(blob) {
        const numChildren = Math.floor(Math.random() * 3) + 1; // 1 to 3 children
        this.blobBorn += numChildren;
        for (let i = 0; i < numChildren; i++) {
            const child = {
                id: `${Math.round(Math.random()*10000000)}`,
                speed: 0.4 + 0.3 * Math.random(),
                x: blob.x + (Math.random() - 0.5) * 2,
                y: blob.y + (Math.random() - 0.5) * 2,
                dx: 0,
                dy: 0,
                angle: Math.random() * 2 * Math.PI,
                age: 0,
                foodCapacity: 100,
                food: 50,
                sex: Math.floor(Math.random() * 2),
                lastBreedTime: 0,
                isPregnant: false,
                pregnancyTime: 0
            };
            this.blobs[child.id] = child;
            new Grid().addBlob(child);
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
                this.moveTowards(blob, blob.closestFood, distance);
                /*const directionX = (blob.closestFood.x - blob.x) / distance;
                const directionY = (blob.closestFood.y - blob.y) / distance;
                blob.dx = blob.speed * directionX;
                blob.dy = blob.speed * directionY;
                blob.angle = Math.atan2(directionY, directionX);*/
            }
        }

        if(blob.action === 'Idle') {
            this.attemptToBreed(blob, dT);
        }

        if(blob.action === 'Idle') {
            // choose if I wanna move
            blob.idlingTimer = (blob.idlingTimer || 0) + dT;
            if(blob.idlingTimer > 10) {
                blob.idlingTimer = 0;
                if(Math.random() > 0.4) {
                    this.moveRandomPoint(blob);
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

    moveBlob(blob, dT) {
        if(Number.isNaN(blob.dx) ) {
            return;
        }
        if(Number.isNaN(blob.dy) ) {
            return;
        }

        const pX = blob.x;
        const pY = blob.y;
        blob.x += blob.dx*dT;
        blob.y += blob.dy*dT;

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
    }

    tick(dT) {
        Object.values(this.visibleBlobs).forEach(blob => {
            this.moveBlob(blob, dT)
        });

        this.displayBlobs();

        if(this.selectedBlob) {
            this.eventHandler.sendData('selected-blob-data', this.dataToDisplay(this.selectedBlob));
        }

    }

    process(dT) {
        // const str = performance.now();
        const blobArr = Object.values(this.blobs);
        let age = 0;
        let males = 0;
        let females = 0;
        this.visibleBlobs = {};
        this.nonVisibleBlobs = {};
        const vp = new MapViewport();

        blobArr.forEach(blob => {
            this.handleBlobDeathProbability(blob, dT);
            if(blob.food <= 0) {
                this.blobDie(blob.id, 'HUNGER');
            }
            const isVisible = vp.checkVisibility(blob);
            if(isVisible) {
                blob.isVisible = true;
                this.visibleBlobs[blob.id] = blob;
            } else {
                blob.isVisible = false;
                this.nonVisibleBlobs[blob.id] = blob;
                this.moveBlob(blob, dT);
            }
            blob.age += (dT / (5 * 365));
            blob.food -= dT / 5; // food consumption

            // logic to gather food or some other stuff
            this.makeDecisions(blob, dT);

            if (blob.eatingFood) {
                blob.food += 2 * dT;
                blob.eatingFood.amount -= 2 * dT;
            }
            age += blob.age;
            if(blob.sex === 0) {
                males++;
            } else {
                females++;
            }
        })

        this.eventHandler.sendData('total-stats', {
            totalBlobs: blobArr.length,
            averageAge: Math.round(100 * age / blobArr.length) / 100,
            totalMale: males,
            totalFemale: females,
            born: this.blobBorn,
            died: this.blobDied
        });
        // console.log('process took: ', performance.now() - str);
    }

    displayBlobs() {
        let blobsArr = Object.values(this.visibleBlobs);

        const viewPort = new MapViewport();
        if(!viewPort.isUIReady) return;

        this.eventHandler.sendData('blobs-coordinates', { blobs: blobsArr.map(blob => ({
                id: blob.id,
                sex: blob.sex,
                displayX: blob.x - this.map.width / 2,
                displayY: blob.y - this.map.height / 2,
                displayZ: this.gameMap.getZByXY(blob.x, blob.y),
                angle: blob.angle,
                cellX: blob.cell.col,
                cellY: blob.cell.row,
                animation: blob.animation,
                scale: blob.age < 1 ? 0.5 + 0.5 * blob.age : 1,
            }))
        })
        this.isFirstRender = false;
    }

    dataToDisplay(blob) {
        return {
            id: blob.id,
            displayX: Math.round(blob.x - this.map.width / 2),
            displayY: Math.round(blob.y - this.map.height / 2),
            angle: blob.angle,
            speed: blob.speed,
            dx: blob.dx,
            dy: blob.dy,
            age: `${Math.floor(blob.age)} years, ${Math.round((blob.age % 1) * 365)} days`,
            cellX: blob.cell.col,
            cellY: blob.cell.row,
            action: blob.action,
            animation: blob.animation,
            foodStat: `${Math.round(blob.food)} / ${Math.round(blob.foodCapacity)}`,
            sex: blob.sex === 0 ? 'Male' : 'Female',
            isPregnant: blob.isPregnant,
            lastBreedTime: blob.lastBreedTime > 0 ? `${Math.round(((blob.age - blob.lastBreedTime) % 1)*365)} days ago` : 'Never'
        }
    }

}