import { makeArt, prepareArt } from '../graphics/project-art.js';
import { getProject } from '../content/projects.js';
import { t } from '../i18n/index.js';
import { smoothRange } from '../graphics/study-unfold.js';

export function createStudyView({ getScene, isReduced }) {
  const dialog = document.querySelector('#study-dialog');
  const details = dialog.querySelector('.study-details');
  const discover = dialog.querySelector('#study-discover');
  let currentIndex = 0;
  let source = null,
    closing = false,
    animated = false,
    returnFrame = 0;

  function showFallbackImage() {
    const original = dialog.querySelector('#study-art').firstElementChild;
    if (!original) return;
    const fallback = original.cloneNode();
    if (original instanceof HTMLCanvasElement) fallback.getContext('2d').drawImage(original, 0, 0);
    fallback.setAttribute('aria-hidden', 'true');
    dialog.querySelector('.study-fallback').replaceChildren(fallback);
  }

  function finishClose() {
    cancelAnimationFrame(returnFrame);
    dialog.close();
    document.body.classList.remove('modal-open', 'study-open');
    source?.focus({ preventScroll: true });
    source = null;
    closing = false;
  }

  function beginReturn() {
    dialog.dataset.state = 'closing';
    if (animated) getScene().closeStudy();
    else finishClose();
  }

  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    details.inert = true;
    discover.disabled = true;
    // Bring the image back into view before it rejoins the ribbon.
    const initialScroll = dialog.scrollTop;
    if (initialScroll < 2 || isReduced()) {
      dialog.scrollTop = 0;
      beginReturn();
      return;
    }
    let start = null;
    function returnToImage(now) {
      start ??= now;
      const t = Math.min(1, (now - start) / 360);
      dialog.scrollTop = initialScroll * (1 - smoothRange(0, 1, t));
      if (t < 1) returnFrame = requestAnimationFrame(returnToImage);
      else beginReturn();
    }
    returnFrame = requestAnimationFrame(returnToImage);
  }

  dialog
    .querySelectorAll('[data-study-close]')
    .forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  discover.addEventListener('click', () => {
    details.inert = false;
    dialog.scrollTo({ top: details.offsetTop, behavior: isReduced() ? 'instant' : 'smooth' });
  });

  function setProgress(value) {
    if (!dialog.open) return;
    dialog.style.setProperty('--study-reveal', smoothRange(0.35, 1, value));
    if (!closing) dialog.dataset.state = value > 0.68 ? 'revealed' : 'opening';
    const complete = value === 1 && !closing;
    dialog.setAttribute('aria-busy', String(!complete));
    dialog.classList.toggle('study-ready', complete);
    details.inert = !complete;
    discover.disabled = !complete;
    // Reveal the gallery controls only as the surface returns to its place.
    document.body.style.setProperty('--study-cover', smoothRange(0, 0.28, value));
  }

  function renderContent(index) {
    const study = getProject(index);
    dialog.querySelector('#study-title').textContent = study.title;
    dialog.querySelector('#study-number').textContent = t('project.number', {
      number: `0${index + 1}`,
    });
    dialog.querySelector('#study-category').textContent = study.category.slice(5);
    dialog.querySelector('#study-description').textContent = study.description;
    dialog.querySelector('#study-intention').textContent = study.intention;
    dialog.querySelector('#study-detail-copy').textContent = study.detail;
    dialog.querySelector('#study-discipline').textContent = study.discipline;
    dialog.querySelector('#study-context').textContent = study.context;
    dialog.querySelector('#study-stack').textContent = study.stack.join(' · ');
    dialog.querySelector('#study-caption').textContent = study.caption;
    dialog.querySelector('#study-note').textContent = study.note;
    const link = dialog.querySelector('#study-project-link');
    link.hidden = !study.link;
    if (study.link) {
      link.href = study.link.url;
      link.textContent = study.link.label;
    } else {
      link.removeAttribute('href');
      link.textContent = '';
    }
    const featureList = dialog.querySelector('#study-features');
    featureList.replaceChildren(
      ...study.features.map(([title, copy], featureIndex) => {
        const item = document.createElement('article');
        const number = document.createElement('span');
        number.textContent = `0${featureIndex + 1}`;
        const heading = document.createElement('h4');
        heading.textContent = title;
        const paragraph = document.createElement('p');
        paragraph.textContent = copy;
        item.append(number, heading, paragraph);
        return item;
      }),
    );
    const secondary = dialog.querySelector('#study-secondary');
    secondary.hidden = !study.secondary;
    const secondaryImage = dialog.querySelector('#study-secondary-image');
    if (study.secondary) {
      secondaryImage.src = study.secondary;
      secondaryImage.alt = study.secondaryAlt;
      dialog.querySelector('#study-secondary-caption').textContent = study.secondaryCaption;
    } else secondaryImage.removeAttribute('src');
    dialog.querySelector('#study-evidence').hidden = !study.terminal;
    dialog.querySelector('#study-evidence-title').textContent = study.terminalTitle ?? '';
    dialog.querySelector('#study-terminal').textContent = study.terminal ?? '';
    dialog.querySelector('#study-terminal-caption').textContent = study.terminalCaption ?? '';
    dialog.querySelector('#study-index').textContent = `0${index + 1}`;
    const art = dialog.querySelector('#study-art');
    art.replaceChildren();
    const visual = makeArt(study.id);
    visual.setAttribute('role', 'img');
    visual.setAttribute('aria-label', study.imageAlt);
    art.append(visual);
  }

  return {
    refreshLanguage() {
      if (dialog.open) {
        renderContent(currentIndex);
        if (!animated) showFallbackImage();
      }
    },
    open(index, trigger, slot) {
      if (dialog.open) return;
      source = trigger;
      closing = false;
      currentIndex = index;
      renderContent(index);
      const visual = dialog.querySelector('#study-art').firstElementChild;
      dialog.querySelector('.study-fallback').replaceChildren();
      animated = Boolean(getScene()?.openStudy(index, slot));
      if (!animated) showFallbackImage();
      dialog.dataset.state = 'opening';
      dialog.classList.toggle('study-static', !animated);
      dialog.showModal();
      dialog.scrollTop = 0;
      document.body.classList.add('modal-open', 'study-open');
      setProgress(animated ? 0 : 1);
      prepareArt().then(() => {
        if (
          dialog.open &&
          !animated &&
          dialog.querySelector('#study-art').firstElementChild === visual
        )
          showFallbackImage();
      });
    },
    setProgress,
    finishClose,
    // WebGL failure must leave a readable, closable project view.
    useFallback() {
      if (!dialog.open) return;
      getScene()?.abortStudy();
      animated = false;
      if (closing) {
        finishClose();
        return;
      }
      showFallbackImage();
      dialog.classList.add('study-static');
      setProgress(1);
    },
  };
}
