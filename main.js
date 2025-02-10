import { state } from "./globals.js";
import { initScene, animate, onWindowResize } from "./modules/sceneManager.js";
import { initEventHandlers } from "./modules/eventHandlers.js";
import { initNetwork } from "./modules/networkManager.js";

window.addEventListener('DOMContentLoaded', () => {
  initScene();
  initEventHandlers();
  initNetwork();
  window.addEventListener('resize', onWindowResize);
  animate(); // start the render loop
});