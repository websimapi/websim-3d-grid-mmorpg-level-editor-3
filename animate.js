function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (selectedPlacedAsset && selectedPlacedAsset.helper) {
    selectedPlacedAsset.helper.update();
  }
  renderer.render(scene, camera);
}