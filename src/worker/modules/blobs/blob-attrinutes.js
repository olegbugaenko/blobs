import {GameModule} from "../../shared/game-module";

export class BlobAttributes extends GameModule {

    defaultValues = {
        maxAge: 2.5,
        minReproductiveAge: 1,
        maxChildren: 3,
        baseSpeed: 0.3,
        foodCapacity: 100,
        foodSearchRange: 30,
        foodConsumption: 0.2,
        eatingSpeed: 2,
        breedSearchRange: 60,
        pregnancyDays: 30
    }

    constructor() {
        if(BlobAttributes.instance) {
            return BlobAttributes.instance;
        }
        super();
        BlobAttributes.instance = this;
        this.attributes = {...this.defaultValues};

    }

    getAttribute(key) {
        return this.attributes[key] || this.defaultValues[key];
    }

}