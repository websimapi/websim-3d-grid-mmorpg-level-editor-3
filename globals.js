const room = new WebsimSocket();
let peers = {};
let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let gridBlocks = {};
let placementPreview;
let groundPlane;
let loadedModels = [];
let selectedModel = null;
let modelPreview = null;
let placedAssets = [];
let selectedPlacedAsset = null;
let assetIdCounter = 0;
let selectedBlock = null;
const loader = new THREE.GLTFLoader();
let actionHistory = [];
let redoHistory = [];
const MAX_REDO_HISTORY = 100;
let actionHistoryUI = document.getElementById('action-history');
let debugInfo = {
  mousePosition: { x: 0, y: 0 },
  normalizedMouse: { x: 0, y: 0 },
  raycastHit: null,
  gridPosition: null,
  cameraPosition: null,
  lastAction: null
};
let initialBlockColor = null;
let assetTypeOptions = ['scene object', 'player', 'npc', 'texture'];
let loadedTextures = [];