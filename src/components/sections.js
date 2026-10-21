import { t } from '../i18n/index.js';
import { createServiceSculpture } from '../graphics/service-sculpture.js';

export function createSections({ reduced }) {
  const root = document.documentElement;
  const header = document.querySelector('.header');
  const practice = document.querySelector('.practice');
  const visual = document.querySelector('.service-visual');
  const services = [...document.querySelectorAll('[data-service]')];
  const method = document.querySelector('#method');
  const steps = [...method.querySelectorAll('[data-step]')];
  const contact = document.querySelector('.contact-orbit');
  const signal = new AbortController();
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let selected = 0,
    sculpture = null,
    triedSculpture = false,
    frame = 0,
    currentStep = -1,
    keyboardNavigation = false;

  function preview(index) {
    document.querySelector('#form-caption').textContent = t(`services.caption${index}`);
    sculpture?.select(index);
  }
  function select(index) {
    preview(index);
    if (index === selected) return;
    selected = index;
    services.forEach((service, i) => {
      const active = i === index;
      service.classList.toggle('is-active', active);
      service.querySelector('button').setAttribute('aria-expanded', String(active));
      const panel = service.querySelector('.service-panel');
      panel.setAttribute('aria-hidden', String(!active));
      panel.inert = !active;
    });
  }
  services.forEach((service, i) => {
    const button = service.querySelector('button');
    button.addEventListener('click', () => select(i), { signal: signal.signal });
    button.addEventListener('focus', () => select(i), { signal: signal.signal });
    // Hover previews the form without moving the clickable accordion rows.
    button.addEventListener(
      'pointerenter',
      () => {
        if (finePointer.matches && !keyboardNavigation) preview(i);
      },
      { signal: signal.signal },
    );
    button.addEventListener(
      'pointermove',
      (event) => {
        if (!finePointer.matches || !(event.movementX || event.movementY)) return;
        keyboardNavigation = false;
        preview(i);
      },
      { signal: signal.signal },
    );
    button.addEventListener('pointerleave', () => preview(selected), { signal: signal.signal });
    button.addEventListener(
      'keydown',
      (event) => {
        let next;
        if (event.key === 'ArrowDown') next = (i + 1) % services.length;
        else if (event.key === 'ArrowUp') next = (i - 1 + services.length) % services.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = services.length - 1;
        keyboardNavigation = true;
        if (next !== undefined) {
          event.preventDefault();
          services[next].querySelector('button').focus();
        }
      },
      { signal: signal.signal },
    );
  });
  visual.addEventListener(
    'pointermove',
    (event) => {
      if (reduced || !finePointer.matches) return;
      const box = visual.getBoundingClientRect();
      sculpture?.pointer(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        ((event.clientY - box.top) / box.height) * 2 - 1,
      );
    },
    { signal: signal.signal },
  );
  visual.addEventListener('pointerleave', () => sculpture?.pointer(0, 0), {
    signal: signal.signal,
  });

  const formObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries[0].isIntersecting;
      if (visible && !triedSculpture) {
        triedSculpture = true;
        sculpture = createServiceSculpture(document.querySelector('#service-form'), reduced);
        sculpture?.select(selected);
      }
      sculpture?.setVisible(visible);
    },
    { rootMargin: '100px' },
  );
  formObserver.observe(visual);

  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
    },
    { threshold: 0.12 },
  );
  root.classList.add('sections-enhanced');
  document.querySelectorAll('[data-reveal]').forEach((node) => revealObserver.observe(node));

  function update() {
    frame = 0;
    const height = innerHeight;
    const methodRect = method.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const headerCenter = headerRect.top + headerRect.height / 2;
    header.classList.toggle(
      'on-paper',
      methodRect.top < headerCenter && methodRect.bottom > headerCenter,
    );
    if (methodRect.top < height && methodRect.bottom > 0) {
      const position = height * 0.44;
      const distances = steps.map((step) =>
        Math.abs(step.getBoundingClientRect().top + 100 - position),
      );
      const index = distances.indexOf(Math.min(...distances));
      if (index !== currentStep) {
        currentStep = index;
        steps.forEach((step, i) => step.classList.toggle('is-current', i === index));
        document.querySelector('#method-current').textContent = `0${index + 1}`;
        document.querySelector('#method-word').textContent = t(`method.word${index}`);
      }
      const first = steps[0].getBoundingClientRect().top;
      const last = steps.at(-1).getBoundingClientRect().bottom;
      const amount = Math.max(0.05, Math.min(1, (position - first) / (last - first)));
      method.style.setProperty('--method-progress', reduced ? (index + 1) / 3 : amount);
    }
    const practiceRect = practice.getBoundingClientRect();
    header.classList.toggle('over-sections', practiceRect.top < headerCenter);
    if (practiceRect.top < height && practiceRect.bottom > 0)
      sculpture?.progress(
        Math.max(0, Math.min(1, (height - practiceRect.top) / (height + practiceRect.height))),
      );
  }
  function requestUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', requestUpdate, { passive: true, signal: signal.signal });
  window.addEventListener('resize', requestUpdate, { signal: signal.signal });
  contact.addEventListener(
    'pointermove',
    (event) => {
      if (reduced || !finePointer.matches) return;
      const rect = contact.getBoundingClientRect();
      contact.style.setProperty(
        '--magnet-x',
        `${((event.clientX - rect.left) / rect.width - 0.5) * 20}px`,
      );
      contact.style.setProperty(
        '--magnet-y',
        `${((event.clientY - rect.top) / rect.height - 0.5) * 20}px`,
      );
    },
    { signal: signal.signal },
  );
  contact.addEventListener(
    'pointerleave',
    () => {
      contact.style.setProperty('--magnet-x', '0px');
      contact.style.setProperty('--magnet-y', '0px');
    },
    { signal: signal.signal },
  );
  function refreshLanguage() {
    document.querySelector('#form-caption').textContent = t(`services.caption${selected}`);
    document.querySelector('#method-word').textContent = t(
      `method.word${Math.max(0, currentStep)}`,
    );
    requestUpdate();
  }
  update();
  refreshLanguage();
  return {
    refreshLanguage,
    setReduced(value) {
      reduced = value;
      sculpture?.setReduced(value);
      requestUpdate();
    },
    dispose() {
      signal.abort();
      cancelAnimationFrame(frame);
      formObserver.disconnect();
      revealObserver.disconnect();
      sculpture?.dispose();
    },
  };
}
