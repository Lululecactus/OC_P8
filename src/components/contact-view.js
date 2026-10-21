import { t, onLanguageChange } from '../i18n/index.js';

/** Full-screen contact reveal. Native dialog retains focus trapping and inertness. */
export function createContactView({ isReduced }) {
  const dialog = document.querySelector('#contact-dialog');
  const surface = dialog.querySelector('.contact-surface');
  const sheet = dialog.querySelector('.contact-sheet');
  const lines = [...dialog.querySelectorAll('.contact-line>span')];
  const details = [...dialog.querySelectorAll('[data-contact-reveal]')];
  const email = dialog.querySelector('[data-contact-email]');
  const copyButton = dialog.querySelector('[data-copy-email]');
  const copyStatus = dialog.querySelector('#contact-copy-status');
  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true;
    copyStatus.textContent = '';
    try {
      await navigator.clipboard.writeText(email.textContent.trim());
      copyStatus.textContent = t('contact.copied');
    } catch {
      // Leave the visible mail link selectable when clipboard access is unavailable.
      copyStatus.textContent = t('contact.copyFailed');
    } finally {
      copyButton.disabled = false;
    }
  });
  onLanguageChange(() => {
    copyStatus.textContent = '';
  });

  let state = 'closed',
    trigger = null,
    origin = { x: 0, y: 0 },
    reveal = null,
    animations = [];
  const easing = 'cubic-bezier(.76,0,.24,1)';
  function circle(radius) {
    return `circle(${radius}px at ${origin.x}px ${origin.y}px)`;
  }
  function stopAnimations() {
    reveal?.cancel();
    reveal = null;
    animations.forEach((animation) => animation.cancel());
    animations = [];
  }
  function clean() {
    stopAnimations();
    state = 'closed';
    copyStatus.textContent = '';
    surface.style.clipPath = '';
    sheet.style.opacity = '';
    document.body.classList.remove('modal-open', 'contact-active');
    trigger?.focus({ preventScroll: true });
    trigger = null;
  }
  function open(source) {
    if (state !== 'closed') return;
    trigger = source;
    const rect = source.getBoundingClientRect();
    origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    state = 'opening';
    surface.style.clipPath = circle(0);
    dialog.showModal();
    dialog.scrollTop = 0;
    sheet.scrollTop = 0;
    document.body.classList.add('modal-open', 'contact-active');
    if (isReduced()) {
      surface.style.clipPath = 'none';
      state = 'open';
      return;
    }
    reveal = surface.animate(
      [{ clipPath: circle(0) }, { clipPath: circle(Math.hypot(innerWidth, innerHeight) * 1.05) }],
      { duration: 950, easing, fill: 'forwards' },
    );
    lines.forEach((line, i) =>
      animations.push(
        line.animate(
          [
            { transform: 'translateY(115%) rotate(3deg)' },
            { transform: 'translateY(0) rotate(0deg)' },
          ],
          {
            duration: 1000,
            delay: 250 + i * 100,
            easing: 'cubic-bezier(.16,1,.3,1)',
            fill: 'both',
          },
        ),
      ),
    );
    details.forEach((detail, i) =>
      animations.push(
        detail.animate(
          [
            { opacity: 0, transform: 'translateY(22px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 650, delay: 350 + i * 90, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
        ),
      ),
    );
    reveal.finished
      .then(() => {
        if (state === 'opening') {
          state = 'open';
          surface.style.clipPath = 'none';
          reveal.cancel();
          reveal = null;
        }
      })
      .catch(() => {});
  }
  function close() {
    if (state === 'closed' || state === 'closing') return;
    state = 'closing';
    if (isReduced()) {
      dialog.close();
      return;
    }
    const current = getComputedStyle(surface).clipPath;
    reveal?.cancel();
    surface.style.clipPath = current;
    // Fade the interior within the closing iris; keep its current reveal positions.
    animations.push(
      sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }),
    );
    const rect = trigger?.getBoundingClientRect();
    if (rect) origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    reveal = surface.animate(
      [
        {
          clipPath:
            current === 'none' ? circle(Math.hypot(innerWidth, innerHeight) * 1.05) : current,
        },
        { clipPath: circle(0) },
      ],
      { duration: 650, easing, fill: 'forwards' },
    );
    reveal.finished
      .then(() => {
        if (state === 'closing') dialog.close();
      })
      .catch(() => {});
  }
  dialog.querySelector('[data-contact-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', clean);
  return {
    open,
    setReduced() {
      if (!isReduced() || state === 'closed') return;
      if (state === 'closing') dialog.close();
      else {
        stopAnimations();
        surface.style.clipPath = 'none';
        state = 'open';
      }
    },
  };
}
