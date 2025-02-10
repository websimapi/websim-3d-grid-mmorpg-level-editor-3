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
  mousePosition: {
    x: 0,
    y: 0
  },
  normalizedMouse: {
    x: 0,
    y: 0
  },
  raycastHit: null,
  gridPosition: null,
  cameraPosition: null,
  lastAction: null
};
let draggingSectionHeader = null;
let sections = [];
let dragStartY = 0;
let initialBlockColor = null;
let assetTypeOptions = ['scene object', 'player', 'npc', 'texture'];
let loadedTextures = [];

async function exportLevel() {
  const levelData = {
    blocks: Object.keys(gridBlocks).map(key => {
      const [x, y, z] = key.split(',').map(Number);
      const block = gridBlocks[key];
      const blockData = {
        x,
        y,
        z,
        color: block.material.color.getHexString(),
        type: block.userData.blockType || 'half',
        orientation: block.userData.orientation || 'north'
      };
      if (block.material.map) {
        blockData.textureUrl = block.material.map.userData?.url;
      }
      return blockData;
    }),
    assets: placedAssets.map(asset => {
      const assetData = {
        id: asset.id,
        url: asset.url,
        name: asset.name,
        type: asset.type || 'scene object',
        position: {
          x: asset.model.position.x,
          y: asset.model.position.y,
          z: asset.model.position.z
        },
        rotation: {
          x: asset.model.rotation.x,
          y: asset.model.rotation.y,
          z: asset.model.rotation.z
        },
        scale: {
          x: asset.model.scale.x,
          y: asset.model.scale.y,
          z: asset.model.scale.z
        }
      };
      const appliedTextures = [];
      asset.model.traverse(child => {
        if (child.material && child.material.map) {
          appliedTextures.push(child.material.map.userData?.url);
        }
      });
      if (appliedTextures.length > 0) {
        assetData.textureUrls = appliedTextures;
      }
      return assetData;
    }),
    assetLibrary: loadedModels.map(model => {
      return {
        url: model.url,
        name: model.name,
        defaultRotation: {
          x: model.model.rotation.x,
          y: model.model.rotation.y,
          z: model.model.rotation.z
        }
      };
    }),
    textures: loadedTextures.map(texture => ({
      url: texture.url,
      name: texture.name
    })),
    actionHistory: actionHistory
  };
  const blob = new Blob([JSON.stringify(levelData, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'level.json';
  a.click();
  URL.revokeObjectURL(url);
  debugInfo.lastAction = `Exported Level - Blocks: ${levelData.blocks.length}, Assets: ${levelData.assets.length}, Asset Library: ${levelData.assetLibrary.length}, Textures: ${levelData.textures.length}, Action History Included: true`;
  addActionToHistory(debugInfo.lastAction);
  updateDebugInfo();
}

function importLevel(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const levelData = JSON.parse(e.target.result);
      Object.keys(gridBlocks).forEach(key => removeBlock(key));
      gridBlocks = {};
      placedAssets.forEach(asset => {
        scene.remove(asset.model);
      });
      placedAssets = [];
      document.getElementById('placed-assets-list').innerHTML = '';
      loadedModels = [];
      document.getElementById('asset-list').innerHTML = '';
      const processedUrls = new Set();
      levelData.assetLibrary?.forEach(asset => {
        if (!processedUrls.has(asset.url)) {
          loadModelFromURL(asset.url, asset.name, asset.defaultRotation);
          processedUrls.add(asset.url);
        }
      });
      levelData.assets?.forEach(asset => {
        if (!processedUrls.has(asset.url)) {
          loadModelFromURL(asset.url, asset.name, asset.defaultRotation);
          processedUrls.add(asset.url);
        }
      });
      levelData.textures?.forEach(textureData => {
        addTextureToLibrary(textureData.url, textureData.name);
      });
      levelData.blocks?.forEach(block => {
        const newBlock = addBlock(new THREE.Vector3(block.x, block.y, block.z), block.type || 'half');
        if (block.orientation) {
          document.getElementById('block-orientation').value = block.orientation;
          let rotation = 0;
          switch (block.orientation) {
            case 'east':
              rotation = Math.PI / 2;
              break;
            case 'south':
              rotation = Math.PI;
              break;
            case 'west':
              rotation = -Math.PI / 2;
              break;
          }
          newBlock.rotation.y = rotation;
          newBlock.userData.orientation = block.orientation;
        }
        if (block.color) {
          newBlock.material.color.set('#' + block.color);
        }
        if (block.textureUrl) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(block.textureUrl, texture => {
            texture.userData = {
              url: block.textureUrl
            };
            newBlock.material.map = texture;
            newBlock.material.needsUpdate = true;
          });
        }
        gridBlocks[`${block.x},${block.y},${block.z}`] = newBlock;
      });
      updateBlocksList();
      let maxAssetId = -1;
      levelData.assets?.forEach(assetData => {
        loader.load(assetData.url, gltf => {
          const model = gltf.scene;
          model.position.set(assetData.position.x, assetData.position.y, assetData.position.z);
          model.rotation.set(assetData.rotation.x, assetData.rotation.y, assetData.rotation.z);
          model.scale.set(assetData.scale.x, assetData.scale.y, assetData.scale.z);
          model.userData.url = assetData.url;
          model.userData.name = assetData.name;
          scene.add(model);
          const asset = {
            id: assetData.id,
            model: model,
            position: model.position.clone(),
            url: assetData.url,
            name: assetData.name
          };
          placedAssets.push(asset);
          addPlacedAssetToList(asset);
        }, undefined, error => {
          console.error('Error loading asset:', error);
          debugInfo.lastAction = `Error loading asset: ${error.message}`;
          addActionToHistory(debugInfo.lastAction);
          updateDebugInfo();
        });
        if (assetData.id > maxAssetId) {
          maxAssetId = assetData.id;
        }
      });
      assetIdCounter = maxAssetId + 1;
      if (levelData.actionHistory && Array.isArray(levelData.actionHistory)) {
        actionHistory = levelData.actionHistory;
        actionHistoryUI.innerHTML = '';
        actionHistory.forEach(action => {
          const actionItem = document.createElement('div');
          actionItem.textContent = action.description;
          actionHistoryUI.appendChild(actionItem);
        });
      } else {
        actionHistory = [];
        actionHistoryUI.innerHTML = '';
      }
      debugInfo.lastAction = `Imported Level - Blocks: ${levelData.blocks?.length || 0}, Assets: ${levelData.assets?.length || 0}, Asset Library: ${levelData.assetLibrary?.length || 0}, Textures: ${levelData.textures?.length || 0}, Action History Loaded: ${levelData.actionHistory ? 'Yes' : 'No'}`;
      addActionToHistory(debugInfo.lastAction);
      updateDebugInfo();
    } catch (error) {
      console.error('Error importing level:', error);
      debugInfo.lastAction = `Error importing level: ${error.message}`;
      addActionToHistory(debugInfo.lastAction);
      updateDebugInfo();
    }
  };
  reader.readAsText(file);
}

async function uploadModel(file) {
  try {
    const url = await websim.upload(file);
    const name = file.name;
    loadModelFromURL(url, name);
  } catch (error) {
    console.error('Error uploading file:', error);
    debugInfo.lastAction = `Error uploading model: ${error.message}`;
    addActionToHistory(debugInfo.lastAction);
    updateDebugInfo();
  }
}

function loadModelFromURL(url, name, defaultRotation = {
  x: 0,
  y: 0,
  z: 0
}) {
  if (loadedModels.some(model => model.url === url)) {
    return;
  }
  loader.load(url, gltf => {
    const model = gltf.scene;
    model.userData.yOffset = new THREE.Box3().setFromObject(model).min.y;
    model.userData.url = url;
    model.userData.name = name;
    model.rotation.set(defaultRotation.x || 0, defaultRotation.y || 0, defaultRotation.z || 0);
    const assetItem = createAssetItem(model, url, name);
    document.getElementById('asset-list').appendChild(assetItem);
    loadedModels.push({
      model: model,
      preview: assetItem.querySelector('.asset-preview'),
      url: url,
      name: name
    });
    debugInfo.lastAction = `Loaded model: ${name}`;
    addActionToHistory(debugInfo.lastAction);
    updateDebugInfo();
  }, undefined, error => {
    console.error(error);
    debugInfo.lastAction = `Error loading model: ${error.message}`;
    addActionToHistory(debugInfo.lastAction);
    updateDebugInfo();
  });
}

function createAssetItem(model, url, name) {
  const assetItem = document.createElement('div');
  assetItem.className = 'asset-item';
  const defaultRotationControls = document.createElement('div');
  defaultRotationControls.className = 'default-rotation-controls';
  const rotationLabel = document.createElement('div');
  rotationLabel.textContent = 'Default Rotation';
  rotationLabel.className = 'rotation-label';
  defaultRotationControls.appendChild(rotationLabel);
  ['X', 'Y', 'Z'].forEach(axis => {
    const axisControl = document.createElement('div');
    axisControl.className = 'rotation-axis';
    const label = document.createElement('span');
    label.textContent = axis;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '360';
    slider.value = model.rotation[axis.toLowerCase()] * 180 / Math.PI % 360;
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '0';
    numberInput.max = '360';
    numberInput.value = slider.value;
    numberInput.step = '1';
    const updateRotation = () => {
      const radians = numberInput.value * Math.PI / 180;
      model.rotation[axis.toLowerCase()] = radians;
      if (modelPreview) {
        modelPreview.rotation[axis.toLowerCase()] = radians;
      }
    };
    slider.addEventListener('input', e => {
      numberInput.value = e.target.value;
      updateRotation();
    });
    numberInput.addEventListener('input', e => {
      slider.value = e.target.value;
      updateRotation();
    });
    numberInput.addEventListener('change', () => {
      const loadedModel = loadedModels.find(m => m.url === model.userData.url);
      if (loadedModel) {
        loadedModel.model.rotation[axis.toLowerCase()] = model.rotation[axis.toLowerCase()];
      }
    });
    axisControl.appendChild(label);
    axisControl.appendChild(slider);
    axisControl.appendChild(numberInput);
    defaultRotationControls.appendChild(axisControl);
  });
  assetItem.innerHTML = `
    <div class="asset-name">${name}</div>
  `;
  assetItem.appendChild(defaultRotationControls);
  assetItem.addEventListener('click', () => {
    if (modelPreview) {
      scene.remove(modelPreview);
      modelPreview = null;
    }
    selectedModel = model;
    placementPreview.visible = false;
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    document.getElementById('place-block').classList.add('active');
    if (selectedModel) {
      if (!modelPreview) {
        modelPreview = selectedModel.clone();
        modelPreview.traverse(child => {
          if (child.material) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.5;
          }
        });
        modelPreview.rotation.copy(selectedModel.rotation);
        scene.add(modelPreview);
      }
    }
  });
  return assetItem;
}

function addPlacedAssetToList(assetData) {
  const placedAssetsList = document.getElementById('placed-assets-list');
  const assetItem = document.createElement('div');
  assetItem.className = 'asset-item';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-asset-btn';
  deleteBtn.innerHTML = '×';
  deleteBtn.onclick = e => {
    e.stopPropagation();
    deletePlacedAsset(assetData.id, true);
  };
  const typeSelect = document.createElement('select');
  typeSelect.className = 'asset-type-select';
  assetTypeOptions.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    typeSelect.appendChild(option);
  });
  typeSelect.value = assetData.type || 'scene object';
  typeSelect.addEventListener('change', e => {
    const newType = e.target.value;
    const oldType = assetData.type || 'scene object';
    assetData.type = newType;
    debugInfo.lastAction = `Changed asset ${assetData.id} type from ${oldType} to ${newType}`;
    addActionToHistory(debugInfo.lastAction, {
      type: 'changeAssetType',
      assetId: assetData.id,
      previousType: oldType,
      newType: newType
    });
    updateDebugInfo();
  });
  assetItem.innerHTML = `
    <div class="asset-name">${assetData.name} (ID: ${assetData.id})</div>
  `;
  assetItem.appendChild(typeSelect);
  assetItem.appendChild(deleteBtn);
  placedAssetsList.appendChild(assetItem);
  assetItem.querySelector('.asset-name').addEventListener('click', () => {
    selectPlacedAsset(assetData.id);
  });
  assetData.assetItem = assetItem;
  assetData.typeSelect = typeSelect;
}

function getPlacedAssetById(assetId) {
  return placedAssets.find(asset => asset.id === assetId);
}

function selectPlacedAsset(assetId) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    if (selectedPlacedAsset) {
      deselectPlacedAsset();
    }
    if (selectedBlock) {
      selectBlock(null);
    }
    selectedPlacedAsset = asset;
    const helper = new THREE.BoxHelper(asset.model, 0xffff00);
    helper.name = 'selectionHelper';
    scene.add(helper);
    asset.helper = helper;
    asset.assetItem.classList.add('selected-asset');
    showRotationUI(asset);
  }
}

function deselectPlacedAsset() {
  if (selectedPlacedAsset) {
    if (selectedPlacedAsset.helper) {
      scene.remove(selectedPlacedAsset.helper);
      selectedPlacedAsset.helper = null;
    }
    hideRotationUI(selectedPlacedAsset);
    selectedPlacedAsset.assetItem.classList.remove('selected-asset');
    selectedPlacedAsset = null;
  }
}

function showRotationUI(asset) {
  const rotationUI = document.createElement('div');
  rotationUI.className = 'rotation-ui';
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  angles.forEach(angle => {
    const button = document.createElement('button');
    button.className = 'rotation-button';
    button.innerHTML = getArrowIcon(angle);
    button.addEventListener('click', event => {
      event.stopPropagation();
      rotatePlacedAssetToAngle(asset.id, angle);
    });
    rotationUI.appendChild(button);
  });
  const rotationControls = document.createElement('div');
  rotationControls.className = 'rotation-controls';
  const axes = ['X', 'Y', 'Z'];
  axes.forEach(axis => {
    const axisControl = document.createElement('div');
    axisControl.className = 'rotation-axis';
    const label = document.createElement('span');
    label.textContent = axis;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '360';
    slider.value = asset.model.rotation[axis.toLowerCase()] * 180 / Math.PI % 360;
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '0';
    numberInput.max = '360';
    numberInput.value = slider.value;
    numberInput.step = '1';
    slider.addEventListener('input', e => {
      numberInput.value = e.target.value;
      const radians = e.target.value * Math.PI / 180;
      asset.model.rotation[axis.toLowerCase()] = radians;
      if (asset.helper) {
        asset.helper.update();
      }
    });
    numberInput.addEventListener('input', e => {
      slider.value = e.target.value;
      const radians = e.target.value * Math.PI / 180;
      asset.model.rotation[axis.toLowerCase()] = radians;
      if (asset.helper) {
        asset.helper.update();
      }
    });
    const updateRotation = e => {
      const radians = e.target.value * Math.PI / 180;
      const axisLower = axis.toLowerCase();
      const previousRotation = asset.model.rotation[axisLower];
      debugInfo.lastAction = `Rotated asset ${asset.id} ${axis}-axis to ${e.target.value} degrees`;
      addActionToHistory(debugInfo.lastAction, {
        type: 'rotateAssetAxis',
        assetId: asset.id,
        axis: axisLower,
        previousRotation: previousRotation,
        newRotation: radians
      });
      updateDebugInfo();
    };
    slider.addEventListener('change', updateRotation);
    numberInput.addEventListener('change', updateRotation);
    axisControl.appendChild(label);
    axisControl.appendChild(slider);
    axisControl.appendChild(numberInput);
    rotationControls.appendChild(axisControl);
  });
  rotationUI.appendChild(rotationControls);
  asset.assetItem.appendChild(rotationUI);
  asset.rotationUI = rotationUI;
}

function hideRotationUI(asset) {
  if (asset.rotationUI) {
    asset.assetItem.removeChild(asset.rotationUI);
    asset.rotationUI = null;
  }
}

function getArrowIcon(angle) {
  return `<span class="arrow-icon" style="transform: rotate(${angle}deg);">&#9650;</span>`;
}

function rotatePlacedAssetToAngle(assetId, angle) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    const previousRotation = asset.model.rotation.y;
    asset.model.rotation.y = THREE.Math.degToRad(angle);
    if (asset.helper) {
      asset.helper.update();
    }
    debugInfo.lastAction = `Rotated asset ${assetId} to ${angle} degrees`;
    addActionToHistory(debugInfo.lastAction, {
      type: 'rotateAsset',
      assetId: assetId,
      previousRotation: previousRotation,
      newRotation: asset.model.rotation.y
    });
    updateDebugInfo();
  }
}

function deletePlacedAsset(assetId, recordAction = true) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    if (asset.helper) {
      scene.remove(asset.helper);
    }
    scene.remove(asset.model);
    asset.assetItem.parentNode.removeChild(asset.assetItem);
    const index = placedAssets.findIndex(a => a.id === assetId);
    if (index !== -1) {
      placedAssets.splice(index, 1);
    }
    if (selectedPlacedAsset && selectedPlacedAsset.id === assetId) {
      deselectPlacedAsset();
    }
    debugInfo.lastAction = `Deleted asset ${assetId}`;
    if (recordAction) {
      addActionToHistory(debugInfo.lastAction, {
        type: 'deleteAsset',
        assetData: {
          id: asset.id,
          url: asset.url,
          name: asset.name,
          position: {
            x: asset.model.position.x,
            y: asset.model.position.y,
            z: asset.model.position.z
          },
          rotation: {
            x: asset.model.rotation.x,
            y: asset.model.rotation.y,
            z: asset.model.rotation.z
          },
          scale: {
            x: asset.model.scale.x,
            y: asset.model.scale.y,
            z: asset.model.scale.z
          }
        }
      });
    }
    updateDebugInfo();
  }
}

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('grid-container').appendChild(renderer.domElement);
  camera.position.set(0, 32, 32);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  const groundGeometry = new THREE.PlaneGeometry(32, 32);
  const groundMaterial = new THREE.MeshBasicMaterial({
    visible: false,
    side: THREE.DoubleSide
  });
  groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.set(0, 0, 0);
  scene.add(groundPlane);
  const gridHelper = new THREE.GridHelper(32, 32);
  gridHelper.position.set(0, 0, 0);
  scene.add(gridHelper);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);
  const previewGeometry = new THREE.BoxGeometry(1, 0.5, 1);
  const previewMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5,
    wireframe: true
  });
  placementPreview = new THREE.Mesh(previewGeometry, previewMaterial);
  placementPreview.visible = false;
  scene.add(placementPreview);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMouseClick);
  window.addEventListener('resize', onWindowResize);
  document.getElementById('block-color').addEventListener('change', e => {
    if (selectedBlock) {
      selectedBlock.material.color.set(e.target.value);
    }
  });
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.classList.contains('section-toggle')) {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.section-toggle');
        content.classList.toggle('expanded');
        toggle.classList.toggle('expanded');
        e.stopPropagation();
      }
    });
  });
  initDraggableSections();
  room.party.subscribe(newPeers => {
    peers = newPeers;
  });
  room.onmessage = event => {
    const data = event.data;
    switch (data.type) {
      case "connected":
        console.log(`Client ${data.clientId} connected`);
        break;
      case "disconnected":
        console.log(`Client ${data.clientId} disconnected`);
        break;
      case "gridUpdate":
        if (data.clientId !== room.party.client.id) {
          if (data.action === 'place') {
            if (data.assetData) {
              loader.load(data.assetData.url, gltf => {
                const model = gltf.scene;
                model.position.set(data.position.x + 0.5, data.position.y + 0.5, data.position.z + 0.5);
                scene.add(model);
                const assetId = assetIdCounter++;
                const asset = {
                  id: assetId,
                  model: model,
                  position: model.position.clone(),
                  url: data.assetData.url,
                  name: data.assetData.name
                };
                placedAssets.push(asset);
                addPlacedAssetToList(asset);
              });
            } else {
              const block = addBlock(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
              if (data.color) {
                block.material.color.set('#' + data.color);
              }
              const key = `${data.position.x},${data.position.y},${data.position.z}`;
              gridBlocks[key] = block;
              updateBlocksList();
            }
          } else if (data.action === 'remove') {
            const key = `${data.position.x},${data.position.y},${data.position.z}`;
            removeBlock(key);
          }
        }
        break;
      case "levelUpdate":
        if (data.clientId !== room.party.client.id) {
          Object.keys(gridBlocks).forEach(key => removeBlock(key));
          gridBlocks = {};
          placedAssets.forEach(asset => scene.remove(asset.model));
          placedAssets = [];
          data.data.blocks.forEach(block => {
            const newBlock = addBlock(new THREE.Vector3(block.x, block.y, block.z));
            if (block.color) {
              newBlock.material.color.set('#' + block.color);
            }
            const key = `${block.x},${block.y},${block.z}`;
            gridBlocks[key] = newBlock;
          });
          data.data.assets.forEach(assetData => {
            loader.load(assetData.url, gltf => {
              const model = gltf.scene;
              model.position.set(assetData.position.x, assetData.position.y, assetData.position.z);
              model.rotation.set(assetData.rotation.x, assetData.rotation.y, assetData.rotation.z);
              model.scale.set(assetData.scale.x, assetData.scale.y, assetData.scale.z);
              scene.add(model);
              const asset = {
                id: assetData.id,
                model: model,
                position: model.position.clone(),
                url: assetData.url,
                name: assetData.name
              };
              placedAssets.push(asset);
              addPlacedAssetToList(asset);
            });
          });
          updateBlocksList();
        }
        break;
    }
  };
  function updateOnlineUsers() {
    const usersList = document.getElementById('online-users');
    usersList.innerHTML = '';
    for (const clientId in room.party.peers) {
      const {
        username,
        avatarUrl
      } = room.party.peers[clientId];
      const userEl = document.createElement('div');
      userEl.className = 'user-item';
      userEl.innerHTML = `
        <img src="${avatarUrl}" alt="${username}" width="24" height="24">
        <span>${username}</span>
        ${clientId === room.party.client.id ? ' (You)' : ''}
      `;
      usersList.appendChild(userEl);
    }
  }
  room.party.subscribe(() => {
    updateOnlineUsers();
  });
  updateOnlineUsers();
  document.getElementById('load-texture').addEventListener('click', () => {
    document.getElementById('texture-input').click();
  });
  document.getElementById('texture-input').addEventListener('change', event => {
    if (event.target.files.length > 0) {
      uploadTexture(event.target.files[0]);
      event.target.value = '';
    }
  });
  document.getElementById('model-input').addEventListener('change', event => {
    if (event.target.files.length > 0) {
      uploadModel(event.target.files[0]);
      event.target.value = '';
    }
  });
}

function getGridPosition(point) {
  return {
    x: Math.floor(point.x),
    z: Math.floor(point.z)
  };
}

function getHighestBlockAt(x, z) {
  let maxY = -0.5;
  for (let key in gridBlocks) {
    const [bx, by, bz] = key.split(',').map(Number);
    if (Math.floor(bx) === Math.floor(x) && Math.floor(bz) === Math.floor(z)) {
      maxY = Math.max(maxY, by);
    }
  }
  placedAssets.forEach(asset => {
    const pos = asset.model.position;
    if (Math.floor(pos.x - 0.5) === Math.floor(x) && Math.floor(pos.z - 0.5) === Math.floor(z)) {
      maxY = Math.max(maxY, pos.y - 0.25);
    }
  });
  return maxY;
}

function updateDebugInfo() {
  const content = document.getElementById('debug-content');
  content.innerHTML = `Mouse Position (screen): ${debugInfo.mousePosition.x}, ${debugInfo.mousePosition.y}
Normalized Mouse: ${debugInfo.normalizedMouse.x.toFixed(3)}, ${debugInfo.normalizedMouse.y.toFixed(3)}
Camera Position: ${JSON.stringify(debugInfo.cameraPosition)}
Raycast Hit: ${debugInfo.raycastHit ? 'Yes' : 'No'}
${debugInfo.raycastHit ? `Hit Position: ${JSON.stringify(debugInfo.raycastHit)}` : ''}
Grid Position: ${JSON.stringify(debugInfo.gridPosition)}
Last Action: ${debugInfo.lastAction || 'None'}
Active Blocks: ${Object.keys(gridBlocks).length}
Active Assets: ${placedAssets.length}
Block Positions: ${JSON.stringify(Object.keys(gridBlocks), null, 2)}`;
}

function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  debugInfo.mousePosition = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  debugInfo.normalizedMouse = {
    x: mouse.x,
    y: mouse.y
  };
  debugInfo.cameraPosition = {
    x: camera.position.x.toFixed(2),
    y: camera.position.y.toFixed(2),
    z: camera.position.z.toFixed(2)
  };
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([groundPlane, ...Object.values(gridBlocks)], true);
  if (intersects.length > 0) {
    const intersect = intersects[0];
    debugInfo.raycastHit = {
      point: {
        x: intersect.point.x.toFixed(2),
        y: intersect.point.y.toFixed(2),
        z: intersect.point.z.toFixed(2)
      }
    };
    const gridPos = getGridPosition(intersect.point);
    debugInfo.gridPosition = gridPos;
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById('color-dropper').classList.contains('active')) {
      if (modelPreview) modelPreview.visible = false;
      const key = `${gridPos.x},${getHighestBlockAt(gridPos.x, gridPos.z)},${gridPos.z}`;
      if (gridBlocks[key]) {
        placementPreview.visible = true;
        placementPreview.material.color.set(0x00ff00);
        placementPreview.position.set(gridPos.x + 0.5, getHighestBlockAt(gridPos.x, gridPos.z) + 0.25, gridPos.z + 0.5);
      } else {
        placementPreview.visible = false;
      }
    } else if (document.getElementById('place-block').classList.contains('active')) {
      if (selectedModel) {
        if (!modelPreview) {
          modelPreview = selectedModel.clone();
          modelPreview.traverse(child => {
            if (child.material) {
              child.material = child.material.clone();
              child.material.transparent = true;
              child.material.opacity = 0.5;
            }
          });
          modelPreview.rotation.copy(selectedModel.rotation);
          scene.add(modelPreview);
        }
        const yOffset = selectedModel.userData.yOffset || 0;
        modelPreview.position.set(Math.floor(gridPos.x) + 0.5, highestY + 0.5 - yOffset, Math.floor(gridPos.z) + 0.5);
        modelPreview.visible = true;
        placementPreview.visible = false;
      } else {
        if (modelPreview) modelPreview.visible = false;
        placementPreview.visible = true;
        placementPreview.material.color.set(0x00ff00);
        placementPreview.position.set(gridPos.x + 0.5, highestY + 0.75, gridPos.z + 0.5);
      }
    } else if (document.getElementById('remove-block').classList.contains('active')) {
      if (modelPreview) modelPreview.visible = false;
      const key = `${gridPos.x},${highestY},${gridPos.z}`;
      if (gridBlocks[key]) {
        placementPreview.visible = true;
        placementPreview.material.color.set(0xff0000);
        placementPreview.position.set(gridPos.x + 0.5, highestY + 0.25, gridPos.z + 0.5);
      } else {
        placementPreview.visible = false;
      }
    } else {
      if (placementPreview) placementPreview.visible = false;
      if (modelPreview) modelPreview.visible = false;
    }
  } else {
    debugInfo.raycastHit = null;
    debugInfo.gridPosition = null;
    if (placementPreview) placementPreview.visible = false;
    if (modelPreview) modelPreview.visible = false;
  }
  updateDebugInfo();
}

function onMouseClick(event) {
  if (document.getElementById('color-dropper').classList.contains('active')) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(gridBlocks), true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      for (const key in gridBlocks) {
        if (gridBlocks[key] === intersect.object) {
          selectColor(gridBlocks[key]);
          break;
        }
      }
    }
    return;
  }
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([...Object.values(gridBlocks), ...placedAssets.map(a => a.model)], true);
  let clickedBlock = null;
  let clickedAsset = null;
  if (intersects.length > 0) {
    const intersect = intersects[0];
    for (const key in gridBlocks) {
      if (gridBlocks[key] === intersect.object) {
        clickedBlock = gridBlocks[key];
        break;
      }
    }
    if (!clickedBlock) {
      const assetModel = intersect.object;
      const asset = placedAssets.find(a => a.model === assetModel || a.model.children.includes(assetModel));
      if (asset) {
        clickedAsset = asset;
      }
    }
  }
  if (document.getElementById('select-tool').classList.contains('active')) {
    if (clickedBlock) {
      selectBlock(clickedBlock);
    } else if (clickedAsset) {
      if (selectedBlock) {
        selectBlock(null);
      }
      selectPlacedAsset(clickedAsset.id);
    } else {
      selectBlock(null);
      if (selectedPlacedAsset) {
        deselectPlacedAsset();
      }
    }
    return;
  }
  if (clickedBlock) {
    selectBlock(null);
  } else if (clickedAsset) {
    if (selectedBlock) {
      selectBlock(null);
    }
    selectPlacedAsset(clickedAsset.id);
  } else {
    selectBlock(null);
    if (selectedPlacedAsset) {
      deselectPlacedAsset();
    }
  }
  raycaster.setFromCamera(mouse, camera);
  const groundIntersects = raycaster.intersectObjects([groundPlane, ...Object.values(gridBlocks)], true);
  if (groundIntersects.length > 0) {
    const intersect = groundIntersects[0];
    const gridPos = getGridPosition(intersect.point);
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById('place-block').classList.contains('active')) {
      if (selectedModel) {
        const clone = selectedModel.clone();
        clone.rotation.copy(selectedModel.rotation);
        const yOffset = selectedModel.userData.yOffset || 0;
        clone.position.set(Math.floor(gridPos.x) + 0.5, highestY + 0.5 - yOffset, Math.floor(gridPos.z) + 0.5);
        scene.add(clone);
        const assetId = assetIdCounter++;
        const assetData = {
          id: assetId,
          model: clone,
          position: clone.position.clone(),
          url: selectedModel.userData.url,
          name: selectedModel.userData.name
        };
        placedAssets.push(assetData);
        addPlacedAssetToList(assetData);
        debugInfo.lastAction = `Placed model at ${clone.position.toArray()}`;
        addActionToHistory(debugInfo.lastAction, {
          type: 'placeAsset',
          assetData: {
            id: assetData.id,
            url: assetData.url,
            name: assetData.name,
            position: {
              x: clone.position.x,
              y: clone.position.y,
              z: clone.position.z
            },
            rotation: {
              x: clone.rotation.x,
              y: clone.rotation.y,
              z: clone.rotation.z
            },
            scale: {
              x: clone.scale.x,
              y: clone.scale.y,
              z: clone.scale.z
            }
          }
        });
      } else {
        const key = `${gridPos.x},${highestY + 0.5},${gridPos.z}`;
        if (!gridBlocks[key]) {
          const blockType = document.getElementById('block-type').value;
          const block = addBlock(new THREE.Vector3(gridPos.x, highestY + 0.5, gridPos.z), blockType);
          gridBlocks[key] = block;
          updateBlocksList();
          debugInfo.lastAction = `Placed ${blockType} block at ${key}`;
          addActionToHistory(debugInfo.lastAction, {
            type: 'placeBlock',
            key: key,
            position: {
              x: gridPos.x,
              y: highestY + 0.5,
              z: gridPos.z
            },
            blockType
          });
        }
      }
    } else if (document.getElementById('remove-block').classList.contains('active')) {
      const topBlockKey = `${gridPos.x},${highestY},${gridPos.z}`;
      if (gridBlocks[topBlockKey]) {
        const block = gridBlocks[topBlockKey];
        removeBlock(topBlockKey);
        debugInfo.lastAction = `Removed block at ${topBlockKey}`;
        addActionToHistory(debugInfo.lastAction, {
          type: 'removeBlock',
          key: topBlockKey,
          position: {
            x: gridPos.x,
            y: highestY,
            z: gridPos.z
          }
        });
      }
    }
    updateDebugInfo();
    room.send({
      type: "gridUpdate",
      action: document.getElementById('place-block').classList.contains('active') ? 'place' : 'remove',
      position: gridPos,
      color: selectedBlock ? selectedBlock.material.color.getHexString() : null,
      assetData: selectedModel ? {
        url: selectedModel.userData.url,
        name: selectedModel.userData.name
      } : null
    });
  }
}

function addBlock(position, blockType = document.getElementById('block-type').value) {
  let geometry;
  const orientation = document.getElementById('block-orientation').value;
  let rotation = 0;
  switch (orientation) {
    case 'north':
      rotation = 0;
      break;
    case 'east':
      rotation = Math.PI / 2;
      break;
    case 'south':
      rotation = Math.PI;
      break;
    case 'west':
      rotation = -Math.PI / 2;
      break;
  }
  switch (blockType) {
    case 'full':
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'stair':
      geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.5, 0.0, 0.5,  // 0
         0.5, 0.0, 0.5,  // 1
         0.5, 0.25, 0.5, // 2
        -0.5, 0.25, 0.5, // 3
        -0.5, 0.0, -0.5, // 4
         0.5, 0.0, -0.5, // 5
         0.5, 0.25, -0.5,// 6
        -0.5, 0.25, -0.5,// 7
        -0.5, 0.25, 0.5, // 8
         0.0, 0.25, 0.5, // 9
         0.0, 0.5, 0.5,  //10
        -0.5, 0.5, 0.5,  //11
        -0.5, 0.25, -0.5,//12
         0.0, 0.25, -0.5,//13
         0.0, 0.5, -0.5, //14
        -0.5, 0.5, -0.5  //15
      ]);
      const indices = new Uint16Array([
         0,  1,  2,  0,  2,  3,
         4,  5,  6,  4,  6,  7,
         0,  4,  7,  0,  7,  3,
         1,  5,  6,  1,  6,  2,
         3,  2,  6,  3,  6,  7,
         0,  1,  5,  0,  5,  4,
         8,  9, 10,  8, 10, 11,
        12, 13, 14, 12, 14, 15,
         8, 12, 15,  8, 15, 11,
         9, 13, 14,  9, 14, 10,
        11, 10, 14, 11, 14, 15,
         8,  9, 13,  8, 13, 12
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 0.5, 1);
  }
  const material = new THREE.MeshPhongMaterial({
    color: document.getElementById('block-color').value
  });
  const block = new THREE.Mesh(geometry, material);
  block.userData.initialColor = material.color.getHexString();
  block.userData.blockType = blockType;
  block.userData.orientation = orientation;
  const adjustedX = position.x + 0.5;
  const adjustedY = position.y + (blockType === 'full' ? 0.5 : blockType === 'half' ? 0.25 : blockType === 'stair' ? 0.0 : 0.25);
  const adjustedZ = position.z + 0.5;
  block.position.set(adjustedX, adjustedY, adjustedZ);
  block.rotation.y = rotation;
  block.userData.key = `${position.x},${position.y},${position.z}`;
  scene.add(block);
  if (!selectedBlock) {
    selectedBlock = block;
    document.getElementById('block-color').value = '#' + block.material.color.getHexString();
    updateBlocksList();
  }
  return block;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (selectedPlacedAsset && selectedPlacedAsset.helper) {
    selectedPlacedAsset.helper.update();
  }
  renderer.render(scene, camera);
}

function addActionToHistory(actionDescription, actionData = {}) {
  redoHistory = [];
  document.getElementById('redo-action').disabled = true;
  let serializableActionData;
  switch (actionData.type) {
    case 'placeBlock':
    case 'removeBlock':
    case 'placeAsset':
    case 'deleteAsset':
    case 'rotateAsset':
    case 'changeBlockColor':
      serializableActionData = actionData;
      break;
    default:
      serializableActionData = actionData;
  }
  const action = {
    description: actionDescription,
    data: serializableActionData
  };
  actionHistory.push(action);
  const actionItem = document.createElement('div');
  actionItem.textContent = actionDescription;
  actionHistoryUI.appendChild(actionItem);
  const historySection = actionHistoryUI.closest('.section-content');
  if (historySection && historySection.classList.contains('expanded')) {
    actionItem.scrollIntoView({
      behavior: 'smooth'
    });
  }
}

function undoLastAction() {
  if (actionHistory.length === 0) return;
  const lastAction = actionHistory.pop();
  redoHistory.push(lastAction);
  if (redoHistory.length > MAX_REDO_HISTORY) {
    redoHistory.shift();
  }
  document.getElementById('redo-action').disabled = false;
  const actionItem = actionHistoryUI.lastChild;
  if (actionItem) {
    actionHistoryUI.removeChild(actionItem);
  }
  switch (lastAction.data.type) {
    case 'placeBlock':
      removeBlock(lastAction.data.key);
      updateBlocksList();
      break;
    case 'removeBlock':
      const position = lastAction.data.position;
      const key = lastAction.data.key;
      const block = addBlock(new THREE.Vector3(position.x, position.y, position.z));
      gridBlocks[key] = block;
      updateBlocksList();
      break;
    case 'changeBlockColor':
      if (lastAction.data.block && gridBlocks[lastAction.data.key]) {
        const block = gridBlocks[lastAction.data.key];
        block.material.color.set('#' + lastAction.data.previousColor);
        if (selectedBlock === block) {
          document.getElementById('block-color').value = '#' + lastAction.data.previousColor;
        }
        debugInfo.lastAction = `Undid color change of block at ${lastAction.data.key}`;
      }
      break;
    case 'changeBlockOrientation':
      if (lastAction.data.key && gridBlocks[lastAction.data.key]) {
        const block = gridBlocks[lastAction.data.key];
        block.userData.orientation = lastAction.data.previousOrientation;
        let rotation = 0;
        switch (lastAction.data.previousOrientation) {
          case 'east':
            rotation = Math.PI / 2;
            break;
          case 'south':
            rotation = Math.PI;
            break;
          case 'west':
            rotation = -Math.PI / 2;
            break;
        }
        block.rotation.y = rotation;
        if (selectedBlock === block) {
          document.getElementById('block-orientation').value = lastAction.data.previousOrientation;
        }
      }
      break;
    case 'placeAsset':
      if (selectedPlacedAsset && selectedPlacedAsset.id === lastAction.data.assetData.id) {
        deselectPlacedAsset();
      }
      deletePlacedAsset(lastAction.data.assetData.id, false);
      break;
    case 'deleteAsset':
      const assetData = lastAction.data.assetData;
      loader.load(assetData.url, gltf => {
        const model = gltf.scene;
        model.position.set(assetData.position.x, assetData.position.y, assetData.position.z);
        model.rotation.set(assetData.rotation.x, assetData.rotation.y, assetData.rotation.z);
        model.scale.set(assetData.scale.x, assetData.scale.y, assetData.scale.z);
        model.userData.url = assetData.url;
        model.userData.name = assetData.name;
        scene.add(model);
        const asset = {
          id: assetData.id,
          model: model,
          position: model.position.clone(),
          url: assetData.url,
          name: assetData.name
        };
        placedAssets.push(asset);
        addPlacedAssetToList(asset);
        debugInfo.lastAction = `Undid deleting asset ${asset.id}`;
        updateDebugInfo();
      });
      break;
    case 'rotateAsset':
      const asset = getPlacedAssetById(lastAction.data.assetId);
      if (asset) {
        asset.model.rotation.y = lastAction.data.previousRotation;
        if (asset.helper) {
          asset.helper.update();
        }
        debugInfo.lastAction = `Undid rotating asset ${asset.id}`;
      }
      break;
    case 'rotateAssetAxis':
      const assetForAxisRot = getPlacedAssetById(lastAction.data.assetId);
      if (assetForAxisRot) {
        assetForAxisRot.model.rotation[lastAction.data.axis] = lastAction.data.previousRotation;
        if (assetForAxisRot.helper) {
          assetForAxisRot.helper.update();
        }
        if (assetForAxisRot.rotationUI) {
          const slider = assetForAxisRot.rotationUI.querySelector(`.rotation-axis input[type="range"]`);
          if (slider) {
            slider.value = lastAction.data.previousRotation * 180 / Math.PI % 360;
          }
        }
        debugInfo.lastAction = `Undid rotating asset ${asset.id} ${lastAction.data.axis}-axis`;
      }
      break;
    case 'changeAssetType':
      const assetForType = getPlacedAssetById(lastAction.data.assetId);
      if (assetForType) {
        assetForType.type = lastAction.data.previousType;
        if (assetForType.typeSelect) {
          assetForType.typeSelect.value = lastAction.data.previousType;
        }
        debugInfo.lastAction = `Undid type change of asset ${assetForType.id}`;
      }
      break;
    case 'applyTexture':
      if (gridBlocks[lastAction.data.blockKey]) {
        const block = gridBlocks[lastAction.data.blockKey];
        block.material.map = lastAction.data.previousTexture;
        if (!lastAction.data.previousTexture) {
          block.material.color.set('#' + lastAction.data.previousColor);
        }
        block.material.needsUpdate = true;
      }
      break;
    case 'applyAssetTexture':
      const textureAsset = getPlacedAssetById(lastAction.data.assetId);
      if (textureAsset) {
        lastAction.data.previousMaterials.forEach(prev => {
          prev.object.material.map = prev.texture;
          if (!prev.texture) {
            prev.object.material.color.set('#' + prev.color);
          }
          prev.object.material.needsUpdate = true;
        });
      }
      break;
    default:
      debugInfo.lastAction = `Undid action: ${lastAction.description}`;
  }
  updateDebugInfo();
}

function redoLastAction() {
  if (redoHistory.length === 0) return;
  const actionToRedo = redoHistory.pop();
  document.getElementById('redo-action').disabled = redoHistory.length === 0;
  switch (actionToRedo.data.type) {
    case 'placeBlock':
      const block = addBlock(new THREE.Vector3(actionToRedo.data.position.x, actionToRedo.data.position.y, actionToRedo.data.position.z));
      gridBlocks[actionToRedo.data.key] = block;
      updateBlocksList();
      break;
    case 'removeBlock':
      removeBlock(actionToRedo.data.key);
      updateBlocksList();
      break;
    case 'changeBlockColor':
      if (actionToRedo.data.key && gridBlocks[actionToRedo.data.key]) {
        const block = gridBlocks[actionToRedo.data.key];
        block.material.color.set('#' + actionToRedo.data.newColor);
        if (selectedBlock === block) {
          document.getElementById('block-color').value = '#' + actionToRedo.data.newColor;
        }
      }
      break;
    case 'changeBlockOrientation':
      if (actionToRedo.data.key && gridBlocks[actionToRedo.data.key]) {
        const block = gridBlocks[actionToRedo.data.key];
        block.userData.orientation = actionToRedo.data.newOrientation;
        let rotation = 0;
        switch (actionToRedo.data.newOrientation) {
          case 'east':
            rotation = Math.PI / 2;
            break;
          case 'south':
            rotation = Math.PI;
            break;
          case 'west':
            rotation = -Math.PI / 2;
            break;
        }
        block.rotation.y = rotation;
        if (selectedBlock === block) {
          document.getElementById('block-orientation').value = actionToRedo.data.newOrientation;
        }
      }
      break;
    case 'placeAsset':
      const assetData = actionToRedo.data.assetData;
      loader.load(assetData.url, gltf => {
        const model = gltf.scene;
        model.position.set(assetData.position.x, assetData.position.y, assetData.position.z);
        model.rotation.set(assetData.rotation.x, assetData.rotation.y, assetData.rotation.z);
        model.scale.set(assetData.scale.x, assetData.scale.y, assetData.scale.z);
        model.userData.url = assetData.url;
        model.userData.name = assetData.name;
        scene.add(model);
        const asset = {
          id: assetData.id,
          model: model,
          position: model.position.clone(),
          url: assetData.url,
          name: assetData.name
        };
        placedAssets.push(asset);
        addPlacedAssetToList(asset);
      });
      break;
    case 'deleteAsset':
      deletePlacedAsset(actionToRedo.data.assetData.id, false);
      break;
    case 'changeAssetType':
      const assetForTypeRedo = getPlacedAssetById(actionToRedo.data.assetId);
      if (assetForTypeRedo) {
        assetForTypeRedo.type = actionToRedo.data.newType;
        if (assetForTypeRedo.typeSelect) {
          assetForTypeRedo.typeSelect.value = actionToRedo.data.newType;
        }
      }
      break;
    case 'applyTexture':
      if (gridBlocks[actionToRedo.data.blockKey]) {
        const block = gridBlocks[actionToRedo.data.blockKey];
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(actionToRedo.data.textureUrl, texture => {
          block.material.map = texture;
          block.material.needsUpdate = true;
        });
      }
      break;
    case 'applyAssetTexture':
      const textureAsset = getPlacedAssetById(actionToRedo.data.assetId);
      if (textureAsset) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(actionToRedo.data.textureUrl, texture => {
          textureAsset.model.traverse(child => {
            if (child.material) {
              child.material.map = texture;
              child.material.needsUpdate = true;
            }
          });
        });
      }
      break;
    case 'rotateAssetAxis':
      const assetForAxisRotRedo = getPlacedAssetById(actionToRedo.data.assetId);
      if (assetForAxisRotRedo) {
        assetForAxisRotRedo.model.rotation[actionToRedo.data.axis] = actionToRedo.data.newRotation;
        if (assetForAxisRotRedo.helper) {
          assetForAxisRotRedo.helper.update();
        }
        if (assetForAxisRotRedo.rotationUI) {
          const slider = assetForAxisRotRedo.rotationUI.querySelector(`.rotation-axis input[type="range"]`);
          if (slider) {
            slider.value = actionToRedo.data.newRotation * 180 / Math.PI % 360;
          }
        }
        debugInfo.lastAction = `Redid rotating asset ${assetForAxisRotRedo.id} ${actionToRedo.data.axis}-axis`;
      }
      break;
    default:
      console.log('Unknown action type:', actionToRedo.data.type);
  }
  actionHistory.push(actionToRedo);
  const actionItem = document.createElement('div');
  actionItem.textContent = actionToRedo.description;
  actionHistoryUI.appendChild(actionItem);
  debugInfo.lastAction = `Redid: ${actionToRedo.description}`;
  updateDebugInfo();
}

function updateBlocksList() {
  if (selectedBlock) {
    initialBlockColor = null;
  }
  const blocksList = document.getElementById('placed-blocks-list');
  const scrollTop = blocksList.scrollTop;
  blocksList.innerHTML = '';
  Object.entries(gridBlocks).forEach(([key, block]) => {
    const blockItem = document.createElement('div');
    blockItem.className = 'block-item';
    if (selectedBlock && selectedBlock.userData.key === key) {
      blockItem.classList.add('selected-block');
    }
    const [x, y, z] = key.split(',').map(Number);
    blockItem.textContent = `${block.userData.blockType || 'half'} Block at (${x}, ${y}, ${z}) facing ${block.userData.orientation || 'north'}`;
    blockItem.addEventListener('click', () => {
      selectBlock(block);
    });
    blocksList.appendChild(blockItem);
  });
  blocksList.scrollTop = scrollTop;
}

function initDraggableSections() {
  document.querySelectorAll('.toolbar-section').forEach(section => {
    if (section && section.parentNode) {
      section.replaceWith(...section.childNodes);
    }
  });
  document.querySelectorAll('.section-header').forEach(header => {
    const content = header.nextElementSibling;
    if (!content || !header.parentNode) return;
    const section = document.createElement('div');
    section.className = 'toolbar-section';
    if (!header.parentNode.classList.contains('toolbar-section')) {
      header.parentNode.insertBefore(section, header);
      section.appendChild(header);
      section.appendChild(content);
    }
    let isDragging = false;
    let startY = 0;
    let initialRect = null;
    let placeholder = null;
    header.addEventListener('mousedown', e => {
      if (e.target.classList.contains('section-toggle')) return;
      e.preventDefault();
      isDragging = true;
      startY = e.clientY;
      initialRect = section.getBoundingClientRect();
      section.classList.add('dragging');
      section.style.width = `${initialRect.width}px`;
      section.style.left = `${initialRect.left}px`;
      section.style.top = `${initialRect.top}px`;
      placeholder = document.createElement('div');
      placeholder.style.height = `${initialRect.height}px`;
      placeholder.style.margin = '5px 0';
      placeholder.style.background = 'rgba(100,100,100,0.2)';
      placeholder.style.borderRadius = '4px';
      if (section.parentNode) {
        section.parentNode.insertBefore(placeholder, section);
      }
      document.body.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', e => {
      if (!isDragging || !section.parentNode) return;
      const deltaY = e.clientY - startY;
      section.style.transform = `translateY(${deltaY}px)`;
      const draggingRect = section.getBoundingClientRect();
      const draggingCenter = draggingRect.top + draggingRect.height / 2;
      document.querySelectorAll('.drop-target').forEach(s => s.classList.remove('drop-target'));
      const otherSections = Array.from(document.querySelectorAll('.toolbar-section')).filter(s => s !== section);
      let dropTarget = null;
      for (const otherSection of otherSections) {
        const rect = otherSection.getBoundingClientRect();
        if (draggingCenter > rect.top && draggingCenter < rect.bottom) {
          dropTarget = otherSection;
          break;
        }
      }
      if (dropTarget && placeholder && placeholder.parentNode) {
        dropTarget.classList.add('drop-target');
        const rect = dropTarget.getBoundingClientRect();
        if (draggingCenter < rect.top + rect.height / 2) {
          dropTarget.parentNode.insertBefore(placeholder, dropTarget);
        } else {
          dropTarget.parentNode.insertBefore(placeholder, dropTarget.nextSibling);
        }
      }
    });
    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      section.classList.remove('dragging');
      section.style.transform = '';
      section.style.position = '';
      section.style.width = '';
      section.style.left = '';
      section.style.top = '';
      if (placeholder && placeholder.parentNode && section.parentNode) {
        placeholder.parentNode.insertBefore(section, placeholder);
        placeholder.remove();
      }
      document.querySelectorAll('.drop-target').forEach(s => s.classList.remove('drop-target'));
      document.body.style.cursor = '';
    });
  });
}

document.querySelectorAll('.tool-button').forEach(button => {
  button.addEventListener('click', () => {
    if (button.id !== 'undo-action' && button.id !== 'redo-action') {
      document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      if (button.id !== 'place-block') {
        selectedModel = null;
        if (modelPreview) {
          scene.remove(modelPreview);
          modelPreview = null;
        }
      }
      if (!button.id.includes('select-tool')) {
        if (selectedBlock) {
          selectBlock(null);
        }
        if (selectedPlacedAsset) {
          deselectPlacedAsset();
        }
      }
    }
  });
});

document.getElementById('export-json').addEventListener('click', exportLevel);

document.getElementById('import-json').addEventListener('click', () => {
  document.getElementById('import-input').click();
});

document.getElementById('import-input').addEventListener('change', event => {
  if (event.target.files.length > 0) {
    importLevel(event.target.files[0]);
    event.target.value = '';
  }
});

document.getElementById('load-model').addEventListener('click', () => {
  document.getElementById('model-input').click();
});

document.getElementById('model-input').addEventListener('change', event => {
  if (event.target.files.length > 0) {
    uploadModel(event.target.files[0]);
    event.target.value = '';
  }
});

document.getElementById('undo-action').addEventListener('click', undoLastAction);
document.getElementById('redo-action').addEventListener('click', redoLastAction);

window.addEventListener('keydown', event => {
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedPlacedAsset) {
    deletePlacedAsset(selectedPlacedAsset.id, true);
  }
  if (event.key === '`') {
    const debugConsole = document.getElementById('debug-console');
    debugConsole.classList.toggle('visible');
  }
  if (event.ctrlKey || event.metaKey) {
    if (event.key === 'z') {
      if (event.shiftKey) {
        redoLastAction();
      } else {
        undoLastAction();
      }
      event.preventDefault();
    }
  }
});

document.getElementById('toggle-menu').addEventListener('click', () => {
  const toolbar = document.getElementById('toolbar');
  const toggleButton = document.getElementById('toggle-menu');
  const arrow = toggleButton.querySelector('.menu-arrow');
  toolbar.classList.toggle('hidden');
  toggleButton.classList.toggle('menu-hidden');
  arrow.classList.toggle('collapsed');
});

document.addEventListener('mouseleave', () => {
  const draggingSection = document.querySelector('.toolbar-section.dragging');
  if (draggingSection) {
    draggingSection.classList.remove('dragging');
    draggingSection.style.transform = '';
    draggingSection.style.position = '';
    draggingSection.style.width = '';
    draggingSection.style.left = '';
    draggingSection.style.top = '';
  }
  const placeholder = document.querySelector('.section-placeholder');
  if (placeholder) {
    placeholder.remove();
  }
  document.querySelectorAll('.drop-target').forEach(s => s.classList.remove('drop-target'));
  document.body.style.cursor = '';
});

document.getElementById('block-color').addEventListener('input', e => {
  if (selectedBlock) {
    if (initialBlockColor === null) {
      initialBlockColor = selectedBlock.material.color.getHexString();
    }
    selectedBlock.material.color.set(e.target.value);
  }
});

document.getElementById('block-color').addEventListener('change', e => {
  if (selectedBlock && initialBlockColor !== null) {
    debugInfo.lastAction = `Changed block color at ${selectedBlock.userData.key}`;
    addActionToHistory(debugInfo.lastAction, {
      type: 'changeBlockColor',
      block: selectedBlock,
      key: selectedBlock.userData.key,
      previousColor: initialBlockColor,
      newColor: e.target.value.substring(1)
    });
    initialBlockColor = null;
    updateDebugInfo();
  }
});

async function uploadTexture(file) {
  try {
    const url = await websim.upload(file);
    const name = file.name;
    addTextureToLibrary(url, name);
  } catch (error) {
    console.error('Error uploading texture:', error);
    debugInfo.lastAction = `Error uploading texture: ${error.message}`;
    addActionToHistory(debugInfo.lastAction);
    updateDebugInfo();
  }
}

function addTextureToLibrary(url, name) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(url, texture => {
    texture.userData = {
      url: url
    };
    const assetItem = document.createElement('div');
    assetItem.className = 'asset-item';
    assetItem.innerHTML = `
      <div class="asset-name">${name} (Texture)</div>
      <img src="${url}" style="max-width: 100%; height: 100px; object-fit: contain; margin-top: 10px;">
    `;
    assetItem.addEventListener('click', () => {
      if (selectedPlacedAsset) {
        const previousMaterials = [];
        selectedPlacedAsset.model.traverse(child => {
          if (child.material) {
            previousMaterials.push({
              object: child,
              texture: child.material.map,
              color: child.material.color.getHexString()
            });
            child.material.map = texture;
            child.material.needsUpdate = true;
          }
        });
        debugInfo.lastAction = `Applied texture ${name} to asset ${selectedPlacedAsset.id}`;
        addActionToHistory(debugInfo.lastAction, {
          type: 'applyAssetTexture',
          assetId: selectedPlacedAsset.id,
          textureUrl: url,
          textureName: name,
          previousMaterials: previousMaterials
        });
      } else if (selectedBlock) {
        const previousTexture = selectedBlock.material.map;
        const previousColor = selectedBlock.material.color.getHexString();
        selectedBlock.material.map = texture;
        selectedBlock.material.needsUpdate = true;
        debugInfo.lastAction = `Applied texture ${name} to block at ${selectedBlock.userData.key}`;
        addActionToHistory(debugInfo.lastAction, {
          type: 'applyTexture',
          blockKey: selectedBlock.userData.key,
          textureUrl: url,
          textureName: name,
          previousTexture: previousTexture,
          previousColor: previousColor
        });
      }
      updateDebugInfo();
    });
    document.getElementById('asset-list').appendChild(assetItem);
    loadedTextures.push({
      url: url,
      name: name,
      texture: texture
    });
    debugInfo.lastAction = `Added texture to library: ${name}`;
    addActionToHistory(debugInfo.lastAction);
    updateDebugInfo();
  });
}

function selectBlock(block) {
  if (selectedPlacedAsset) {
    deselectPlacedAsset();
  }
  if (selectedBlock === block) return;
  if (selectedBlock) {
    removeBlockOutline(selectedBlock);
  }
  selectedBlock = block;
  if (selectedBlock && document.getElementById('select-tool').classList.contains('active')) {
    document.getElementById('block-color').value = '#' + selectedBlock.material.color.getHexString();
    document.getElementById('block-orientation').value = selectedBlock.userData.orientation || 'north';
    addBlockOutline(selectedBlock);
  }
  updateBlocksList();
}

function addBlockOutline(block) {
  if (block.userData.outline) {
    removeBlockOutline(block);
  }
  let geometry;
  switch (block.userData.blockType) {
    case 'full':
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'stair':
      geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.5, 0.0, 0.5,  // 0
         0.5, 0.0, 0.5,  // 1
         0.5, 0.25, 0.5, // 2
        -0.5, 0.25, 0.5, // 3
        -0.5, 0.0, -0.5, // 4
         0.5, 0.0, -0.5, // 5
         0.5, 0.25, -0.5,// 6
        -0.5, 0.25, -0.5,// 7
        -0.5, 0.25, 0.5, // 8
         0.0, 0.25, 0.5, // 9
         0.0, 0.5, 0.5,  //10
        -0.5, 0.5, 0.5,  //11
        -0.5, 0.25, -0.5,//12
         0.0, 0.25, -0.5,//13
         0.0, 0.5, -0.5, //14
        -0.5, 0.5, -0.5  //15
      ]);
      const indices = new Uint16Array([
         0,  1,  2,  0,  2,  3,
         4,  5,  6,  4,  6,  7,
         0,  4,  7,  0,  7,  3,
         1,  5,  6,  1,  6,  2,
         3,  2,  6,  3,  6,  7,
         0,  1,  5,  0,  5,  4,
         8,  9, 10,  8, 10, 11,
        12, 13, 14, 12, 14, 15,
         8, 12, 15,  8, 15, 11,
         9, 13, 14,  9, 14, 10,
        11, 10, 14, 11, 14, 15,
         8,  9, 13,  8, 13, 12
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 0.5, 1);
  }
  const edges = new THREE.EdgesGeometry(geometry);
  const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
    color: 0x0088ff,
    linewidth: 2
  }));
  outline.position.copy(block.position);
  outline.rotation.copy(block.rotation);
  outline.scale.set(1.02, 1.02, 1.02);
  scene.add(outline);
  block.userData.outline = outline;
}

function removeBlockOutline(block) {
  if (block.userData.outline) {
    scene.remove(block.userData.outline);
    block.userData.outline = null;
  }
}

function selectColor(block) {
  const hexColor = '#' + block.material.color.getHexString();
  document.getElementById('block-color').value = hexColor;
  debugInfo.lastAction = `Selected color ${hexColor} from block at ${block.userData.key}`;
  addActionToHistory(debugInfo.lastAction);
  updateDebugInfo();
}

init();
animate();

function removeBlock(key) {
  scene.children.forEach(child => {
    if (child.userData.key === key) {
      if (child.userData.outline) {
        scene.remove(child.userData.outline);
      }
      scene.remove(child);
      delete gridBlocks[key];
      if (selectedBlock && selectedBlock.userData.key === key) {
        selectBlock(null);
      }
    }
  });
  updateBlocksList();
}

document.getElementById('block-orientation').addEventListener('change', e => {
  if (selectedBlock) {
    const previousOrientation = selectedBlock.userData.orientation;
    const newOrientation = e.target.value;
    selectedBlock.userData.orientation = newOrientation;
    let rotation = 0;
    switch (newOrientation) {
      case 'east':
        rotation = Math.PI / 2;
        break;
      case 'south':
        rotation = Math.PI;
        break;
      case 'west':
        rotation = -Math.PI / 2;
        break;
    }
    selectedBlock.rotation.y = rotation;
    debugInfo.lastAction = `Changed block orientation at ${selectedBlock.userData.key} from ${previousOrientation} to ${newOrientation}`;
    addActionToHistory(debugInfo.lastAction, {
      type: 'changeBlockOrientation',
      key: selectedBlock.userData.key,
      previousOrientation,
      newOrientation
    });
    updateDebugInfo();
  }
});