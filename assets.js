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

function loadModelFromURL(url, name, defaultRotation = { x: 0, y: 0, z: 0 }) {
  if (loadedModels.some((model) => model.url === url)) {
    return;
  }
  loader.load(
    url,
    (gltf) => {
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
        name: name,
      });
      debugInfo.lastAction = `Loaded model: ${name}`;
      addActionToHistory(debugInfo.lastAction);
      updateDebugInfo();
    },
    undefined,
    (error) => {
      console.error(error);
      debugInfo.lastAction = `Error loading model: ${error.message}`;
      addActionToHistory(debugInfo.lastAction);
      updateDebugInfo();
    }
  );
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
  ['X', 'Y', 'Z'].forEach((axis) => {
    const axisControl = document.createElement('div');
    axisControl.className = 'rotation-axis';
    const label = document.createElement('span');
    label.textContent = axis;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '360';
    slider.value = ((model.rotation[axis.toLowerCase()] * 180) / Math.PI) % 360;
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '0';
    numberInput.max = '360';
    numberInput.value = slider.value;
    numberInput.step = '1';
    const updateRotation = () => {
      const radians = (numberInput.value * Math.PI) / 180;
      model.rotation[axis.toLowerCase()] = radians;
      if (modelPreview) {
        modelPreview.rotation[axis.toLowerCase()] = radians;
      }
    };
    slider.addEventListener('input', (e) => {
      numberInput.value = e.target.value;
      updateRotation();
    });
    numberInput.addEventListener('input', (e) => {
      slider.value = e.target.value;
      updateRotation();
    });
    numberInput.addEventListener('change', () => {
      const loadedModel = loadedModels.find((m) => m.url === model.userData.url);
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
    document.querySelectorAll('.tool-button').forEach((b) => b.classList.remove('active'));
    document.getElementById('place-block').classList.add('active');
    if (selectedModel) {
      if (!modelPreview) {
        modelPreview = selectedModel.clone();
        modelPreview.traverse((child) => {
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
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deletePlacedAsset(assetData.id, true);
  };
  const typeSelect = document.createElement('select');
  typeSelect.className = 'asset-type-select';
  assetTypeOptions.forEach((type) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    typeSelect.appendChild(option);
  });
  typeSelect.value = assetData.type || 'scene object';
  typeSelect.addEventListener('change', (e) => {
    const newType = e.target.value;
    const oldType = assetData.type || 'scene object';
    assetData.type = newType;
    debugInfo.lastAction = `Changed asset ${assetData.id} type from ${oldType} to ${newType}`;
    addActionToHistory(debugInfo.lastAction, {
      type: 'changeAssetType',
      assetId: assetData.id,
      previousType: oldType,
      newType: newType,
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

function uploadTexture(file) {
  websim
    .upload(file)
    .then((url) => {
      const name = file.name;
      addTextureToLibrary(url, name);
    })
    .catch((error) => {
      console.error('Error uploading texture:', error);
      debugInfo.lastAction = `Error uploading texture: ${error.message}`;
      addActionToHistory(debugInfo.lastAction);
      updateDebugInfo();
    });
}

function addTextureToLibrary(url, name) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(url, (texture) => {
    texture.userData = {
      url: url,
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
        selectedPlacedAsset.model.traverse((child) => {
          if (child.material) {
            previousMaterials.push({
              object: child,
              texture: child.material.map,
              color: child.material.color.getHexString(),
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
          previousMaterials: previousMaterials,
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
          previousColor: previousColor,
        });
      }
      updateDebugInfo();
    });
    document.getElementById('asset-list').appendChild(assetItem);
    loadedTextures.push({
      url: url,
      name: name,
      texture: texture,
    });
    debugInfo.lastAction = `Added texture to library: ${name}`;
    addActionToHistory(debugInfo.lastAction);
    updateDebugInfo();
  });
}