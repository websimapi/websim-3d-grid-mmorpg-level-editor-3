// history.js – Functions to add actions to the history and enable undo/redo.
import { state } from "./state.js";
import { updateDebugInfo } from "./utils.js";
import { removeBlock } from "./blocks.js";
import { getPlacedAssetById, deselectPlacedAsset, deletePlacedAsset } from "./assets.js";

export function addActionToHistory(actionDescription, actionData = {}) {
  state.redoHistory = [];
  document.getElementById("redo-action").disabled = true;
  const action = {
    description: actionDescription,
    data: actionData,
  };
  state.actionHistory.push(action);
  const actionItem = document.createElement("div");
  actionItem.textContent = actionDescription;
  state.actionHistoryUI.appendChild(actionItem);
  const historySection = state.actionHistoryUI.closest(".section-content");
  if (historySection && historySection.classList.contains("expanded")) {
    actionItem.scrollIntoView({ behavior: "smooth" });
  }
}

export function undoLastAction() {
  if (state.actionHistory.length === 0) return;
  const lastAction = state.actionHistory.pop();
  state.redoHistory.push(lastAction);
  if (state.redoHistory.length > state.MAX_REDO_HISTORY) {
    state.redoHistory.shift();
  }
  document.getElementById("redo-action").disabled = false;
  const actionItem = state.actionHistoryUI.lastChild;
  if (actionItem) {
    state.actionHistoryUI.removeChild(actionItem);
  }
  switch (lastAction.data.type) {
    case "placeBlock":
      removeBlock(lastAction.data.key);
      break;
    case "removeBlock":
      // Recreate block (assuming proper data exists)
      break;
    case "changeBlockColor":
      if (lastAction.data.block && state.gridBlocks[lastAction.data.key]) {
        const block = state.gridBlocks[lastAction.data.key];
        block.material.color.set("#" + lastAction.data.previousColor);
        if (state.selectedBlock === block) {
          document.getElementById("block-color").value = "#" + lastAction.data.previousColor;
        }
        state.debugInfo.lastAction = `Undid color change of block at ${lastAction.data.key}`;
      }
      break;
    case "changeBlockOrientation":
      if (lastAction.data.key && state.gridBlocks[lastAction.data.key]) {
        const block = state.gridBlocks[lastAction.data.key];
        block.userData.orientation = lastAction.data.previousOrientation;
        let rotation = 0;
        switch (lastAction.data.previousOrientation) {
          case "east":
            rotation = Math.PI / 2;
            break;
          case "south":
            rotation = Math.PI;
            break;
          case "west":
            rotation = -Math.PI / 2;
            break;
        }
        block.rotation.y = rotation;
        if (state.selectedBlock === block) {
          document.getElementById("block-orientation").value = lastAction.data.previousOrientation;
        }
      }
      break;
    case "placeAsset":
      if (state.selectedPlacedAsset && state.selectedPlacedAsset.id === lastAction.data.assetData.id) {
        deselectPlacedAsset();
      }
      deletePlacedAsset(lastAction.data.assetData.id, false);
      break;
    case "deleteAsset":
      {
        const assetData = lastAction.data.assetData;
        state.loader.load(assetData.url, (gltf) => {
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
            name: assetData.name,
          };
          state.placedAssets.push(asset);
        });
      }
      break;
    case "rotateAsset":
      {
        const asset = getPlacedAssetById(lastAction.data.assetId);
        if (asset) {
          asset.model.rotation.y = lastAction.data.previousRotation;
          if (asset.helper) {
            asset.helper.update();
          }
          state.debugInfo.lastAction = `Undid rotating asset ${asset.id}`;
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
  document.getElementById("redo-action").disabled = state.redoHistory.length === 0;
  state.actionHistory.push(actionToRedo);
  const actionItem = document.createElement("div");
  actionItem.textContent = actionToRedo.description;
  state.actionHistoryUI.appendChild(actionItem);
  state.debugInfo.lastAction = `Redid: ${actionToRedo.description}`;
  updateDebugInfo();
}