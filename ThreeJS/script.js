import { ObjectInteractor } from "./ObjInteractor.js";
import { VTKLoader } from 'three/addons/loaders/VTKLoader.js';
import * as THREE from 'three';

const importMeshSize = 10;
const noXrTemplate = document.getElementById("noXrControlGui");

var objInteractor;

const loader = new VTKLoader();
loader.load( './data/vtk_export.vtk', function ( geometry ) {

    geometry.center();
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial( { color: 0xffffff });
    material.side = THREE.DoubleSide;
    material.vertexColors = true;
    const mesh = new THREE.Mesh( geometry, material );

    const interactionObj = new THREE.Group();
    interactionObj.add(mesh);
    
    // Have to realign this mesh due to different coord systems
    mesh.rotateX(-90);

    let scale = importMeshSize / geometry.boundingBox.max.sub(geometry.boundingBox.min).length();
    mesh.scale.multiplyScalar(scale);
    let initDist = Math.abs(geometry.boundingBox.max.z) * scale * 2 * 1.5;
    
    navigator.xr.isSessionSupported('immersive-vr').then((isSupported) => {
        objInteractor = new ObjectInteractor(isSupported, interactionObj, initDist, noXrTemplate);
    });
    
    fetch('./data/uter_out.json').then((response) => response.json()).then((json_data) => {
        let vertex_vals = json_data.pointValues;
        let vertex_colors = json_data.colors;
        let time = json_data.time;
        anim_vertex_colors(geometry, vertex_colors, time);
    })
    
} );

async function anim_vertex_colors(geo, vertex_colors, time_values) {
    let time_idx = 0;
    while (true) {        
        // Update vertex colors
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertex_colors[time_idx]), 3));

        // Calculate frame time
        let deltaTime;
        if (time_idx < time_values.length-1) {
            deltaTime = (time_values[time_idx+1] - time_values[time_idx]) * 1000;
        }
        else {
            deltaTime = 1000;
        }

        objInteractor.time = time_values[time_idx];
        
        time_idx += 1;
        // Loop if greater than time
        if (time_idx > time_values.length-1) {
            time_idx = 0;
        }

        await new Promise(r => setTimeout(r, deltaTime/objInteractor.playbackSpeed));
    }
}
