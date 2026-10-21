import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
} from 'three';
import '../styles/liquid-buttons.css';

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 uSize;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uFill;
  uniform float uTilt;
  uniform float uImpulse;
  uniform float uDark;

  float water(vec2 p) {
    float t = uTime;
    float h = sin(p.x * 7.2 + p.y * 3.1 - t * 1.4) * .35;
    h += sin(p.x * -4.8 + p.y * 8.3 + t * 1.1) * .22;
    h += sin(p.x * 11.0 + p.y * 5.7 - t * .8) * .12;
    vec2 delta = p - vec2(uPointer.x * uSize.x / uSize.y, uPointer.y);
    float d = length(delta);
    h += sin(d * 19.0 - t * 4.0) * exp(-d * 1.7) * uImpulse * .5;
    return h;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uSize.x / uSize.y;
    float x = uv.x * aspect;
    float activity = .38 + uImpulse * .65;
    // Surface tension at the sides, a travelling wave, and the pointer's wake.
    float wave = (sin(x * 3.8 - uTime * 2.0) * 1.6
      + sin(x * 6.5 + uTime * 1.5) * .65) * activity;
    wave += sin((uv.x - uPointer.x) * 17.0 - uTime * 3.4)
      * exp(-abs(uv.x - uPointer.x) * 3.0) * uImpulse * 2.4;
    float edge = exp(-uv.x * 45.0) + exp(-(1.0 - uv.x) * 45.0);
    float surface = uFill * 1.085 - .12
      + (wave + edge * 1.5) / uSize.y + (uv.x - .5) * uTilt;
    float depth = (surface - uv.y) * uSize.y;
    float alpha = smoothstep(-.65, .65, depth);

    vec2 p = vec2(x, uv.y);
    float h = water(p);
    vec2 gradient = vec2(water(p + vec2(.025, 0.0)) - h,
                         water(p + vec2(0.0, .025)) - h) / .025;
    vec3 normal = normalize(vec3(-gradient * .12, 1.0));
    vec3 light = normalize(vec3(-.5, .6, 1.5));
    float specular = pow(max(dot(normal, light), 0.0), 36.0);
    // Refracted light through shallow champagne water, not a solid metallic fill.
    float caustic = pow(.5 + .5 * sin(p.x * 7.5 + p.y * 9.0 + h * 2.6), 16.0);
    float reflection = exp(-pow((uv.y - .63 + h * .17) * 8.0, 2.0));
    vec3 shallow = mix(vec3(.82, .77, .63), vec3(.24, .29, .26), uDark);
    vec3 deep = mix(vec3(.62, .55, .38), vec3(.12, .17, .15), uDark);
    vec3 color = mix(shallow, deep, smoothstep(0.0, 1.0, 1.0 - uv.y) * .65);
    color += (specular * .11 + reflection * .065 + caustic * .065) * (1.0 - uDark * .45);
    color += h * .035;
    // A fine bright meniscus, with the shadow just below it.
    color += exp(-pow((depth - .65) / .8, 2.0)) * .21;
    color -= exp(-pow((depth - 2.2) / 1.35, 2.0)) * .085;
    gl_FragColor = vec4(color, alpha);
  }
`;

/** A single small GPU surface serves every CTA; nothing runs while the buttons are idle. */
export function createLiquidButtons({ reduced = false } = {}) {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const states = [];
  let renderer, scene, material, geometry, camera;
  let unavailable = false,
    frame = 0,
    lastTime = 0,
    time = 0,
    renderWidth = 0,
    renderHeight = 0;

  function ensureRenderer() {
    if (renderer) return true;
    if (unavailable) return false;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      scene = new Scene();
      camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      geometry = new PlaneGeometry(2, 2);
      material = new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uSize: { value: new Vector2() },
          uPointer: { value: new Vector2(0.5, 0.5) },
          uTime: { value: 0 },
          uFill: { value: 0 },
          uTilt: { value: 0 },
          uImpulse: { value: 0 },
          uDark: { value: 0 },
        },
        vertexShader:
          'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
        fragmentShader,
      });
      scene.add(new Mesh(geometry, material));
      renderer.domElement.addEventListener('webglcontextlost', fallback, options);
      return true;
    } catch {
      fallback();
      return false;
    }
  }

  function clear(state) {
    state.ctx?.clearRect(0, 0, state.canvas.width, state.canvas.height);
  }
  function fallback() {
    unavailable = true;
    cancelAnimationFrame(frame);
    frame = 0;
    states.forEach((state) => {
      clear(state);
      state.button.classList.add('liquid-fallback');
    });
  }
  function reset(state) {
    state.hover = state.focus = false;
    state.fill = state.velocity = state.tilt = state.impulse = 0;
    state.button.classList.remove('is-wet');
    clear(state);
  }
  function schedule() {
    if (!frame && !reduced && !unavailable && !document.hidden) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function measure(state) {
    const rect = state.button.getBoundingClientRect();
    state.width = Math.max(1, rect.width - 2 * state.button.clientLeft);
    state.height = Math.max(1, rect.height - 2 * state.button.clientTop);
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    state.canvas.width = Math.round(state.width * dpr);
    state.canvas.height = Math.round(state.height * dpr);
  }
  function activate(state) {
    state.button.classList.toggle('is-wet', state.hover || state.focus);
    if (!reduced && state.visible) schedule();
  }
  function draw(state) {
    const { uniforms } = material;
    uniforms.uSize.value.set(state.width, state.height);
    uniforms.uPointer.value.set(state.x, state.y);
    uniforms.uTime.value = time;
    uniforms.uFill.value = state.fill;
    uniforms.uTilt.value = state.tilt;
    uniforms.uImpulse.value = state.impulse;
    uniforms.uDark.value = state.round || state.button.closest('.on-paper') ? 1 : 0;
    if (renderWidth !== state.canvas.width || renderHeight !== state.canvas.height) {
      renderWidth = state.canvas.width;
      renderHeight = state.canvas.height;
      renderer.setSize(renderWidth, renderHeight, false);
    }
    renderer.render(scene, camera);
    clear(state);
    state.ctx.drawImage(renderer.domElement, 0, 0);
  }
  function tick(now) {
    frame = 0;
    if (reduced || document.hidden || document.body.classList.contains('modal-open')) {
      states.forEach(reset);
      return;
    }
    if (!ensureRenderer()) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    time += dt;
    let running = false;
    for (const state of states) {
      if (!state.visible || !state.ctx) continue;
      const target = state.hover || state.focus ? 1 : 0;
      if (!target && state.fill < 0.001) {
        state.fill = state.velocity = 0;
        clear(state);
        continue;
      }
      // Damped filling: continuous through rapid enter/leave changes, with no timeline restart.
      state.velocity += ((target - state.fill) * 42 - state.velocity * 11) * dt;
      state.fill = Math.max(0, Math.min(1.025, state.fill + state.velocity * dt));
      state.impulse *= Math.exp(-dt * 2.1);
      const tilt = (state.x - 0.5) * 0.07 + state.velocity * 0.009;
      state.tilt += (tilt - state.tilt) * (1 - Math.exp(-dt * 4));
      draw(state);
      running = true;
    }
    if (running) frame = requestAnimationFrame(tick);
  }

  const resize = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const state = states.find((item) => item.button === entry.target);
      measure(state);
      if (state.hover || state.focus || state.fill > 0.001) schedule();
    });
  });
  const visibility = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const state = states.find((item) => item.button === entry.target);
      state.visible = entry.isIntersecting;
      if (!state.visible) reset(state);
    });
  });

  document.querySelectorAll('.project-cta, .contact-orbit').forEach((button) => {
    const round = button.classList.contains('contact-orbit');
    const label = round ? button.querySelector('span') : document.createElement('span');
    if (!round) {
      label.append(...button.childNodes);
      button.append(label);
    }
    label.classList.add('liquid-label');
    const canvas = document.createElement('canvas');
    canvas.className = 'liquid-surface';
    canvas.setAttribute('aria-hidden', 'true');
    button.prepend(canvas);
    button.classList.add('has-liquid');
    const state = {
      button,
      canvas,
      label,
      round,
      ctx: canvas.getContext('2d'),
      visible: true,
      hover: false,
      focus: false,
      fill: 0,
      velocity: 0,
      tilt: 0,
      impulse: 0,
      x: 0.5,
      y: 0.5,
      width: 1,
      height: 1,
    };
    states.push(state);
    if (!state.ctx) button.classList.add('liquid-fallback');
    const point = (event) => {
      const rect = button.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      state.impulse = Math.min(1.5, state.impulse + Math.abs(x - state.x) * 3);
      state.x = x;
      state.y = 1 - (event.clientY - rect.top) / rect.height;
    };
    button.addEventListener(
      'pointerenter',
      (event) => {
        if (event.pointerType === 'touch') return;
        point(event);
        state.hover = true;
        state.impulse = 0.6;
        activate(state);
      },
      options,
    );
    button.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'touch' && state.hover) point(event);
      },
      options,
    );
    button.addEventListener(
      'pointerleave',
      () => {
        state.hover = false;
        activate(state);
      },
      options,
    );
    button.addEventListener(
      'pointercancel',
      () => {
        state.hover = false;
        activate(state);
      },
      options,
    );
    button.addEventListener(
      'focus',
      () => {
        state.focus = button.matches(':focus-visible');
        activate(state);
      },
      options,
    );
    button.addEventListener(
      'blur',
      () => {
        state.focus = false;
        activate(state);
      },
      options,
    );
    measure(state);
    resize.observe(button);
    visibility.observe(button);
  });

  // Native dialogs suspend the decorative renderer, including a keyboard-triggered open.
  const modal = new MutationObserver(() => {
    if (document.body.classList.contains('modal-open')) {
      cancelAnimationFrame(frame);
      frame = 0;
      states.forEach(reset);
    }
  });
  modal.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        states.forEach(reset);
      }
    },
    options,
  );
  window.addEventListener(
    'blur',
    () => {
      cancelAnimationFrame(frame);
      frame = 0;
      states.forEach(reset);
    },
    options,
  );

  return {
    setReduced(value) {
      reduced = value;
      if (value) {
        cancelAnimationFrame(frame);
        frame = 0;
        states.forEach(reset);
      }
    },
    dispose() {
      cancelAnimationFrame(frame);
      abort.abort();
      resize.disconnect();
      visibility.disconnect();
      modal.disconnect();
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      states.forEach(({ button, canvas, label, round }) => {
        canvas.remove();
        button.classList.remove('has-liquid', 'is-wet', 'liquid-fallback');
        if (round) label.classList.remove('liquid-label');
        else label.replaceWith(...label.childNodes);
      });
    },
  };
}
