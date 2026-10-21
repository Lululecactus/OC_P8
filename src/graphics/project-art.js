import optimizerEvidence from '../content/optimizer-evidence.json' with { type: 'json' };
import { projects as studies } from '../content/projects.js';
import { t } from '../i18n/index.js';

const canvases = new Map();
let preparation;
const WIDTH = 1500,
  HEIGHT = 960;
function baseCanvas(id) {
  if (!canvases.has(id)) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvases.set(id, canvas);
  }
  return canvases.get(id);
}

function drawOptimizer(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#102d34';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#a5c0bc';
  ctx.font = '21px Manrope, sans-serif';
  ctx.fillText(t('art.constraint'), 75, 85);
  ctx.textAlign = 'right';
  ctx.fillText('PYTHON / 004', 1425, 85);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e9e3d2';
  ctx.font = '210px Georgia, serif';
  ctx.fillText('500', 68, 398);
  ctx.font = 'italic 65px Georgia, serif';
  ctx.fillText('€', 407, 398);
  ctx.font = '24px Manrope, sans-serif';
  ctx.fillStyle = '#b5c5be';
  ctx.fillText(t('art.budgetLine'), 78, 465);
  ctx.fillText(t('art.combination'), 78, 501);
  const left = 635,
    right = 1410,
    top = 220,
    bottom = 700;
  ctx.strokeStyle = '#ffffff16';
  ctx.lineWidth = 1;
  ctx.font = '16px Manrope, sans-serif';
  ctx.fillStyle = '#789a98';
  for (let i = 0; i <= 4; i++) {
    const y = bottom - ((bottom - top) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(`${i * 50}`, left - 42, y + 5);
  }
  const points = optimizerEvidence.frontier.map(([budget, gain]) => [
    left + (budget / 500) * (right - left),
    bottom - (gain / 200) * (bottom - top),
  ]);
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, '#c5b78938');
  gradient.addColorStop(1, '#c5b78900');
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  points.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(right, bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = '#d4c69c';
  ctx.lineWidth = 3;
  ctx.stroke();
  points
    .filter((_, i) => i % 5 === 0)
    .forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#e7dbc0';
      ctx.fill();
    });
  ctx.fillStyle = '#a5c0bc';
  ctx.fillText('0', left, bottom + 35);
  ctx.textAlign = 'right';
  ctx.fillText(t('art.budget'), right, bottom + 35);
  ctx.textAlign = 'left';
  ctx.font = '17px Manrope, sans-serif';
  ctx.fillText(t('art.gain'), left, top - 38);
  ctx.strokeStyle = '#b0c4bf44';
  ctx.beginPath();
  ctx.moveTo(75, 780);
  ctx.lineTo(1425, 780);
  ctx.stroke();
  ctx.fillStyle = '#e0e5dc';
  ctx.font = '25px Manrope, sans-serif';
  ctx.fillText(t('art.valid'), 75, 835);
  ctx.fillText(t('art.selected'), 560, 835);
  ctx.fillText(t('art.allocated'), 1060, 835);
}

export function makeArt(id) {
  return baseCanvas(id);
}
export function prepareArt() {
  preparation ??= Promise.all(
    studies.map(async (study) => {
      const canvas = baseCanvas(study.id),
        ctx = canvas.getContext('2d');
      if (study.id === 'optimizer') {
        drawOptimizer(canvas);
        return;
      }
      ctx.fillStyle = study.id === 'sunday' ? '#e8edf2' : '#d5cabc';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const image = new Image();
      image.src = study.image;
      try {
        await image.decode();
        if (study.id === 'sunday') {
          // Frame the full interface without cropping the sidebar or controls.
          const w = 1400,
            h = (w / image.width) * image.height;
          ctx.drawImage(image, 50, (HEIGHT - h) / 2 - 12, w, h);
        } else {
          const ratio = Math.max(WIDTH / image.width, HEIGHT / image.height);
          ctx.drawImage(
            image,
            (WIDTH - image.width * ratio) / 2,
            (HEIGHT - image.height * ratio) / 2,
            image.width * ratio,
            image.height * ratio,
          );
        }
      } catch {
        ctx.fillStyle = '#252c28';
        ctx.font = '70px Manrope, sans-serif';
        ctx.fillText(study.title, 80, 450);
        ctx.font = '24px Manrope, sans-serif';
        ctx.fillText(t('art.unavailable'), 80, 510);
      }
    }),
  );
  return preparation;
}

export function refreshArtLanguage() {
  drawOptimizer(baseCanvas('optimizer'));
}
