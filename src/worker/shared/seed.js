export class SeededRandom {
    constructor(seed) {
        /*if(SeededRandom.instance) {
            return SeededRandom.instance;
        }
        SeededRandom.instance = this;*/
        this.seed = this.hashString(seed);
        if(this.seed < 0) {
            this.seed = Math.abs(this.seed);
            console.error(`Unexpected value: ${this.seed}`);
        }
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer, keeps sign
        }
        return hash >>> 0; // Converts to an unsigned 32-bit integer, ensuring non-negativity
    }

    random() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280.0;
    }

    nextDouble() {
        return this.random();
    }

    nextInt(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    }
}
