import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { VTKLoader } from 'three/addons/loaders/VTKLoader.js';

//TODO: if I implement server side stuff, could use vtk.js to read file, then serve back vtk model and the vertex values to be animated on the client side

// const height = 
const importMeshSize = 10;
const rotInputScale = 10;
const zoomInputScale = 20;

var renderer, camera, scene, interactionObj;
var leftController = null;
var rightController = null;

function init() {
    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 100 );
    scene = new THREE.Scene();
    scene.add(camera);

    // Renderer
    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    
    // Enable vr & apply vr settings
    document.body.appendChild( VRButton.createButton(renderer));
    renderer.xr.enabled = true;

    // TODO: turn controller set up into functions
    renderer.xr.addEventListener('sessionstart', ()=> {
        console.log('starting session')

        // Init right controller

        rightController = renderer.xr.getController(0);
        rightController.name = 'right';
        rightController.isSelected = false;
        rightController.isGripped = false;

        rightController.addEventListener("selectstart", (event) => {
            rightController.isSelected = true;
            rightController.prevPosition = rightController.position.clone();
        });

        rightController.addEventListener("selectend", (event) => {
            rightController.isSelected = false;
            rightController.prevPosition.set(0, 0, 0);
        })

        rightController.addEventListener("squeezestart", (event) => {
            rightController.isGripped = true;
            rightController.prevPosition = rightController.position.clone();
        });

        rightController.addEventListener("squeezeend", (event) => {
            rightController.isGripped = false;
            rightController.prevPosition.set(0, 0, 0);
        })

        // Init left controller
        leftController = renderer.xr.getController(1);
        leftController.name = 'left';
        leftController.isSelected = false;
        leftController.isGripped = false;
        console.log(leftController);
        
        leftController.addEventListener("selectstart", (event) => {
            leftController.isSelected = true;
            leftController.prevPosition = leftController.position.clone();
        });

        leftController.addEventListener("selectend", (event) => {
            leftController.isSelected = false;
            leftController.prevPosition.set(0, 0, 0);
        });

        leftController.addEventListener("squeezestart", (event) => {
            leftController.isGripped = true;
            leftController.prevPosition = leftController.position.clone();
        });

        leftController.addEventListener("squeezeend", (event) => {
            leftController.isGripped = false;
            leftController.prevPosition.set(0, 0, 0);
        })
    });

    renderer.xr.addEventListener('sessionend', () => {
        leftController = null;
        rightController = null;
    });

    // Load vtk file
    const loader = new VTKLoader();
    loader.load( 'data/vtk_export.vtk', function ( geometry ) {

        geometry.center();
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial( { color: 0xffffff });
        material.side = THREE.DoubleSide;
        material.vertexColors = true;
        const mesh = new THREE.Mesh( geometry, material );

        interactionObj = new THREE.Group();
        interactionObj.add(mesh);
        mesh.rotateX(-90);

        let scale = importMeshSize / geometry.boundingBox.max.sub(geometry.boundingBox.min).length();
        mesh.scale.multiplyScalar(scale);
        let dist = Math.abs(geometry.boundingBox.max.z) * scale * 2 * 1.5;
        interactionObj.position.set(camera.position.x, camera.position.y, camera.position.z - dist);
        
        scene.add(interactionObj);
        
        fetch('data/uter_out.json').then((response) => response.json()).then((json_data) => {
            let vertex_vals = json_data.pointValues;
            let vertex_colors = json_data.colors;
            let time = json_data.time;
            anim_vertex_colors(geometry, vertex_colors, time);
        })

    } );

    renderer.setAnimationLoop(animate);
    document.body.appendChild( renderer.domElement );
}

function animate() {
    // defaults to right controller
    if (rightController) {
        if (rightController.isSelected) {
            console.log(rightController.prevPosition);
            let deltaPos = rightController.prevPosition.clone().sub(rightController.position);
            // rotate y on local axis
            interactionObj.rotateY(-deltaPos.x * rotInputScale);
            // rotate x on world axis
            interactionObj.rotateOnWorldAxis(new THREE.Vector3(-1, 0, 0), -deltaPos.y * rotInputScale);
        }
    } else if (leftController) {
        if (leftController.isSelected) {
            let deltaPos = leftController.prevPosition.clone().sub(leftController.position);
            // rotate y on local axis
            interactionObj.rotateY(-deltaPos.x * rotInputScale);
            // rotate x on world axis
            interactionObj.rotateOnWorldAxis(new THREE.Vector3(-1, 0, 0), -deltaPos.y * rotInputScale);
        }
    }

    if (rightController && leftController) {
        if (rightController.isGripped && leftController.isGripped) {
            let prevDist = leftController.prevPosition.sub(rightController.prevPosition).length();
            let currentDist = leftController.position.clone().sub(rightController.position).length();
            let zoomVal = currentDist - prevDist;
            interactionObj.translateZ(zoomVal * zoomInputScale);
            
            console.log(interactionObj.position.z)
        }
    }

    if (rightController) {
        rightController.prevPosition = rightController.position.clone();
    }
    if (leftController) { 
        leftController.prevPosition = leftController.position.clone();
    }

    
    renderer.render(scene, camera);
}

async function anim_vertex_colors(geo, vertex_colors, time_values) {
    let time_idx = 0;
    while (true) {        
        // Update vertex colors
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertex_colors[time_idx]), 3));

        // Calculate frame time
        let deltaTime;
        if (time_idx < time_values.length-2) {
            deltaTime = (time_values[time_idx+1] - time_values[time_idx]) * 1000;
        }
        else {
            deltaTime = 1000;
        }
        
        time_idx += 1;
        if (time_idx > time_values.length-1) {
            time_idx = 0;
            console.log('looping');
        }

        await new Promise(r => setTimeout(r, deltaTime));
    }
}

init();