/* All benchmark values below are reported final checkpoints, never simulated. */
const configurations = {
  kmc240: { tokens: '240B', ratio: 'K:R:C = 7:0.5:0.5', names: ['MMLU', 'GSM8K', 'MATH', 'HumanEval', 'MBPP'], direct: [34.13, 29.72, 15.80, 17.68, 9.80], lare: [34.96, 46.78, 24.80, 24.39, 15.40] },
  kmc120: { tokens: '120B', ratio: 'K:R:C = 7:0.5:0.5', names: ['MMLU', 'GSM8K', 'MATH', 'HumanEval', 'MBPP'], direct: [33.52, 26.76, 13.80, 15.85, 9.40], lare: [33.53, 41.55, 20.20, 21.34, 12.20] },
  km120: { tokens: '120B', ratio: 'K:R = 7:1', names: ['MMLU', 'GSM8K', 'MATH'], direct: [33.97, 37.00, 17.20], lare: [34.36, 50.57, 25.60] },
};
const select = selector => document.querySelector(selector);
const setText = (selector, value) => { select(selector).textContent = value; };

// Slightly oversized display equations can fit without shrinking the surrounding prose.
function fitDisplayEquations() {
  const displays = [...document.querySelectorAll('.article-prose .katex-display')];
  if (!displays.length) return;

  let frame = 0;
  function fit() {
    frame = 0;
    displays.forEach(display => display.style.removeProperty('--fitted-math-size'));
    const scales = displays.map(display => {
      const available = display.clientWidth;
      const natural = display.querySelector('.katex').getBoundingClientRect().width;
      return available > 0 && natural > available ? Math.max(0.875, (available - 1) / natural) : 1;
    });
    displays.forEach((display, index) => {
      if (scales[index] < 1) display.style.setProperty('--fitted-math-size', scales[index] + 'em');
    });
  }
  function scheduleFit() {
    if (!frame) frame = requestAnimationFrame(fit);
  }
  if (window.ResizeObserver) {
    const widths = new WeakMap();
    const observer = new ResizeObserver(entries => {
      for (const { target, contentRect } of entries) {
        if (widths.get(target) === contentRect.width) continue;
        widths.set(target, contentRect.width);
        scheduleFit();
      }
    });
    displays.forEach(display => observer.observe(display));
  } else {
    window.addEventListener('resize', scheduleFit);
  }
  document.fonts?.ready.then(scheduleFit);
  document.fonts?.addEventListener('loadingdone', scheduleFit);
  scheduleFit();
}
fitDisplayEquations();

// Matched results use a common 0–60 accuracy scale.
function updateResults() {
  const config = configurations[select('#experiment').value];
  const previous = new Map([...document.querySelectorAll('.benchmark-row')].map(row => [row.querySelector('.benchmark-label').textContent, [...row.querySelectorAll('.benchmark-bar')].map(bar => bar.style.width)]));
  let totalGain = 0;
  const rows = [];
  config.names.forEach((name, index) => {
    const direct = config.direct[index], lare = config.lare[index], gain = lare - direct;
    totalGain += gain;
    rows.push(`<div class="benchmark-row"><span class="benchmark-label">${name}</span><div class="benchmark-track" role="img" aria-label="${name}: direct mixture ${direct.toFixed(2)} percent, LARE ${lare.toFixed(2)} percent"><div class="benchmark-bar baseline" data-previous-width="${previous.get(name)?.[0] || '0%'}" style="width:${direct / 60 * 100}%"><span class="benchmark-value">${direct.toFixed(2)}</span></div><div class="benchmark-bar lare" data-previous-width="${previous.get(name)?.[1] || '0%'}" style="width:${lare / 60 * 100}%"><span class="benchmark-value">${lare.toFixed(2)}</span></div></div><span class="benchmark-gain">+${gain.toFixed(2)}<small> pp</small></span></div>`);
  });
  select('#benchmark-chart').innerHTML = `${rows.join('')}<div class="benchmark-axis" aria-hidden="true"><span></span><div><span>0</span><span>20</span><span>40</span><span>60</span></div><span></span></div>`;
  setText('#result-config', `${config.ratio} · ${config.tokens} tokens`);
  setText('#result-average', `+${(totalGain / config.names.length).toFixed(2)} pp`);
  window.dispatchEvent(new Event('lare:results'));
}
const experiment = select('#experiment');
experiment.disabled = false;
experiment.addEventListener('change', updateResults);
if (experiment.value !== 'km120') updateResults();

// Select the citation for manual copying when clipboard access is unavailable.
const copyCitation = select('#copy-citation');
copyCitation.hidden = false;
copyCitation.addEventListener('click', async () => {
  copyCitation.disabled = true;
  setText('#copy-status', '');
  try {
    await navigator.clipboard.writeText(select('#bibtex').textContent);
    setText('#copy-status', 'BibTeX copied.');
  } catch {
    const range = document.createRange();
    range.selectNodeContents(select('#bibtex'));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    setText('#copy-status', 'BibTeX selected. Please copy it manually.');
  } finally {
    copyCitation.disabled = false;
  }
});

// Keep reading position visible without adding a fixed navigation bar.
// Keep the contents compact on first mobile load. The language
// switch restores the user's open/closed state after load in i18n.js.
if (matchMedia('(max-width: 900px)').matches) select('#contents').open = false;
const tocLinks = [...document.querySelectorAll('.article-toc nav a')];
const sections = tocLinks.map(link => select(link.getAttribute('href')));
let pendingFrame = false;
function updateReadingPosition() {
  const available = document.documentElement.scrollHeight - window.innerHeight;
  select('#reading-progress').style.transform = `scaleX(${available > 0 ? Math.max(0, Math.min(1, window.scrollY / available)) : 0})`;
  let current = 0;
  sections.forEach((section, index) => { if (section.getBoundingClientRect().top <= 160) current = index; });
  tocLinks.forEach((link, index) => {
    if (index === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  pendingFrame = false;
}
function scheduleReadingUpdate() { if (!pendingFrame) { pendingFrame = true; requestAnimationFrame(updateReadingPosition); } }
window.addEventListener('scroll', scheduleReadingUpdate, { passive: true });
window.addEventListener('resize', scheduleReadingUpdate);
updateReadingPosition();
