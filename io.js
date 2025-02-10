// io.js – Handles export/import and file uploads.
import { state } from "./state.js";
import { removeBlock } from "./blocks.js";
import { loadModelFromURL } from "./assets.js";
import { addBlock } from "./blocks.js";

export async function exportLevel() {
  const levelData = {
    blocks: Object.keys(state.gridBlocks).map((key) => {
      const [x, y, z] = key.split(",").map(Number);
      const block = state.gridBlocks[key];
      const blockData = {
        x,
        y,
        z,
        color: block.material.color.getHexString(),
        type: block.userData.blockType || "half",
        orientation: block.userData.orientation || "north",
      };
      if (block.material.map) {
        blockData.textureUrl = block.material.map.userData?.url;
      }
      return blockData;
    }),
    assets: state.placedAssets.map((asset) => {
      const assetData = {
        id: asset.id,
        url: asset.url,
        name: asset.name,
        type: asset.type || "scene object",
        position: {
          x: asset.model.position.x,
          y: asset.model.position.y,
          z: asset.model.position.z,
        },
        rotation: {
          x: asset.model.rotation.x,
          y: asset.model.rotation.y,
          z: asset.model.rotation.z,
        },
        scale: {
          x: asset.model.scale.x,
          y: asset.model.scale.y,
          z: asset.model.scale.z,
        },
      };
      const appliedTextures = [];
      asset.model.traverse((child) => {
        if (child.material && child.material.map) {
          appliedTextures.push(child.material.map.userData?.url);
        }
      });
      if (appliedTextures.length > 0) {
        assetData.textureUrls = appliedTextures;
      }
      return assetData;
    }),
    assetLibrary: state.loadedModels.map((model) => {
      return {
        url: model.url,
        name: model.name,
        defaultRotation: {
          x: model.model.rotation.x,
          y: model.model.rotation.y,
          z: model.model.rotation.z,
        },
      };
    }),
    textures: state.loadedTextures.map((texture) => ({
      url: texture.url,
      name: texture.name,
    })),
    actionHistory: state.actionHistory,
  };
  const blob = new Blob([JSON.stringify(levelData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "level.json";
  a.click();
  URL.revokeObjectURL(url);
  state.debugInfo.lastAction = `Exported Level - Blocks: ${levelData.blocks.length}, Assets: ${levelData.assets.length}, Asset Library: ${levelData.assetLibrary.length}, Textures: ${levelData.textures.length}, Action History Included: true`;
}

export function importLevel(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const levelData = JSON.parse(e.target.result);
      // Remove all existing blocks and assets.
      Object.keys(state.gridBlocks).forEach((key) => {
        removeBlock(key);
      });
      state.gridBlocks = {};
      state.placedAssets.forEach((asset) => {
        state.scene.remove(asset.model);
      });
      state.placedAssets = [];
      document.getElementById("placed-assets-list").innerHTML = "";
      state.loadedModels = [];
      document.getElementById("asset-list").innerHTML = "";
      const processedUrls = new Set();
      levelData.assetLibrary?.forEach((asset) => {
        if (!processedUrls.has(asset.url)) {
          loadModelFromURL(asset.url, asset.name, asset.defaultRotation);
          processedUrls.add(asset.url);
        }
      });
      levelData.assets?.forEach((asset) => {
        if (!processedUrls.has(asset.url)) {
          loadModelFromURL(asset.url, asset.name, asset.defaultRotation);
          processedUrls.add(asset.url);
        }
      });
      levelData.textures?.forEach((textureData) => {
        addTextureToLibrary(textureData.url, textureData.name);
      });
      levelData.blocks?.forEach((block) => {
        const newBlock = addBlock(new THREE.Vector3(block.x, block.y, block.z), block.type || "half");
        if (block.orientation) {
          newBlock.userData.orientation = block.orientation;
          let rotation = 0;
          switch (block.orientation) {
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
          newBlock.rotation.y = rotation;
        }
        if (block.color) {
          newBlock.material.color.set("#" + block.color);
        }
        if (block.textureUrl) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(block.textureUrl, (texture) => {
            texture.userData = {
              url: block.textureUrl,
            };
            newBlock.material.map = texture;
            newBlock.material.needsUpdate = true;
          });
        }
        state.gridBlocks[`${block.x},${block.y},${block.z}`] = newBlock;
      });
      if (levelData.actionHistory && Array.isArray(levelData.actionHistory)) {
        state.actionHistory = levelData.actionHistory;
        state.actionHistoryUI.innerHTML = "";
        state.actionHistory.forEach((action) => {
          const actionItem = document.createElement("div");
          actionItem.textContent = action.description;
          state.actionHistoryUI.appendChild(actionItem);
        });
      } else {
        state.actionHistory = [];
        state.actionHistoryUI.innerHTML = "";
      }
      state.debugInfo.lastAction = `Imported Level - Blocks: ${levelData.blocks?.length || 0}, Assets: ${levelData.assets?.length || 0}, Asset Library: ${levelData.assetLibrary?.length || 0}, Textures: ${levelData.textures?.length || 0}, Action History Loaded: ${levelData.actionHistory ? "Yes" : "No"}`;
    } catch (error) {
      console.error("Error importing level:", error);
      state.debugInfo.lastAction = `Error importing level: ${error.message}`;
    }
  };
  reader.readAsText(file);
}

export async function uploadModel(file) {
  try {
    const url = await websim.upload(file);
    const name = file.name;
    loadModelFromURL(url, name);
  } catch (error) {
    console.error("Error uploading file:", error);
    state.debugInfo.lastAction = `Error uploading model: ${error.message}`;
  }
}

export async function uploadTexture(file) {
  try {
    const url = await websim.upload(file);
    const name = file.name;
    addTextureToLibrary(url, name);
  } catch (error) {
    console.error("Error uploading texture:", error);
    state.debugInfo.lastAction = `Error uploading texture: ${error.message}`;
  }
}

export function addTextureToLibrary(url, name) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(url, (texture) => {
    texture.userData = { url: url };
    const assetItem = document.createElement("div");
    assetItem.className = "asset-item";
    assetItem.innerHTML = `
      <div class="asset-name">${name} (Texture)</div>
      <div style="max-width: 100%; height: 100px; background: #222; margin-top: 10px; border-radius: 4px;"></div>
    `;
    assetItem.addEventListener("click", () => {
      if (state.selectedPlacedAsset) {
        const previousMaterials = [];
        state.selectedPlacedAsset.model.traverse((child) => {
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
        state.debugInfo.lastAction = `Applied texture ${name} to asset ${state.selectedPlacedAsset.id}`;
      } else if (state.selectedBlock) {
        const previousTexture = state.selectedBlock.material.map;
        const previousColor = state.selectedBlock.material.color.getHexString();
        state.selectedBlock.material.map = texture;
        state.selectedBlock.material.needsUpdate = true;
        state.debugInfo.lastAction = `Applied texture ${name} to block at ${state.selectedBlock.userData.key}`;
      }
    });
    document.getElementById("asset-list").appendChild(assetItem);
    state.loadedTextures.push({ url: url, name: name, texture: texture });
    state.debugInfo.lastAction = `Added texture to library: ${name}`;
  });
}