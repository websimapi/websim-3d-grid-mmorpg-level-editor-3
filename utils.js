// utils.js – Utility helper functions
import { state } from "./state.js";

export function getGridPosition(point) {
  return {
    x: Math.floor(point.x),
    z: Math.floor(point.z),
  };
}

export function getHighestBlockAt(x, z) {
  let maxY = -0.5;
  for (const key in state.gridBlocks) {
    const [bx, by /*, bz*/] = key.split(",").map(Number);
    if (Math.floor(bx) === Math.floor(x)) {
      maxY = Math.max(maxY, by);
    }
  }
  state.placedAssets.forEach((asset) => {
    const pos = asset.model.position;
    if (Math.floor(pos.x - 0.5) === Math.floor(x)) {
      maxY = Math.max(maxY, pos.y - 0.25);
    }
  });
  return maxY;
}

export function updateDebugInfo() {
  const content = document.getElementById("debug-content");
  if (!content) return;
  content.innerHTML = `Mouse Position (screen): ${state.debugInfo.mousePosition.x}, ${state.debugInfo.mousePosition.y}
Normalized Mouse: ${state.debugInfo.normalizedMouse.x.toFixed(3)}, ${state.debugInfo.normalizedMouse.y.toFixed(3)}
Camera Position: ${JSON.stringify(state.debugInfo.cameraPosition)}
Raycast Hit: ${state.debugInfo.raycastHit ? "Yes" : "No"}
${
  state.debugInfo.raycastHit
    ? `Hit Position: ${JSON.stringify(state.debugInfo.raycastHit)}`
    : ""
}
Grid Position: ${JSON.stringify(state.debugInfo.gridPosition)}
Last Action: ${state.debugInfo.lastAction || "None"}
Active Blocks: ${Object.keys(state.gridBlocks).length}
Active Assets: ${state.placedAssets.length}
Block Positions: ${JSON.stringify(Object.keys(state.gridBlocks), null, 2)}`;
}

export function getArrowIcon(angle) {
  return `<span class="arrow-icon" style="transform: rotate(${angle}deg);">&#9650;</span>`;
}