import * as THREE from 'three';
import Project from "./Project.js";


export default class Renderer
{
    constructor()
    {
        this.project = new Project();
        this.canvas = this.project.canvas;
        this.sizes = this.project.sizes;
        this.scene = this.project.scene;
        this.camera = this.project.camera;

        this.setInstance();

    }

    setInstance()
    {
        this.instance =  new THREE.WebGLRenderer({
            canvas : this.canvas,
            antialias : true
        });

        this.instance.physicallyCorrectLights = true;
        this.instance.outputEncoding = THREE.sRGBEncoding;
        this.instance.toneMapping = THREE.CineonToneMapping;
        this.instance.toneMappingExposure = 1.75;
        this.instance.shadowMap.enabled = true;
        this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
        this.instance.setSize(this.sizes.width, this.sizes.height);
        this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, 2));
    }

    resize()
    {
        this.instance.setSize(this.sizes.width, this.sizes.height);
        this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, 2));
    }

    update()
    {
        this.instance.render(this.scene, this.camera.instance);
    }

}