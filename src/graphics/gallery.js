import * as THREE from 'three';
import { LiquidField, wrapIndex } from './liquid-field.js';
import { projects as studies } from '../content/projects.js';
import { PANEL_WIDTH, PANEL_HEIGHT, PANEL_GAP, deformRibbonGeometry } from './ribbon-geometry.js';
import { coverScale, smoothRange, unfoldGeometry } from './study-unfold.js';

// Repeated slots must be a multiple of the project count to preserve the sequence at the seam.
const LOOP_SIZE = studies.length * 3;

function captionTexture(source, study) {
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  const image = source.image;
  const ratio = Math.max(canvas.width / image.width, canvas.height / image.height);
  ctx.drawImage(
    image,
    (canvas.width - image.width * ratio) / 2,
    (canvas.height - image.height * ratio) / 2,
    image.width * ratio,
    image.height * ratio,
  );
  const shade = ctx.createLinearGradient(0, 650, 0, 960);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.78)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 650, 1500, 310);
  ctx.fillStyle = '#f3f3ef';
  ctx.font = '34px Manrope, sans-serif';
  ctx.fillText(study.title, 48, 902);
  ctx.beginPath();
  ctx.arc(1413, 890, 31, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.65)';
  ctx.fill();
  ctx.strokeStyle = '#e8e9e9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1402, 890);
  ctx.lineTo(1424, 890);
  ctx.moveTo(1413, 879);
  ctx.lineTo(1413, 901);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCard(texture, cleanTexture, index) {
  const geometry = new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT, 64, 32);
  geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  const field = new LiquidField();
  const liquid = new THREE.DataTexture(field.pixels, field.width, field.height, THREE.RGBAFormat);
  liquid.minFilter = liquid.magFilter = THREE.LinearFilter;
  liquid.generateMipmaps = false;
  liquid.needsUpdate = true;
  const uniforms = {
    uLiquid: { value: liquid },
    uTexel: { value: new THREE.Vector2(1 / field.width, 1 / field.height) },
    uEnabled: { value: 1 },
    uCleanMap: { value: cleanTexture },
    uStudy: { value: 0 },
    uCover: { value: new THREE.Vector2(1, 1) },
  };
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const declarations =
      '\nuniform sampler2D uLiquid; uniform vec2 uTexel; uniform float uEnabled; uniform sampler2D uCleanMap; uniform float uStudy; uniform vec2 uCover;\n';
    shader.vertexShader = declarations + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float height = (texture2D(uLiquid, uv).r - 128.0 / 255.0) * 3.984375;
      transformed.z += height * .09 * uEnabled;
    `,
    );
    shader.fragmentShader = declarations + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      float left = texture2D(uLiquid, vMapUv - vec2(uTexel.x, 0.0)).r;
      float right = texture2D(uLiquid, vMapUv + vec2(uTexel.x, 0.0)).r;
      float down = texture2D(uLiquid, vMapUv - vec2(0.0, uTexel.y)).r;
      float up = texture2D(uLiquid, vMapUv + vec2(0.0, uTexel.y)).r;
      vec2 slope = vec2(left - right, down - up) * 3.984375;
      // Refract the picture locally; the caption remains legible at the lower edge.
      float edge = smoothstep(0.0, .12, vMapUv.x) * smoothstep(0.0, .12, 1.0 - vMapUv.x)
        * smoothstep(.12, .28, vMapUv.y) * smoothstep(0.0, .1, 1.0 - vMapUv.y);
      vec2 refractedUv = clamp(vMapUv + slope * .095 * edge * uEnabled, .001, .999);
      vec4 sampledDiffuseColor = texture2D(map, refractedUv);
      diffuseColor *= sampledDiffuseColor;
      diffuseColor.rgb += dot(slope, vec2(-.7, .5)) * .11 * edge * uEnabled;
      vec2 studyUv = (refractedUv - .5) * mix(vec2(1.0), uCover, uStudy) + .5;
      vec4 studyColor = texture2D(uCleanMap, studyUv);
      diffuseColor = mix(diffuseColor, studyColor, smoothstep(.0, .55, uStudy));
    `,
    );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = {
    index: index % studies.length,
    slot: index,
    field,
    liquid,
    uniforms,
    ribbonCenter: NaN,
    mobile: null,
  };
  return mesh;
}

export function createGallery(
  scene,
  sourceTextures,
  onActiveStudy,
  onStudyProgress,
  onStudyClosed,
) {
  const textures = sourceTextures.map((texture, i) => captionTexture(texture, studies[i]));
  const cards = Array.from({ length: LOOP_SIZE }, (_, i) =>
    makeCard(textures[i % textures.length], sourceTextures[i % textures.length], i),
  );
  cards.forEach((card) => scene.add(card));
  const grid = new THREE.GridHelper(80, 80, 0x66717f, 0x66717f);
  grid.position.y = -1.36;
  grid.material.transparent = true;
  grid.material.opacity = 0;
  grid.material.depthWrite = false;
  scene.add(grid);

  const raycaster = new THREE.Raycaster();
  let base = 0,
    offset = 0,
    position = 0,
    active = -1,
    hovered = null;
  let previousUv = null,
    dragging = false,
    dragSpeed = 0,
    accumulator = 0;
  let reduced = false;
  let study = null;
  const sourcePoint = new THREE.Vector3();

  function resetPointer() {
    hovered = null;
    previousUv = null;
  }
  function releaseStudy() {
    if (!study) return;
    const { card, mobile, restoreScale, restoreZ } = study;
    card.renderOrder = 0;
    card.material.depthTest = true;
    card.userData.uniforms.uStudy.value = 0;
    card.userData.uniforms.uEnabled.value = reduced ? 0 : 1;
    deformRibbonGeometry(card.geometry, card.userData.ribbonCenter, mobile);
    card.userData.mobile = mobile;
    card.scale.setScalar(restoreScale);
    card.position.set(0, 0, restoreZ);
    study = null;
  }

  return {
    refreshTextures() {
      textures.forEach((texture, index) => {
        const updated = captionTexture(sourceTextures[index], studies[index]);
        texture.image = updated.image;
        texture.needsUpdate = true;
        updated.dispose();
      });
    },
    get studyOpen() {
      return study !== null;
    },
    setBase(value) {
      if (!study) base = value;
    },
    rebase(value) {
      base = value;
      offset = position - base;
    },
    navigate(direction) {
      offset = Math.round(base + offset) + direction - base;
    },
    beginDrag() {
      dragging = true;
      dragSpeed = 0;
      offset = position - base;
    },
    drag(delta, elapsed) {
      offset += delta;
      dragSpeed = THREE.MathUtils.lerp(dragSpeed, delta / Math.max(elapsed, 0.016), 0.5);
    },
    endDrag() {
      if (!dragging) return;
      dragging = false;
      offset =
        Math.round(base + offset + THREE.MathUtils.clamp(dragSpeed * 0.16, -0.9, 0.9)) - base;
    },
    hit(pointer, camera) {
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(cards.filter((card) => card.visible))[0];
    },
    pointer(hit) {
      if (reduced || !hit?.uv) {
        resetPointer();
        return;
      }
      const card = hit.object;
      const uv = hit.uv;
      const field = card.userData.field;
      if (hovered !== card) {
        field.disturb(uv.x, uv.y, 0.75);
        hovered = card;
        previousUv = uv.clone();
      } else {
        const distance = uv.distanceTo(previousUv);
        if (distance > 0.002) {
          field.disturb(uv.x, uv.y, Math.min(0.55 + distance * 16, 1.2));
          field.disturb(previousUv.x, previousUv.y, -0.45);
          previousUv.copy(uv);
        }
      }
    },
    clearPointer: resetPointer,
    openStudy(index, camera, slot) {
      if (study) return false;
      const candidates = cards.filter((card) => card.visible && card.userData.index === index);
      const card =
        candidates.find((item) => item.userData.slot === slot) ??
        candidates.sort(
          (a, b) => Math.abs(a.userData.ribbonCenter) - Math.abs(b.userData.ribbonCenter),
        )[0];
      if (!card) return false;
      offset = position - base;
      dragging = false;
      resetPointer();
      card.updateMatrixWorld();
      const vertices = card.geometry.getAttribute('position');
      const source = new Float32Array(vertices.count * 3);
      for (let i = 0; i < vertices.count; i++) {
        sourcePoint
          .fromBufferAttribute(vertices, i)
          .applyMatrix4(card.matrixWorld)
          .toArray(source, i * 3);
      }
      study = {
        card,
        source,
        camera,
        progress: 0,
        target: 1,
        mobile: card.userData.mobile,
        restoreScale: card.scale.x,
        restoreZ: card.position.z,
      };
      card.position.set(0, 0, 0);
      card.scale.setScalar(1);
      card.renderOrder = 10;
      card.material.depthTest = false;
      return true;
    },
    closeStudy() {
      if (study) study.target = 0;
    },
    abortStudy: releaseStudy,
    setReduced(value) {
      reduced = value;
      if (value) {
        cards.forEach((card) => {
          card.userData.field.clear();
          card.userData.liquid.needsUpdate = true;
        });
        resetPointer();
      }
    },
    update(dt, arrival, mobile) {
      const previous = position;
      const damping = reduced ? 1 : 1 - Math.exp(-dt * (dragging ? 15 : 7.5));
      if (!study) position += (base + offset - position) * damping;
      const index = wrapIndex(Math.round(position), studies.length);
      if (arrival > 0.95 && active !== index) {
        active = index;
        onActiveStudy(index);
      }
      const scale = mobile ? 0.68 : 1;
      const speed = THREE.MathUtils.clamp((position - previous) / Math.max(dt, 0.001), -4, 4);
      accumulator = Math.min(accumulator + dt, 0.06);
      const steps = Math.floor(accumulator * 60);
      accumulator -= steps / 60;
      let liquidMoving = false;
      cards.forEach((card) => {
        const relative =
          wrapIndex(card.userData.slot - position + LOOP_SIZE / 2, LOOP_SIZE) - LOOP_SIZE / 2;
        const selected = study?.card === card;
        card.visible = selected || (arrival > 0.001 && Math.abs(relative) < 2.75);
        const center = relative * (PANEL_WIDTH + PANEL_GAP);
        if (
          !selected &&
          card.visible &&
          (card.userData.ribbonCenter !== center || card.userData.mobile !== mobile)
        ) {
          deformRibbonGeometry(card.geometry, center, mobile);
          card.userData.ribbonCenter = center;
          card.userData.mobile = mobile;
        }
        if (!selected) {
          card.scale.setScalar(scale * (0.9 + 0.1 * arrival));
          card.position.set(0, 0, -(1 - arrival) * 8);
        }
        card.material.opacity = selected
          ? 1
          : arrival * (1 - smoothRange(0, 0.48, study?.progress ?? 0));
        card.userData.uniforms.uEnabled.value = reduced ? 0 : 1;
        const field = card.userData.field;
        let changed = false;
        for (let i = 0; i < steps; i++) changed = field.step() || changed;
        if (changed) card.userData.liquid.needsUpdate = true;
        liquidMoving ||= field.energy >= 0.002;
      });
      grid.visible = arrival > 0.001;
      grid.position.y = mobile ? -1.05 : -1.36;
      grid.material.opacity = arrival * 0.14;
      let unfolding = false;
      if (study) {
        const { card, camera } = study;
        if (study.mobile !== mobile) {
          // Rebuild the return shape when the viewport crosses the mobile breakpoint.
          deformRibbonGeometry(card.geometry, card.userData.ribbonCenter, mobile);
          const vertices = card.geometry.getAttribute('position');
          for (let i = 0; i < vertices.count; i++) {
            sourcePoint
              .fromBufferAttribute(vertices, i)
              .multiplyScalar(scale * (0.9 + 0.1 * arrival));
            sourcePoint.z -= (1 - arrival) * 8;
            sourcePoint.toArray(study.source, i * 3);
          }
          study.mobile = mobile;
          study.restoreScale = scale * (0.9 + 0.1 * arrival);
          study.restoreZ = -(1 - arrival) * 8;
        }
        const direction = Math.sign(study.target - study.progress);
        study.progress = reduced
          ? study.target
          : THREE.MathUtils.clamp(study.progress + (direction * dt) / 1.05, 0, 1);
        const amount = smoothRange(0, 1, study.progress);
        unfoldGeometry(card.geometry, study.source, camera, study.progress);
        const image = sourceTextures[card.userData.index].image;
        card.userData.uniforms.uCover.value.set(
          ...coverScale(image.width / image.height, camera.aspect),
        );
        card.userData.uniforms.uStudy.value = amount;
        card.userData.uniforms.uEnabled.value = reduced ? 0 : 1 - amount;
        grid.material.opacity *= 1 - smoothRange(0, 0.5, study.progress);
        onStudyProgress(study.progress);
        unfolding = study.progress !== study.target;
        if (study.target === 0 && study.progress === 0) {
          releaseStudy();
          onStudyClosed();
          unfolding = true;
        }
      }
      return (
        unfolding ||
        Math.abs(position - base - offset) > 0.0005 ||
        Math.abs(speed) > 0.003 ||
        liquidMoving
      );
    },
    dispose() {
      cards.forEach((card) => {
        scene.remove(card);
        card.geometry.dispose();
        card.material.dispose();
        card.userData.liquid.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      scene.remove(grid);
      grid.geometry.dispose();
      grid.material.dispose();
    },
  };
}
