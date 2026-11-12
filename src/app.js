/* All benchmark values below are reported final checkpoints, never simulated. */
const fixedRuns = [
  { weight: 1, mmlu: 31.40, gsm: 27.67 },
  { weight: 2, mmlu: 32.27, gsm: 38.59 },
  { weight: 3, mmlu: 32.08, gsm: 42.46 },
  { weight: 4, mmlu: 32.07, gsm: 43.29 },
  { weight: 7, mmlu: 31.19, gsm: 48.98 },
];
const adaptiveRun = { weight: 2.41, mmlu: 32.24, gsm: 39.80 };
const configurations = {
  kmc240: { tokens: '240B', ratio: 'K:R:C = 7:0.5:0.5', names: ['MMLU', 'GSM8K', 'MATH', 'HumanEval', 'MBPP'], direct: [34.13, 29.72, 15.80, 17.68, 9.80], lare: [34.96, 46.78, 24.80, 24.39, 15.40] },
  kmc120: { tokens: '120B', ratio: 'K:R:C = 7:0.5:0.5', names: ['MMLU', 'GSM8K', 'MATH', 'HumanEval', 'MBPP'], direct: [33.52, 26.76, 13.80, 15.85, 9.40], lare: [33.53, 41.55, 20.20, 21.34, 12.20] },
  km120: { tokens: '120B', ratio: 'K:R = 7:1', names: ['MMLU', 'GSM8K', 'MATH'], direct: [33.97, 37.00, 17.20], lare: [34.36, 50.57, 25.60] },
};
const select = selector => document.querySelector(selector);
const setText = (selector, value) => { select(selector).textContent = value; };

// Theme selection is shared by both language versions in theme.js.

// Experiment 1: choose actual, discrete fixed-weight runs or the online endpoint.
let recipe = 'fixed';
const weightSlider = select('#weight-slider');
let fixedIndex = Number(weightSlider.value);
const exposurePlot = select('#exposure-score-plot');
const exposureX = gsm => 61 + (gsm - 25) / 26 * 496;
const exposureY = mmlu => 219 - (mmlu - 30.9) / 1.6 * 177;
const baselineX = exposureX(fixedRuns[0].gsm);
const baselineY = exposureY(fixedRuns[0].mmlu);
const weightLabelOffsets = [[0, -14], [-10, -14], [-11, 22], [14, 22], [0, -14]];
exposurePlot.innerHTML = `
  ${[31, 31.5, 32, 32.5].map(value => {
    const y = exposureY(value);
    return `<line x1="61" y1="${y}" x2="557" y2="${y}" class="motion-grid"/>
      <text x="49" y="${y + 4}" text-anchor="end" class="motion-tick">${value}</text>`;
  }).join('')}
  ${[25, 30, 35, 40, 45, 50].map(value => {
    const x = exposureX(value);
    return `<line x1="${x}" y1="42" x2="${x}" y2="219" class="motion-grid"/>
      <text x="${x}" y="240" text-anchor="middle" class="motion-tick">${value}</text>`;
  }).join('')}
  <text x="61" y="22" class="motion-label">Knowledge · MMLU (%) ↑</text>
  <text x="309" y="263" text-anchor="middle" class="motion-label">Reasoning · GSM8K (%) →</text>
  <line x1="${baselineX}" y1="${baselineY}" x2="${baselineX}" y2="${baselineY}" class="exposure-score-shift"/>
  ${fixedRuns.map((run, index) => {
    const [dx, dy] = weightLabelOffsets[index];
    return `<g transform="translate(${exposureX(run.gsm)} ${exposureY(run.mmlu)})" class="exposure-score-point${index === 0 ? ' exposure-score-baseline' : ''}">
      <circle r="5.5"/><text x="${dx}" y="${dy}" text-anchor="middle" class="motion-tick">${run.weight}×</text>
    </g>`;
  }).join('')}
  <g class="exposure-score-adaptive" transform="translate(${exposureX(adaptiveRun.gsm)} ${exposureY(adaptiveRun.mmlu)})" hidden>
    <path d="M0 -6 6 0 0 6 -6 0Z"/><text x="13" y="3" class="motion-tick">LARE</text>
  </g>
  <circle r="10" class="exposure-score-selected"/>
`;
const exposureSelected = exposurePlot.querySelector('.exposure-score-selected');
const exposureShift = exposurePlot.querySelector('.exposure-score-shift');
const exposureAdaptive = exposurePlot.querySelector('.exposure-score-adaptive');

function updateExposure() {
  document.querySelectorAll('[data-recipe]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.recipe === recipe)));
  weightSlider.disabled = recipe !== 'fixed';
  select('#weight-control').classList.toggle('inactive', recipe !== 'fixed');
  let run, description, note;
  if (recipe === 'adaptive') {
    run = adaptiveRun;
    description = 'LARE · weights selected online';
    note = 'This run changes its weights during training. The 2.41× shown here is the final ratio.';
  } else {
    run = fixedRuns[recipe === 'direct' ? 0 : fixedIndex];
    description = run.weight === 1 ? 'Equal loss weights' : `Fixed 1:${run.weight} reweighting`;
    if (run.weight === 1) note = 'Reasoning loss weight is 1×. Both streams stay present throughout training.';
    else if (run.mmlu > 31.40) note = `At the same exposure, this run improves MMLU by +${(run.mmlu - 31.40).toFixed(2)} and GSM8K by +${(run.gsm - 27.67).toFixed(2)} percentage points over direct mixing.`;
    else note = `A larger reasoning coefficient trades some knowledge for reasoning: MMLU changes by ${(run.mmlu - 31.40).toFixed(2)} points and GSM8K by +${(run.gsm - 27.67).toFixed(2)} points.`;
  }
  const formatted = recipe === 'adaptive' ? run.weight.toFixed(2) : String(run.weight);
  setText('#math-multiplier', `×${formatted}`);
  setText('#weight-label', `K : R = 1 : ${formatted}`);
  setText('#recipe-description', description);
  setText('#explorer-mmlu', run.mmlu.toFixed(2));
  setText('#explorer-gsm', run.gsm.toFixed(2));
  setText('#recipe-note', note);
  const x = exposureX(run.gsm);
  const y = exposureY(run.mmlu);
  exposureSelected.setAttribute('cx', x);
  exposureSelected.setAttribute('cy', y);
  exposureShift.setAttribute('x2', x);
  exposureShift.setAttribute('y2', y);
  exposureAdaptive.toggleAttribute('hidden', recipe !== 'adaptive');
  weightSlider.value = recipe === 'direct' ? 0 : fixedIndex;
  weightSlider.setAttribute('aria-valuetext', `${fixedRuns[Number(weightSlider.value)].weight} times the knowledge coefficient`);
}
document.querySelectorAll('[data-recipe]').forEach(button => button.addEventListener('click', () => { recipe = button.dataset.recipe; updateExposure(); }));
weightSlider.addEventListener('input', () => { fixedIndex = Number(weightSlider.value); updateExposure(); });
updateExposure();

// Experiment 2: an explicitly illustrative, algebraic controller snapshot.
function updateRule() {
  const lossK = Number(select('#knowledge-loss').value);
  const lossM = Number(select('#math-loss').value);
  const shareK = 7 / 8, shareM = 1 / 8, epsilon = 1e-8;
  const rawK = 1 / Math.sqrt(lossK + epsilon), rawM = 1 / Math.sqrt(lossM + epsilon);
  const denominator = shareK * rawK + shareM * rawM;
  const weightK = rawK / denominator, weightM = rawM / denominator;
  setText('#knowledge-loss-value', lossK.toFixed(2));
  setText('#math-loss-value', lossM.toFixed(2));
  setText('#knowledge-weight', weightK.toFixed(3));
  setText('#math-weight', weightM.toFixed(3));
  select('#relative-weight').innerHTML = `${(weightM / weightK).toFixed(2)}<span>×</span>`;
  const contributionK = shareK * weightK * 100, contributionM = shareM * weightM * 100;
  for (const [name, value] of [['knowledge', contributionK], ['math', contributionM]]) {
    const element = select(`#${name}-influence`);
    element.style.width = `${value}%`;
    element.textContent = value < 7 ? '' : `${value.toFixed(1)}%`;
  }
  select('#influence-bar').setAttribute('aria-label', `Normalized coefficient shares: knowledge ${contributionK.toFixed(1)} percent, reasoning ${contributionM.toFixed(1)} percent.`);
  setText('#normalization-check', `Weighted mean = ${(shareK * weightK + shareM * weightM).toFixed(3)}`);
  window.dispatchEvent(new Event('lare:rule'));
}
select('#knowledge-loss').addEventListener('input', updateRule);
select('#math-loss').addEventListener('input', updateRule);
updateRule();

// Experiment 3: matched results, with a common zero-based 0–60 accuracy scale.
function updateResults() {
  const config = configurations[select('#experiment').value];
  const previous = new Map([...document.querySelectorAll('.benchmark-row')].map(row => [row.querySelector('.benchmark-label').textContent, [...row.querySelectorAll('.benchmark-bar')].map(bar => bar.style.width)]));
  let totalGain = 0;
  const rows = [], tableRows = [];
  config.names.forEach((name, index) => {
    const direct = config.direct[index], lare = config.lare[index], gain = lare - direct;
    totalGain += gain;
    rows.push(`<div class="benchmark-row"><span class="benchmark-label">${name}</span><div class="benchmark-track" role="img" aria-label="${name}: direct mixture ${direct.toFixed(2)} percent, LARE ${lare.toFixed(2)} percent"><div class="benchmark-bar baseline" data-previous-width="${previous.get(name)?.[0] || '0%'}" style="width:${direct / 60 * 100}%"><span class="benchmark-value">${direct.toFixed(2)}</span></div><div class="benchmark-bar lare" data-previous-width="${previous.get(name)?.[1] || '0%'}" style="width:${lare / 60 * 100}%"><span class="benchmark-value">${lare.toFixed(2)}</span></div></div><span class="benchmark-gain">+${gain.toFixed(2)}<small> pp</small></span></div>`);
    tableRows.push(`<tr><th scope="row">${name}</th><td>${direct.toFixed(2)}</td><td><strong>${lare.toFixed(2)}</strong></td><td>+${gain.toFixed(2)}</td></tr>`);
  });
  select('#benchmark-chart').innerHTML = `${rows.join('')}<div class="benchmark-axis" aria-hidden="true"><span></span><div><span>0</span><span>20</span><span>40</span><span>60</span></div><span></span></div>`;
  select('#results-table-body').innerHTML = tableRows.join('');
  setText('#result-config', `${config.ratio} · ${config.tokens} tokens`);
  setText('#result-average', `+${(totalGain / config.names.length).toFixed(2)} pp`);
  setText('#results-table-caption', `${config.tokens}-token matched comparison · ${config.ratio} · accuracy (%)`);
  window.dispatchEvent(new Event('lare:results'));
}
select('#experiment').addEventListener('change', updateResults);
updateResults();

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
