import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cropAbove } from './slice.js';

const Y = new THREE.Vector3(0, 1, 0);
function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = true;
  item.receiveShadow = true;
  item.position.set(x, y, z);
  group.add(item);
  return item;
}
function rod(group, from, to, radius, material) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to);
  const item = mesh(
    group,
    new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 24),
    material,
  );
  item.position.copy(a).add(b).multiplyScalar(0.5);
  item.quaternion.setFromUnitVectors(Y, b.sub(a).normalize());
  return item;
}
function finishObject(group) {
  const materials = new Set();
  group.traverse((node) => {
    if (node.isMesh) materials.add(node.material);
  });
  group.userData.materials = [...materials];
  group.userData.weight = 0;
}
function makeCompass() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0xa7afb4,
    metalness: 0.94,
    roughness: 0.24,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xa98e60,
    metalness: 0.87,
    roughness: 0.32,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x25282a, metalness: 0.55, roughness: 0.5 });
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.y = 1.12;
    arm.rotation.z = side * 0.32;
    group.add(arm);
    arms.push(arm);
    mesh(arm, new THREE.BoxGeometry(0.17, 2.12, 0.17), steel, 0, -1.06);
    mesh(arm, new THREE.BoxGeometry(0.055, 1.45, 0.025), brass, 0, -0.95, 0.098);
    mesh(arm, new THREE.CylinderGeometry(0.135, 0.135, 0.32, 32), dark, 0, -2.1);
    for (let i = 0; i < 7; i++)
      mesh(
        arm,
        new THREE.TorusGeometry(0.136, 0.008, 4, 32),
        steel,
        0,
        -1.98 - i * 0.04,
      ).rotation.x = Math.PI / 2;
    mesh(
      arm,
      new THREE.CylinderGeometry(0.08, 0.012, 0.56, 24),
      side === 1 ? dark : steel,
      0,
      -2.52,
    );
  }
  const joint = mesh(group, new THREE.CylinderGeometry(0.25, 0.25, 0.24, 48), brass, 0, 1.12);
  joint.rotation.x = Math.PI / 2;
  const inset = mesh(
    group,
    new THREE.CylinderGeometry(0.145, 0.145, 0.015, 48),
    dark,
    0,
    1.12,
    0.131,
  );
  inset.rotation.x = Math.PI / 2;
  const screw = mesh(group, new THREE.CylinderGeometry(0.09, 0.09, 0.03, 32), steel, 0, 1.12, 0.15);
  screw.rotation.x = Math.PI / 2;
  mesh(group, new THREE.BoxGeometry(0.12, 0.017, 0.01), dark, 0, 1.12, 0.17).rotation.z = -0.5;
  rod(group, [0, 1.3, 0], [0, 1.67, 0], 0.085, steel);
  mesh(group, new THREE.CylinderGeometry(0.12, 0.12, 0.24, 32), dark, 0, 1.78);
  for (let i = 0; i < 8; i++)
    mesh(
      group,
      new THREE.TorusGeometry(0.121, 0.008, 4, 32),
      brass,
      0,
      1.68 + i * 0.027,
    ).rotation.x = Math.PI / 2;
  rod(group, [-0.61, -0.22, 0.02], [0.61, -0.22, 0.02], 0.035, steel);
  for (let i = 0; i < 37; i++)
    mesh(
      group,
      new THREE.TorusGeometry(0.043, 0.009, 4, 12),
      brass,
      -0.58 + i * 0.032,
      -0.22,
      0.02,
    ).rotation.y = Math.PI / 2;
  const wheel = mesh(
    group,
    new THREE.CylinderGeometry(0.17, 0.17, 0.11, 48),
    brass,
    0.12,
    -0.22,
    0.02,
  );
  wheel.rotation.z = Math.PI / 2;
  for (let i = 0; i < 32; i++) {
    const angle = (i * Math.PI) / 16;
    mesh(
      group,
      new THREE.BoxGeometry(0.12, 0.016, 0.016),
      dark,
      0.12,
      -0.22 + Math.cos(angle) * 0.17,
      0.02 + Math.sin(angle) * 0.17,
    ).rotation.x = angle;
  }
  group.userData.arms = arms;
  finishObject(group);
  return group;
}
function makeArchitecture() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({
    color: 0x83877d,
    roughness: 0.9,
    metalness: 0.02,
    envMapIntensity: 0.22,
  });
  const cut = new THREE.MeshStandardMaterial({
    color: 0x777b78,
    roughness: 0.77,
    metalness: 0.05,
    envMapIntensity: 0.3,
  });
  mesh(group, new THREE.BoxGeometry(3.12, 0.16, 1.12), cut, 0, -1.64);
  mesh(group, new THREE.BoxGeometry(2.98, 0.12, 1.02), stone, 0, -1.5);
  for (const x of [-1.12, 1.12]) {
    mesh(group, new THREE.BoxGeometry(0.72, 0.14, 0.78), stone, x, -1.38);
    mesh(group, new THREE.CylinderGeometry(0.34, 0.37, 0.12, 64), stone, x, -1.25);
    const shaft = new THREE.CylinderGeometry(0.255, 0.31, 1.6, 192, 20);
    const positions = shaft.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i),
        pz = positions.getZ(i),
        radius = Math.hypot(px, pz);
      if (radius < 0.01) continue;
      const flute = 0.017 * Math.pow(0.5 + 0.5 * Math.cos(Math.atan2(pz, px) * 20), 1.6);
      positions.setX(i, px * (1 - flute / radius));
      positions.setZ(i, pz * (1 - flute / radius));
    }
    shaft.computeVertexNormals();
    mesh(group, shaft, stone, x, -0.4);
    mesh(group, new THREE.CylinderGeometry(0.35, 0.265, 0.16, 64), stone, x, 0.48);
    mesh(group, new THREE.BoxGeometry(0.76, 0.12, 0.82), stone, x, 0.62);
  }
  const blocks = [];
  for (let i = 0; i < 11; i++) {
    const start = (i / 11) * Math.PI + 0.006,
      end = ((i + 1) / 11) * Math.PI - 0.006;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.47, start, end, false);
    shape.lineTo(Math.cos(end) * 0.8, Math.sin(end) * 0.8);
    shape.absarc(0, 0, 0.8, end, start, true);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.62,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 12,
    });
    geometry.translate(0, 0.68, -0.31);
    blocks.push(mesh(group, geometry, stone));
  }
  group.userData.keystone = blocks[5];
  finishObject(group);
  return group;
}
export function createServiceSculpture(canvas, reduced) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x0d0f12, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(33, 1, 0.1, 40);
  camera.position.set(0, 0.15, 9);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.05);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff0da, 2.8);
  key.position.set(-4, 5, 3);
  scene.add(key);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.018;
  const rim = new THREE.DirectionalLight(0xc0cfe0, 2.3);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xd8e0e5, 0.2);
  fill.position.set(2, 0, 4);
  scene.add(fill);
  const objects = [new THREE.Group(), makeCompass(), makeArchitecture()];
  objects.forEach((object) => {
    scene.add(object);
    object.visible = false;
  });
  let mode = 0,
    pointerX = 0,
    pointerY = 0,
    smoothX = 0,
    smoothY = 0,
    scroll = 0.5;
  let visible = false,
    frame = 0,
    lastTime = 0,
    disposed = false,
    lost = false,
    headReady = false;
  const controller = new AbortController();
  function requestFrame() {
    if (!frame && visible && !disposed && !lost && !document.hidden)
      frame = requestAnimationFrame(render);
  }
  function setReady() {
    canvas.parentElement.classList.toggle('is-ready', mode !== 0 || headReady);
  }
  Promise.all([
    new GLTFLoader().loadAsync('./assets/head.glb'),
    new THREE.TextureLoader().loadAsync('./assets/head-normal.jpg'),
  ])
    .then(([gltf, normalMap]) => {
      let original;
      gltf.scene.traverse((node) => {
        if (node.isMesh && !original) original = node;
      });
      if (!original) throw new Error('Missing sculpture mesh');
      let geometry = original.geometry.clone();
      geometry.center();
      geometry.computeBoundingBox();
      geometry.scale(
        ...Array(3).fill(3 / (geometry.boundingBox.max.y - geometry.boundingBox.min.y)),
      );
      const cropped = cropAbove(geometry, -0.3);
      geometry.dispose();
      geometry = cropped;
      geometry.center();
      geometry.computeBoundingBox();
      geometry.scale(
        ...Array(3).fill(2.95 / (geometry.boundingBox.max.y - geometry.boundingBox.min.y)),
      );
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x787e74,
        metalness: 0.12,
        roughness: 0.68,
        normalMap,
        normalScale: new THREE.Vector2(0.7, 0.7),
        envMapIntensity: 0.22,
      });
      mesh(objects[0], geometry, material, 0, 0.28);
      const base = new THREE.MeshStandardMaterial({
        color: 0x92968e,
        roughness: 0.78,
        metalness: 0.08,
      });
      mesh(objects[0], new THREE.BoxGeometry(1.65, 0.16, 1.16), base, 0, -1.31);
      mesh(objects[0], new THREE.BoxGeometry(1.78, 0.09, 1.28), base, 0, -1.435);
      finishObject(objects[0]);
      headReady = true;
      gltf.scene.traverse((node) => {
        if (node.isMesh) {
          node.geometry.dispose();
          node.material.dispose();
        }
      });
      if (disposed) {
        disposeObjects();
        return;
      }
      setReady();
      requestFrame();
    })
    .catch((error) => {
      if (!disposed) console.warn('Service sculpture unavailable.', error);
    });
  function render(now) {
    frame = 0;
    if (!visible || disposed || document.hidden || lost) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.045) : 0.016;
    lastTime = now;
    const damping = reduced ? 1 : 1 - Math.exp(-dt * 7);
    smoothX += ((reduced ? 0 : pointerX) - smoothX) * damping;
    smoothY += ((reduced ? 0 : pointerY) - smoothY) * damping;
    let difference =
      Math.abs((reduced ? 0 : pointerX) - smoothX) + Math.abs((reduced ? 0 : pointerY) - smoothY);
    objects.forEach((object, i) => {
      if (!object.userData.materials) return;
      const target = i === mode ? 1 : 0;
      const weight = (object.userData.weight += (target - object.userData.weight) * damping);
      difference = Math.max(difference, Math.abs(target - weight));
      object.visible = weight > 0.005;
      if (!object.visible) return;
      object.position.y = -(1 - weight) * 0.32;
      object.rotation.set(
        smoothY * 0.09,
        [0.45, -0.23, -0.28][i] +
          smoothX * 0.28 +
          (1 - weight) * -0.65 +
          (reduced ? 0 : (scroll - 0.5) * 0.1),
        i === 1 ? -0.12 : 0,
      );
      object.scale.setScalar(0.96 + weight * 0.04);
      for (const material of object.userData.materials) {
        material.transparent = weight < 0.999;
        material.opacity = weight;
        material.depthWrite = weight > 0.9;
      }
      if (i === 1)
        object.userData.arms.forEach((arm, index) => {
          arm.rotation.z = (index ? 1 : -1) * (0.32 + smoothX * 0.06);
        });
      if (i === 2) object.userData.keystone.position.y = Math.max(0, -smoothY) * 0.18;
    });
    renderer.render(scene, camera);
    if (difference > 0.0001) requestFrame();
  }
  const resize = new ResizeObserver(() => {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 600 ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = Math.max(
      8.8,
      3.1 / camera.aspect / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / 2,
    );
    camera.updateProjectionMatrix();
    requestFrame();
  });
  resize.observe(canvas);
  document.addEventListener(
    'visibilitychange',
    () => {
      lastTime = 0;
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else requestFrame();
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.parentElement.classList.remove('is-ready');
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      lost = false;
      setReady();
      requestFrame();
    },
    { signal: controller.signal },
  );
  function disposeObjects() {
    const materials = new Set(),
      textures = new Set();
    objects.forEach((object) =>
      object.traverse((node) => {
        if (node.isMesh) {
          node.geometry.dispose();
          materials.add(node.material);
          if (node.material.normalMap) textures.add(node.material.normalMap);
        }
      }),
    );
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }
  return {
    select(value) {
      mode = value;
      setReady();
      requestFrame();
    },
    pointer(x, y) {
      pointerX = x;
      pointerY = y;
      requestFrame();
    },
    progress(value) {
      scroll = value;
      requestFrame();
    },
    setReduced(value) {
      reduced = value;
      requestFrame();
    },
    setVisible(value) {
      visible = value;
      lastTime = 0;
      if (value) requestFrame();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controller.abort();
      disposeObjects();
      key.shadow.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
