import { state } from "../globals.js";
import { updateDebugInfo } from "./uiManager.js";
import { addBlock, removeBlock } from "./blockManager.js";
import { getPlacedAssetById, deselectPlacedAsset, addPlacedAssetToList, deletePlacedAsset } from "./assetManager.js";

export function addActionToHistory(actionDescription, actionData = {}) {
  state.redoHistory = [];
  document.getElementById('redo-action').disabled = true;
  const action = {
    description: actionDescription,
    data: actionData
  };
  state.actionHistory.push(action);
  const actionHistoryUI = document.getElementById('action-history');
  const actionItem = document.createElement('div');
  actionItem.textContent = actionDescription;
  actionHistoryUI.appendChild(actionItem);
  const historySection = actionHistoryUI.closest('.section-content');
  if (historySection && historySection.classList.contains('expanded')) {
    actionItem.scrollIntoView({ behavior: 'smooth' });
  }
}

export function undoLastAction() {
  if (state.actionHistory.length === 0) return;
  const lastAction = state.actionHistory.pop();
  state.redoHistory.push(lastAction);
  if (state.redoHistory.length > state.MAX_REDO_HISTORY) {
    state.redoHistory.shift();
  }
  document.getElementById('redo-action').disabled = false;
  const actionHistoryUI = document.getElementById('action-history');
  const actionItem = actionHistoryUI.lastChild;
  if (actionItem) {
    actionHistoryUI.removeChild(actionItem);
  }
  switch (lastAction.data.type) {
    case 'placeBlock':
      removeBlock(lastAction.data.key);
      break;
    case 'removeBlock':
      {
        const position = lastAction.data.position;
        const key = lastAction.data.key;
        const block = addBlock(new THREE.Vector3(position.x, position.y, position.z));
        state.gridBlocks[key] = block;
      }
      break;
    case 'changeBlockColor':
      if (lastAction.data.block && state.gridBlocks[lastAction.data.key]) {
        const block = state.gridBlocks[lastAction.data.key];
        block.material.color.set('#' + lastAction.data.previousColor);
      }
      break;
    case 'changeBlockOrientation':
      if (lastAction.data.key && state.gridBlocks[lastAction.data.key]) {
        const block = state.gridBlocks[lastAction.data.key];
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
        document.getElementById('block-orientation').value = lastAction.data.previousOrientation;
      }
      break;
    case 'placeAsset':
      {
        const asset = getPlacedAssetById(lastAction.data.assetData.id);
        if (asset) {
          state.scene.remove(asset.model);
          const index = state.placedAssets.findIndex(a => a.id === asset.id);
          if (index !== -1) {
            state.placedAssets.splice(index, 1);
          }
          if (state.selectedPlacedAsset && state.selectedPlacedAsset.id === asset.id) {
            deselectPlacedAsset();
          }
        }
      }
      break;
    case 'deleteAsset':
      {
        const assetData = lastAction.data.assetData;
        state.loader.load(assetData.url, gltf => {
          const model = gltf.scene;
          model.position.set(assetData.position.x, assetData.position.y, assetData.position.z);
          model.rotation.set(assetData.rotation.x, assetData.rotation.y, assetData.rotation.z);
          model.scale.set(assetData.scale.x, assetData.scale.y, assetData.scale.z);
          model.userData.url = assetData.url;
          model.userData.name = assetData.name;
          state.scene.add(model);
          const asset = {
            id: assetData.id,
            model: model,
            position: model.position.clone(),
            url: assetData.url,
            name: assetData.name
          };
          state.placedAssets.push(asset);
          addPlacedAssetToList(asset);
        });
      }
      break;
    case 'rotateAsset':
      {
        const assetForRotation = getPlacedAssetById(lastAction.data.assetId);
        if (assetForRotation) {
          assetForRotation.model.rotation.y = lastAction.data.previousRotation;
          if (assetForRotation.helper) {
            assetForRotation.helper.update();
          }
        }
      }
      break;
    case 'rotateAssetAxis':
      {
        const assetForAxisRotation = getPlacedAssetById(lastAction.data.assetId);
        if (assetForAxisRotation) {
          assetForAxisRotation.model.rotation[lastAction.data.axis] = lastAction.data.previousRotation;
          if (assetForAxisRotation.helper) {
            assetForAxisRotation.helper.update();
          }
        }
      }
      break;
    case 'changeAssetType':
      {
        const assetForTypeChange = getPlacedAssetById(lastAction.data.assetId);
        if (assetForTypeChange) {
          assetForTypeChange.type = lastAction.data.previousType;
          if (assetForTypeChange.typeSelect) {
            assetForTypeChange.typeSelect.value = lastAction.data.previousType;
          }
        }
      }
      break;
    case 'applyTexture':
      if (state.gridBlocks[lastAction.data.blockKey]) {
        const block = state.gridBlocks[lastAction.data.blockKey];
        block.material.map = lastAction.data.previousTexture;
        if (!lastAction.data.previousTexture) {
          block.material.color.set('#' + lastAction.data.previousColor);
        }
        block.material.needsUpdate = true;
      }
      break;
    case 'applyAssetTexture':
      {
        const assetForTextureChange = getPlacedAssetById(lastAction.data.assetId);
        if (assetForTextureChange) {
          lastAction.data.previousMaterials.forEach(prev => {
            prev.object.material.map = prev.texture;
            if (!prev.texture) {
              prev.object.material.color.set('#' + prev.color);
            }
            prev.object.material.needsUpdate = true;
          });
        }
      }
      break;
    default:
      state.debugInfo.lastAction = `Undid action: ${lastAction.description}`;
  }
  updateDebugInfo();
}

export function redoLastAction() {
  if (state.redoHistory.length === 0) return;
  const actionToRedo = state.redoHistory.pop();
  document.getElementById('redo-action').disabled = state.redoHistory.length === 0;
  switch (actionToRedo.data.type) {
    case 'placeBlock':
      {
        const block = addBlock(new THREE.Vector3(actionToRedo.data.position.x, actionToRedo.data.position.y, actionToRedo.data.position.z));
        state.gridBlocks[actionToRedo.data.key] = block;
      }
      break;
    case 'removeBlock':
      removeBlock(actionToRedo.data.key);
      break;
    case 'changeBlockColor':
      if (actionToRedo.data.key && state.gridBlocks[actionToRedo.data.key]) {
        const block = state.gridBlocks[actionToRedo.data.key];
        block.material.color.set('#' + actionToRedo.data.newColor);
      }
      break;
    case 'changeBlockOrientation':
      if (actionToRedo.data.key && state.gridBlocks[actionToRedo.data.key]) {
        const block = state.gridBlocks[actionToRedo.data.key];
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
        document.getElementById('block-orientation').value = actionToRedo.data.newOrientation;
      }
      break;
    case 'placeAsset':
      {
        const assetDataToRedo = actionToRedo.data.assetData;
        state.loader.load(assetDataToRedo.url, gltf => {
          const model = gltf.scene;
          model.position.set(assetDataToRedo.position.x, assetDataToRedo.position.y, assetDataToRedo.position.z);
          model.rotation.set(assetDataToRedo.rotation.x, assetDataToRedo.rotation.y, assetDataToRedo.rotation.z);
          model.scale.set(assetDataToRedo.scale.x, assetDataToRedo.scale.y, assetDataToRedo.scale.z);
          model.userData.url = assetDataToRedo.url;
          model.userData.name = assetDataToRedo.name;
          state.scene.add(model);
          const assetToRedo = {
            id: assetDataToRedo.id,
            model: model,
            position: model.position.clone(),
            url: assetDataToRedo.url,
            name: assetDataToRedo.name
          };
          state.placedAssets.push(assetToRedo);
          addPlacedAssetToList(assetToRedo);
        });
      }
      break;
    case 'deleteAsset':
      deletePlacedAsset(actionToRedo.data.assetData.id, false);
      break;
    case 'changeAssetType':
      {
        const assetForTypeRedo = getPlacedAssetById(actionToRedo.data.assetId);
        if (assetForTypeRedo) {
          assetForTypeRedo.type = actionToRedo.data.newType;
          if (assetForTypeRedo.typeSelect) {
            assetForTypeRedo.typeSelect.value = actionToRedo.data.newType;
          }
        }
      }
      break;
    case 'applyTexture':
      if (state.gridBlocks[actionToRedo.data.blockKey]) {
        const blockToRedo = state.gridBlocks[actionToRedo.data.blockKey];
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(actionToRedo.data.textureUrl, texture => {
          blockToRedo.material.map = texture;
          blockToRedo.material.needsUpdate = true;
        });
      }
      break;
    case 'applyAssetTexture':
      {
        const assetForTextureRedo = getPlacedAssetById(actionToRedo.data.assetId);
        if (assetForTextureRedo) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(actionToRedo.data.textureUrl, texture => {
            assetForTextureRedo.model.traverse(child => {
              if (child.material) {
                child.material.map = texture;
                child.material.needsUpdate = true;
              }
            });
          });
        }
      }
      break;
    case 'rotateAssetAxis':
      {
        const assetForAxisRedo = getPlacedAssetById(actionToRedo.data.assetId);
        if (assetForAxisRedo) {
          assetForAxisRedo.model.rotation[actionToRedo.data.axis] = actionToRedo.data.newRotation;
          if (assetForAxisRedo.helper) {
            assetForAxisRedo.helper.update();
          }
        }
      }
      break;
    default:
      console.log('Unknown action type:', actionToRedo.data.type);
  }
  state.actionHistory.push(actionToRedo);
  const actionHistoryUI = document.getElementById('action-history');
  const actionItem = document.createElement('div');
  actionItem.textContent = actionToRedo.description;
  actionHistoryUI.appendChild(actionItem);
  state.debugInfo.lastAction = `Redid: ${actionToRedo.description}`;
  updateDebugInfo();
}