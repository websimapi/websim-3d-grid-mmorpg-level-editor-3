function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('grid-container').appendChild(renderer.domElement);

  camera.position.set(0, 32, 32);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const groundGeometry = new THREE.PlaneGeometry(32, 32);
  const groundMaterial = new THREE.MeshBasicMaterial({
    visible: false,
    side: THREE.DoubleSide,
  });
  groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.set(0, 0, 0);
  scene.add(groundPlane);

  const gridHelper = new THREE.GridHelper(32, 32);
  gridHelper.position.set(0, 0, 0);
  scene.add(gridHelper);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);

  const previewGeometry = new THREE.BoxGeometry(1, 0.5, 1);
  const previewMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.5,
    wireframe: true,
  });
  placementPreview = new THREE.Mesh(previewGeometry, previewMaterial);
  placementPreview.visible = false;
  scene.add(placementPreview);

  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onMouseClick);
  window.addEventListener('resize', onWindowResize);

  document.getElementById('block-color').addEventListener('change', (e) => {
    if (selectedBlock) {
      selectedBlock.material.color.set(e.target.value);
    }
  });

  document.querySelectorAll('.section-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.classList.contains('section-toggle')) {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.section-toggle');
        content.classList.toggle('expanded');
        toggle.classList.toggle('expanded');
        e.stopPropagation();
      }
    });
  });

  initDraggableSections();

  room.party.subscribe((newPeers) => {
    peers = newPeers;
  });

  room.party.subscribe(() => {
    updateOnlineUsers();
  });
  updateOnlineUsers();

  document.getElementById('load-texture').addEventListener('click', () => {
    document.getElementById('texture-input').click();
  });
  document.getElementById('texture-input').addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
      uploadTexture(event.target.files[0]);
      event.target.value = '';
    }
  });
  document.getElementById('model-input').addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
      uploadModel(event.target.files[0]);
      event.target.value = '';
    }
  });
}