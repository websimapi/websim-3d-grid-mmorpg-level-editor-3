// assets.js – Functions for loading, previewing, placing, and managing 3D assets.
import * as THREE from "three";
import { state } from "./state.js";
import { getArrowIcon } from "./utils.js";

export function loadModelFromURL(url, name, defaultRotation = { x: 0, y: 0, z: 0 }) {
  if (state.loadedModels.some((model) => model.url === url)) {
    return;
  }
  state.loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.userData.yOffset = new THREE.Box3().setFromObject(model).min.y;
      model.userData.url = url;
      model.userData.name = name;
      model.rotation.set(defaultRotation.x || 0, defaultRotation.y || 0, defaultRotation.z || 0);
      const assetItem = createAssetItem(model, url, name);
      document.getElementById("asset-list").appendChild(assetItem);
      state.loadedModels.push({
        model: model,
        preview: assetItem.querySelector(".asset-preview"),
        url: url,
        name: name,
      });
      state.debugInfo.lastAction = `Loaded model: ${name}`;
    },
    undefined,
    (error) => {
      console.error(error);
      state.debugInfo.lastAction = `Error loading model: ${error.message}`;
    }
  );
}

export function createAssetItem(model, url, name) {
  const assetItem = document.createElement("div");
  assetItem.className = "asset-item";
  const defaultRotationControls = document.createElement("div");
  defaultRotationControls.className = "default-rotation-controls";
  const rotationLabel = document.createElement("div");
  rotationLabel.textContent = "Default Rotation";
  rotationLabel.className = "rotation-label";
  defaultRotationControls.appendChild(rotationLabel);
  ["X", "Y", "Z"].forEach((axis) => {
    const axisControl = document.createElement("div");
    axisControl.className = "rotation-axis";
    const label = document.createElement("span");
    label.textContent = axis;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "360";
    slider.value = (model.rotation[axis.toLowerCase()] * 180) / Math.PI % 360;
    const numberInput = document.createElement("input");
    numberInput.type = "number";
    numberInput.min = "0";
    numberInput.max = "360";
    numberInput.value = slider.value;
    numberInput.step = "1";
    const updateRotation = () => {
      const radians = numberInput.value * Math.PI / 180;
      model.rotation[axis.toLowerCase()] = radians;
      if (state.modelPreview) {
        state.modelPreview.rotation[axis.toLowerCase()] = radians;
      }
    };
    slider.addEventListener("input", (e) => {
      numberInput.value = e.target.value;
      updateRotation();
    });
    numberInput.addEventListener("input", (e) => {
      slider.value = e.target.value;
      updateRotation();
    });
    numberInput.addEventListener("change", () => {
      const loadedModel = state.loadedModels.find((m) => m.url === model.userData.url);
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
  assetItem.addEventListener("click", () => {
    if (state.modelPreview) {
      state.scene.remove(state.modelPreview);
      state.modelPreview = null;
    }
    state.selectedModel = model;
    state.placementPreview.visible = false;
    document.querySelectorAll(".tool-button").forEach((b) => b.classList.remove("active"));
    document.getElementById("place-block").classList.add("active");
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
    }
  });
  return assetItem;
}

export function addPlacedAssetToList(assetData) {
  const placedAssetsList = document.getElementById("placed-assets-list");
  const assetItem = document.createElement("div");
  assetItem.className = "asset-item";
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-asset-btn";
  deleteBtn.innerHTML = "×";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deletePlacedAsset(assetData.id, true);
  };
  const typeSelect = document.createElement("select");
  typeSelect.className = "asset-type-select";
  state.assetTypeOptions.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    typeSelect.appendChild(option);
  });
  typeSelect.value = assetData.type || "scene object";
  typeSelect.addEventListener("change", (e) => {
    const newType = e.target.value;
    const oldType = assetData.type || "scene object";
    assetData.type = newType;
    state.debugInfo.lastAction = `Changed asset ${assetData.id} type from ${oldType} to ${newType}`;
  });
  assetItem.innerHTML = `
    <div class="asset-name">${assetData.name} (ID: ${assetData.id})</div>
  `;
  assetItem.appendChild(typeSelect);
  assetItem.appendChild(deleteBtn);
  placedAssetsList.appendChild(assetItem);
  assetItem.querySelector(".asset-name").addEventListener("click", () => {
    selectPlacedAsset(assetData.id);
  });
  assetData.assetItem = assetItem;
  assetData.typeSelect = typeSelect;
}

export function getPlacedAssetById(assetId) {
  return state.placedAssets.find((asset) => asset.id === assetId);
}

export function selectPlacedAsset(assetId) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    if (state.selectedPlacedAsset) {
      deselectPlacedAsset();
    }
    if (state.selectedBlock) {
      // (Assume block deselection is handled in blocks.js)
    }
    state.selectedPlacedAsset = asset;
    const helper = new THREE.BoxHelper(asset.model, 0xffff00);
    helper.name = "selectionHelper";
    state.scene.add(helper);
    asset.helper = helper;
    asset.assetItem.classList.add("selected-asset");
    showRotationUI(asset);
  }
}

export function deselectPlacedAsset() {
  if (state.selectedPlacedAsset) {
    if (state.selectedPlacedAsset.helper) {
      state.scene.remove(state.selectedPlacedAsset.helper);
      state.selectedPlacedAsset.helper = null;
    }
    hideRotationUI(state.selectedPlacedAsset);
    state.selectedPlacedAsset.assetItem.classList.remove("selected-asset");
    state.selectedPlacedAsset = null;
  }
}

export function showRotationUI(asset) {
  const rotationUI = document.createElement("div");
  rotationUI.className = "rotation-ui";
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  angles.forEach((angle) => {
    const button = document.createElement("button");
    button.className = "rotation-button";
    button.innerHTML = getArrowIcon(angle);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      rotatePlacedAssetToAngle(asset.id, angle);
    });
    rotationUI.appendChild(button);
  });
  const rotationControls = document.createElement("div");
  rotationControls.className = "rotation-controls";
  const axes = ["X", "Y", "Z"];
  axes.forEach((axis) => {
    const axisControl = document.createElement("div");
    axisControl.className = "rotation-axis";
    const label = document.createElement("span");
    label.textContent = axis;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "360";
    slider.value = (asset.model.rotation[axis.toLowerCase()] * 180) / Math.PI % 360;
    const numberInput = document.createElement("input");
    numberInput.type = "number";
    numberInput.min = "0";
    numberInput.max = "360";
    numberInput.value = slider.value;
    numberInput.step = "1";
    slider.addEventListener("input", (e) => {
      numberInput.value = e.target.value;
      const radians = e.target.value * Math.PI / 180;
      asset.model.rotation[axis.toLowerCase()] = radians;
      if (asset.helper) {
        asset.helper.update();
      }
    });
    numberInput.addEventListener("input", (e) => {
      slider.value = e.target.value;
      const radians = e.target.value * Math.PI / 180;
      asset.model.rotation[axis.toLowerCase()] = radians;
      if (asset.helper) {
        asset.helper.update();
      }
    });
    const updateRotation = (e) => {
      const radians = e.target.value * Math.PI / 180;
      const axisLower = axis.toLowerCase();
      const previousRotation = asset.model.rotation[axisLower];
      state.debugInfo.lastAction = `Rotated asset ${asset.id} ${axis}-axis to ${e.target.value} degrees`;
      if (asset.helper) {
        asset.helper.update();
      }
    };
    slider.addEventListener("change", updateRotation);
    numberInput.addEventListener("change", updateRotation);
    axisControl.appendChild(label);
    axisControl.appendChild(slider);
    axisControl.appendChild(numberInput);
    rotationControls.appendChild(axisControl);
  });
  rotationUI.appendChild(rotationControls);
  asset.assetItem.appendChild(rotationUI);
  asset.rotationUI = rotationUI;
}

export function hideRotationUI(asset) {
  if (asset.rotationUI) {
    asset.assetItem.removeChild(asset.rotationUI);
    asset.rotationUI = null;
  }
}

export function rotatePlacedAssetToAngle(assetId, angle) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    const previousRotation = asset.model.rotation.y;
    asset.model.rotation.y = THREE.Math.degToRad(angle);
    if (asset.helper) {
      asset.helper.update();
    }
    state.debugInfo.lastAction = `Rotated asset ${assetId} to ${angle} degrees`;
  }
}

export function deletePlacedAsset(assetId, recordAction = true) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    if (asset.helper) {
      state.scene.remove(asset.helper);
    }
    state.scene.remove(asset.model);
    asset.assetItem.parentNode.removeChild(asset.assetItem);
    const index = state.placedAssets.findIndex((a) => a.id === assetId);
    if (index !== -1) {
      state.placedAssets.splice(index, 1);
    }
    if (state.selectedPlacedAsset && state.selectedPlacedAsset.id === assetId) {
      deselectPlacedAsset();
    }
    state.debugInfo.lastAction = `Deleted asset ${assetId}`;
  }
}