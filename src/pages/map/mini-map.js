import {useContext, useState} from "react";
import { useWorkerClient } from "../../general/client";
import WorkerContext from "../../context/worker-context";
import { useEffect, useRef } from "react";

export const MiniMap = ({ size }) => {
    const worker = useContext(WorkerContext);
    const { onMessage, sendData } = useWorkerClient(worker);
    const [currentMiniMap, setCurrentMinimap] = useState({});
    const canvasRef = useRef(null);

    // Function to draw on the canvas
    const draw = (minimap) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const gridSize = size / minimap.grid.length;

        // Draw blobs
        minimap.grid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell.blobs > 0) {
                    ctx.fillStyle = "#0333c3";
                    ctx.fillRect(colIndex * gridSize, rowIndex * gridSize, gridSize*2, gridSize*2);
                }
            });
        });

        // Draw camera position
        const cameraSize = 3; // Size of camera indicator
        const cameraX = minimap.camera.x - Math.floor(cameraSize / 2);
        const cameraY = minimap.camera.y - Math.floor(cameraSize / 2);
        ctx.fillStyle = "lightblue";
        ctx.fillRect(cameraX * gridSize, cameraY * gridSize, cameraSize * gridSize, cameraSize * gridSize);
    };

    useEffect(() => {
        onMessage('minimap', (minimap) => {
            // console.log('minimap', minimap.totalBlobs);
            setCurrentMinimap(minimap);
            draw(minimap); // Draw on canvas when mini-map data is received
        });
    }, []);

    return (
        <canvas ref={canvasRef} width={size} height={size} style={{ backgroundColor: "green" }} />
    );
};
