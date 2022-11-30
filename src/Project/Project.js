import * as THREE from 'three';
import Sizes from "./Utils/Sizes.js";
import Time from "./Utils/Time.js";
import Camera from './Camera.js';
import Renderer from './Renderer.js';
import World from './World/World.js';
import Resources from './Utils/Resources.js';
import sources from './sources.js'
import Boid from './World/Boid.js'



let instance = null;

export default class Project
{
    constructor(canvas)
    {

        if(instance)
        {
            return instance;
        }

        instance = this;

        window.project = this;
        this.canvas =canvas;
        this.sizes = new Sizes();
        this.time = new Time();
        this.scene = new THREE.Scene();
        this.resources = new Resources(sources);
        this.camera = new Camera();
        this.renderer = new Renderer();
        this.world = new World();
        this.boid = new Boid();
        this.gravity = new THREE.Vector3(0, -0.005, 0);
        this.wind = new THREE.Vector3(0.002,0,0);


        this.sizes.on('resize',()=>
        {
            this.resize();
        })

        this.time.on('tick',()=>
        {
           this.update();
        })
    }

    resize()
    {
        this.camera.resize();
        this.renderer.resize();
        
    }

    update()
    {
        this.camera.update();
        this.renderer.update();
        this.boid.applyForce(this.gravity);
        //window.addEventListener('mousedown', this.boid.applyForce(this.wind), false);
        //this.boid.applyForce(this.wind);
        this.boid.update();
        this.boid.edges();
       
    }
}