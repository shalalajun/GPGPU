import * as THREE from 'three';
import Project from "../Project.js";
import Environment from './Environment.js';
import Boid from './Boid.js'

export default class World
{
    constructor()
    {
        this.project = new Project();
  
        this.scene = this.project.scene;
        this.resources = this.project.resources;


        this.resources.on('ready', ()=>
        {
            this.environment = new Environment();
        })

       
    }

   

}