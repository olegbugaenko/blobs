import * as THREE from 'three';

function disposeNode(node) {
    if (node instanceof THREE.Mesh) {
        // Dispose of the mesh's geometry
        if (node.geometry) {
            node.geometry.dispose();
        }
        // Dispose of the mesh's material
        if (node.material) {
            if (Array.isArray(node.material)) {
                node.material.forEach(material => disposeMaterial(material));
            } else {
                disposeMaterial(node.material);
            }
        }
    }
}

function disposeMaterial(material) {
    if (material.map) {
        material.map.dispose();
    }
    if (material.lightMap) {
        material.lightMap.dispose();
    }
    if (material.bumpMap) {
        material.bumpMap.dispose();
    }
    if (material.normalMap) {
        material.normalMap.dispose();
    }
    if (material.specularMap) {
        material.specularMap.dispose();
    }
    if (material.envMap) {
        material.envMap.dispose();
    }
    material.dispose();  // Dispose the material itself
}

export function disposeHierarchy(node) {
    node.traverse(disposeNode);
    if (node.parent) {
        node.parent.remove(node);  // Remove the node from its parent
    }
    node = undefined;
}
