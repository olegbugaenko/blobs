import GameCanvas from "./map/map-canvas";
import {useContext, useEffect, useState} from "react";
import {useWorkerClient} from "../general/client";
import WorkerContext from "../context/worker-context";

export const MainWindow = () => {
    const worker = useContext(WorkerContext);
    const { onMessage, sendData } = useWorkerClient(worker);
    const [isGameLoaded, setGameLoaded] = useState(false);

    useEffect(() => {
        sendData('initialize', {});
        onMessage('initialized', (pl) => {
            console.log('initialized succesfully: ', pl);
            setGameLoaded(true)
        })
    }, []);

    if(!isGameLoaded) {
        return (<p>Loading...</p>)
    }

    return (<div>
        <GameCanvas />
    </div>)

}