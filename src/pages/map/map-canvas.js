import React, {useRef, useEffect, useState, useContext, useCallback} from 'react';
import WorkerContext from '../../context/worker-context';
import * as THREE from 'three';
import {useWorkerClient} from "../../general/client";
import {BlobDetails} from "./blob-details";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';


function GameCanvas() {
    const worker = useContext(WorkerContext);
    const mountRef = useRef(null);
    const rendererRef = useRef(null); // Using a ref to keep a stable reference to the renderer
    const cameraRef = useRef(null);
    const [blobs, setBlobs] = useState([]);
    const blobsRef = useRef({});
    const blobModelRef = useRef(null);
    const [food, setFood] = useState([]);
    const foodRef = useRef({});
    const [trees, setTrees] = useState([]);
    const treeRef = useRef({});
    const { onMessage, sendData } = useWorkerClient(worker);
    const mouse = new THREE.Vector2();
    const mixers = useRef(new Map());
    const clock = new THREE.Clock();

    const [zoom, setZoom] = useState(2);
    const [cameraSettings, setCameraSettings] = useState({
        position: { x: 0, y: 200, z: 300 },
        target: { x: 0, y: 0, z: 0 }
    });

    const [selectedBlob, setSelectedBlob] = useState(null);
    const [selectedBlobData, setSelectedBlobData] = useState(null);
    const [isFollow, setFollow] = useState(null);
    const isFollowRef = useRef(isFollow);

    const [isFPV, setFPV] = useState(null);
    const isFPVRef = useRef(isFPV);

    useEffect(() => {
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('click', onDocumentMouseDown);
        window.addEventListener('keydown', handleKeyDown);
        mountRef.current.addEventListener('wheel', handleWheel);
        mountRef.current.addEventListener('mousemove', handleMouseMove);

        // Clean-up function
        return () => {
            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('click', onDocumentMouseDown);
            mountRef.current.removeEventListener('wheel', handleWheel);
            mountRef.current.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    function handleKeyDown(event) {
        if (event.key === "Escape") {
            setFollow(null);
            setFPV(null);
        }
    }

    function onWindowResize() {
        if(cameraRef.current) {
            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
        }
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }

    function onDocumentMouseDown( event ) {
        if(event.target.tagName.toLowerCase() !== 'canvas') {
            return;
        }
        event.preventDefault();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObjects(Object.values(blobsRef.current));

        if (intersects.length > 0) {
            console.log("You clicked on a blob!", intersects[0].object);
            setSelectedBlob(intersects[0].object.userData.id);
            // Example: Change color of the first intersected object
            // intersects[0].object.material.color.setHex(Math.random() * 0xffffff);
        } else {
            console.log(event.target, event.target.tagName === 'canvas');
            setSelectedBlob(null)
        }
    }

    const handleWheel = (event) => {
        if (event.deltaY > 0) {
            handleZoomOut();
        } else {
            handleZoomIn();
        }
    };

    const cameraSettingsRef = useRef(cameraSettings);

    useEffect(() => {
        cameraSettingsRef.current = cameraSettings;
    }, [cameraSettings]);

    const handleMouseMove = useCallback((event) => {
        if (event.buttons === 2) { // Right button
            const deltaX = event.movementX * 0.002;
            const deltaY = event.movementY * 0.002;

            const currentCameraSettings = cameraSettingsRef.current;

            console.error('ROTATING!!!', currentCameraSettings.position, currentCameraSettings.target);

            if (cameraRef.current) {
                const camera = cameraRef.current;
                console.log("Old camera position:", currentCameraSettings.position.x, currentCameraSettings.position.y, currentCameraSettings.position.z);

                const radius = camera.position.distanceTo(currentCameraSettings.target);
                console.log('radius: ', radius);
                const phi = Math.atan2(camera.position.z - currentCameraSettings.target.z, camera.position.x - currentCameraSettings.target.x);
                const theta = Math.atan2(Math.sqrt((camera.position.x - currentCameraSettings.target.x) ** 2 + (camera.position.z - currentCameraSettings.target.z) ** 2), camera.position.y - currentCameraSettings.target.y);
                console.log('Angles: ', phi, theta);
                const newPhi = phi + deltaX;
                const newTheta = Math.min(Math.max(theta + deltaY, 0.01), (Math.PI / 2) - 0.01);

                const newX = currentCameraSettings.target.x + radius * Math.sin(newTheta) * Math.cos(newPhi);
                const newZ = currentCameraSettings.target.z + radius * Math.sin(newTheta) * Math.sin(newPhi);
                const newY = currentCameraSettings.target.y + radius * Math.cos(newTheta);

                console.log("New camera position:", newX, newY, newZ, currentCameraSettings.target);

                setCameraSettings(prev => ({
                    ...prev,
                    position: { x: newX, y: newY, z: newZ }
                }));
            }
        } else if (event.buttons === 1) { // left button
            const deltaX = Math.sign(event.movementX);
            const deltaY = Math.sign(event.movementY);
            console.log('deltas: ', deltaX, deltaY);
            moveXZ(deltaX, deltaY);
            // moveCameraForward(deltaY);
        }
    }, [cameraSettings.target, cameraSettings.position]);



    useEffect(() => {
        if(!selectedBlob) {
            setSelectedBlobData(null);
        }
        sendData('select-blob', { id: selectedBlob });
    }, [selectedBlob]);


    useEffect(() => {
        if (!worker) {
            console.log('worker: ', worker);
            return;
        }
        const scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        // const camera = new THREE.OrthographicCamera(-aspect * 10, aspect * 10, 10, -10, 1, 1000);
        const camera = new THREE.PerspectiveCamera(10, aspect, 0.1, 2000);
        cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0xe0e0e0); // Set a clear background color
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer; // Store renderer in ref
        const gridHelper = new THREE.GridHelper(200, 50);
        scene.add(gridHelper);
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        const cameraHelper = new THREE.CameraHelper(camera);
        scene.add(cameraHelper);

        const light = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(light);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 10, 0);
        scene.add(directionalLight);



        onMessage('map-data', (payload) => {
            const planeGeometry = new THREE.PlaneGeometry(payload.width, payload.height);
            const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x228b22, side: THREE.DoubleSide });
            const plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.rotation.x = -Math.PI / 2;
            scene.add(plane);
        })

        onMessage('selected-blob-data', payload => {
            // console.log('Selected blob: ', payload);
            setSelectedBlobData(payload);
        })

        function cloneSkinnedMesh(original) {
            const cloned = original.clone(true);

            cloned.traverse(function (node) {
                if (node.isSkinnedMesh) {
                    const clonedMesh = node;
                    const skeleton = clonedMesh.skeleton;
                    const newBones = [];

                    // Clone bones
                    for (const bone of skeleton.bones) {
                        const clonedBone = bone.clone(true);
                        newBones.push(clonedBone);
                    }

                    // Create a new skeleton with the cloned bones
                    const newSkeleton = new THREE.Skeleton(newBones);
                    clonedMesh.add(...newBones);
                    clonedMesh.bind(newSkeleton, clonedMesh.bindMatrix);
                }
            });

            return cloned;
        }




        function preloadAssets() {
            const loader = new GLTFLoader();
            const textureLoader = new THREE.TextureLoader();
            const assetsToLoad = 5; // Adjust based on number of assets
            let loadedAssets = 0;

            // Function to check if all assets are loaded
            const assetLoaded = () => {
                loadedAssets++;
                if (loadedAssets === assetsToLoad) {
                    // All assets are loaded
                    console.log('All assets loaded');
                    sendData('init-map', { width: 1000, height: 1000 })
                }
            };

            // Load GLB model
            loader.load('models/food-v2.glb', function (gltf) {
                foodRef.current.model = gltf.scene;
                console.log('Food model loaded');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/tree-v2.glb', function (gltf) {
                treeRef.current.model = gltf.scene;
                console.log('Tree model loaded');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/tree-v3.glb', function (gltf) {
                treeRef.current.modelv2 = gltf.scene;
                console.log('Tree v2 model loaded');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/tree-v4.glb', function (gltf) {
                treeRef.current.modelv3 = gltf.scene;
                console.log('Tree v3 model loaded', treeRef.current);
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });


            // Load texture
            loader.load('models/blob-v4.glb', function (gltf) {

                gltf.scene.traverse(function(node) {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        if (node.material.map) node.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        console.log("Mesh found", node);
                    }
                    if (node.isBone) {
                        console.log("Bone found", node);
                    }
                });
                gltf.scene.scale.set(1, 1, 1);  // Adjust as necessary
                gltf.scene.position.set(100, 0, 10);

                blobModelRef.current = {
                    scene: gltf.scene,
                    animations: gltf.animations
                };



                /*scene.add(gltf.scene);

                // If using animations
                const mixer = new THREE.AnimationMixer(gltf.scene);
                gltf.animations.forEach((clip) => {
                    mixer.clipAction(clip).play();
                });

                const blobMesh = SkeletonUtils.clone(gltf.scene);
                blobMesh.userData = {
                    id: 100500,
                }
                scene.add(blobMesh);
                blobMesh.scale.set(2,2,2);
                blobMesh.position.set(20,2,20);
                blobMesh.updateMatrixWorld(true);*/
                // animate();
                console.log("Blob model and animations loaded", blobModelRef.current);
                assetLoaded();

            }, undefined, function (error) {
                console.error('Error loading blob model:', error);
            });
        }



        onMessage('blobs-coordinates', payload => {
            payload.blobs.forEach(blob => {
                let blobMesh = blobsRef.current[blob.id];
                let mixer = mixers.current.get(blob.id);

                if (!blobMesh) {
                    blobMesh = SkeletonUtils.clone(blobModelRef.current.scene);
                    blobMesh.userData = {
                        id: blob.id,
                    }
                    scene.add(blobMesh);
                    blobsRef.current[blob.id] = blobMesh;

                    mixer = new THREE.AnimationMixer(blobMesh);
                    mixers.current.set(blob.id, mixer);

                    const initialAction = mixer.clipAction(blobModelRef.current.animations[0]); // Assuming the first is "Moving"
                    initialAction.play();
                    console.log('currList: ', blobsRef.current);
                }

                blobMesh.position.set(blob.displayX, 0.4, blob.displayY);
                blobMesh.rotation.y = - Math.PI / 2 - blob.angle;

                /*if (blob.animation) {
                    const action = mixer.clipAction(THREE.AnimationClip.findByName(blobModelRef.current.animations, blob.animation));
                    action.reset().play();
                }*/
            });
            setBlobs(payload.blobs);
            /*const receivedBlobs = payload.blobs;
            receivedBlobs.forEach(blob => {

                let mixer;
                if (!blobsRef.current[blob.id]) {
                    const blobMesh = blobModelRef.current.scene.clone();
                    mixer = new THREE.AnimationMixer(blobMesh);
                    mixers.current.set(blob.id, mixer);

                    const initialAction = mixer.clipAction(blobModelRef.current.animations[0]); // Assuming the first animation is "Moving"
                    initialAction.play();

                    blobMesh.position.set(blob.displayX, 0.4, blob.displayY);
                    blobMesh.rotation.y = -blob.angle;
                    scene.add(blobMesh);

                    blobsRef.current[blob.id] = blobMesh;
                } else {
                    const blobMesh = blobsRef.current[blob.id];
                    blobMesh.position.set(blob.displayX, 0.4, blob.displayY);
                    blobMesh.rotation.y = -blob.angle;
                    mixer = mixers.current.get(blob.id);
                }

                /!*if(blob.id === 1) {
                    console.log('animations: ', blobModelRef.current.animations);
                }*!/

                // Update the animation if there's new data
                if (blob.animation) {
                    const action = mixer.clipAction(THREE.AnimationClip.findByName(blobModelRef.current.animations, blob.animation));
                    action.reset().play();
                }

                /!*blobsRef.current[blob.id].rotation.y = - blob.angle;
                blobsRef.current[blob.id].position.set(blob.displayX, 0.4, blob.displayY, 1);*!/
                blobsRef.current[blob.id].userData = {
                    id: blob.id,
                    angle: blob.angle
                }
            });
            setBlobs(receivedBlobs);*/
        })

        onMessage('delete-blob', payload => {
            console.log('Blob '+payload.id+' died');
            if (blobsRef.current[payload.id]) {
                const mesh = blobsRef.current[payload.id];
                console.log('Dying Mesh: ', mesh);
                const mixer = mixers.current.get(payload.id);
                mixer.actions?.forEach(action => mixer.uncacheAction(action));
                scene.remove(mesh);
                mesh.geometry?.dispose();
                mesh.material?.dispose();
                mixers.current.delete(payload.id);
                delete blobsRef.current[payload.id];
            }
        })

        onMessage('food-coordinates', payload => {
            const receivedFood = payload.food;
            console.log('received food: ', receivedFood);
            receivedFood.forEach(foodItem => {
                if (!foodRef.current[foodItem.id]) {
                    // If an instance for this ID doesn't exist, create it
                    const foodMesh = foodRef.current.model.clone();  // Clone the model

                    foodMesh.scale.set(0.25,0.25,0.25);

                    // Set the mesh properties based on incoming data
                    foodMesh.position.set(foodItem.displayX, 0.1, foodItem.displayY);
                    foodMesh.rotation.y = foodItem.angle;  // Assuming angle is in radians
                    foodMesh.userData = { id: foodItem.id };

                    // Add the mesh to the scene
                    scene.add(foodMesh);

                    // Store the mesh in ref for potential updates
                    foodRef.current[foodItem.id] = foodMesh;
                } else {
                    // Update existing mesh position and rotation if it already exists
                    const foodMesh = foodRef.current[foodItem.id];
                    foodMesh.position.set(foodItem.displayX, 0.1, foodItem.displayY);
                    foodMesh.rotation.y = foodItem.angle;
                }
            });
            setFood(receivedFood);
        })

        onMessage('tree-coordinates', payload => {
            const receivedTrees = payload.trees;
            console.log('received trees: ', receivedTrees);
            receivedTrees.forEach(treeItem => {
                if (!treeRef.current[treeItem.id]) {
                    // If an instance for this ID doesn't exist, create it
                    let treeMesh;
                    if(treeItem.type === 'v0') {
                        treeMesh = treeRef.current.model.clone();
                    } else if(treeItem.type === 'v1') {
                        treeMesh = treeRef.current.modelv2.clone();
                    } else if(treeItem.type === 'v2') {
                        treeMesh = treeRef.current.modelv3.clone();
                    }

                    // treeMesh.scale.set(0.25,0.25,0.25);

                    // Set the mesh properties based on incoming data
                    treeMesh.position.set(treeItem.displayX, 0, treeItem.displayY);
                    console.log('Tree position:', treeMesh.position);
                    treeMesh.rotation.y = treeItem.angle;  // Assuming angle is in radians
                    treeMesh.userData = { id: treeItem.id };

                    // Add the mesh to the scene
                    scene.add(treeMesh);

                    // Store the mesh in ref for potential updates
                    treeRef.current[treeItem.id] = treeMesh;
                } else {
                    // Update existing mesh position and rotation if it already exists
                    const treeMesh = treeRef.current[treeItem.id];
                    treeMesh.position.set(treeItem.displayX, 0, treeItem.displayY);
                    treeMesh.rotation.y = treeItem.angle;
                }
            });
            setTrees(receivedTrees);
        })



        function animate() {
            requestAnimationFrame(animate);

            const delta = clock.getDelta(); // Get the time elapsed since the last call to this function

            mixers.current.forEach((mixer) => {
                mixer.update(delta); // Update each mixer with the elapsed time
            });

            if (isFollowRef.current) {
                updateCameraFollow();
            } else if (isFPVRef.current) {
                updateFirstPersonView();
            }
            renderer.render(scene, camera);
        }

        preloadAssets();
        animate();

        return () => {
            if (mountRef.current && rendererRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement); // Check and remove child safely
            }
            // window.removeEventListener('mouseup', syncCameraState);
        };
    }, []);

    function updateCamera() {
        /*if (!cameraRef.current) return;
        const { position, target } = cameraSettings;
        cameraRef.current.position.set(position.x, position.y, position.z);
        cameraRef.current.lookAt(new THREE.Vector3(target.x, target.y, target.z));
        cameraRef.current.zoom = zoom;
        cameraRef.current.updateProjectionMatrix();*/

        if (cameraRef.current && cameraSettings.position && cameraSettings.target) {
            cameraRef.current.position.set(cameraSettings.position.x, cameraSettings.position.y, cameraSettings.position.z);
            cameraRef.current.lookAt(new THREE.Vector3(cameraSettings.target.x, cameraSettings.target.y, cameraSettings.target.z));
            cameraRef.current.zoom = zoom;
            cameraRef.current.updateProjectionMatrix();
        }
    }

    function updateCameraFollow() {
        if (!cameraRef.current || !isFollowRef.current || !blobsRef.current[isFollowRef.current]) return;

        const blob = blobsRef.current[isFollowRef.current];
        const camera = cameraRef.current;

        // Adjust these offsets as needed to position the camera relative to the blob
        // const offsetPosition = new THREE.Vector3(0, 50, 100);  // example offsets

        // Set the new position of the camera relative to the target
        // const newPosition = blob.position.clone().add(offsetPosition);
        // camera.position.copy(newPosition);

        // Make the camera look at the target
        // camera.lookAt(blob.position);

        const offsets = new THREE.Vector3(
            cameraSettings.position.x - cameraSettings.target.x,
            cameraSettings.position.y - cameraSettings.target.y,
            cameraSettings.position.z - cameraSettings.target.z,
            );

        cameraSettings.target.x = blob.position.x;
        cameraSettings.target.y = blob.position.y;
        cameraSettings.target.z = blob.position.z;

        cameraSettings.position.x = blob.position.x + offsets.x;
        cameraSettings.position.y = blob.position.y + offsets.y;

        setCameraSettings(() => {
            return {
                target: {
                    x: blob.position.x,
                    y: blob.position.y,
                    z: blob.position.z,
                },
                position: {
                    x: blob.position.x + offsets.x,
                    y: blob.position.y + offsets.y,
                    z: blob.position.z + offsets.z
                }
            }
        })

    }

    function updateFirstPersonView() {
        if (!cameraRef.current || !isFPVRef.current || !blobsRef.current[isFPVRef.current]) return

        const blob = blobsRef.current[isFPVRef.current];
        // Adjust the camera's position and target
        /*camera.position.copy(blob.position).add(offset);
        camera.lookAt(blob.position.clone().add(direction));*/
        // console.log('blob: ', blob);
        setCameraSettings({
            position: {
                x: blob.position.x,
                y: 1,
                z: blob.position.z
            },
            target: {
                x: blob.position.x + Math.cos(blob.userData.angle),
                y: 1,
                z: blob.position.z + Math.sin(blob.userData.angle)
            }
        })
    }

    const moveXZ = useCallback((dX, dZ) => {
        if (!cameraRef.current) return;

        // Calculate the current phi
        const phi = Math.atan2(cameraRef.current.position.z - cameraSettings.target.z, cameraRef.current.position.x - cameraSettings.target.x);

        // Adjust sin and cos multipliers to calculate new positions
        const drX = (-dZ * Math.cos(phi)) + (dX * Math.sin(phi));
        const drZ = (dX * Math.cos(phi)) - (-dZ * Math.sin(phi));
        const newY = cameraSettings.position.y; // Maintain the current y position

        // Update camera position and target in cameraSettings state
        setCameraSettings(prev => ({
            position: { ...prev.position, x: prev.position.x + drX, z: prev.position.z + drZ },
            target: { ...prev.target, x: prev.target.x + drX, z: prev.target.z + drZ } // Optionally, update target as well
        }));
        // Update camera position and lookAt
        // cameraRef.current.position.set(newX, newY, newZ);
        // cameraRef.current.lookAt(cameraSettings.target);
    }, [cameraSettings.target, cameraSettings.position]);



    /*useEffect(() => {
        // console.log('After change: ', cameraSettings.position, cameraSettings.target);
    }, [cameraSettings.target, cameraSettings.position])*/

    // Button handlers for camera controls
    function handleZoomIn() {
        setZoom(zoom => zoom * 1.1);
    }

    function handleZoomOut() {
        setZoom(zoom => zoom * 0.9);
    }

    /*function moveCamera(dx, dy) {
        setCameraSettings(prev => ({
            position: {
                x: prev.position.x + dx,
                y: prev.position.y,
                z: prev.position.z + dy
            },
            target: {
                x: prev.target.x + dx,
                y: prev.target.y,
                z: prev.target.z + dy
            }
        }));
    }*/

    useEffect(() => {
        updateCamera();
    }, [zoom, cameraSettings]);

    useEffect(() => {
        isFollowRef.current = isFollow;  // Update ref whenever isFollow changes
    }, [isFollow]);

    useEffect(() => {
            isFPVRef.current = isFPV;
    }, [selectedBlob, isFPV]);

    const onFollow = useCallback(() => {
        if(!selectedBlob || isFollow) {
            setFollow(null);
            return;
        }
        console.log('Setting follow to: ', selectedBlob, isFollow)
        setFollow(selectedBlob);
        setFPV(null)
    }, [selectedBlob, isFollow]);

    const onSetFPV = useCallback(() => {
        if(!selectedBlob || isFPV) {
            setFPV(null);
            return;
        }
        console.log('Setting fpv to: ', selectedBlob, isFollow);
        setFollow(null);
        setFPV(selectedBlob);
    }, [selectedBlob, isFPV]);

    return (<div>
        <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
        {selectedBlob ? (<BlobDetails {...selectedBlobData} onFollow={onFollow} isFollowing={isFollow} onSetFPV={onSetFPV} isFPV={isFPV}/>) : null}
        <div className={'box heading'}>
            <p>Blobs Alive: {blobs.length}</p>
        </div>
        <div className={'boxes transparent-buttons'}>
            <button onClick={handleZoomIn}>Zoom In</button>
            <button onClick={handleZoomOut}>Zoom Out</button>
            <button onClick={() => moveXZ(5, 0)}>Move Right</button>
            <button onClick={() => moveXZ(-5, 0)}>Move Left</button>
            <button onClick={() => moveXZ(0, -5)}>Move Forward</button>
            <button onClick={() => moveXZ(0, 5)}>Move Backward</button>
        </div>
    </div>);
}

export default GameCanvas;
