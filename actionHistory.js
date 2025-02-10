function addActionToHistory(actionDescription, actionData = {}) {
  redoHistory = [];
  document.getElementById('redo-action').disabled = true;
  let serializableActionData = actionData;
  const action = {
    description: actionDescription,
    data: serializableActionData,
  };
  actionHistory.push(action);
  const actionItem = document.createElement('div');
  actionItem.textContent = actionDescription;
  actionHistoryUI.appendChild(actionItem);
  const historySection = actionHistoryUI.closest('.section-content');
  if (historySection && historySection.classList.contains('expanded')) {
    actionItem.scrollIntoView({ behavior: 'smooth' });
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
      const block = lastAction.data;
      removeBlock(lastAction.data.key);
      updateBlocksList();
      break;
    case 'removeBlock':
      const position = lastAction.data.position;
      const key = lastAction.data.key;
      const newBlock = addBlock(new THREE.Vector3(position.x, position.y, position.z));
      gridBlocks[key] = newBlock;
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
        debugInfo.lastAction = `Undid rotating asset ${assetForAxisRot.id} ${lastAction.data.axis}-axis`;
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