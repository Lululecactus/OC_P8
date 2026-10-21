import { projects as studies } from '../content/projects.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sliceGeometry, cropAbove } from './slice.js';
import { makeArt, prepareArt, refreshArtLanguage } from './project-art.js';
import { createGallery } from './gallery.js';

const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

export async function createScene(
  canvas,
  { reduced, onReady, onFailure, onOpenStudy, onActiveStudy, onStudyProgress, onStudyClosed },
) {
  await prepareArt();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
  } catch {
    onFailure();
    return null;
  }
  renderer.setClearColor(0x090a0c, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x090a0c, 0.06);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.05);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xf3f0e9, 3.8);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb1c5e1, 3.0);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe2e5ed, 0.8);
  fill.position.set(2, -1, 4);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x90a0bc, 0.15));
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sc = shadowCanvas.getContext('2d'),
    gradient = sc.createRadialGradient(64, 64, 5, 64, 64, 60);
  gradient.addColorStop(0, 'rgba(0,0,0,.85)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  sc.fillStyle = gradient;
  sc.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 2.5),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(1.6, -1.84, 0);
  scene.add(shadow);
  const sculpture = new THREE.Group();
  scene.add(sculpture);
  let parts = [],
    headMaterial;
  const textureLoader = new THREE.TextureLoader();
  const artTextures = studies.map((study) => new THREE.CanvasTexture(makeArt(study.id)));
  artTextures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  });
  const gallery = createGallery(scene, artTextures, onActiveStudy, onStudyProgress, () => {
    // Focus or viewport changes may have moved the scroll target while the view was open.
    // Resume from the same ribbon position instead of applying that accumulated delta.
    progress = progressTarget;
    gallery.rebase(clamp(((progress - 1.1) / 2) * (studies.length - 1), 0, studies.length - 1));
    onStudyClosed();
  });
  gallery.setReduced(reduced);
  let progress = 0,
    progressTarget = 0,
    rotation = 0,
    rotationTarget = 0,
    pointerX = 0,
    pointerY = 0;
  let split = false,
    hover = 0,
    spread = 0.016,
    frame = 0,
    lastTime = 0,
    visible = true,
    lost = false,
    disposed = false;
  let mobile = false,
    dragging = false,
    dragX = 0,
    startX = 0,
    startY = 0,
    smoothX = 0,
    smoothY = 0;
  const pointer = new THREE.Vector2(),
    signal = new AbortController();
  let galleryDragging = false,
    dragMoved = false,
    dragTime = 0;
  try {
    const [gltf, normalMap] = await Promise.all([
      new GLTFLoader().loadAsync('./assets/head.glb'),
      textureLoader.loadAsync('./assets/head-normal.jpg'),
    ]);
    let original;
    gltf.scene.traverse((node) => {
      if (node.isMesh && !original) original = node;
    });
    if (!original) throw new Error('Missing sculpture mesh');
    let geometry = original.geometry.clone();
    geometry.center();
    geometry.computeBoundingBox();
    const height = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
    geometry.scale(3 / height, 3 / height, 3 / height);
    const cropped = cropAbove(geometry, -0.3);
    geometry.dispose();
    geometry = cropped;
    geometry.center();
    geometry.computeBoundingBox();
    const croppedHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
    geometry.scale(2.65 / croppedHeight, 2.65 / croppedHeight, 2.65 / croppedHeight);
    headMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x20242a,
      roughness: 0.72,
      metalness: 0.2,
      normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      envMapIntensity: 0.28,
      clearcoat: 0.05,
      clearcoatRoughness: 0.65,
    });
    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0x43484d,
      roughness: 0.65,
      metalness: 0.2,
      envMapIntensity: 0.25,
    });
    parts = sliceGeometry(geometry, 8).map(({ body, caps }, i) => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(body, headMaterial), new THREE.Mesh(caps, capMaterial));
      group.userData.offset = i - 3.5;
      sculpture.add(group);
      return group;
    });
    geometry.dispose();
    gltf.scene.traverse((node) => {
      if (node.isMesh) {
        node.geometry.dispose();
        node.material.dispose();
      }
    });
    canvas.dataset.ready = 'true';
    onReady();
  } catch (error) {
    console.warn('The sculpture could not be prepared.', error);
    onFailure();
  }
  function requestFrame() {
    if (!frame && !disposed && !lost) frame = requestAnimationFrame(render);
  }
  function resize() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    mobile = width < 600;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = mobile ? 40 : 35;
    camera.updateProjectionMatrix();
    requestFrame();
  }
  function render(now) {
    frame = 0;
    if (disposed || lost || !visible || document.hidden) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.045) : 0.016;
    lastTime = now;
    const damping = reduced ? 1 : 1 - Math.exp(-dt * 9);
    if (!gallery.studyOpen) {
      progress += (progressTarget - progress) * damping;
      smoothX += (pointerX - smoothX) * damping;
      smoothY += (pointerY - smoothY) * damping;
    }
    rotation += (rotationTarget - rotation) * damping;
    const transition = smooth(0.12, 1.05, progress);
    const arrival = smooth(0.48, 1.1, progress);
    camera.position.set(
      reduced ? 0 : smoothX * 0.12,
      reduced ? 0 : -smoothY * 0.08,
      mobile ? 10.5 : 8.5 + arrival * 1.2,
    );
    camera.lookAt(0, 0, 0);
    const targetSpread =
      0.018 + (split ? 0.13 : 0) + (reduced ? 0 : hover * 0.065) + transition * 0.23;
    spread += (targetSpread - spread) * damping;
    sculpture.position.set(
      (mobile ? 0.15 : 1.65) - transition * 5,
      (mobile ? -1.03 : 0.13) + transition * 0.25,
      -transition * 4.5,
    );
    sculpture.scale.setScalar((mobile ? 0.79 : 1) * (1 - transition * 0.25));
    sculpture.rotation.set(
      reduced ? 0 : smoothY * 0.05,
      0.65 + rotation + (reduced ? 0 : smoothX * 0.1) - transition * 0.3,
      -0.03,
    );
    sculpture.visible = transition < 0.999;
    for (const part of parts) part.position.z = part.userData.offset * spread;
    shadow.position.x = sculpture.position.x;
    shadow.material.opacity = 1 - transition;
    gallery.setBase(clamp(((progress - 1.1) / 2) * (studies.length - 1), 0, studies.length - 1));
    const galleryMoving = gallery.update(dt, arrival, mobile);
    renderer.render(scene, camera);
    const moving =
      !gallery.studyOpen &&
      Math.abs(progress - progressTarget) +
        Math.abs(rotation - rotationTarget) +
        Math.abs(spread - targetSpread) +
        Math.abs(pointerX - smoothX) +
        Math.abs(pointerY - smoothY) >
        0.001;
    if (moving || galleryMoving) requestFrame();
  }
  function position(event) {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) / r.width, y: (event.clientY - r.top) / r.height };
  }
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      startX = dragX = event.clientX;
      startY = event.clientY;
      dragTime = event.timeStamp;
      dragMoved = false;
      dragging = progressTarget < 0.65;
      galleryDragging = progressTarget > 0.9 && progressTarget < 3.8;
      if (dragging || galleryDragging) canvas.setPointerCapture(event.pointerId);
      if (galleryDragging) gallery.beginDrag();
    },
    { signal: signal.signal },
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      const p = position(event);
      pointerX = (p.x - 0.5) * 2;
      pointerY = (p.y - 0.5) * 2;
      if (dragging) {
        rotationTarget += (event.clientX - dragX) * 0.006;
        dragX = event.clientX;
      }
      if (galleryDragging) {
        dragMoved ||= Math.abs(event.clientX - startX) > 6;
        gallery.drag(
          (dragX - event.clientX) / (canvas.clientWidth * (mobile ? 0.8 : 0.46)),
          (event.timeStamp - dragTime) / 1000,
        );
        dragX = event.clientX;
        dragTime = event.timeStamp;
      }
      if (progressTarget > 0.9 && progressTarget < 3.8) {
        pointer.set(p.x * 2 - 1, -p.y * 2 + 1);
        gallery.pointer(gallery.hit(pointer, camera));
      }
      hover = !mobile && p.x > 0.48 && p.x < 0.87 && p.y > 0.15 && p.y < 0.77 ? 1 : 0;
      requestFrame();
    },
    { signal: signal.signal },
  );
  canvas.addEventListener(
    'pointerup',
    (event) => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      dragging = false;
      if (galleryDragging) gallery.endDrag();
      galleryDragging = false;
      if (
        progressTarget > 1 &&
        !dragMoved &&
        Math.hypot(event.clientX - startX, event.clientY - startY) < 8
      ) {
        const p = position(event);
        pointer.set(p.x * 2 - 1, -p.y * 2 + 1);
        const hit = gallery.hit(pointer, camera);
        if (hit) onOpenStudy(hit.object.userData.index, hit.object.userData.slot);
      }
      requestFrame();
    },
    { signal: signal.signal },
  );
  canvas.addEventListener(
    'pointercancel',
    () => {
      dragging = false;
      if (galleryDragging) gallery.endDrag();
      galleryDragging = false;
      gallery.clearPointer();
      requestFrame();
    },
    { signal: signal.signal },
  );
  canvas.addEventListener(
    'pointerleave',
    () => {
      hover = 0;
      if (!dragging && !galleryDragging) pointerX = pointerY = 0;
      gallery.clearPointer();
      requestFrame();
    },
    { signal: signal.signal },
  );
  canvas.addEventListener(
    'keydown',
    (event) => {
      if (progressTarget < 0.65 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        rotationTarget += event.key === 'ArrowLeft' ? -0.3 : 0.3;
        requestFrame();
      }
    },
    { signal: signal.signal },
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      frame = 0;
      onFailure();
    },
    { signal: signal.signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      lost = false;
      onReady();
      requestFrame();
    },
    { signal: signal.signal },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      lastTime = 0;
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else requestFrame();
    },
    { signal: signal.signal },
  );
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) requestFrame();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    }
  });
  observer.observe(canvas);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  return {
    setProgress(value) {
      progressTarget = value;
      requestFrame();
    },
    navigateGallery(direction) {
      gallery.navigate(direction);
      requestFrame();
    },
    openStudy(index, slot) {
      const started = gallery.openStudy(index, camera, slot);
      if (started) requestFrame();
      return started;
    },
    refreshLanguage() {
      refreshArtLanguage();
      artTextures.forEach((texture) => {
        texture.needsUpdate = true;
      });
      gallery.refreshTextures();
      requestFrame();
    },
    closeStudy() {
      gallery.closeStudy();
      requestFrame();
    },
    abortStudy() {
      gallery.abortStudy();
      requestFrame();
    },
    setSplit(value) {
      split = value;
      requestFrame();
    },
    turn(amount) {
      rotationTarget += amount;
      requestFrame();
    },
    setReduced(value) {
      reduced = value;
      gallery.setReduced(value);
      pointerX = pointerY = 0;
      hover = 0;
      requestFrame();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      signal.abort();
      gallery.dispose();
      scene.traverse((node) => {
        if (node.isMesh) {
          node.geometry.dispose();
          if (!Array.isArray(node.material)) node.material.dispose();
        }
      });
      artTextures.forEach((t) => t.dispose());
      headMaterial?.normalMap?.dispose();
      shadowTexture.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
