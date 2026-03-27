import * as CANNON from "@cocos/cannon";
import * as THREE from 'three';

window.focus();

let camera, scene, renderer, world, lastTime;
let stack = [];
let overhangs = [];
let gameStarted = false;
const boxHeight = 1;
const originalBoxSize = 3;

window.addEventListener("click", () => {
  if (!gameStarted) {
    addLayer(-11, 0, originalBoxSize, originalBoxSize, "x");
    renderer.setAnimationLoop(animation);
    gameStarted = true;
  } else {
    const topLayer = stack[stack.length - 1];
    const previousLayer = stack[stack.length - 2];

    const direction = topLayer.direction;

    const delta =
      topLayer.threejs.position[direction] -
      previousLayer.threejs.position[direction];

    const overhangSize = Math.abs(delta);

    const size = direction === "x" ? topLayer.width : topLayer.depth;

    const overlap = size - overhangSize;

    if (overlap > 0) {
      cutBox(topLayer, overlap, size, delta);
      const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
      const overhangX =
        direction == "x"
          ? topLayer.threejs.position.x + overhangShift
          : topLayer.threejs.position.x;
      const overhangZ =
        direction == "z"
          ? topLayer.threejs.position.z + overhangShift
          : topLayer.threejs.position.z;
      const overhangWidth = direction == "x" ? overhangSize : topLayer.width;
      const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

      addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

      const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
      const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
      const newWidth = topLayer.width;
      const newDepth = topLayer.depth;
      const nextDirection = direction == "x" ? "z" : "x";

      addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
    }
  }
});

function init() {
  world = new CANNON.World();
  world.gravity.set(0, -10, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.interations = 30;

  scene = new THREE.Scene();

  addLayer(0, 0, originalBoxSize, originalBoxSize);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 20, 0);
  scene.add(directionalLight);

  const width = 10;
  const aspect = window.innerWidth / window.innerHeight;
  const height = width / aspect;
  camera = new THREE.PerspectiveCamera(50, width / height, 0.3, 100);
  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);

  document.body.appendChild(renderer.domElement);
}

function addLayer(x, z, width, depth, direction) {
  const y = boxHeight * stack.length;

  const layer = generateBox(x, y, z, width, depth, false);
  layer.direction = direction;

  stack.push(layer);
}

function generateBox(x, y, z, width, depth, falls, customHue) {
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

  const colorHue =
    customHue !== undefined
      ? customHue
      : stack.length == 0
        ? 30
        : Math.floor(Math.random() * 360);
  const colorString = `hsl(${colorHue}, 100%, 50%)`;
  const color = new THREE.Color(colorString);
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y - 1, z);
  scene.add(mesh);

  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2),
  );
  let mass = falls ? 50 : 0;
  const body = new CANNON.Body({ mass, shape });
  body.position.set(x, y - 1, z);
  world.addBody(body);

  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth,
    colorHue,
  };
}

function animation(time) {
  const speed = 0.15;

  const topLayer = stack.at(-1);
  topLayer.threejs.position[topLayer.direction] += speed;
  topLayer.cannonjs.position[topLayer.direction] += speed;

  if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
    camera.position.y += speed;
  }

  updatePhysics(lastTime || 60);
  renderer.render(scene, camera);
  lastTime = time;
}

function updatePhysics() {
  world.step(1 / 60);

  overhangs.forEach((element) => {
    if (element.lightness === undefined) {
      element.lightness = 0.5;
    }

    if (element.lightness < 1.0) {
      element.lightness += 0.01;
    }

    element.threejs.material.color.setHSL(
      element.colorHue / 360,
      1.0,
      element.lightness,
    );
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}

function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1);
  const topLayerHue = stack[stack.length - 1].colorHue;
  const overhang = generateBox(x, y, z, width, depth, true, topLayerHue);
  overhangs.push(overhang);
}

function cutBox(topLayer, overlap, size, delta) {
  const direction = topLayer.direction;
  const newWidth = direction == "x" ? overlap : topLayer.width;
  const newDepth = direction == "z" ? overlap : topLayer.depth;

  topLayer.width = newWidth;
  topLayer.depth = newDepth;

  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2;

  topLayer.cannonjs.position[direction] -= delta / 2;

  const shape = new CANNON.Box(
    new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2),
  );
  topLayer.cannonjs.shapes = [];
  topLayer.cannonjs.addShape(shape);
}

init();
