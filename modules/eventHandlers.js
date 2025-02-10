import { state } from "../globals.js";
import { getGridPosition, getHighestBlockAt } from "./sceneManager.js";
import { selectBlock, removeBlock } from "./blockManager.js";
import { updateDebugInfo } from "./uiManager.js";

export function onMouseMove(event) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.debugInfo.mousePosition = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  state.mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.debugInfo.normalizedMouse = { x: state.mouse.x, y: state.mouse.y };
  state.debugInfo.cameraPosition = {
    x: state.camera.position.x.toFixed(2),
    y: state.camera.position.y.toFixed(2),
    z: state.camera.position.z.toFixed(2)
  };
  state.raycaster.setFromCamera(state.mouse, state.camera);
  const intersects = state.raycaster.intersectObjects([state.groundPlane, ...Object.values(state.gridBlocks)], true);
  if (intersects.length > 0) {
    const intersect = intersects[0];
    state.debugInfo.raycastHit = {
      point: {
        x: intersect.point.x.toFixed(2),
        y: intersect.point.y.toFixed(2),
        z: intersect.point.z.toFixed(2)
      }
    };
    const gridPos = getGridPosition(intersect.point);
    state.debugInfo.gridPosition = gridPos;
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById('color-dropper').classList.contains('active')) {
      if (state.modelPreview) state.modelPreview.visible = false;
      const key = `${gridPos.x},${getHighestBlockAt(gridPos.x, gridPos.z)},${gridPos.z}`;
      if (state.gridBlocks[key]) {
        state.placementPreview.visible = true;
        state.placementPreview.material.color.set(0x00ff00);
        state.placementPreview.position.set(gridPos.x + 0.5, highestY + 0.25, gridPos.z + 0.5);
      } else {
        state.placementPreview.visible = false;
      }
    } else if (document.getElementById('place-block').classList.contains('active')) {
      if (state.selectedModel) {
        if (!state.modelPreview) {
          state.modelPreview = state.selectedModel.clone();
          state.modelPreview.traverse(child => {
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
    } else if (document.getElementById('remove-block').classList.contains('active')) {
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
  if (document.getElementById('color-dropper').classList.contains('active')) {
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const intersects = state.raycaster.intersectObjects(Object.values(state.gridBlocks), true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      for (const key in state.gridBlocks) {
        if (state.gridBlocks[key] === intersect.object) {
          import("../modules/blockManager.js").then(module => {
            module.selectColor(state.gridBlocks[key]);
          });
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
      clickedAsset = state.placedAssets.find(a => a.model === assetModel || a.model.children.includes(assetModel));
    }
  }
  if (document.getElementById('select-tool').classList.contains('active')) {
    if (clickedBlock) {
      selectBlock(clickedBlock);
    } else if (clickedAsset) {
      if (state.selectedBlock) {
        selectBlock(null);
      }
      import("../modules/assetManager.js").then(module => {
        module.selectPlacedAsset(clickedAsset.id);
      });
    } else {
      selectBlock(null);
      import("../modules/assetManager.js").then(module => {
        module.deselectPlacedAsset();
      });
    }
    return;
  }
  if (clickedBlock) {
    selectBlock(null);
  } else if (clickedAsset) {
    if (state.selectedBlock) {
      selectBlock(null);
    }
    import("../modules/assetManager.js").then(module => {
      module.selectPlacedAsset(clickedAsset.id);
    });
  } else {
    selectBlock(null);
    import("../modules/assetManager.js").then(module => {
      module.deselectPlacedAsset();
    });
  }
  state.raycaster.setFromCamera(state.mouse, state.camera);
  const groundIntersects = state.raycaster.intersectObjects([state.groundPlane, ...Object.values(state.gridBlocks)], true);
  if (groundIntersects.length > 0) {
    const intersect = groundIntersects[0];
    const gridPos = getGridPosition(intersect.point);
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById('place-block').classList.contains('active')) {
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
        import("../modules/assetManager.js").then(module => {
          module.addPlacedAssetToList(assetData);
        });
      } else {
        const key = `${gridPos.x},${highestY + 0.5},${gridPos.z}`;
        if (!state.gridBlocks[key]) {
          import("../modules/blockManager.js").then(module => {
            const blockType = document.getElementById('block-type').value;
            const block = module.addBlock(new THREE.Vector3(gridPos.x, highestY + 0.5, gridPos.z), blockType);
            state.gridBlocks[key] = block;
            module.updateBlocksList();
          });
        }
      }
    } else if (document.getElementById('remove-block').classList.contains('active')) {
      const topBlockKey = `${gridPos.x},${highestY},${gridPos.z}`;
      if (state.gridBlocks[topBlockKey]) {
        import("../modules/blockManager.js").then(module => {
          module.removeBlock(topBlockKey);
        });
      }
    }
  }
}

export function initEventHandlers() {
  state.renderer.domElement.addEventListener('mousemove', onMouseMove);
  state.renderer.domElement.addEventListener('click', onMouseClick);
  window.addEventListener('keydown', event => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedPlacedAsset) {
      import("../modules/assetManager.js").then(module => {
        module.deletePlacedAsset(state.selectedPlacedAsset.id, true);
      });
    }
    if (event.key === '`') {
      const debugConsole = document.getElementById('debug-console');
      debugConsole.classList.toggle('visible');
    }
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z') {
        if (event.shiftKey) {
          import("../modules/actionManager.js").then(module => {
            module.redoLastAction();
          });
        } else {
          import("../modules/actionManager.js").then(module => {
            module.undoLastAction();
          });
        }
        event.preventDefault();
      }
    }
  });
  
  document.getElementById('toggle-menu').addEventListener('click', () => {
    const toolbar = document.getElementById('toolbar');
    const toggleButton = document.getElementById('toggle-menu');
    const arrow = toggleButton.querySelector('.menu-arrow');
    toolbar.classList.toggle('hidden');
    toggleButton.classList.toggle('menu-hidden');
    arrow.classList.toggle('collapsed');
  });
  
  document.addEventListener('mouseleave', () => {
    const draggingSection = document.querySelector('.toolbar-section.dragging');
    if (draggingSection) {
      draggingSection.classList.remove('dragging');
      draggingSection.style.transform = '';
      draggingSection.style.position = '';
      draggingSection.style.width = '';
      draggingSection.style.left = '';
      draggingSection.style.top = '';
    }
    const placeholder = document.querySelector('.section-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
    document.querySelectorAll('.drop-target').forEach(s => s.classList.remove('drop-target'));
    document.body.style.cursor = '';
  });
  document.getElementById('block-color').addEventListener('input', e => {
    if (state.selectedBlock) {
      if (state.initialBlockColor === null) {
        state.initialBlockColor = state.selectedBlock.material.color.getHexString();
      }
      state.selectedBlock.material.color.set(e.target.value);
    }
  });
  
  document.getElementById('block-color').addEventListener('change', e => {
    if (state.selectedBlock && state.initialBlockColor !== null) {
      state.debugInfo.lastAction = `Changed block color at ${state.selectedBlock.userData.key}`;
      import("../modules/actionManager.js").then(module => {
        module.addActionToHistory(state.debugInfo.lastAction, {
          type: 'changeBlockColor',
          block: state.selectedBlock,
          key: state.selectedBlock.userData.key,
          previousColor: state.initialBlockColor,
          newColor: e.target.value.substring(1)
        });
      });
      state.initialBlockColor = null;
    }
  });
  
  document.getElementById('block-orientation').addEventListener('change', e => {
    if (state.selectedBlock) {
      const newOrientation = e.target.value;
      const previousOrientation = state.selectedBlock.userData.orientation;
      state.selectedBlock.userData.orientation = newOrientation;
      let rotation = 0;
      switch (newOrientation) {
        case 'east':
          rotation = Math.PI / 2;
          break;
        case 'south':
          rotation = Math.PI;
          break;
        case 'west':
          rotation = -Math.PI / 2;
          break;
        default:
          rotation = 0;
      }
      state.selectedBlock.rotation.y = rotation;
      state.debugInfo.lastAction = `Changed block orientation at ${state.selectedBlock.userData.key}`;
      import("../modules/actionManager.js").then(module => {
        module.addActionToHistory(state.debugInfo.lastAction, {
          type: 'changeBlockOrientation',
          block: state.selectedBlock,
          key: state.selectedBlock.userData.key,
          previousOrientation: previousOrientation,
          newOrientation: newOrientation
        });
      });
      import("../modules/blockManager.js").then(module => {
        module.updateBlocksList();
      });
    }
  });
  
  document.getElementById('model-input').addEventListener('change', event => {
    if (event.target.files.length > 0) {
      import("../modules/assetManager.js").then(module => {
        module.uploadModel(event.target.files[0]);
      });
      event.target.value = '';
    }
  });
  
  document.getElementById('import-input').addEventListener('change', event => {
    // Import level handling (omitted for brevity)
  });
  
  document.getElementById('load-texture').addEventListener('click', () => {
    document.getElementById('texture-input').click();
  });
  
  document.getElementById('texture-input').addEventListener('change', event => {
    if (event.target.files.length > 0) {
      import("../modules/assetManager.js").then(module => {
        module.uploadTexture(event.target.files[0]);
      });
      event.target.value = '';
    }
  });
  
  document.getElementById('load-model').addEventListener('click', () => {
    document.getElementById('model-input').click();
  });
  
  document.getElementById('undo-action').addEventListener('click', () => {
    import("../modules/actionManager.js").then(module => {
      module.undoLastAction();
    });
  });
  document.getElementById('redo-action').addEventListener('click', () => {
    import("../modules/actionManager.js").then(module => {
      module.redoLastAction();
    });
  });
  
  initDraggableSections();
}

function initDraggableSections() {
  document.querySelectorAll('.toolbar-section').forEach(section => {
    if (section && section.parentNode) {
      section.replaceWith(...section.childNodes);
    }
  });
  document.querySelectorAll('.section-header').forEach(header => {
    const content = header.nextElementSibling;
    if (!content || !header.parentNode) return;
    const section = document.createElement('div');
    section.className = 'toolbar-section';
    if (!header.parentNode.classList.contains('toolbar-section')) {
      header.parentNode.insertBefore(section, header);
      section.appendChild(header);
      section.appendChild(content);
    }
    let isDragging = false;
    let startY = 0;
    let initialRect = null;
    let placeholder = null;
    header.addEventListener('mousedown', e => {
      if (e.target.classList.contains('section-toggle')) return;
      e.preventDefault();
      isDragging = true;
      startY = e.clientY;
      initialRect = section.getBoundingClientRect();
      section.classList.add('dragging');
      section.style.width = `${initialRect.width}px`;
      section.style.left = `${initialRect.left}px`;
      section.style.top = `${initialRect.top}px`;
      placeholder = document.createElement('div');
      placeholder.style.height = `${initialRect.height}px`;
      placeholder.style.margin = '5px 0';
      placeholder.style.background = 'rgba(100,100,100,0.2)';
      placeholder.style.borderRadius = '4px';
      if (section.parentNode) {
        section.parentNode.insertBefore(placeholder, section);
      }
      document.body.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', e => {
      if (!isDragging || !section.parentNode) return;
      const deltaY = e.clientY - startY;
      section.style.transform = `translateY(${deltaY}px)`;
      const draggingRect = section.getBoundingClientRect();
      const draggingCenter = draggingRect.top + draggingRect.height / 2;
      document.querySelectorAll('.drop-target').forEach(s => s.classList.remove('drop-target'));
      const otherSections = Array.from(document.querySelectorAll('.toolbar-section')).filter(s => s !== section);
      let dropTarget = null;
      for (const otherSection of otherSections) {
        const rect = otherSection.getBoundingClientRect();
        if (draggingCenter > rect.top && draggingCenter < rect.bottom) {
          dropTarget = otherSection;
          break;
        }
      }
      if (dropTarget && placeholder && placeholder.parentNode) {
        dropTarget.classList.add('drop-target');
        const rect = dropTarget.getBoundingClientRect();
        if (draggingCenter < rect.top + rect.height / 2) {
          dropTarget.parentNode.insertBefore(placeholder, dropTarget);
        } else {
          dropTarget.parentNode.insertBefore(placeholder, dropTarget.nextSibling);
        }
      }
    });
    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      section.classList.remove('dragging');
      section.style.transform = '';
      section.style.position = '';
      section.style.width = '';
      section.style.left = '';
      section.style.top = '';
      if (placeholder && placeholder.parentNode && section.parentNode) {
        placeholder.parentNode.insertBefore(section, placeholder);
        placeholder.remove();
      }
      document.querySelectorAll('.drop-target').forEach(s => s.classList.remove('drop-target'));
      document.body.style.cursor = '';
    });
  });
}