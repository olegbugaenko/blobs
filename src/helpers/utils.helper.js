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