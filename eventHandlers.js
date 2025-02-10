function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  debugInfo.mousePosition = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  debugInfo.normalizedMouse = {
    x: mouse.x,
    y: mouse.y,
  };
  debugInfo.cameraPosition = {
    x: camera.position.x.toFixed(2),
    y: camera.position.y.toFixed(2),
    z: camera.position.z.toFixed(2),
  };
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(
    [groundPlane, ...Object.values(gridBlocks)],
    true
  );
  if (intersects.length > 0) {
    const intersect = intersects[0];
    debugInfo.raycastHit = {
      point: {
        x: intersect.point.x.toFixed(2),
        y: intersect.point.y.toFixed(2),
        z: intersect.point.z.toFixed(2),
      },
    };
    const gridPos = getGridPosition(intersect.point);
    debugInfo.gridPosition = gridPos;
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById('color-dropper').classList.contains('active')) {
      if (modelPreview) modelPreview.visible = false;
      const key = `${gridPos.x},${getHighestBlockAt(
        gridPos.x,
        gridPos.z
      )},${gridPos.z}`;
      if (gridBlocks[key]) {
        placementPreview.visible = true;
        placementPreview.material.color.set(0x00ff00);
        placementPreview.position.set(
          gridPos.x + 0.5,
          getHighestBlockAt(gridPos.x, gridPos.z) + 0.25,
          gridPos.z + 0.5
        );
      } else {
        placementPreview.visible = false;
      }
    } else if (document.getElementById('place-block').classList.contains('active')) {
      if (selectedModel) {
        if (!modelPreview) {
          modelPreview = selectedModel.clone();
          modelPreview.traverse((child) => {
            if (child.material) {
              child.material = child.material.clone();
              child.material.transparent = true;
              child.material.opacity = 0.5;
            }
          });
          modelPreview.rotation.copy(selectedModel.rotation);
          scene.add(modelPreview);
        }
        const yOffset = selectedModel.userData.yOffset || 0;
        modelPreview.position.set(
          Math.floor(gridPos.x) + 0.5,
          highestY + 0.5 - yOffset,
          Math.floor(gridPos.z) + 0.5
        );
        modelPreview.visible = true;
        placementPreview.visible = false;
      } else {
        if (modelPreview) modelPreview.visible = false;
        placementPreview.visible = true;
        placementPreview.material.color.set(0x00ff00);
        placementPreview.position.set(
          gridPos.x + 0.5,
          highestY + 0.75,
          gridPos.z + 0.5
        );
      }
    } else if (document.getElementById('remove-block').classList.contains('active')) {
      if (modelPreview) modelPreview.visible = false;
      const key = `${gridPos.x},${highestY},${gridPos.z}`;
      if (gridBlocks[key]) {
        placementPreview.visible = true;
        placementPreview.material.color.set(0xff0000);
        placementPreview.position.set(
          gridPos.x + 0.5,
          highestY + 0.25,
          gridPos.z + 0.5
        );
      } else {
        placementPreview.visible = false;
      }
    } else {
      if (placementPreview) placementPreview.visible = false;
      if (modelPreview) modelPreview.visible = false;
    }
  } else {
    debugInfo.raycastHit = null;
    debugInfo.gridPosition = null;
    if (placementPreview) placementPreview.visible = false;
    if (modelPreview) modelPreview.visible = false;
  }
  updateDebugInfo();
}

function onMouseClick(event) {
  if (document.getElementById('color-dropper').classList.contains('active')) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(gridBlocks), true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      for (const key in gridBlocks) {
        if (gridBlocks[key] === intersect.object) {
          selectColor(gridBlocks[key]);
          break;
        }
      }
    }
    return;
  }
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(
    [...Object.values(gridBlocks), ...placedAssets.map((a) => a.model)],
    true
  );
  let clickedBlock = null;
  let clickedAsset = null;
  if (intersects.length > 0) {
    const intersect = intersects[0];
    for (const key in gridBlocks) {
      if (gridBlocks[key] === intersect.object) {
        clickedBlock = gridBlocks[key];
        break;
      }
    }
    if (!clickedBlock) {
      const assetModel = intersect.object;
      const asset = placedAssets.find(
        (a) => a.model === assetModel || a.model.children.includes(assetModel)
      );
      if (asset) {
        clickedAsset = asset;
      }
    }
  }
  if (document.getElementById('select-tool').classList.contains('active')) {
    if (clickedBlock) {
      selectBlock(clickedBlock);
    } else if (clickedAsset) {
      if (selectedBlock) {
        selectBlock(null);
      }
      selectPlacedAsset(clickedAsset.id);
    } else {
      selectBlock(null);
      if (selectedPlacedAsset) {
        deselectPlacedAsset();
      }
    }
    return;
  }
  if (clickedBlock) {
    selectBlock(null);
  } else if (clickedAsset) {
    if (selectedBlock) {
      selectBlock(null);
    }
    selectPlacedAsset(clickedAsset.id);
  } else {
    selectBlock(null);
    if (selectedPlacedAsset) {
      deselectPlacedAsset();
    }
  }
  raycaster.setFromCamera(mouse, camera);
  const groundIntersects = raycaster.intersectObjects(
    [groundPlane, ...Object.values(gridBlocks)],
    true
  );
  if (groundIntersects.length > 0) {
    const intersect = groundIntersects[0];
    const gridPos = getGridPosition(intersect.point);
    const highestY = getHighestBlockAt(gridPos.x, gridPos.z);
    if (document.getElementById('place-block').classList.contains('active')) {
      if (selectedModel) {
        const clone = selectedModel.clone();
        clone.rotation.copy(selectedModel.rotation);
        const yOffset = selectedModel.userData.yOffset || 0;
        clone.position.set(
          Math.floor(gridPos.x) + 0.5,
          highestY + 0.5 - yOffset,
          Math.floor(gridPos.z) + 0.5
        );
        scene.add(clone);
        const assetId = assetIdCounter++;
        const assetData = {
          id: assetId,
          model: clone,
          position: clone.position.clone(),
          url: selectedModel.userData.url,
          name: selectedModel.userData.name,
        };
        placedAssets.push(assetData);
        addPlacedAssetToList(assetData);
        debugInfo.lastAction = `Placed model at ${clone.position.toArray()}`;
        addActionToHistory(debugInfo.lastAction, {
          type: 'placeAsset',
          assetData: {
            id: assetData.id,
            url: assetData.url,
            name: assetData.name,
            position: {
              x: clone.position.x,
              y: clone.position.y,
              z: clone.position.z,
            },
            rotation: {
              x: clone.rotation.x,
              y: clone.rotation.y,
              z: clone.rotation.z,
            },
            scale: {
              x: clone.scale.x,
              y: clone.scale.y,
              z: clone.scale.z,
            },
          },
        });
      } else {
        const key = `${gridPos.x},${highestY + 0.5},${gridPos.z}`;
        if (!gridBlocks[key]) {
          const blockType = document.getElementById('block-type').value;
          const block = addBlock(
            new THREE.Vector3(gridPos.x, highestY + 0.5, gridPos.z),
            blockType
          );
          gridBlocks[key] = block;
          updateBlocksList();
          debugInfo.lastAction = `Placed ${blockType} block at ${key}`;
          addActionToHistory(debugInfo.lastAction, {
            type: 'placeBlock',
            key: key,
            position: {
              x: gridPos.x,
              y: highestY + 0.5,
              z: gridPos.z,
            },
            blockType,
          });
        }
      }
    } else if (document.getElementById('remove-block').classList.contains('active')) {
      const topBlockKey = `${gridPos.x},${highestY},${gridPos.z}`;
      if (gridBlocks[topBlockKey]) {
        const block = gridBlocks[topBlockKey];
        removeBlock(topBlockKey);
        debugInfo.lastAction = `Removed block at ${topBlockKey}`;
        addActionToHistory(debugInfo.lastAction, {
          type: 'removeBlock',
          key: topBlockKey,
          position: {
            x: gridPos.x,
            y: highestY,
            z: gridPos.z,
          },
        });
      }
    }
    updateDebugInfo();
    room.send({
      type: 'gridUpdate',
      action: document
        .getElementById('place-block')
        .classList.contains('active')
        ? 'place'
        : 'remove',
      position: gridPos,
      color: selectedBlock ? selectedBlock.material.color.getHexString() : null,
      assetData: selectedModel
        ? {
            url: selectedModel.userData.url,
            name: selectedModel.userData.name,
          }
        : null,
    });
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}