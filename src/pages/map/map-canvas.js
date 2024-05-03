import React, {useRef, useEffect, useState, useContext, useCallback} from 'react';
import WorkerContext from '../../context/worker-context';
import * as THREE from 'three';
import {useWorkerClient} from "../../general/client";
import {BlobDetails} from "./blob-details";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {disposeHierarchy} from "../../helpers/web-gl.helper";
import {debounce} from "../../helpers/utils.helper";


function GameCanvas() {
    const worker = useContext(WorkerContext);
    const mountRef = useRef(null);
    const rendererRef = useRef(null); // Using a ref to keep a stable reference to the renderer
    const cameraRef = useRef(null);
    const [blobs, setBlobs] = useState([]);
    const blobsRef = useRef({});
    const blobModelRef = useRef(null);
    const [food, setFood] = useState([]);
    const foodRef = useRef({ instances: {} });
    const [trees, setTrees] = useState([]);
    const treeRef = useRef({ models: {}, instances: {}});
    const { onMessage, sendData } = useWorkerClient(worker);
    const [ totalStats, setTotalStats ] = useState({});
    const [ mapData, setMapData ] = useState({});
    const mouse = new THREE.Vector2();
    const mixers = useRef(new Map());
    const clock = new THREE.Clock();
    const currentBlobIDs = new Set();
    const currentTreeIDs = new Set();
    const currentFoodIDs = new Set();
    const terrainChunks = useRef({});

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
    const mapDataRef = useRef(null);

    // State to track pending object placements
    const pendingObjectPlacements = useRef({
        blobs: [],
        trees: [],
        food: [],
        decorations: []
    });

    /****
     * updateObjectPosition - pick arrays of objects with deffered y-position calculation, and re-assert
     *
     */

    const updateObjectsPosition = () => {
        if(!mapData || !mapData.width) return;
        // Process pending blobs
        pendingObjectPlacements.current.blobs.forEach(blob => {
            const z = getYPosition(blob.displayX, blob.displayY);
            let blobMesh = blobsRef.current[blob.id];
            if(blobMesh) {
                blobMesh.position.set(blob.displayX, 0.4 + z, blob.displayY);
            }
            // Set other necessary properties and add to scene if not already added
        });

        // Similar processing for trees and food
        pendingObjectPlacements.current.trees.forEach(tree => {
            const z = getYPosition(tree.displayX, tree.displayY, true);
            let treeMesh = treeRef.current.instances[tree.id];
            treeMesh.position.set(tree.displayX, z, tree.displayY);
            console.log('Set tree '+tree.id+' position to: ', tree.displayX, z, tree.displayY);
            // Set other necessary properties and add to scene if not already added
        });

        pendingObjectPlacements.current.food.forEach(foodItem => {
            const z = getYPosition(foodItem.displayX, foodItem.displayY);
            let foodMesh = foodRef.current.instances[foodItem.id];
            if(!foodMesh) {
                // console.error('Food mesh not found for ', foodItem, foodRef.current.instances);
                return;
            }
            foodMesh.position.set(foodItem.displayX, z, foodItem.displayY);
            // Set other necessary properties and add to scene if not already added
        });

        // Clear the arrays after processing
        pendingObjectPlacements.current.blobs = [];
        pendingObjectPlacements.current.trees = [];
        pendingObjectPlacements.current.food = [];
        pendingObjectPlacements.current.decorations = [];
    };

    /*onMessage('map-heights', (payload) => {
        // Assume terrain chunks are updated here
        payload.terrain.forEach(chunk => {
            updateTerrainChunk(scene, chunk);
        });

        // After updating terrain, process any pending object placements
        updateObjectsPosition();
    });

    onMessage('blobs-coordinates', payload => {
        // Instead of directly placing blobs, store them if terrain might not be ready
        pendingObjectPlacements.current.blobs.push(...payload.blobs);
        updateObjectsPosition(); // Try to update positions if terrain is ready
    });*/



    onMessage('total-stats', payload => {
        setTotalStats(prev => ({...prev, ...payload}));
    })

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

    function getParentData(o) {
        let a = o;
        while (a.parent && !a.userData?.id) {
            a = a.parent;
        }
        return a;
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
            const intr = getParentData(intersects[0].object)
            console.log("You clicked on a blob!", intr, intersects[0].object);
            setSelectedBlob(intr.userData.id);
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
        debounce(sendData, 500)('camera-position', cameraSettingsRef.current);
        console.log('dbc: ', cameraSettings);
        // sendData('camera-position', cameraSettingsRef.current);
    }, [cameraSettings]);

    const handleMouseMove = useCallback((event) => {
        if (event.buttons === 2) { // Right button
            const deltaX = event.movementX * 0.002;
            const deltaY = event.movementY * 0.002;

            const currentCameraSettings = cameraSettingsRef.current;

            // console.error('ROTATING!!!', currentCameraSettings.position, currentCameraSettings.target);

            if (cameraRef.current) {
                const camera = cameraRef.current;
                // console.log("Old camera position:", currentCameraSettings.position.x, currentCameraSettings.position.y, currentCameraSettings.position.z);

                const radius = camera.position.distanceTo(currentCameraSettings.target);
                // console.log('radius: ', radius);
                const phi = Math.atan2(camera.position.z - currentCameraSettings.target.z, camera.position.x - currentCameraSettings.target.x);
                const theta = Math.atan2(Math.sqrt((camera.position.x - currentCameraSettings.target.x) ** 2 + (camera.position.z - currentCameraSettings.target.z) ** 2), camera.position.y - currentCameraSettings.target.y);
                // console.log('Angles: ', phi, theta);
                const newPhi = phi + deltaX;
                const newTheta = Math.min(Math.max(theta + deltaY, 0.01), (Math.PI / 2) - 0.01);

                const newX = currentCameraSettings.target.x + radius * Math.sin(newTheta) * Math.cos(newPhi);
                const newZ = currentCameraSettings.target.z + radius * Math.sin(newTheta) * Math.sin(newPhi);
                const newY = currentCameraSettings.target.y + radius * Math.cos(newTheta);

                // console.log("New camera position:", newX, newY, newZ, currentCameraSettings.target);

                setCameraSettings(prev => ({
                    ...prev,
                    position: { x: newX, y: newY, z: newZ }
                }));
            }
        } else if (event.buttons === 1) { // left button
            const deltaX = Math.sign(event.movementX);
            const deltaY = Math.sign(event.movementY);
            // console.log('deltas: ', deltaX, deltaY);
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

    const getYPosition = (x, z, logWarn = false) => {
        // Calculate the key for the chunk based on the x and z coordinates
        const size = mapDataRef.current.pointsPerSample * mapDataRef.current.samplesPerChunk; // Assume each chunk covers a 200x200 area
        const xIndex = Math.floor((x + 0.5*mapDataRef.current.width) / size);
        const zIndex = Math.floor((z + 0.5*mapDataRef.current.height) / size);
        const key = `${xIndex * size},${zIndex * size}`;

        // Retrieve the relevant chunk from the stored terrain chunks
        const chunk = terrainChunks.current[key];
        if (chunk) {
            // Calculate local coordinates within the chunk
            const localX = x + 0.5*mapDataRef.current.width - xIndex * size;
            const localZ = z + 0.5*mapDataRef.current.height - zIndex * size;

            // Assume grid points are defined at every pointsPerSample interval
            const baseX = Math.floor(localX / mapDataRef.current.pointsPerSample) * mapDataRef.current.pointsPerSample;
            const baseZ = Math.floor(localZ / mapDataRef.current.pointsPerSample) * mapDataRef.current.pointsPerSample;
            const nextX = baseX + mapDataRef.current.pointsPerSample;
            const nextZ = baseZ + mapDataRef.current.pointsPerSample;

            // Fetch the heights from the four nearest vertices
            const Q11 = chunk.userData.map[`${baseX},${baseZ}`];  // Bottom-left
            const Q21 = chunk.userData.map[`${nextX},${baseZ}`];  // Bottom-right
            const Q12 = chunk.userData.map[`${baseX},${nextZ}`];  // Top-left
            const Q22 = chunk.userData.map[`${nextX},${nextZ}`];  // Top-right

            // Calculate the relative positions
            const dx = (localX - baseX) / mapDataRef.current.pointsPerSample;
            const dz = (localZ - baseZ) / mapDataRef.current.pointsPerSample;

            // Perform bilinear interpolation
            const interpolatedHeight = (Q11 * (1 - dx) * (1 - dz)) +
                (Q21 * dx * (1 - dz)) +
                (Q12 * (1 - dx) * dz) +
                (Q22 * dx * dz);

            return interpolatedHeight;
        }

        if(logWarn) {
            console.warn(`chunk: ${key} wasn't found at ${x}:${z}`, terrainChunks.current[key], size, mapData, terrainChunks.current);
        }

        return 0; // Return a default value if no intersection is found
    }


    function updateTerrainChunk(scene, heightData) {
        const size = mapData.pointsPerSample * mapData.samplesPerChunk;  // size of each chunk
        const segments = mapData.samplesPerChunk;  // How finely you want to segment the terrain
        const chunkWidth = size;
        const chunkDepth = size;

        // If the chunk already exists, we first remove it
        if (terrainChunks.current[heightData.key]) {
            // disposeChunk(key);
            return;
        }

        // Create the geometry
        const geometry = new THREE.PlaneGeometry(chunkWidth, chunkDepth, segments, segments);
        geometry.rotateX(-Math.PI / 2);  // Align the geometry with the xz plane

        // Adjust the vertex heights according to the height data
        const positions = geometry.attributes.position.array;
        for (let i = 0, l = positions.length; i < l; i += 3) {
            const x = Math.floor(+positions[i] + (heightData.width / 2));
            const z = Math.floor(+positions[i + 2] + (heightData.height / 2));
            const heightKey = `${x},${z}`;
            // console.log('Key: ', heightData.width, heightData.height, positions[i], positions[i+2], heightKey);
            positions[i + 1] = heightData.map[heightKey] || 0;
        }

        geometry.computeVertexNormals();  // Recompute normals for proper lighting

        let params = { color: 0x557633 };
        if(heightData.key === '4800,4800') {
            params = { color: 0x996633 };
        }
        const material = new THREE.MeshLambertMaterial(params);
        const mesh = new THREE.Mesh(geometry, material);

        // Position the mesh according to its key

        mesh.position.set(heightData.displayX, 0, heightData.displayY);

        console.log('terr_key: ', heightData.key, positions.length, chunkWidth, chunkDepth, segments);
        if(heightData.key === '4800,4800') {
            console.log('DISPLAY_AT: ', heightData.displayX, 0, heightData.displayY);
        }
        mesh.frustumCulled = false;
        mesh.geometry.computeBoundingBox();
        scene.add(mesh);
        mesh.userData.map = heightData.map;
        terrainChunks.current[heightData.key] = mesh;  // Store the chunk
        scene.updateMatrixWorld(true);
    }

    function disposeChunk(scene, key) {
        const mesh = terrainChunks.current[key];
        if (mesh) {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            delete terrainChunks.current[key];
        }
    }


    onMessage('map-data', (payload) => {
        setMapData(payload);
        mapDataRef.current = payload;
        console.log('map-data: ', payload);

    })

    useEffect(() => {
        console.log('updatedMapData', mapData);
        sendData('init-map', { width: 10000, height: 10000 })
    }, []);


    useEffect(() => {
        if (!worker) {
            console.log('worker: ', worker);
            return;
        }
        if(!mapData || !mapData.width) {
            return ;
        }
        console.log('INITIALIZED MAP...');
        const scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        // const camera = new THREE.OrthographicCamera(-aspect * 10, aspect * 10, 10, -10, 1, 1000);
        const camera = new THREE.PerspectiveCamera(10, aspect, 0.1, 500);
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

        onMessage('map-heights', (payload) => {
            const receivedKeys = new Set(payload.terrain.map(({ key }) => key));  // Keys from the payload
            console.log('payload.terrain: ', payload.terrain, mapData);

            // Generate new or update existing chunks
            payload.terrain.forEach((chunk) => {
                updateTerrainChunk(scene, chunk);
            });

            // Remove chunks not present in the new payload
            Object.keys(terrainChunks.current).forEach(key => {
                if (!receivedKeys.has(key)) {
                    disposeChunk(scene, key);
                }
            });

            // updateObjectsPosition();
        });

        onMessage('selected-blob-data', payload => {
            console.log('Selected blob: ', payload);
            setSelectedBlobData(payload);
        })


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
                    console.log('ALL ASSETS LOADED');
                    sendData('assets-loaded', {  })
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
                treeRef.current.models.model = gltf.scene;
                console.log('Tree model loaded');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/tree-v3.glb', function (gltf) {
                treeRef.current.models.modelv2 = gltf.scene;
                console.log('Tree v2 model loaded');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/tree-v4.glb', function (gltf) {
                treeRef.current.models.modelv3 = gltf.scene;
                console.log('Tree v3 model loaded', treeRef.current);
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });


            // Load texture
            loader.load('models/blob-v11.glb', function (gltf) {

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
                gltf.scene.scale.set(0.5, 0.5, 0.5);  // Adjust as necessary
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
            // console.log('blobsReceived: ', payload.blobs);
            const newBlobIDs = new Set();
            payload.blobs.forEach(blob => {
                // pendingObjectPlacements.current.blobs.push(blob);
                newBlobIDs.add(blob.id);
                let blobMesh = blobsRef.current[blob.id];
                let mixer = mixers.current.get(blob.id);

                if (!blobMesh) {
                    blobMesh = SkeletonUtils.clone(blobModelRef.current.scene);
                    blobMesh.frustumCulled = true;
                    blobMesh.userData = {
                        id: blob.id,
                    }
                    scene.add(blobMesh);
                    blobsRef.current[blob.id] = blobMesh;

                    mixer = new THREE.AnimationMixer(blobMesh);
                    mixers.current.set(blob.id, mixer);

                    // const initialAction = mixer.clipAction(blobModelRef.current.animations[0]); // Assuming the first is "Moving"
                    // initialAction.play();
                    // console.log('currList: ', blobsRef.current);
                }

                blobMesh.position.set(blob.displayX, 0.4 + blob.displayZ, blob.displayY);
                blobMesh.rotation.y = - Math.PI / 2 - blob.angle;
                blobMesh.scale.set(0.25*blob.scale, 0.25*blob.scale, 0.25*blob.scale);

                if (blob.animation !== blobMesh.userData.prevAnimation) {
                    if(!blob.animation) {
                        mixer.stopAllAction();
                    } else {
                        const action = mixer.clipAction(THREE.AnimationClip.findByName(blobModelRef.current.animations, blob.animation));
                        if(!action) {
                            console.warn('Not found animation: ', blob.animation, blobModelRef.current.animations)
                        } else {
                            mixer.stopAllAction();
                            action.reset().play();
                        }
                    }

                }

                blobMesh.userData.prevAnimation = blob.animation;
                blobMesh.userData.x = blob.displayX;
                blobMesh.userData.y = blob.displayY;
                blobMesh.userData.angle = blob.angle;
                blobMesh.userData.z = blob.displayZ;
            });

            // Now, handle removal of blobs not in the new payload
            currentBlobIDs.forEach(id => {
                if (!newBlobIDs.has(id)) {
                    // Blob is not in the new payload, remove it
                    const blobMesh = blobsRef.current[id];
                    const mixer = mixers.current.get(id);
                    if (mixer) {
                        mixer.stopAllAction();
                        mixer.uncacheRoot(blobMesh); // Optionally clear cached actions
                        mixers.current.delete(id);
                    }
                    if(blobMesh) {
                        scene.remove(blobMesh);
                        disposeHierarchy(blobMesh);
                        delete blobsRef.current[id];
                    }


                }
            });

            // Update the set of current blob IDs
            currentBlobIDs.clear();
            newBlobIDs.forEach(id => currentBlobIDs.add(id));

            setBlobs(payload.blobs);

        })

        onMessage('delete-blob', payload => {
            console.log('Blob '+payload.id+' died');
            if (blobsRef.current[payload.id]) {
                const mesh = blobsRef.current[payload.id];
                // console.log('Dying Mesh: ', mesh);
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
            // console.log('received food: ', receivedFood);
            setTotalStats(prev => ({...prev, ...payload.stats}));
            const newFoodIDs = new Set();
            receivedFood.forEach(foodItem => {
                // pendingObjectPlacements.current.food.push(foodItem);
                newFoodIDs.add(foodItem.id);
                if (!foodRef.current.instances[foodItem.id]) {
                    // If an instance for this ID doesn't exist, create it
                    const foodMesh = foodRef.current.model.clone();  // Clone the model
                    foodMesh.frustumCulled = true;
                    foodMesh.scale.set(0.25,0.25,0.25);

                    // Set the mesh properties based on incoming data
                    foodMesh.position.set(foodItem.displayX, foodItem.displayZ, foodItem.displayY);
                    foodMesh.rotation.y = foodItem.angle;  // Assuming angle is in radians
                    foodMesh.userData = { id: foodItem.id };

                    // Add the mesh to the scene
                    scene.add(foodMesh);

                    // Store the mesh in ref for potential updates
                    foodRef.current.instances[foodItem.id] = foodMesh;
                } /*else {
                    // Update existing mesh position and rotation if it already exists
                    const foodMesh = foodRef.current.instances[foodItem.id];
                    foodMesh.position.set(foodItem.displayX, 0.1, foodItem.displayY);
                    foodMesh.rotation.y = foodItem.angle;
                }*/
            });

            currentFoodIDs.forEach(id => {
                if (!newFoodIDs.has(id)) {
                    const foodMesh = foodRef.current.instances[id];
                    if (foodMesh) {
                        disposeHierarchy(foodMesh, true);
                        delete foodRef.current.instances[id];
                    }
                }
            })

            currentFoodIDs.clear();
            newFoodIDs.forEach(id => currentFoodIDs.add(id));
            setFood(receivedFood);
        })

        onMessage('tree-coordinates', payload => {
            console.log('received-trees: ', payload.trees);

            const newTreeIDs = new Set();
            // Process received trees and update or create new ones
            payload.trees.forEach(treeItem => {
                newTreeIDs.add(treeItem.id);
                // pendingObjectPlacements.current.trees.push(treeItem);
                let treeMesh = treeRef.current.instances[treeItem.id];
                if (!treeMesh) {
                    // Create new tree mesh
                    if(treeItem.type === 'v0') {
                        treeMesh = treeRef.current.models.model.clone();
                    } else if(treeItem.type === 'v1') {
                        treeMesh = treeRef.current.models.modelv2.clone();
                    } else if(treeItem.type === 'v2') {
                        treeMesh = treeRef.current.models.modelv3.clone();
                    }

                    // const y = getYPosition(treeItem.displayX, treeItem.displayY);
                    treeMesh.position.set(treeItem.displayX, treeItem.displayZ, treeItem.displayY);
                    treeMesh.rotation.y = treeItem.angle;
                    treeMesh.userData = { id: treeItem.id };
                    treeMesh.frustumCulled = true;

                    scene.add(treeMesh);
                    treeRef.current.instances[treeItem.id] = treeMesh;
                } /*else {
                    // Update existing tree
                    treeMesh.position.set(treeItem.displayX, 0, treeItem.displayY);
                    treeMesh.rotation.y = treeItem.angle;
                }*/
            });

            currentTreeIDs.forEach(id => {
                if (!newTreeIDs.has(id)) {
                    const treeMesh = treeRef.current.instances[id];
                    if (treeMesh) {
                        disposeHierarchy(treeMesh, true);
                        delete treeRef.current.instances[id];
                    }
                }
            })

            currentTreeIDs.clear();
            newTreeIDs.forEach(id => currentTreeIDs.add(id));

            setTrees(payload.trees);
        });




        function animate() {
            requestAnimationFrame(animate);

            const delta = clock.getDelta(); // Get the time elapsed since the last call to this function

            mixers.current.forEach((mixer) => {
                mixer.update(delta / 2); // Update each mixer with the elapsed time
            });

            if (isFollowRef.current) {
                updateCameraFollow();
            } else if (isFPVRef.current) {
                updateFirstPersonView();
            }
            renderer.render(scene, camera);
        }

        preloadAssets();

        setCameraSettings({
            position: { x: 0, y: 100, z: 100 },
            target: { x: 0, y: getYPosition(0, 0), z: 0 }
        });

        setZoom(0.5);

        animate();

        return () => {
            if (mountRef.current && rendererRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement); // Check and remove child safely
            }
            // window.removeEventListener('mouseup', syncCameraState);
        };
    }, [mapData]);

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

        /*cameraSettings.target.x = blob.position.x;
        cameraSettings.target.y = blob.position.y;
        cameraSettings.target.z = blob.position.z;

        cameraSettings.position.x = blob.position.x + offsets.x;
        cameraSettings.position.y = blob.position.y + offsets.y;*/

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
                x: blob.position.x + Math.cos(blob.userData.angle),
                y: 1,
                z: blob.position.z + Math.sin(blob.userData.angle)
            },
            target: {
                x: blob.position.x + 2*Math.cos(blob.userData.angle),
                y: 1,
                z: blob.position.z + 2*Math.sin(blob.userData.angle)
            }
        })

       /* console.log('chngCam: ', {
            position: {
                x: blob.position.x + Math.cos(blob.userData.angle),
                y: 2,
                z: blob.position.z + Math.sin(blob.userData.angle)
            },
            target: {
                x: blob.position.x + 2*Math.cos(blob.userData.angle),
                y: 1.5,
                z: blob.position.z + 2*Math.sin(blob.userData.angle)
            }
        });*/
    }

    const moveXZ = useCallback((dX, dZ) => {
        if (!cameraRef.current) return;

        // Ensure we are calculating the angle of rotation around the Y-axis
        const phi = Math.atan2(
            cameraSettingsRef.current.position.z - cameraSettingsRef.current.target.z,
            cameraSettingsRef.current.position.x - cameraSettingsRef.current.target.x
        );

        console.log("Angle Phi in degrees:",
            phi * 180 / Math.PI,
            cameraSettingsRef.current.position.z - cameraSettingsRef.current.target.z,
            cameraSettingsRef.current.position.x - cameraSettingsRef.current.target.x
        );

        // Calculate the new positions based on the camera's orientation
        /*const drX = dX * Math.cos(phi) - dZ * Math.sin(phi);
        const drZ = dX * Math.sin(phi) + dZ * Math.cos(phi);*/
        const drX = dX * Math.sin(phi) + dZ * Math.cos(phi);
        const drZ = -dX * Math.cos(phi) + dZ * Math.sin(phi);

        console.log("dX, dZ:", dX, dZ);
        console.log("drX, drZ:", drX, drZ);

        // Apply the calculated positional changes to the camera settings
        setCameraSettings(prev => ({
            position: { ...prev.position, x: prev.position.x + drX, z: prev.position.z + drZ },
            target: { ...prev.target, x: prev.target.x + drX, z: prev.target.z + drZ, y: getYPosition(prev.target.x + drX, prev.target.z + drZ, true) }
        }));
    }, [cameraSettings.target, cameraSettings.position]);



    /*useEffect(() => {
        // console.log('After change: ', cameraSettings.position, cameraSettings.target);
    }, [cameraSettings.target, cameraSettings.position])*/

    // Button handlers for camera controls
    function handleZoomIn() {
        setZoom(zoom => zoom * 1.1);
    }

    function handleZoomOut() {
        setZoom(zoom => Math.max(0.25, zoom * 0.9));
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
            <p>Blobs Alive: {totalStats.totalBlobs}</p>
            <p>Births/dies: {totalStats.born} / {totalStats.died}</p>
            <p>Male: {totalStats.totalMale}</p>
            <p>Female: {totalStats.totalFemale}</p>
            <p>Average Age: {totalStats.averageAge}</p>
            <p>Food: {totalStats.totalFood}</p>
            <p>Eaten: {totalStats.foodEaten}</p>
            <p>Grown: {totalStats.foodGrown}</p>
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
