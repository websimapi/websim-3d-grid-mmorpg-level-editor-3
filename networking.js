room.onmessage = (event) => {
  const data = event.data;
  switch (data.type) {
    case 'connected':
      console.log(`Client ${data.clientId} connected`);
      break;
    case 'disconnected':
      console.log(`Client ${data.clientId} disconnected`);
      break;
    case 'gridUpdate':
      // Handle grid updates from other clients
      if (data.clientId !== room.party.client.id) {
        if (data.action === 'place') {
          if (data.assetData) {
            loader.load(data.assetData.url, gltf => {
              const model = gltf.scene;
              model.position.set(data.position.x + 0.5, data.position.y + 0.5, data.position.z + 0.5);
              scene.add(model);
              const assetId = assetIdCounter++;
              const asset = {
                id: assetId,
                model: model,
                position: model.position.clone(),
                url: data.assetData.url,
                name: data.assetData.name
              };
              placedAssets.push(asset);
              addPlacedAssetToList(asset);
            });
          } else {
            const block = addBlock(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
            if (data.color) {
              block.material.color.set('#' + data.color);
            }
            const key = `${data.position.x},${data.position.y},${data.position.z}`;
            gridBlocks[key] = block;
            updateBlocksList();
          }
        } else if (data.action === 'remove') {
          const key = `${data.position.x},${data.position.y},${data.position.z}`;
          removeBlock(key);
        }
      }
      break;
    case 'levelUpdate':
      if (data.clientId !== room.party.client.id) {
        Object.keys(gridBlocks).forEach(key => removeBlock(key));
        gridBlocks = {};
        placedAssets.forEach(asset => scene.remove(asset.model));
        placedAssets = [];
        data.data.blocks.forEach(block => {
          const newBlock = addBlock(new THREE.Vector3(block.x, block.y, block.z));
          if (block.color) {
            newBlock.material.color.set('#' + block.color);
          }
          const key = `${block.x},${block.y},${block.z}`;
          gridBlocks[key] = newBlock;
        });
        data.data.assets.forEach(assetData => {
          loader.load(assetData.url, gltf => {
            const model = gltf.scene;
            model.position.set(assetData.position.x, assetData.position.y, assetData.position.z);
            model.rotation.set(assetData.rotation.x, assetData.rotation.y, assetData.rotation.z);
            model.scale.set(assetData.scale.x, assetData.scale.y, assetData.scale.z);
            scene.add(model);
            const asset = {
              id: assetData.id,
              model: model,
              position: model.position.clone(),
              url: assetData.url,
              name: assetData.name
            };
            placedAssets.push(asset);
            addPlacedAssetToList(asset);
          });
        });
        updateBlocksList();
      }
      break;
  }
};

function updateOnlineUsers() {
  const usersList = document.getElementById('online-users');
  usersList.innerHTML = '';
  for (const clientId in room.party.peers) {
    const { username, avatarUrl } = room.party.peers[clientId];
    const userEl = document.createElement('div');
    userEl.className = 'user-item';
    userEl.innerHTML = `
      <img src="${avatarUrl}" alt="${username}" width="24" height="24">
      <span>${username}</span>
      ${clientId === room.party.client.id ? ' (You)' : ''}
    `;
    usersList.appendChild(userEl);
  }
}