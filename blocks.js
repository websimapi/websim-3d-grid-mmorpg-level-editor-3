// blocks.js – Functions for block creation, removal, and UI updates for blocks.
import * as THREE from "three";
import { state } from "./state.js";
import { updateDebugInfo } from "./utils.js";
import { deselectPlacedAsset } from "./assets.js";

export function addBlock(position, blockType = document.getElementById("block-type").value) {
  let geometry;
  const orientation = document.getElementById("block-orientation").value;
  let rotation = 0;
  switch (orientation) {
    case "north":
      rotation = 0;
      break;
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
  switch (blockType) {
    case "full":
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case "stair":
      geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.5, 0.0, 0.5,  0.5, 0.0, 0.5,  0.5, 0.25, 0.5,  -0.5, 0.25, 0.5,
        -0.5, 0.0, -0.5, 0.5, 0.0, -0.5,  0.5, 0.25, -0.5, -0.5, 0.25, -0.5,
        -0.5, 0.25, 0.5,  0.0, 0.25, 0.5,   0.0, 0.5, 0.5,   -0.5, 0.5, 0.5,
        -0.5, 0.25, -0.5, 0.0, 0.25, -0.5,  0.0, 0.5, -0.5,  -0.5, 0.5, -0.5,
      ]);
      const indices = new Uint16Array([
         0,1,2,  0,2,3,
         4,5,6,  4,6,7,
         0,4,7,  0,7,3,
         1,5,6,  1,6,2,
         3,2,6,  3,6,7,
         0,1,5,  0,5,4,
         8,9,10, 8,10,11,
         12,13,14, 12,14,15,
         8,12,15, 8,15,11,
         9,13,14, 9,14,10,
         11,10,14, 11,14,15,
         8,9,13, 8,13,12,
      ]);
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 0.5, 1);
  }
  const material = new THREE.MeshPhongMaterial({
    color: document.getElementById("block-color").value,
  });
  const block = new THREE.Mesh(geometry, material);
  block.userData.initialColor = material.color.getHexString();
  block.userData.blockType = blockType;
  block.userData.orientation = orientation;
  const adjustedX = position.x + 0.5;
  const adjustedY =
    position.y +
    (blockType === "full"
      ? 0.5
      : blockType === "half"
      ? 0.25
      : blockType === "stair"
      ? 0.0
      : 0.25);
  const adjustedZ = position.z + 0.5;
  block.position.set(adjustedX, adjustedY, adjustedZ);
  block.rotation.y = rotation;
  block.userData.key = `${position.x},${position.y},${position.z}`;
  state.scene.add(block);
  if (!state.selectedBlock) {
    state.selectedBlock = block;
    document.getElementById("block-color").value = "#" + block.material.color.getHexString();
    updateBlocksList();
  }
  return block;
}

export function removeBlock(key) {
  state.scene.children.forEach((child) => {
    if (child.userData.key === key) {
      if (child.userData.outline) {
        state.scene.remove(child.userData.outline);
      }
      state.scene.remove(child);
      delete state.gridBlocks[key];
      if (state.selectedBlock && state.selectedBlock.userData.key === key) {
        selectBlock(null);
      }
    }
  });
  updateBlocksList();
}

export function updateBlocksList() {
  if (state.selectedBlock) {
    state.initialBlockColor = null;
  }
  const blocksList = document.getElementById("placed-blocks-list");
  const scrollTop = blocksList.scrollTop;
  blocksList.innerHTML = "";
  Object.entries(state.gridBlocks).forEach(([key, block]) => {
    const blockItem = document.createElement("div");
    blockItem.className = "block-item";
    if (state.selectedBlock && state.selectedBlock.userData.key === key) {
      blockItem.classList.add("selected-block");
    }
    const [x, y, z] = key.split(",").map(Number);
    blockItem.textContent = `${block.userData.blockType || "half"} Block at (${x}, ${y}, ${z}) facing ${
      block.userData.orientation || "north"
    }`;
    blockItem.addEventListener("click", () => {
      selectBlock(block);
    });
    blocksList.appendChild(blockItem);
  });
  blocksList.scrollTop = scrollTop;
}

export function selectBlock(block) {
  if (state.selectedPlacedAsset) {
    // Deselect any asset if a block is being selected
    // (Assume deselectPlacedAsset is imported from assets.js)
    deselectPlacedAsset();
  }
  if (state.selectedBlock === block) return;
  if (state.selectedBlock) {
    removeBlockOutline(state.selectedBlock);
  }
  state.selectedBlock = block;
  if (state.selectedBlock && document.getElementById("select-tool").classList.contains("active")) {
    document.getElementById("block-color").value = "#" + state.selectedBlock.material.color.getHexString();
    document.getElementById("block-orientation").value = state.selectedBlock.userData.orientation || "north";
    addBlockOutline(state.selectedBlock);
  }
  updateBlocksList();
}

export function addBlockOutline(block) {
  if (block.userData.outline) {
    removeBlockOutline(block);
  }
  let geometry;
  switch (block.userData.blockType) {
    case "full":
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case "stair":
      geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.5, 0.0, 0.5,  0.5, 0.0, 0.5,  0.5, 0.25, 0.5,  -0.5, 0.25, 0.5,
        -0.5, 0.0, -0.5, 0.5, 0.0, -0.5,  0.5, 0.25, -0.5, -0.5, 0.25, -0.5,
        -0.5, 0.25, 0.5,  0.0, 0.25, 0.5,   0.0, 0.5, 0.5,   -0.5, 0.5, 0.5,
        -0.5, 0.25, -0.5, 0.0, 0.25, -0.5,  0.0, 0.5, -0.5,  -0.5, 0.5, -0.5,
      ]);
      const indices = new Uint16Array([
         0,1,2,  0,2,3,
         4,5,6,  4,6,7,
         0,4,7,  0,7,3,
         1,5,6,  1,6,2,
         3,2,6,  3,6,7,
         0,1,5,  0,5,4,
         8,9,10, 8,10,11,
         12,13,14, 12,14,15,
         8,12,15, 8,15,11,
         9,13,14, 9,14,10,
         11,10,14, 11,14,15,
         8,9,13, 8,13,12,
      ]);
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 0.5, 1);
  }
  const edges = new THREE.EdgesGeometry(geometry);
  const outline = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 2 })
  );
  outline.position.copy(block.position);
  outline.rotation.copy(block.rotation);
  outline.scale.set(1.02, 1.02, 1.02);
  state.scene.add(outline);
  block.userData.outline = outline;
}

export function removeBlockOutline(block) {
  if (block.userData.outline) {
    state.scene.remove(block.userData.outline);
    block.userData.outline = null;
  }
}