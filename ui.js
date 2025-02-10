function updateDebugInfo() {
  const content = document.getElementById('debug-content');
  content.innerHTML = `Mouse Position (screen): ${debugInfo.mousePosition.x}, ${debugInfo.mousePosition.y}
Normalized Mouse: ${debugInfo.normalizedMouse.x.toFixed(3)}, ${debugInfo.normalizedMouse.y.toFixed(3)}
Camera Position: ${JSON.stringify(debugInfo.cameraPosition)}
Raycast Hit: ${debugInfo.raycastHit ? 'Yes' : 'No'}
${debugInfo.raycastHit ? `Hit Position: ${JSON.stringify(debugInfo.raycastHit)}` : ''}
Grid Position: ${JSON.stringify(debugInfo.gridPosition)}
Last Action: ${debugInfo.lastAction || 'None'}
Active Blocks: ${Object.keys(gridBlocks).length}
Active Assets: ${placedAssets.length}
Block Positions: ${JSON.stringify(Object.keys(gridBlocks), null, 2)}`;
}

function updateBlocksList() {
  if (selectedBlock) {
    initialBlockColor = null;
  }
  const blocksList = document.getElementById('placed-blocks-list');
  const scrollTop = blocksList.scrollTop;
  blocksList.innerHTML = '';
  Object.entries(gridBlocks).forEach(([key, block]) => {
    const blockItem = document.createElement('div');
    blockItem.className = 'block-item';
    if (selectedBlock && selectedBlock.userData.key === key) {
      blockItem.classList.add('selected-block');
    }
    const [x, y, z] = key.split(',').map(Number);
    blockItem.textContent = `${block.userData.blockType || 'half'} Block at (${x}, ${y}, ${z}) facing ${block.userData.orientation || 'north'}`;
    blockItem.addEventListener('click', () => {
      selectBlock(block);
    });
    blocksList.appendChild(blockItem);
  });
  blocksList.scrollTop = scrollTop;
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

function selectBlock(block) {
  if (selectedPlacedAsset) {
    deselectPlacedAsset();
  }
  if (selectedBlock === block) return;
  if (selectedBlock) {
    removeBlockOutline(selectedBlock);
  }
  selectedBlock = block;
  if (selectedBlock && document.getElementById('select-tool').classList.contains('active')) {
    document.getElementById('block-color').value = '#' + selectedBlock.material.color.getHexString();
    document.getElementById('block-orientation').value = selectedBlock.userData.orientation || 'north';
    addBlockOutline(selectedBlock);
  }
  updateBlocksList();
}

function addBlockOutline(block) {
  if (block.userData.outline) {
    removeBlockOutline(block);
  }
  let geometry;
  switch (block.userData.blockType) {
    case 'full':
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'stair':
      geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.5, 0.0, 0.5,  // 0
         0.5, 0.0, 0.5,  // 1
         0.5, 0.25, 0.5, // 2
        -0.5, 0.25, 0.5, // 3
        -0.5, 0.0, -0.5, // 4
         0.5, 0.0, -0.5, // 5
         0.5, 0.25, -0.5,// 6
        -0.5, 0.25, -0.5,// 7
        -0.5, 0.25, 0.5, // 8
         0.0, 0.25, 0.5, // 9
         0.0, 0.5, 0.5,  //10
        -0.5, 0.5, 0.5,  //11
        -0.5, 0.25, -0.5,//12
         0.0, 0.25, -0.5,//13
         0.0, 0.5, -0.5, //14
        -0.5, 0.5, -0.5  //15
      ]);
      const indices = new Uint16Array([
         0,  1,  2,  0,  2,  3,
         4,  5,  6,  4,  6,  7,
         0,  4,  7,  0,  7,  3,
         1,  5,  6,  1,  6,  2,
         3,  2,  6,  3,  6,  7,
         0,  1,  5,  0,  5,  4,
         8,  9, 10,  8, 10, 11,
        12, 13, 14, 12, 14, 15,
         8, 12, 15,  8, 15, 11,
         9, 13, 14,  9, 14, 10,
        11, 10, 14, 11, 14, 15,
         8,  9, 13,  8, 13, 12
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 0.5, 1);
  }
  const edges = new THREE.EdgesGeometry(geometry);
  const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
    color: 0x0088ff,
    linewidth: 2
  }));
  outline.position.copy(block.position);
  outline.rotation.copy(block.rotation);
  outline.scale.set(1.02, 1.02, 1.02);
  scene.add(outline);
  block.userData.outline = outline;
}

function removeBlockOutline(block) {
  if (block.userData.outline) {
    scene.remove(block.userData.outline);
    block.userData.outline = null;
  }
}

function deselectPlacedAsset() {
  if (selectedPlacedAsset) {
    if (selectedPlacedAsset.helper) {
      scene.remove(selectedPlacedAsset.helper);
      selectedPlacedAsset.helper = null;
    }
    hideRotationUI(selectedPlacedAsset);
    selectedPlacedAsset.assetItem.classList.remove('selected-asset');
    selectedPlacedAsset = null;
  }
}

function showRotationUI(asset) {
  const rotationUI = document.createElement('div');
  rotationUI.className = 'rotation-ui';
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  angles.forEach(angle => {
    const button = document.createElement('button');
    button.className = 'rotation-button';
    button.innerHTML = getArrowIcon(angle);
    button.addEventListener('click', event => {
      event.stopPropagation();
      rotatePlacedAssetToAngle(asset.id, angle);
    });
    rotationUI.appendChild(button);
  });
  const rotationControls = document.createElement('div');
  rotationControls.className = 'rotation-controls';
  const axes = ['X', 'Y', 'Z'];
  axes.forEach(axis => {
    const axisControl = document.createElement('div');
    axisControl.className = 'rotation-axis';
    const label = document.createElement('span');
    label.textContent = axis;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '360';
    slider.value = asset.model.rotation[axis.toLowerCase()] * 180 / Math.PI % 360;
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '0';
    numberInput.max = '360';
    numberInput.value = slider.value;
    numberInput.step = '1';
    slider.addEventListener('input', e => {
      numberInput.value = e.target.value;
      const radians = e.target.value * Math.PI / 180;
      asset.model.rotation[axis.toLowerCase()] = radians;
      if (asset.helper) {
        asset.helper.update();
      }
    });
    numberInput.addEventListener('input', e => {
      slider.value = e.target.value;
      const radians = e.target.value * Math.PI / 180;
      asset.model.rotation[axis.toLowerCase()] = radians;
      if (asset.helper) {
        asset.helper.update();
      }
    });
    const updateRotation = e => {
      const radians = e.target.value * Math.PI / 180;
      const axisLower = axis.toLowerCase();
      const previousRotation = asset.model.rotation[axisLower];
      debugInfo.lastAction = `Rotated asset ${asset.id} ${axis}-axis to ${e.target.value} degrees`;
      addActionToHistory(debugInfo.lastAction, {
        type: 'rotateAssetAxis',
        assetId: asset.id,
        axis: axisLower,
        previousRotation: previousRotation,
        newRotation: radians
      });
      updateDebugInfo();
    };
    slider.addEventListener('change', updateRotation);
    numberInput.addEventListener('change', updateRotation);
    axisControl.appendChild(label);
    axisControl.appendChild(slider);
    axisControl.appendChild(numberInput);
    rotationControls.appendChild(axisControl);
  });
  rotationUI.appendChild(rotationControls);
  asset.assetItem.appendChild(rotationUI);
  asset.rotationUI = rotationUI;
}

function hideRotationUI(asset) {
  if (asset.rotationUI) {
    asset.assetItem.removeChild(asset.rotationUI);
    asset.rotationUI = null;
  }
}

function getArrowIcon(angle) {
  return `<span class="arrow-icon" style="transform: rotate(${angle}deg);">&#9650;</span>`;
}

function rotatePlacedAssetToAngle(assetId, angle) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    const previousRotation = asset.model.rotation.y;
    asset.model.rotation.y = THREE.Math.degToRad(angle);
    if (asset.helper) {
      asset.helper.update();
    }
    debugInfo.lastAction = `Rotated asset ${assetId} to ${angle} degrees`;
    addActionToHistory(debugInfo.lastAction, {
      type: 'rotateAsset',
      assetId: assetId,
      previousRotation: previousRotation,
      newRotation: asset.model.rotation.y
    });
    updateDebugInfo();
  }
}