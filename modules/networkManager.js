import { state } from "../globals.js";
import { addPlacedAssetToList } from "./assetManager.js";
import { updateBlocksList } from "./blockManager.js";

export function initNetwork() {
  state.room.party.subscribe(newPeers => {
    state.peers = newPeers;
    updateOnlineUsers();
  });
  
  state.room.onmessage = event => {
    const data = event.data;
    switch (data.type) {
      case "connected":
        console.log(`Client ${data.clientId} connected`);
        break;
      case "disconnected":
        console.log(`Client ${data.clientId} disconnected`);
        break;
      case "gridUpdate":
        if (data.clientId !== state.room.party.client.id) {
          if (data.action === 'place') {
            if (data.assetData) {
              state.loader.load(data.assetData.url, gltf => {
                const model = gltf.scene;
                model.position.set(data.position.x + 0.5, data.position.y + 0.5, data.position.z + 0.5);
                state.scene.add(model);
                const assetId = state.assetIdCounter++;
                const asset = {
                  id: assetId,
                  model: model,
                  position: model.position.clone(),
                  url: data.assetData.url,
                  name: data.assetData.name
                };
                state.placedAssets.push(asset);
                addPlacedAssetToList(asset);
              });
            } else {
              const block = addBlock(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
              if (data.color) {
                block.material.color.set('#' + data.color);
              }
              const key = `${data.position.x},${data.position.y},${data.position.z}`;
              state.gridBlocks[key] = block;
              updateBlocksList();
            }
          } else if (data.action === 'remove') {
            const key = `${data.position.x},${data.position.y},${data.position.z}`;
            removeBlock(key);
          }
        }
        break;
      case "levelUpdate":
        if (data.clientId !== state.room.party.client.id) {
          Object.keys(state.gridBlocks).forEach(key => removeBlock(key));
          state.gridBlocks = {};
          state.placedAssets.forEach(asset => state.scene.remove(asset.model));
          state.placedAssets = [];
          data.data.blocks.forEach(block => {
            const newBlock = addBlock(new THREE.Vector3(block.x, block.y, block.z));
            if (block.color) {
              newBlock.material.color.set('#' + block.color);
            }
            const key = `${block.x},${block.y},${block.z}`;
            state.gridBlocks[key] = newBlock;
          });
          data.data.assets.forEach(assetData => {
            state.loader.load(assetData.url, gltf => {
              const model = gltf.scene;
              model.position.set(assetData.position.x, assetData.position.y, assetData.position.z);
              model.rotation.set(assetData.rotation.x, assetData.rotation.y, assetData.rotation.z);
              model.scale.set(assetData.scale.x, assetData.scale.y, assetData.scale.z);
              state.scene.add(model);
              const asset = {
                id: assetData.id,
                model: model,
                position: model.position.clone(),
                url: assetData.url,
                name: assetData.name
              };
              state.placedAssets.push(asset);
              addPlacedAssetToList(asset);
            });
          });
          updateBlocksList();
        }
        break;
      default:
        console.log("Received event:", data);
    }
  };
  
  function updateOnlineUsers() {
    const usersList = document.getElementById('online-users');
    usersList.innerHTML = '';
    for (const clientId in state.room.party.peers) {
      const { username, avatarUrl } = state.room.party.peers[clientId];
      const userEl = document.createElement('div');
      userEl.className = 'user-item';
      userEl.innerHTML = `
        <img src="${avatarUrl}" alt="${username}" width="24" height="24">
        <span>${username}</span>
        ${clientId === state.room.party.client.id ? ' (You)' : ''}
      `;
      usersList.appendChild(userEl);
    }
  }
}

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
    color: document.getElementById('block-color').value
  });
  const block = new THREE.Mesh(geometry, material);
  block.userData.initialColor = material.color.getHexString();
  block.userData.blockType = blockType;
  block.userData.orientation = orientation;
  const adjustedX = position.x + 0.5;
  const adjustedY = position.y + (blockType === 'full' ? 0.5 : blockType === 'half' ? 0.25 : blockType === 'stair' ? 0.0 : 0.25);
  const adjustedZ = position.z + 0.5;
  block.position.set(adjustedX, adjustedY, adjustedZ);
  block.rotation.y = rotation;
  block.userData.key = `${position.x},${position.y},${position.z}`;
  state.scene.add(block);
  return block;
}

function removeBlock(key) {
  state.scene.children.forEach(child => {
    if (child.userData.key === key) {
      state.scene.remove(child);
      delete state.gridBlocks[key];
    }
  });
  updateBlocksList();
}