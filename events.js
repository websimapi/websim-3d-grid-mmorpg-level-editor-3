// events.js – Handles mouse and window events.
import * as THREE from "three";
import { state } from "./state.js";
import { getGridPosition, getHighestBlockAt, updateDebugInfo } from "./utils.js";

export function onMouseMove(event) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.debugInfo.mousePosition = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.debugInfo.normalizedMouse = { x: state.mouse.x, y: state.mouse.y };
  state.debugInfo.cameraPosition = {
    x: state.camera.position.x.toFixed(2),
    y: state.camera.position.y.toFixed(2),
    z: state.camera.position.z.toFixed(2),
  };
  state.raycaster.setFromCamera(state.mouse, state.camera);
  const intersects = state.raycaster.intersectObjects(
    [state.groundPlane, ...Object.values(state.gridBlocks)],
    true
  );
  if (intersects.length > 0) {
    const intersect = intersects[0];
    state.debugInfo.raycastHit = {
      point: {
        x: intersect.point.x.toFixed(2),
        y: intersect.point.y.toFixed(2),
        z: intersect.point.z.toFixed(2),
      },
    };
    const gridPos = getGridPosition(intersect.point);
    state.debugInfo.gridPosition = gridPos;
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById("color-dropper").classList.contains("active")) {
      if (state.modelPreview) state.modelPreview.visible = false;
      const key = `${gridPos.x},${highestY},${gridPos.z}`;
      if (state.gridBlocks[key]) {
        state.placementPreview.visible = true;
        state.placementPreview.material.color.set(0x00ff00);
        state.placementPreview.position.set(gridPos.x + 0.5, highestY + 0.25, gridPos.z + 0.5);
      } else {
        state.placementPreview.visible = false;
      }
    } else if (document.getElementById("place-block").classList.contains("active")) {
      if (state.selectedModel) {
        if (!state.modelPreview) {
          state.modelPreview = state.selectedModel.clone();
          state.modelPreview.traverse((child) => {
            if (child.material) {
              child.material = child.material.clone();
              child.material.transparent = true;
              child.material.opacity = 0.5;
            }
          });
          state.modelPreview.rotation.copy(state.selectedModel.rotation);
          state.scene.add(state.modelPreview);
        }
        const yOffset = state.selectedModel.userData.yOffset || 0;
        state.modelPreview.position.set(Math.floor(gridPos.x) + 0.5, highestY + 0.5 - yOffset, Math.floor(gridPos.z) + 0.5);
        state.modelPreview.visible = true;
        state.placementPreview.visible = false;
      } else {
        if (state.modelPreview) state.modelPreview.visible = false;
        state.placementPreview.visible = true;
        state.placementPreview.material.color.set(0x00ff00);
        state.placementPreview.position.set(gridPos.x + 0.5, highestY + 0.75, gridPos.z + 0.5);
      }
    } else if (document.getElementById("remove-block").classList.contains("active")) {
      if (state.modelPreview) state.modelPreview.visible = false;
      const key = `${gridPos.x},${highestY},${gridPos.z}`;
      if (state.gridBlocks[key]) {
        state.placementPreview.visible = true;
        state.placementPreview.material.color.set(0xff0000);
        state.placementPreview.position.set(gridPos.x + 0.5, highestY + 0.25, gridPos.z + 0.5);
      } else {
        state.placementPreview.visible = false;
      }
    } else {
      if (state.placementPreview) state.placementPreview.visible = false;
      if (state.modelPreview) state.modelPreview.visible = false;
    }
  } else {
    state.debugInfo.raycastHit = null;
    state.debugInfo.gridPosition = null;
    if (state.placementPreview) state.placementPreview.visible = false;
    if (state.modelPreview) state.modelPreview.visible = false;
  }
  updateDebugInfo();
}

export function onMouseClick(event) {
  if (document.getElementById("color-dropper").classList.contains("active")) {
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const intersects = state.raycaster.intersectObjects(Object.values(state.gridBlocks), true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      for (const key in state.gridBlocks) {
        if (state.gridBlocks[key] === intersect.object) {
          const block = state.gridBlocks[key];
          const hexColor = '#' + block.material.color.getHexString();
          document.getElementById('block-color').value = hexColor;
          state.debugInfo.lastAction = `Selected color ${hexColor} from block at ${block.userData.key}`;
          state.actions.push({ description: `Selected color ${hexColor} from block at ${block.userData.key}` });
          updateDebugInfo();
          break;
        }
      }
    }
    return;
  }
  state.raycaster.setFromCamera(state.mouse, state.camera);
  const intersects = state.raycaster.intersectObjects([...Object.values(state.gridBlocks), ...state.placedAssets.map(a => a.model)], true);
  let clickedBlock = null;
  let clickedAsset = null;
  if (intersects.length > 0) {
    const intersect = intersects[0];
    for (const key in state.gridBlocks) {
      if (state.gridBlocks[key] === intersect.object) {
        clickedBlock = state.gridBlocks[key];
        break;
      }
    }
    if (!clickedBlock) {
      const assetModel = intersect.object;
      const asset = state.placedAssets.find(a => a.model === assetModel || a.model.children.includes(assetModel));
      if (asset) {
        clickedAsset = asset;
      }
    }
  }
  if (document.getElementById("select-tool").classList.contains("active")) {
    if (clickedBlock) {
      // Select block logic
      if (state.selectedBlock) {
        state.selectedBlock = null;
        updateBlocksList();
      }
      state.selectedBlock = clickedBlock;
      document.getElementById('block-color').value = '#' + clickedBlock.material.color.getHexString();
      document.getElementById('block-orientation').value = clickedBlock.userData.orientation || 'north';
      addBlockOutline(clickedBlock);
    } else if (clickedAsset) {
      if (state.selectedBlock) {
        state.selectedBlock = null;
        updateBlocksList();
      }
      selectPlacedAsset(clickedAsset.id);
    } else {
      if (state.selectedBlock) {
        state.selectedBlock = null;
        updateBlocksList();
      }
      if (state.selectedPlacedAsset) {
        deselectPlacedAsset();
      }
    }
    return;
  }
  if (clickedBlock) {
    if (state.selectedPlacedAsset) {
      deselectPlacedAsset();
    }
    if (state.selectedBlock) {
      state.selectedBlock = null;
      updateBlocksList();
    }
  } else if (clickedAsset) {
    if (state.selectedBlock) {
      state.selectedBlock = null;
      updateBlocksList();
    }
    selectPlacedAsset(clickedAsset.id);
  } else {
    if (state.selectedBlock) {
      state.selectedBlock = null;
      updateBlocksList();
    }
    if (state.selectedPlacedAsset) {
      deselectPlacedAsset();
    }
  }
  state.raycaster.setFromCamera(state.mouse, state.camera);
  const groundIntersects = state.raycaster.intersectObjects([state.groundPlane, ...Object.values(state.gridBlocks)], true);
  if (groundIntersects.length > 0) {
    const intersect = groundIntersects[0];
    const gridPos = getGridPosition(intersect.point);
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById("place-block").classList.contains("active")) {
      if (state.selectedModel) {
        const clone = state.selectedModel.clone();
        clone.rotation.copy(state.selectedModel.rotation);
        const yOffset = state.selectedModel.userData.yOffset || 0;
        clone.position.set(Math.floor(gridPos.x) + 0.5, highestY + 0.5 - yOffset, Math.floor(gridPos.z) + 0.5);
        state.scene.add(clone);
        const assetId = state.assetIdCounter++;
        const assetData = {
          id: assetId,
          model: clone,
          position: clone.position.clone(),
          url: state.selectedModel.userData.url,
          name: state.selectedModel.userData.name
        };
        state.placedAssets.push(assetData);
        addPlacedAssetToList(assetData);
        state.debugInfo.lastAction = `Placed model at ${clone.position.toArray()}`;
        state.actions.push({ description: `Placed model at ${clone.position.toArray()}` });
      } else {
        const key = `${gridPos.x},${highestY + 0.5},${gridPos.z}`;
        if (!state.gridBlocks[key]) {
          const blockType = document.getElementById('block-type').value;
          const block = addBlock(new THREE.Vector3(gridPos.x, highestY + 0.5, gridPos.z), blockType);
          state.gridBlocks[key] = block;
          updateBlocksList();
          state.debugInfo.lastAction = `Placed ${blockType} block at ${key}`;
          state.actions.push({ description: `Placed ${blockType} block at ${key}` });
        }
      }
    } else if (document.getElementById("remove-block").classList.contains("active")) {
      const topBlockKey = `${gridPos.x},${highestY},${gridPos.z}`;
      if (state.gridBlocks[topBlockKey]) {
        const block = state.gridBlocks[topBlockKey];
        removeBlock(topBlockKey);
        state.debugInfo.lastAction = `Removed block at ${topBlockKey}`;
        state.actions.push({ description: `Removed block at ${topBlockKey}` });
      }
    }
    updateDebugInfo();
    state.room.send({
      type: "gridUpdate",
      action: document.getElementById("place-block").classList.contains("active") ? 'place' : 'remove',
      position: gridPos,
      color: state.selectedBlock ? state.selectedBlock.material.color.getHexString() : null,
      assetData: state.selectedModel ? {
        url: state.selectedModel.userData.url,
        name: state.selectedModel.userData.name
      } : null
    });
  }
  updateDebugInfo();
}

export function onWindowResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}