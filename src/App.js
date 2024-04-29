import logo from './logo.svg';
import './App.css';
import { useEffect, useState } from "react";
import GameCanvas from "./pages/map/map-canvas";
import WorkerContext from "./context/worker-context";
import * as WorkerModule from './worker/main.worker.js';
import {MainWindow} from "./pages/main-window";
const Worker = WorkerModule.default;

function App() {

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const newWorker = new Worker();
    setWorker(newWorker);
    setLoading(false);
    return () => newWorker.terminate();
  }, []);

  if(loading) {
    return (<p>Loading...</p>)
  }

  return (
      <WorkerContext.Provider value={worker}>
        <div className="App">
            <MainWindow />
        </div>
      </WorkerContext.Provider>
  );
}

export default App;
