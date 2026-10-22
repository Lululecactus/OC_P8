import './styles/base.css';
import './styles/sections.css';
import './styles/contact.css';
import './styles/language.css';
import { createScene } from './graphics/scene.js';
import { projects as studies, getProject } from './content/projects.js';
import { initializeLanguage, onLanguageChange, t } from './i18n/index.js';
import { createStudyView } from './components/project-view.js';
import { createSections } from './components/sections.js';
import { createContactView } from './components/contact-view.js';
import { createLiquidButtons } from './components/liquid-buttons.js';

initializeLanguage();

const stage = document.querySelector('.stage'),
  canvas = document.querySelector('#scene');
const intro = document.querySelector('.intro'),
  tools = document.querySelector('.sculpture-tools');
const gallery = document.querySelector('.gallery-ui'),
  cue = document.querySelector('.scroll-cue'),
  status = document.querySelector('#scene-status');
const media = matchMedia('(prefers-reduced-motion: reduce)');
let manualReduced = false;
try {
  manualReduced = localStorage.getItem('presence-motion') === 'off';
} catch {
  /* Preference storage is optional. */
}
let reduced = manualReduced || media.matches,
  scene = null,
  split = false,
  activeStudy = 0,
  progress = 0,
  scrollFrame = 0,
  trigger = null;
const studyView = createStudyView({ getScene: () => scene, isReduced: () => reduced });
const sections = createSections({ reduced });
const contactView = createContactView({ isReduced: () => reduced });
const liquidButtons = createLiquidButtons({ reduced });
const motionButton = document.querySelector('#motion-toggle');
function updateMotion() {
  reduced = manualReduced || media.matches;
  document.documentElement.classList.toggle('motion-off', reduced);
  motionButton.innerHTML = `${t(media.matches ? 'motion.reduced' : reduced ? 'motion.off' : 'motion.on')} <i aria-hidden="true"></i>`;
  motionButton.setAttribute('aria-pressed', String(reduced));
  motionButton.setAttribute(
    'aria-label',
    t(media.matches ? 'motion.system' : reduced ? 'motion.enable' : 'motion.disable'),
  );
  scene?.setReduced(reduced);
  motionButton.disabled = media.matches;
  sections.setReduced(reduced);
  contactView.setReduced();
  liquidButtons.setReduced(reduced);
}
motionButton.addEventListener('click', () => {
  manualReduced = !manualReduced;
  try {
    localStorage.setItem('presence-motion', manualReduced ? 'off' : 'on');
  } catch {
    /* Optional. */
  }
  updateMotion();
});
media.addEventListener('change', updateMotion);
updateMotion();
function updateStudy(index) {
  activeStudy = index;
  const study = getProject(index);
  document.querySelector('#project-category').textContent = study.category;
  document.querySelector('#project-title').textContent = study.title;
  const total = String(studies.length).padStart(2, '0'),
    number = String(index + 1).padStart(2, '0');
  document.querySelector('#project-count').textContent = `${number} / ${total}`;
  document.querySelector('#gallery-position').textContent = `${number} — ${total}`;
  document.querySelector('#work-count').textContent = total;
  document
    .querySelector('#project-open')
    .setAttribute('aria-label', t('gallery.exploreLabel', { title: study.title }));
}
function updateScroll() {
  scrollFrame = 0;
  progress = Math.max(0, scrollY / innerHeight);
  const introFade = Math.max(0, 1 - progress / 0.65);
  intro.style.opacity = introFade;
  intro.style.transform = `translateY(${-progress * 40}px)`;
  intro.inert = introFade < 0.05;
  tools.style.opacity = introFade;
  tools.inert = introFade < 0.05;
  gallery.hidden = !(progress > 0.75 && progress < 3.8);
  gallery.style.opacity = Math.min(1, Math.max(0, (progress - 0.75) / 0.35));
  cue.style.opacity = progress > 0.5 ? '0' : '1';
  cue.inert = progress > 0.5;
  document.querySelector('.stage-caption').textContent = t(
    progress > 0.8 ? 'gallery.caption' : 'scene.caption',
  );
  document.querySelector('.stage-caption').classList.toggle('is-available', progress <= 0.8);
  const index = Math.round(
    Math.min(studies.length - 1, Math.max(0, ((progress - 1.1) / 2) * (studies.length - 1))),
  );
  if (!scene && index !== activeStudy) updateStudy(index);
  scene?.setProgress(progress);
  canvas.setAttribute(
    'aria-label',
    t(progress > 0.75 ? 'scene.galleryLabel' : 'scene.sculptureLabel'),
  );
}
window.addEventListener(
  'scroll',
  () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  },
  { passive: true },
);
window.addEventListener('resize', updateScroll);
function navigateStudy(direction) {
  if (scene) scene.navigateGallery(direction);
  else {
    const index = (activeStudy + direction + studies.length) % studies.length;
    updateStudy(index);
  }
}
document.querySelector('#previous').addEventListener('click', () => navigateStudy(-1));
document.querySelector('#next').addEventListener('click', () => navigateStudy(1));
canvas.addEventListener('keydown', (event) => {
  if (progress > 0.75 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    navigateStudy(event.key === 'ArrowLeft' ? -1 : 1);
  }
  if (progress > 0.75 && event.key === 'Enter') {
    event.preventDefault();
    openStudy(activeStudy, canvas);
  }
});
document.querySelector('#sculpture-mode').addEventListener('click', (event) => {
  split = !split;
  event.currentTarget.setAttribute('aria-pressed', String(split));
  event.currentTarget.innerHTML = `<span class="split-icon" aria-hidden="true">Ⅲ</span> ${t(split ? 'sculpture.join' : 'sculpture.split')}`;
  scene?.setSplit(split);
});
document.querySelector('#turn-left').addEventListener('click', () => scene?.turn(-0.3));
document.querySelector('#turn-right').addEventListener('click', () => scene?.turn(0.3));
function openDialog(id, source) {
  trigger = source;
  document.querySelector(id).showModal();
  document.body.classList.add('modal-open');
}
function openStudy(index, source, slot) {
  studyView.open(index, source, slot);
}
document
  .querySelector('#project-open')
  .addEventListener('click', (event) => openStudy(activeStudy, event.currentTarget));
document
  .querySelector('#about-open')
  .addEventListener('click', () =>
    document.querySelector('#about').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }),
  );
document
  .querySelector('#credits-open')
  .addEventListener('click', (event) => openDialog('#credits-dialog', event.currentTarget));
document
  .querySelectorAll('#contact-open, [data-open-contact]')
  .forEach((button) =>
    button.addEventListener('click', (event) => contactView.open(event.currentTarget)),
  );
document.querySelectorAll('#credits-dialog').forEach((dialog) => {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const r = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    trigger?.focus({ preventScroll: true });
  });
});
function refreshLanguage() {
  updateStudy(activeStudy);
  updateMotion();
  updateScroll();
  document.querySelector('#sculpture-mode').innerHTML =
    `<span class="split-icon" aria-hidden="true">Ⅲ</span> ${t(split ? 'sculpture.join' : 'sculpture.split')}`;
  status.textContent = stage.classList.contains('scene-failed')
    ? t('scene.failure')
    : canvas.dataset.ready
      ? ''
      : t('scene.loading');
  sections.refreshLanguage();
  scene?.refreshLanguage();
  studyView.refreshLanguage();
}
onLanguageChange(refreshLanguage);
refreshLanguage();
await document.fonts.ready;
try {
  scene = await createScene(canvas, {
    reduced,
    onActiveStudy: updateStudy,
    onReady() {
      stage.classList.remove('scene-failed');
      status.textContent = '';
    },
    onFailure() {
      stage.classList.add('scene-failed');
      status.textContent = t('scene.failure');
      studyView.useFallback();
    },
    onOpenStudy(index, slot) {
      openStudy(index, canvas, slot);
    },
    onStudyProgress: studyView.setProgress,
    onStudyClosed: studyView.finishClose,
  });
  scene?.setSplit(split);
  scene?.setReduced(reduced);
  refreshLanguage();
} catch (error) {
  stage.classList.add('scene-failed');
  status.textContent = t('scene.failure');
  console.warn('Scene initialization failed.', error);
}
