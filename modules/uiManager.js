import { state } from "../globals.js";

export function updateDebugInfo() {
  const content = document.getElementById('debug-content');
  content.innerHTML = `Mouse Position (screen): ${state.debugInfo.mousePosition.x}, ${state.debugInfo.mousePosition.y}
Normalized Mouse: ${state.debugInfo.normalizedMouse.x.toFixed(3)}, ${state.debugInfo.normalizedMouse.y.toFixed(3)}
Camera Position: ${JSON.stringify(state.debugInfo.cameraPosition)}
Raycast Hit: ${state.debugInfo.raycastHit ? 'Yes' : 'No'}
${state.debugInfo.raycastHit ? `Hit Position: ${JSON.stringify(state.debugInfo.raycastHit)}` : ''}
Grid Position: ${JSON.stringify(state.debugInfo.gridPosition)}
Last Action: ${state.debugInfo.lastAction || 'None'}
Active Blocks: ${Object.keys(state.gridBlocks).length}
Active Assets: ${state.placedAssets.length}
Block Positions: ${JSON.stringify(Object.keys(state.gridBlocks), null, 2)}`;
}