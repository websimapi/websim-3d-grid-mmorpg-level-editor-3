function addBlock(position, blockType = document.getElementById('block-type').value) {
  let geometry;
  const orientation = document.getElementById('block-orientation').value;
  let rotation = 0;
  switch (orientation) {
    case 'north':
      rotation = 0;
      break;
    case 'east':
      rotation = Math.PI / 2;
      break;
    case 'south':
      rotation = Math.PI;
      break;
    case 'west':
      rotation = -Math.PI / 2;
      break;
  }
  switch (blockType) {
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
  const material = new THREE.MeshPhongMaterial({
    color: document.getElementById('block-color').value,
  });
  const block = new THREE.Mesh(geometry, material);
  block.userData.initialColor = material.color.getHexString();
  block.userData.blockType = blockType;
  block.userData.orientation = orientation;
  const adjustedX = position.x + 0.5;
  const adjustedY =
    position.y +
    (blockType === 'full'
      ? 0.5
      : blockType === 'half'
      ? 0.25
      : blockType === 'stair'
      ? 0.0
      : 0.25);
  const adjustedZ = position.z + 0.5;
  block.position.set(adjustedX, adjustedY, adjustedZ);
  block.rotation.y = rotation;
  block.userData.key = `${position.x},${position.y},${position.z}`;
  scene.add(block);
  if (!selectedBlock) {
    selectedBlock = block;
    document.getElementById('block-color').value =
      '#' + block.material.color.getHexString();
    updateBlocksList();
  }
  return block;
}

function removeBlock(key) {
  scene.children.forEach((child) => {
    if (child.userData.key === key) {
      if (child.userData.outline) {
        scene.remove(child.userData.outline);
      }
      scene.remove(child);
      delete gridBlocks[key];
      if (selectedBlock && selectedBlock.userData.key === key) {
        selectBlock(null);
      }
    }
  });
  updateBlocksList();
}

function getGridPosition(point) {
  return {
    x: Math.floor(point.x),
    z: Math.floor(point.z)
  };
}

function getHighestBlockAt(x, z) {
  let maxY = -0.5;
  for (let key in gridBlocks) {
    const [bx, by, bz] = key.split(',').map(Number);
    if (Math.floor(bx) === Math.floor(x) && Math.floor(bz) === Math.floor(z)) {
      maxY = Math.max(maxY, by);
    }
  }
  placedAssets.forEach(asset => {
    const pos = asset.model.position;
    if (Math.floor(pos.x - 0.5) === Math.floor(x) && Math.floor(pos.z - 0.5) === Math.floor(z)) {
      maxY = Math.max(maxY, pos.y - 0.25);
    }
  });
  return maxY;
}

function getPlacedAssetById(assetId) {
  return placedAssets.find(asset => asset.id === assetId);
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

function deletePlacedAsset(assetId, recordAction = true) {
  const asset = getPlacedAssetById(assetId);
  if (asset) {
    if (asset.helper) {
      scene.remove(asset.helper);
    }
    scene.remove(asset.model);
    asset.assetItem.parentNode.removeChild(asset.assetItem);
    const index = placedAssets.findIndex(a => a.id === assetId);
    if (index !== -1) {
      placedAssets.splice(index, 1);
    }
    if (selectedPlacedAsset && selectedPlacedAsset.id === assetId) {
      deselectPlacedAsset();
    }
    debugInfo.lastAction = `Deleted asset ${assetId}`;
    if (recordAction) {
      addActionToHistory(debugInfo.lastAction, {
        type: 'deleteAsset',
        assetData: {
          id: asset.id,
          url: asset.url,
          name: asset.name,
          position: {
            x: asset.model.position.x,
            y: asset.model.position.y,
            z: asset.model.position.z
          },
          rotation: {
            x: asset.model.rotation.x,
            y: asset.model.rotation.y,
            z: asset.model.rotation.z
          },
          scale: {
            x: asset.model.scale.x,
            y: asset.model.scale.y,
            z: asset.model.scale.z
          }
        }
      });
    }
    updateDebugInfo();
  }
}