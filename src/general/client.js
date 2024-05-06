import { useEffect, useCallback } from 'react';
import {globalEventHandlers} from "./handlers";

/**
 * A React hook that creates a client to interact with a web worker.
 *
 * @param {Worker} worker - The web worker instance to interact with.
 */
export function useWorkerClient(worker) {

    // Function to register event handlers
    const onMessage = useCallback((event, callback) => {
        globalEventHandlers[event] = callback;
    }, []);

    // Function to send data to the worker
    const sendData = useCallback((event, payload) => {
        if (worker) {
            worker.postMessage(JSON.stringify({ event, payload }));
        }
    }, [worker]);

    // Function to process messages received from the worker
    const handleMessage = useCallback((event) => {
        if (!event.data) return;

        const parsed = JSON.parse(event.data);

        if (!parsed.event || !globalEventHandlers[parsed.event]) {
            console.error('Invalid event or handler not registered', parsed.event);
            console.warn(globalEventHandlers);
            return;
        }

        const handler = globalEventHandlers[parsed.event];
        // console.log('handling '+parsed.event, handler);
        if (handler) {
            handler(parsed.payload);
        }
    }, []);

    // Effect to attach and detach the message listener
    useEffect(() => {
        if (worker) {
            worker.addEventListener('message', handleMessage);

            // Cleanup function to remove the event listener
            return () => {
                worker.removeEventListener('message', handleMessage);
            };
        }
    }, [worker, handleMessage]);

    return { onMessage, sendData };
}
