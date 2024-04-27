import logo from './logo.svg';
import './App.css';
import { useEffect, useState } from "react";
import GameCanvas from "./pages/map/map-canvas";
import WorkerContext from "./context/worker-context";

function App() {

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const newWorker = new Worker('/worker.js', { type: 'module' });
    setWorker(newWorker);
    newWorker.postMessage('Init');
    setLoading(false);
    return () => newWorker.terminate();
  }, []);

  if(loading) {
    return (<p>Loading...</p>)
  }

  return (
      <WorkerContext.Provider value={worker}>
        <div className="App">
          <header className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
            <GameCanvas />
          </header>
        </div>
      </WorkerContext.Provider>
  );
}

export default App;
