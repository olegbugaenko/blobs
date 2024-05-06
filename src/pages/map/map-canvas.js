import React, {useRef, useEffect, useState, useContext, useCallback} from 'react';
import WorkerContext from '../../context/worker-context';
import * as THREE from 'three';
import {useWorkerClient} from "../../general/client";
import {BlobDetails} from "./blob-details";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {disposeHierarchy} from "../../helpers/web-gl.helper";
import {throttle} from "../../helpers/utils.helper";
import {MiniMap} from "./mini-map";
import {BlobStats} from "./blob-stats";


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
    const decorsRef = useRef({ models: {}, instances: {} });
    const { onMessage, sendData } = useWorkerClient(worker);
    const [ totalStats, setTotalStats ] = useState({});
    const [ mapData, setMapData ] = useState({});
    const mouse = new THREE.Vector2();
    const mixers = useRef(new Map());
    const clock = new THREE.Clock();
    const currentBlobIDs = new Set();
    const currentTreeIDs = new Set();
    const currentDecorationIDs = new Set();
    const currentFoodIDs = new Set();
    const terrainChunks = useRef({});

    const [cameraSettings, setCameraSettings] = useState({
        position: { x: 0, y: 200, z: 300 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 2,
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
        try {
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
        } catch (e) {
            console.error(e);
            console.error('IID: ', cameraRef.current, mouse, blobsRef.current);
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
        throttle(sendData, 500)('camera-position', cameraSettingsRef.current);
        // console.log('dbc: ', cameraSettings);
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
                    position: { x: newX, y: newY, z: newZ },
                    zoom: prev.zoom
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

        // console.log('terr_key: ', heightData.key, positions.length, chunkWidth, chunkDepth, segments);
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

        scene.fog = new THREE.FogExp2(0xe0e0e0, 0.001); // Color, near, far

// Add a directional light source to represent the sun
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(1000, 1000, 1000); // Adjust position as needed
        scene.add(sunLight);

// Add ambient light to the scene with a light blue color
        const ambientLight = new THREE.AmbientLight(0x87cefb, 0.5); // Soft blue light
        scene.add(ambientLight);
        // const camera = new THREE.OrthographicCamera(-aspect * 10, aspect * 10, 10, -10, 1, 1000);
        const camera = new THREE.PerspectiveCamera(10, aspect, 0.1, 500);
        cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x80c0e0); // Set a clear background color
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer; // Store renderer in ref
        const gridHelper = new THREE.GridHelper(200, 50);
        scene.add(gridHelper);
        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);

        const cameraHelper = new THREE.CameraHelper(camera);
        scene.add(cameraHelper);

/*        const light = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(light);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 10, 0);
        scene.add(directionalLight);*/

        onMessage('map-heights', (payload) => {
            const receivedKeys = new Set(payload.terrain.map(({ key }) => key));  // Keys from the payload
            console.log('payload.terrain: ', payload.terrain.length, mapData);

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
            // console.log('Selected blob: ', payload);
            setSelectedBlobData(payload);
        })


        function logModelMetrics(scene, label) {
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    const geometry = object.geometry;
                    let vertices;
                    if (geometry instanceof THREE.BufferGeometry) {
                        // For BufferGeometry objects
                        const positionAttribute = geometry.attributes.position;
                        vertices = positionAttribute ? positionAttribute.count : 0;
                    } else {
                        console.warn(`${label}: Unsupported geometry type for ${object.name}`);
                        return;
                    }

                    const faces = geometry.index ? geometry.index.count / 3 : 0;
                    const triangles = faces * 3; // Each face consists of 3 vertices

                    console.log(`${label}: Model: ${object.name}`);
                    console.log(`- Vertices: ${vertices}`);
                    console.log(`- Faces: ${faces}`);
                    console.log(`- Triangles: ${triangles}`);
                }
            });
        }


        function preloadAssets() {
            const loader = new GLTFLoader();
            const textureLoader = new THREE.TextureLoader();
            const assetsToLoad = 11; // Adjust based on number of assets
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
                //logModelMetrics(gltf.scene, 'food');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            /*loader.load('models/tree-v2.glb', function (gltf) {
                loader.load('models/tree-v2-min.glb', function (gltfMin) {
                    const lod = new THREE.LOD();

                    gltf.scene.matrixAutoUpdate = false;
                    gltfMin.scene.matrixAutoUpdate = false;
                    gltf.scene.updateMatrix();
                    gltfMin.scene.updateMatrix();
                    lod.addLevel(gltf.scene);
                    lod.addLevel(gltfMin.scene, 100);
                    treeRef.current.models.model = lod;
                    console.log('Tree model loaded');
                    //logModelMetrics(gltf.scene, 'tree-v2');
                    assetLoaded(); // Mark this asset as loaded
                })

            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/tree-v3.glb', function (gltf) {
                treeRef.current.models.modelv2 = gltf.scene;
                console.log('Tree v2 model loaded');
                //logModelMetrics(gltf.scene, 'tree-v3');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/tree-v4.glb', function (gltf) {
                treeRef.current.models.modelv3 = gltf.scene;
                console.log('Tree v3 model loaded', treeRef.current);
                //logModelMetrics(gltf.scene, 'tree-v4');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });*/

            function createLOD(scene, sceneMin, distance) {
                const lod = new THREE.LOD();
                scene.matrixAutoUpdate = false;
                sceneMin.matrixAutoUpdate = false;
                scene.updateMatrix();
                sceneMin.updateMatrix();
                lod.addLevel(scene, 0);
                lod.addLevel(sceneMin, distance); // Adjust the distance factor as needed
                return lod;
            }

            function loadTreeModel(modelName, modelNameMin, modelRef, distance, callback) {
                loader.load(`models/${modelName}.glb`, function (gltf) {
                    loader.load(`models/${modelNameMin}-min.glb`, function (gltfMin) {
                        const lod = createLOD(gltf.scene, gltfMin.scene, distance);
                        modelRef.current.models[modelName] = lod;
                        console.log(`${modelName} model loaded`);
                        callback(); // Mark this asset as loaded
                    });
                }, undefined, function (error) {
                    console.error('Error loading GLB model:', error);
                });
            }

            loadTreeModel('tree-v2', 'tree-v2', treeRef, 400, assetLoaded);
            loadTreeModel('tree-v3', 'tree-v3', treeRef, 400, assetLoaded);
            loadTreeModel('tree-v4', 'tree-v4', treeRef, 400, assetLoaded);

            loader.load('models/trinkets-v1-min4.glb', function (gltf) {
                decorsRef.current.models.modelv1 = gltf.scene;
                console.log('Decor v1 model loaded');
                //logModelMetrics(gltf.scene, 'trinkets-v1');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/trinkets-v2-min4.glb', function (gltf) {
                decorsRef.current.models.modelv2 = gltf.scene;
                console.log('Decor v2 model loaded');
                //logModelMetrics(gltf.scene, 'trinkets-v2');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/flora-v3-min4.glb', function (gltf) {
                decorsRef.current.models.modelv3 = gltf.scene;
                console.log('Decor v3 model loaded');
                //logModelMetrics(gltf.scene, 'flora-v3');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/flora-v4-min4.glb', function (gltf) {
                decorsRef.current.models.modelv4 = gltf.scene;
                console.log('Decor v4 model loaded');
                //logModelMetrics(gltf.scene, 'flora-v4');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });


            loader.load('models/flora-v5-min4.glb', function (gltf) {
                decorsRef.current.models.modelv5 = gltf.scene;
                console.log('Decor v5 model loaded');
                //logModelMetrics(gltf.scene, 'flora-v5');
                assetLoaded(); // Mark this asset as loaded
            }, undefined, function (error) {
                console.error('Error loading GLB model:', error);
            });

            loader.load('models/flora-v6-min4.glb', function (gltf) {
                const simplified = gltf.scene.clone();
                // simplifyModel(simplified, 0.5);
                // console.log('Decor v6 model loaded');
                logModelMetrics(gltf.scene, 'flora-v6');
                // logModelMetrics(simplified, 'flora-v6-simplified');
                decorsRef.current.models.modelv6 = gltf.scene;
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

                logModelMetrics(gltf.scene);


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
            console.log('received-trees: ', payload.trees.length);

            const newTreeIDs = new Set();
            // Process received trees and update or create new ones
            payload.trees.forEach(treeItem => {
                newTreeIDs.add(treeItem.id);
                // pendingObjectPlacements.current.trees.push(treeItem);
                let treeMesh = treeRef.current.instances[treeItem.id];
                if (!treeMesh) {
                    // Create new tree mesh
                    if(treeItem.type === 'v0') {
                        treeMesh = treeRef.current.models['tree-v2'].clone();
                    } else if(treeItem.type === 'v1') {
                        treeMesh = treeRef.current.models['tree-v3'].clone();
                    } else if(treeItem.type === 'v2') {
                        treeMesh = treeRef.current.models['tree-v4'].clone();
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


        onMessage('decorations-coordinates', payload => {
            console.log('received-decorations: ', payload.decorations.length);

            const newDecorationIDs = new Set();
            // Process received trees and update or create new ones
            payload.decorations.forEach(decorItem => {
                newDecorationIDs.add(decorItem.id);
                // pendingObjectPlacements.current.trees.push(decorItem);
                let decorMesh = decorsRef.current.instances[decorItem.id];
                if (!decorMesh) {
                    // Create new tree mesh
                    if(decorItem.type === 0) {
                        decorMesh = decorsRef.current.models.modelv1.clone();
                        decorMesh.scale.set(2,2,2);
                    } else if(decorItem.type === 1) {
                        decorMesh = decorsRef.current.models.modelv2.clone();
                    } else if(decorItem.type === 2) {
                        decorMesh = decorsRef.current.models.modelv3.clone();
                        decorMesh.scale.set(3,3,3);
                    } else if(decorItem.type === 3) {
                        decorMesh = decorsRef.current.models.modelv3.clone();
                    } else if(decorItem.type === 4) {
                        decorMesh = decorsRef.current.models.modelv3.clone();
                        decorMesh.scale.set(2,2,2);
                    } else if(decorItem.type === 5) {
                        decorMesh = decorsRef.current.models.modelv3.clone();
                        decorMesh.scale.set(2,2,2);
                    }

                    // const y = getYPosition(decorItem.displayX, decorItem.displayY);
                    decorMesh.position.set(decorItem.displayX, decorItem.displayZ, decorItem.displayY);
                    decorMesh.rotation.y = decorItem.angle;
                    decorMesh.userData = { id: decorItem.id };
                    decorMesh.frustumCulled = true;

                    // console.log('decorMesh: ', decorMesh);
                    scene.add(decorMesh);
                    decorsRef.current.instances[decorItem.id] = decorMesh;
                } /*else {
                    // Update existing tree
                    decorMesh.position.set(decorItem.displayX, 0, decorItem.displayY);
                    decorMesh.rotation.y = decorItem.angle;
                }*/
            });

            currentDecorationIDs.forEach(id => {
                if (!newDecorationIDs.has(id)) {
                    const decorMesh = decorsRef.current.instances[id];
                    if (decorMesh) {
                        disposeHierarchy(decorMesh, true);
                        delete decorsRef.current.instances[id];
                    }
                }
            })

            currentDecorationIDs.clear();
            newDecorationIDs.forEach(id => currentDecorationIDs.add(id));
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
            // console.log('RND: ', performance.now() - st);
        }

        preloadAssets();

        setCameraSettings({
            position: { x: 0, y: 100, z: 100 },
            target: { x: 0, y: getYPosition(0, 0), z: 0 },
            zoom: 0.5
        });

        animate();

        return () => {
            if (mountRef.current && rendererRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement); // Check and remove child safely
            }
            // window.removeEventListener('mouseup', syncCameraState);
        };
    }, [mapData]);

    function updateCamera() {


        if (cameraRef.current && cameraSettings.position && cameraSettings.target) {
            cameraRef.current.position.set(cameraSettings.position.x, cameraSettings.position.y, cameraSettings.position.z);
            cameraRef.current.lookAt(new THREE.Vector3(cameraSettings.target.x, cameraSettings.target.y, cameraSettings.target.z));
            cameraRef.current.zoom = cameraSettings.zoom;
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

        setCameraSettings((prev) => {
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
                },
                zoom: prev.zoom
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
        setCameraSettings(prev => ({
            position: {
                x: blob.position.x + Math.cos(blob.userData.angle),
                y: 1,
                z: blob.position.z + Math.sin(blob.userData.angle)
            },
            target: {
                x: blob.position.x + 2*Math.cos(blob.userData.angle),
                y: 1,
                z: blob.position.z + 2*Math.sin(blob.userData.angle)
            },
            zoom: prev.zoom,
        }));

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

        /*console.log("Angle Phi in degrees:",
            phi * 180 / Math.PI,
            cameraSettingsRef.current.position.z - cameraSettingsRef.current.target.z,
            cameraSettingsRef.current.position.x - cameraSettingsRef.current.target.x
        );*/

        // Calculate the new positions based on the camera's orientation
        /*const drX = dX * Math.cos(phi) - dZ * Math.sin(phi);
        const drZ = dX * Math.sin(phi) + dZ * Math.cos(phi);*/
        const drX = dX * Math.sin(phi) + dZ * Math.cos(phi);
        const drZ = -dX * Math.cos(phi) + dZ * Math.sin(phi);

        // console.log("dX, dZ:", dX, dZ);
        // console.log("drX, drZ:", drX, drZ);

        // Apply the calculated positional changes to the camera settings
        setCameraSettings(prev => ({
            position: { ...prev.position, x: prev.position.x + drX, z: prev.position.z + drZ },
            target: { ...prev.target, x: prev.target.x + drX, z: prev.target.z + drZ, y: getYPosition(prev.target.x + drX, prev.target.z + drZ, true) },
            zoom: prev.zoom
        }));
    }, [cameraSettings.target, cameraSettings.position]);



    /*useEffect(() => {
        // console.log('After change: ', cameraSettings.position, cameraSettings.target);
    }, [cameraSettings.target, cameraSettings.position])*/

    // Button handlers for camera controls
    function handleZoomIn() {
        setCameraSettings(prev => ({...prev, zoom: prev.zoom * 1.1}));
    }

    function handleZoomOut() {
        setCameraSettings(prev => ({...prev, zoom: Math.max(0.25, prev.zoom * 0.9)}));
    }

    function saveGame() {
        sendData('save-game', {});
    }

    function loadGame() {
        sendData('load-game', JSON.parse(window.localStorage.getItem('game')));
    }

    onMessage('game-loaded', (data) => {
        console.log('game-loaded: ', data);
        // need to free all resources dedicated to blobs/trees/decors, and send init-map event
        for (const blobId in blobsRef.current.instances) {
            const blobMesh = blobsRef.current.instances[blobId];
            if (blobMesh) {
                disposeHierarchy(blobMesh, true);
            }
        }
        blobsRef.current = {};

        // Free all resources dedicated to trees
        for (const treeId in treeRef.current.instances) {
            const treeMesh = treeRef.current.instances[treeId];
            if (treeMesh) {
                disposeHierarchy(treeMesh, true);
            }
        }
        treeRef.current.instances = {};

        // Free all resources dedicated to decorations
        for (const decorId in decorsRef.current.instances) {
            const decorMesh = decorsRef.current.instances[decorId];
            if (decorMesh) {
                disposeHierarchy(decorMesh, true);
            }
        }

        // Free terrain also
        for (const chunkId in terrainChunks.current) {
            const chunk = terrainChunks.current[chunkId];
            if (chunk) {
                disposeHierarchy(chunk, true);
            }
        }

        terrainChunks.current = {};

        sendData('init-map', {});
    })

    useEffect(() => {
        updateCamera();
    }, [cameraSettings]);

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
        {/*<div className={'box heading'}>
            <p>Blobs Alive: {totalStats.totalBlobs}</p>
            <p>Births/dies: {totalStats.additionalStats.blobBorn} / {totalStats.additionalStats.blobDied}</p>
            <p>Male: {totalStats.totalMale}</p>
            <p>Female: {totalStats.totalFemale}</p>
            <p>Average Age: {totalStats.averageAge}</p>
            <p>Food: {totalStats.totalFood}</p>
            <p>Eaten: {totalStats.foodEaten}</p>
            <p>Grown: {totalStats.foodGrown}</p>
        </div>*/}
        <BlobStats {...totalStats} />
        <div className={'minimap-holder'}>
            <MiniMap size={120} />
        </div>
        <div className={'boxes transparent-buttons'}>
            <button onClick={saveGame}>Save game</button>
            <button onClick={loadGame}>Load game</button>
            <button onClick={() => moveXZ(5, 0)}>Move Right</button>
            <button onClick={() => moveXZ(-5, 0)}>Move Left</button>
            <button onClick={() => moveXZ(0, -5)}>Move Forward</button>
            <button onClick={() => moveXZ(0, 5)}>Move Backward</button>
        </div>
    </div>);
}

export default GameCanvas;
