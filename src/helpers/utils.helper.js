let timeout = {};

export function debounce(func, wait) {
    return (...args) => {
        const context = this;
        clearTimeout(timeout[func.name]);
        timeout[func.name] = setTimeout(() => {
            timeout[func.name] = null;
            func.apply(context, args);
        }, wait);
    };
}

export function throttle(callback, wait) {
    let lastEventTime = 0;

    return (...args) => {
        const context = this;
        const currentTime = Date.now();

        if (currentTime - lastEventTime >= wait) {
            // Sufficient time has passed since the last event
            callback.apply(context, args);
            lastEventTime = currentTime;
        } else {
            // Delay the callback execution
            setTimeout(() => {
                if (Date.now() - lastEventTime >= wait) {
                    callback.apply(context, args);
                    lastEventTime = Date.now();
                }
            }, wait);
        }
    };
}