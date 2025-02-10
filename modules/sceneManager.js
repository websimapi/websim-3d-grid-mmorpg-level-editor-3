import { state } from "../globals.js";
import { updateDebugInfo } from "./uiManager.js";

export function initScene() {
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('grid-container').appendChild(state.renderer.domElement);
  
  state.camera.position.set(0, 32, 32);
  state.camera.lookAt(new THREE.Vector3(0, 0, 0));
  state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.05;
  
  const groundGeometry = new THREE.PlaneGeometry(32, 32);
  const groundMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  state.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  state.groundPlane.rotation.x = -Math.PI / 2;
  state.groundPlane.position.set(0, 0, 0);
  state.scene.add(state.groundPlane);
  
  const gridHelper = new THREE.GridHelper(32, 32);
  gridHelper.position.set(0, 0, 0);
  state.scene.add(gridHelper);
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  state.scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  state.scene.add(directionalLight);
  
  const previewGeometry = new THREE.BoxGeometry(1, 0.5, 1);
  const previewMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5, wireframe: true });
  state.placementPreview = new THREE.Mesh(previewGeometry, previewMaterial);
  state.placementPreview.visible = false;
  state.scene.add(state.placementPreview);
}

export function onWindowResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

export function animate() {
  requestAnimationFrame(animate);
  state.controls.update();
  if (state.selectedPlacedAsset && state.selectedPlacedAsset.helper) {
    state.selectedPlacedAsset.helper.update();
  }
  updateDebugInfo();
  state.renderer.render(state.scene, state.camera);
}

export function getGridPosition(point) {
  return { x: Math.floor(point.x), z: Math.floor(point.z) };
}

export function getHighestBlockAt(x, z) {
  let maxY = -0.5;
  for (let key in state.gridBlocks) {
    const [bx, by, bz] = key.split(',').map(Number);
    if (Math.floor(bx) === Math.floor(x) && Math.floor(bz) === Math.floor(z)) {
      maxY = Math.max(maxY, by);
    }
  }
  state.placedAssets.forEach(asset => {
    const pos = asset.model.position;
    if (Math.floor(pos.x - 0.5) === Math.floor(x) && Math.floor(pos.z - 0.5) === Math.floor(z)) {
      maxY = Math.max(maxY, pos.y - 0.25);
    }
  });
  return maxY;
}