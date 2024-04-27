import React, { useRef, useEffect, useState, useContext } from 'react';
import WorkerContext from '../../context/worker-context';
import * as THREE from 'three';

function GameCanvas() {
    const worker = useContext(WorkerContext);
    const mountRef = useRef(null);
    const rendererRef = useRef(null); // Using a ref to keep a stable reference to the renderer
    const [blobs, setBlobs] = useState([]);
    const blobsRef = useRef({});

    useEffect(() => {
        if (!worker) {
            console.log('worker: ', worker);
            return;
        }
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0xe0e0e0); // Set a clear background color
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer; // Store renderer in ref

        camera.position.set(0, 50, 10);
        camera.lookAt(scene.position);

        const light = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(light);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 10, 0);
        scene.add(directionalLight);

        const planeGeometry = new THREE.PlaneGeometry(100, 100);
        const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x228b22, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        scene.add(plane);

        worker.onmessage = function (e) {
            console.log('Received blobs: ', e.data);
            const receivedBlobs = e.data;
            receivedBlobs.forEach(blob => {
                if (!blobsRef.current[blob.id]) {
                    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
                    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const mesh = new THREE.Mesh(geometry, material);
                    scene.add(mesh);
                    blobsRef.current[blob.id] = mesh;
                }
                blobsRef.current[blob.id].position.set(blob.x - 50, 0.5, blob.y - 50, 1);
            });

            setBlobs(receivedBlobs);
        };

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }

        animate();

        return () => {
            if (mountRef.current && rendererRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement); // Check and remove child safely
            }
        };
    }, []);

    return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
}

export default GameCanvas;
