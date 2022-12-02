import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'


// 이번에는 25만 파티클을 움직이는 것에 도전한다.
// 그래서 한 변이 500의 텍스처를 만든다.
// 500 * 500 = 250000

var WIDTH = 500;
var PARTICLES = WIDTH * WIDTH;
// // メモリ負荷確認用
// var stats;
// 기본 세트
var container, geometry;

// gpgpu를 하기 위해 필요한 객체들
let gpuCompute;
var velocityVariable;
var positionVariable;
var positionUniforms;
var velocityUniforms;
var particleUniforms;
var effectController;


/**
 * Loaders
 */
const gltfLoader = new GLTFLoader()
const textureLoader = new THREE.TextureLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()

/**
 * Base
 */
// Debug
const gui = new dat.GUI()
const debugObject = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Update all materials
 */
const updateAllMaterials = () =>
{
    scene.traverse((child) =>
    {
        if(child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial)
        {
            // child.material.envMap = environmentMap
            child.material.envMapIntensity = debugObject.envMapIntensity
            child.material.needsUpdate = true
            child.castShadow = true
            child.receiveShadow = true
        }
    })
}

/**
 * Environment map
 */
const environmentMap = cubeTextureLoader.load([
    '/textures/environmentMap/px.jpg',
    '/textures/environmentMap/nx.jpg',
    '/textures/environmentMap/py.jpg',
    '/textures/environmentMap/ny.jpg',
    '/textures/environmentMap/pz.jpg',
    '/textures/environmentMap/nz.jpg'
])

environmentMap.encoding = THREE.sRGBEncoding

// scene.background = environmentMap
scene.environment = environmentMap

debugObject.envMapIntensity = 0.4
gui.add(debugObject, 'envMapIntensity').min(0).max(4).step(0.001).onChange(updateAllMaterials)

/**
 * Models
 */
let foxMixer = null





/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 4)
directionalLight.castShadow = true
directionalLight.shadow.camera.far = 15
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.normalBias = 0.05
directionalLight.position.set(3.5, 2, - 1.25)
scene.add(directionalLight)

gui.add(directionalLight, 'intensity').min(0).max(10).step(0.001).name('lightIntensity')
gui.add(directionalLight.position, 'x').min(- 5).max(5).step(0.001).name('lightX')
gui.add(directionalLight.position, 'y').min(- 5).max(5).step(0.001).name('lightY')
gui.add(directionalLight.position, 'z').min(- 5).max(5).step(0.001).name('lightZ')

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 1, 15000)
camera.position.y = 120;
camera.position.z = 200;
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.physicallyCorrectLights = true
renderer.outputEncoding = THREE.sRGBEncoding
renderer.toneMapping = THREE.CineonToneMapping
renderer.toneMappingExposure = 1.75
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setClearColor('#211d20')
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () =>
{

    // 계산용 텍스처 업데이트
    gpuCompute.compute();
    // 계산한 결과가 저장된 텍스처를 렌더링용 셰이더에게 전달하다
    particleUniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
    particleUniforms.textureVelocity.value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;


    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    // Update controls
    controls.update()

    // Fox animation
    if(foxMixer)
    {
        foxMixer.update(deltaTime)
    }

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

// ①gpuCompute용 Render 만들기
initComputeRenderer();
// ② particle 초기화
initPosition();

tick()



function initComputeRenderer() {

    // ①gpuCompute용 Render 만들기
    gpuCompute = new GPUComputationRenderer( WIDTH, WIDTH, renderer );

    // 이번에는 파티클의 위치 정보와 이동 방향을 저장하는 텍스처를 두 가지 준비합니다.
    var dtPosition = gpuCompute.createTexture();
    var dtVelocity = gpuCompute.createTexture();

   // 텍스처에 GPU로 계산하기 위해 초기 정보를 채워 나가다
    fillTextures( dtPosition, dtVelocity );

   // shader 프로그램의 어태치
    velocityVariable = gpuCompute.addVariable( "textureVelocity", document.getElementById( 'computeShaderVelocity' ).textContent, dtVelocity );
    positionVariable = gpuCompute.addVariable( "texturePosition", document.getElementById( 'computeShaderPosition' ).textContent, dtPosition );

    // 일련의 관계성을 구축하기 위한 주술.
    gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
    gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );


    // uniform 변수를 등록하려면 아래와 같이 만들기
    
    positionUniforms = positionVariable.material.uniforms;
    velocityUniforms = velocityVariable.material.uniforms;

    velocityUniforms.time = { value: 0.0 };
    positionUniforms.time = { ValueB: 0.0 };
    // ***********************************
    // 예를 들어 위에서 코멘트 아웃하고 있는 effect Controller 객체의 time을
    // 내가 말하면, effect Controller.time을 갱신하면 uniform 변수도 바뀐다든가 하는 것이 가능하다.
    // velocityUniforms.time = { value: effectController.time };
    // ************************************


    // error 처리
    var error = gpuCompute.init();
    if ( error !== null ) {
        console.error( error );
    }
}

 // restart용 함수 이번에는 사용하지 않는다

 function restartSimulation() {
    var dtPosition = gpuCompute.createTexture();
    var dtVelocity = gpuCompute.createTexture();

    fillTextures( dtPosition, dtVelocity );

    gpuCompute.renderTexture( dtPosition, positionVariable.renderTargets[ 0 ] );
    gpuCompute.renderTexture( dtPosition, positionVariable.renderTargets[ 1 ] );
    gpuCompute.renderTexture( dtVelocity, velocityVariable.renderTargets[ 0 ] );
    gpuCompute.renderTexture( dtVelocity, velocityVariable.renderTargets[ 1 ] );
}


// 파티클 자체의 정보를 결정한다.
function initPosition() {

    // 최종적으로 계산된 결과를 반영하기 위한 객체.
    // 위치정보는 Shader측(texturePosition, textureVelocity)
    // 으로 결정되므로 아래와 같이 적당히 넘기고

    geometry = new THREE.BufferGeometry();
    var positions = new Float32Array( PARTICLES * 3 );
    var p = 0;
    for ( var i = 0; i < PARTICLES; i++ ) {
        positions[ p++ ] = 0;
        positions[ p++ ] = 0;
        positions[ p++ ] = 0;
    }

    // uv 정보 결정.텍스처에서 정보를 꺼낼 때 필요함

    var uvs = new Float32Array( PARTICLES * 2 );
    p = 0;
    for ( var j = 0; j < WIDTH; j++ ) {
        for ( var i = 0; i < WIDTH; i++ ) {
            uvs[ p++ ] = i / ( WIDTH - 1 );
            uvs[ p++ ] = j / ( WIDTH - 1 );
        }
    }

   // attribute를 geometry에 등록하다
    geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    geometry.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );


   // uniform 변수를 객체로 정의
   // 이번에는 카메라를 마우스로 만지작거리듯 계산에 필요한 정보도 준다.

    particleUniforms = {
        texturePosition: { value: null },
        textureVelocity: { value: null },
        cameraConstant: { value: getCameraConstant( camera ) }
    };



    // 샤더 재료 이것은 파티클 자체를 묘사하는 데 필요한 셰이더
    var material = new THREE.ShaderMaterial( {
        uniforms:       particleUniforms,
        vertexShader:   document.getElementById( 'particleVertexShader' ).textContent,
        fragmentShader: document.getElementById( 'particleFragmentShader' ).textContent
    });
    material.extensions.drawBuffers = true;
    var particles = new THREE.Points( geometry, material );
    particles.matrixAutoUpdate = false;
    particles.updateMatrix();


    scene.add( particles );
}


function fillTextures( texturePosition, textureVelocity ) {

    // texture의 이미지 데이터를 일단 꺼내다
    var posArray = texturePosition.image.data;
    var velArray = textureVelocity.image.data;

    // 파티클의 초기 위치는 랜덤한 XZ에 평면 둔다.
    // 판자 모양의 정사각형이 그려지다

    for ( var k = 0, kl = posArray.length; k < kl; k += 4 ) {
        // Position
        var x, y, z;
        x = Math.random()*500-250;
        z = Math.random()*500-250;
        y = 0;
        // posArray의 실태는 1차원 배열이기 때문에
        // x,y,z,w 순서대로 채워간다.
        // w는 이번에는 사용하지 않지만 배열의 순서등을 채워 두면 여러가지 사용할 수 있어 편리
        posArray[ k + 0 ] = x;
        posArray[ k + 1 ] = y;
        posArray[ k + 2 ] = z;
        posArray[ k + 3 ] = 0;

        // 이동하는 방향은 일단 랜덤으로 정해볼게.
        // 이걸로 랜덤한 방향으로 튀는 파티클이 완성될 거야.

        velArray[ k + 0 ] = Math.random()*2-1;
        velArray[ k + 1 ] = Math.random()*2-1;;
        velArray[ k + 2 ] = Math.random()*2-1;
        velArray[ k + 3 ] = Math.random()*2-1;
    }
}

// 카메라 객체에서 셰이더에게 전달하고 싶은 정보를 끌어오는 함수
// 카메라에서 파티클이 얼마나 떨어져 있는지 계산하고 파티클의 크기를 결정하기 위해서.
    function getCameraConstant( camera ) {
        return window.innerHeight / ( Math.tan( THREE.Math.DEG2RAD * 0.5 * camera.fov ) / camera.zoom );
    }