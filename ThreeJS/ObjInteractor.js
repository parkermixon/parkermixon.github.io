import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ThreeMeshUI from "three-mesh-ui";

export const ObjectInteractor = class {

    rotInputScale = 10;
    zoomInputScale = 20;
    playbackInputScale = 0.1; // as per frame

    minPlaybackSpeed = 0.1;
    maxPlaybackSpeed = 2;

    #time = 0;
    set time(val) {
        this.#time = val;
        if (this.mode == 'xr') {
            this.timeLabel.set({
                content: "Time: " + val.toFixed(2).toString() + "s"
            });
        } else {
            this.timeLabel.innerText = "Time: " + val.toFixed(2).toString() + "s";
        }
    }

    get time() { 
        return this.#time;
    }

    #playbackSpeed = 1;
    set playbackSpeed(val) { 
        this.#playbackSpeed = val;

        if (this.mode == 'xr') {
            this.speedLabel.set({
                content: "Speed: " + val.toFixed(2).toString() + "x"
            });
        } else {
            this.speedLabel.innerText = "Speed: " + val.toFixed(2).toString() + "x";
        }
    }

    get playbackSpeed() { 
        return this.#playbackSpeed;
    }

    // Todo change constructor to just set up vars, then make an init
    constructor(isXRSupported, interactionObj, initDist, noXrControlTemplate, width = window.innerWidth, height = window.innerHeight) {
        this.mode = (isXRSupported) ? 'xr' : 'noxr';
        this.noXrControlTemplate = noXrControlTemplate;
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera( 75, width / height, 0.1, 1000 );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize( width, height );
        document.body.appendChild( this.renderer.domElement );

        this.interactionObj = interactionObj.clone();
        this.scene.add(this.interactionObj);

        //Variables to be defined by init functions
        this.controlGui = null;
        this.timeLabel = null;
        this.speedLabel = null;

        if (isXRSupported) {
            // Enable vr & apply vr settings
            this.renderer.xr.enabled = true;
            this.#initXR();
            this.interactionObj.position.set(
                this.camera.position.x, 
                this.camera.position.y, 
                this.camera.position.z - initDist,
            );
        } else {
            this.#initNoXR();
            this.interactionObj.position.set(
                this.camera.position.x, 
                this.camera.position.y, 
                this.camera.position.z,
            );
    
            this.camera.position.z = initDist;
        }

        this.playbackSpeed = 1;
        this.time = 0;

        document.body.appendChild(VRButton.createButton(this.renderer));
        this.renderer.setAnimationLoop(() => {
            if (isXRSupported) {
                this.#pollControllerInputs();
                ThreeMeshUI.update();
            } else {

            }
            
            this.renderer.render(this.scene, this.camera);
        });
    }

    #initXR() {
        // Create Gui
        const container = this.#createGui();

        this.scene.add(container);

        this.controlGui = container;

        // Load Controllers

        this.renderer.xr.addEventListener('sessionstart', ()=> {
            console.log('Starting XR Session')
    
            // Init right controller
            this.rightController = this.renderer.xr.getController(0);
            this.rightController.name = 'right';
            this.rightController.isSelected = false;
            this.rightController.isGripped = false;
    
            this.rightController.addEventListener( 'connected', (e) => {
                this.rightController.gamepad = e.data.gamepad
            });
    
            this.rightController.addEventListener("selectstart", (event) => {
                this.rightController.isSelected = true;
                this.rightController.prevPosition = this.rightController.position.clone();
            });
    
            this.rightController.addEventListener("selectend", (event) => {
                this.rightController.isSelected = false;
                this.rightController.prevPosition.set(0, 0, 0);
            })
    
            this.rightController.addEventListener("squeezestart", (event) => {
                this.rightController.isGripped = true;
                this.rightController.prevPosition = this.rightController.position.clone();
            });
    
            this.rightController.addEventListener("squeezeend", (event) => {
                this.rightController.isGripped = false;
                this.rightController.prevPosition.set(0, 0, 0);
            })
    
            // Init left controller
            this.leftController = this.renderer.xr.getController(1);
            this.leftController.name = 'left';
            this.leftController.isSelected = false;
            this.leftController.isGripped = false;
    
            this.leftController.addEventListener( 'connected', (e) => {
                this.leftController.gamepad = e.data.gamepad
            });
            
            this.leftController.addEventListener("selectstart", (event) => {
                this.leftController.isSelected = true;
                this.leftController.prevPosition = this.leftController.position.clone();
            });
    
            this.leftController.addEventListener("selectend", (event) => {
                this.leftController.isSelected = false;
                this.leftController.prevPosition.set(0, 0, 0);
            });
    
            this.leftController.addEventListener("squeezestart", (event) => {
                this.leftController.isGripped = true;
                this.leftController.prevPosition = this.leftController.position.clone();
            });
    
            this.leftController.addEventListener("squeezeend", (event) => {
                this.leftController.isGripped = false;
                this.leftController.prevPosition.set(0, 0, 0);
            })
        });
    
        this.renderer.xr.addEventListener('sessionend', () => {
            this.leftController = null;
            this.rightController = null;
        });
    }

    #initNoXR() {

        this.controlGui = document.body.appendChild(this.noXrControlTemplate.content);
        // Yes, this will ignore the id in the template, only finding for inserted element
        this.timeLabel = document.getElementById("timeLabel");
        this.speedLabel = document.getElementById("speedLabel");

        let speedControl = document.getElementById("speedControl");
        speedControl.min = this.minPlaybackSpeed;
        speedControl.max = this.maxPlaybackSpeed;
        speedControl.step = this.playbackInputScale;
        speedControl.value = this.playbackSpeed;
        speedControl.addEventListener("change", (e)=> {
            this.playbackSpeed = parseFloat(e.target.value);
        });

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.update();
    }

    #pollControllerInputs() {
        // defaults to right controller
        if (this.rightController) {
            if (this.rightController.isSelected) {
                let deltaPos = this.rightController.prevPosition.clone().sub(this.rightController.position);
                // rotate y on local axis
                this.interactionObj.rotateY(-deltaPos.x * this.rotInputScale);
                // rotate x on world axis
                this.interactionObj.rotateOnWorldAxis(new THREE.Vector3(-1, 0, 0), -deltaPos.y * this.rotInputScale);
            }

            if (this.rightController && this.rightController.gamepad) {
                // axis 2 is x
                let playback_val = this.rightController.gamepad.axes[2] || this.rightController.gamepad.axes[0];
                playback_val *= this.playbackInputScale;
                this.playbackSpeed += playback_val / 60;
                this.playbackSpeed = Math.min(this.maxPlaybackSpeed, Math.max(this.playbackSpeed, this.minPlaybackSpeed));
                // divide by 60 to attempt to adjust to framerate
            }

        } else if (this.leftController) {
            if (this.leftController.isSelected) {
                let deltaPos = this.leftController.prevPosition.clone().sub(this.leftController.position);
                // rotate y on local axis
                this.interactionObj.rotateY(-deltaPos.x * this.rotInputScale);
                // rotate x on world axis
                this.interactionObj.rotateOnWorldAxis(new THREE.Vector3(-1, 0, 0), -deltaPos.y * this.rotInputScale);
            }
        }

        if (this.rightController && this.leftController) {
            if (this.rightController.isGripped && this.leftController.isGripped) {
                let prevDist = this.leftController.prevPosition.sub(this.rightController.prevPosition).length();
                let currentDist = this.leftController.position.clone().sub(this.rightController.position).length();
                let zoomVal = currentDist - prevDist;
                this.interactionObj.translateZ(zoomVal * this.zoomInputScale);
            }
        }

        if (this.rightController) {
            this.rightController.prevPosition = this.rightController.position.clone();
        }
        if (this.leftController) { 
            this.leftController.prevPosition = this.leftController.position.clone();
        }
    }

    #createGui() {
        const container = new ThreeMeshUI.Block({
            width: 1.2,
            height: 0.7,
            padding: 0.2,
            fontFamily: './assets/Roboto-msdf.json',
            fontTexture: './assets/Roboto-msdf.png',
        });
    
        let timePanel = new ThreeMeshUI.Block({
            width: 0.6,
            height: 0.2,
            fontFamily: './assets/Roboto-msdf.json',
            fontTexture: './assets/Roboto-msdf.png',
            backgroundOpacity: 0
        })
        
        this.timeLabel = new ThreeMeshUI.Text({
            content: "Time: "
        });
    
        timePanel.add(this.timeLabel);
        container.add(timePanel);
    
        let playbackSpeedPanel = new ThreeMeshUI.Block({
            width: 0.6,
            height: 0.2,
            fontFamily: './assets/Roboto-msdf.json',
            fontTexture: './assets/Roboto-msdf.png',
            backgroundOpacity: 0
        })
    
        this.speedLabel = new ThreeMeshUI.Text({
            content: "Speed: 1"
        });
    
        playbackSpeedPanel.add(this.speedLabel);
        container.add(playbackSpeedPanel);

        return container;
    }
}
