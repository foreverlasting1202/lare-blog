/* Observed Muon log histories. Numeric readouts never invent intermediate evaluations. */
(() => {
  const data = window.LARE_TRAINING_DATA;
  if (!data) return;
  const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const players = [];
  const x = tokens => 60 + tokens / 30 * 600;
  const tokensAtStep = step => step * data.tokensPerStep / 1e9;
  function lastIndexAtOrBefore(length, valueAtIndex, step) {
    let lo = 0, hi = length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (valueAtIndex(mid) <= step) lo = mid + 1; else hi = mid;
    }
    return lo - 1;
  }
  function checkpointAt(run, step) {
    return run.checkpoints[lastIndexAtOrBefore(run.checkpoints.length, index => run.checkpoints[index].step, step)];
  }
  function ratioAt(step) {
    const index = lastIndexAtOrBefore(data.weightRatioSteps.length, index => data.weightRatioSteps[index], step);
    return index < 0 ? null : { tokensB: data.weightRatio[index][0], ratio: data.weightRatio[index][1], step: data.weightRatioSteps[index] };
  }
  function localPoint(svg, event) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  }
  function bindDrag(svg, onMove, accept) {
    let dragging = false;
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const point = localPoint(svg, event);
      if (!accept(point)) return;
      dragging = true; svg.setPointerCapture(event.pointerId);
      svg.classList.add('is-dragging'); onMove(point);
    });
    svg.addEventListener('pointermove', event => { if (dragging) onMove(localPoint(svg, event)); });
    const stop = () => { dragging = false; svg.classList.remove('is-dragging'); };
    svg.addEventListener('pointerup', stop); svg.addEventListener('pointercancel', stop);
    svg.addEventListener('lostpointercapture', stop);
  }
  for (const figure of document.querySelectorAll('[data-history]')) {
    const mode = figure.dataset.history;
    const stage = mode === 'stage';
    const series = stage ? data.stage : data.adaptive;
    const keys = Object.keys(series);
    const svg = figure.querySelector('.history-time-svg');
    const slider = figure.querySelector('[data-history-progress]');
    slider.max = data.totalSteps;
    const play = figure.querySelector('[data-history-play]');
    const prefix = `${mode}-logged`;
    const panels = stage ? [
      { metric: 'gsm8k', title: 'Reasoning · GSM8K (%)', top: 42, bottom: 158, min: 0, max: 42, ticks: [0, 10, 20, 30, 40] },
      { metric: 'mmlu', title: 'Knowledge · MMLU (%)', top: 224, bottom: 340, min: 24, max: 34.5, ticks: [24, 28, 32, 34] },
    ] : [
      { metric: 'mmlu', title: 'Knowledge · MMLU (%)', top: 40, bottom: 128, min: 24, max: 33, ticks: [24, 28, 32] },
      { metric: 'gsm8k', title: 'Reasoning · GSM8K (%)', top: 200, bottom: 288, min: 0, max: 52, ticks: [0, 20, 40, 50] },
      { metric: 'ratio', title: 'Relative loss weight · reasoning / knowledge', top: 360, bottom: 448, min: .8, max: 3.2, ticks: [1, 2, 3] },
    ];
    const y = (panel, value) => panel.bottom - (value - panel.min) / (panel.max - panel.min) * (panel.bottom - panel.top);
    const drawPath = (panel, points) => points.map(([tokens, value], index) => `${index ? 'L' : 'M'}${x(tokens).toFixed(2)} ${y(panel, value).toFixed(2)}`).join(' ');
    const finalBottom = panels.at(-1).bottom;
    const moments = stage ? {
      switch: { run: 'mk', step: series.mk.stageTransitions[0].step },
      'staged-end': { run: 'mk', step: data.totalSteps },
      'reweighted-end': { run: 'fixed2', step: data.totalSteps },
    } : {};
    const momentButtons = figure.querySelectorAll('[data-history-moment]');
    const referenceSelect = figure.querySelector('#history-reference');
    const predictionForm = figure.querySelector('#stage-prediction');
    const predictionState = predictionForm?.querySelector('#stage-prediction-state');
    const predictionOptions = predictionForm?.querySelector('fieldset');
    const predictionButton = predictionForm?.querySelector('button[type="submit"]');
    const predictionResult = predictionForm?.querySelector('.prediction-result');
    const afterPrediction = predictionForm ? figure.closest('section').querySelectorAll('[data-after-prediction]') : [];
    let predictionPhase = 'waiting';
    let prediction = '';
    const canExplore = () => !predictionForm || predictionPhase === 'revealed';
    let selected = stage ? moments.switch.run : 'lare';
    let reference = referenceSelect?.value;
    slider.value = stage ? moments.switch.step : Math.round(Number(slider.dataset.initialTokens) / (data.tokensPerStep / 1e9));
    let playing = false, frame = 0, lastTime = 0;

    svg.innerHTML = `<defs><clipPath id="${prefix}-past"><rect data-history-clip x="60" y="0" width="0" height="${finalBottom + 5}"/></clipPath></defs>
      ${panels.map(panel => {
        const grids = panel.ticks.map(tick => `<line x1="60" x2="660" y1="${y(panel, tick)}" y2="${y(panel, tick)}" class="motion-grid"/><text x="48" y="${y(panel, tick) + 4}" text-anchor="end" class="motion-tick">${tick}</text>`).join('');
        const verticals = [0, 5, 10, 15, 20, 25, 30].map(tick => `<line x1="${x(tick)}" x2="${x(tick)}" y1="${panel.top}" y2="${panel.bottom}" class="motion-grid"/>`).join('');
        const curves = panel.metric === 'ratio'
          ? `<g class="history-ratio-references">${[2, 3].map(weight => `<path d="${drawPath(panel, [[0, 1], [data.warmupTokensB, 1], [data.warmupTokensB, weight], [data.actualTokensB, weight]])}" class="history-weight-reference"/><text x="651" y="${y(panel, weight) - 5}" text-anchor="end" class="motion-small">fixed 1:${weight}</text>`).join('')}</g><g class="history-curve history-lare history-selected" data-curve-key="lare" data-panel-metric="ratio"><path d="${drawPath(panel, data.weightRatioDisplay)}" class="history-ghost"/><path d="${drawPath(panel, data.weightRatioDisplay)}" class="history-revealed" clip-path="url(#${prefix}-past)"/><circle r="4.7" class="history-current-marker"/></g>`
          : keys.map(key => `<g class="history-curve history-${key}" data-curve-key="${key}" data-panel-metric="${panel.metric}"><path d="${drawPath(panel, series[key][panel.metric])}" class="history-ghost"/><path d="${drawPath(panel, series[key][panel.metric])}" class="history-revealed" clip-path="url(#${prefix}-past)"/><circle r="4.7" class="history-current-marker"/></g>`).join('');
        const warmupBand = stage ? '' : `<rect x="60" y="${panel.top}" width="${x(data.warmupTokensB) - 60}" height="${panel.bottom - panel.top}" class="history-warmup-band"/>`;
        return `<g data-history-panel="${panel.metric}"><text x="60" y="${panel.top - 17}" class="motion-label history-panel-title">${panel.title}</text>${warmupBand}${grids}${verticals}${curves}</g>`;
      }).join('')}
      <g data-history-boundary><line y1="${panels[0].top - 1}" y2="${finalBottom}" class="history-boundary"/><text y="${panels[0].top + 14}" class="history-boundary-label"></text></g>
      ${[0, 5, 10, 15, 20, 25, 30].map(tick => `<text x="${x(tick)}" y="${finalBottom + 25}" text-anchor="middle" class="motion-tick">${tick}</text>`).join('')}
      <text x="360" y="${finalBottom + 47}" text-anchor="middle" class="motion-label">Sampled training tokens (billions) →</text>
      <g data-history-cursor><line y1="${panels[0].top - 1}" y2="${finalBottom + 4}" class="history-cursor-line"/><rect x="-3" y="${panels[0].top - 1}" width="6" height="${finalBottom - panels[0].top + 4}" class="history-cursor-band"/><circle cy="${finalBottom + 4}" r="6" class="scrub-handle"/><rect x="-15" y="${panels[0].top - 5}" width="30" height="${finalBottom - panels[0].top + 20}" fill="transparent" class="drag-hit"/></g>`;

    // Paired evaluations share an actual checkpoint step in both coordinates.
    const plane = stage ? figure.querySelector('.history-plane-svg') : null;
    const planeX = gsm => 60 + gsm / 50 * 600;
    const planeY = mmlu => 232 - (mmlu - 24) / 10.5 * 188;
    const trajectory = {};
    if (plane) {
      for (const key of keys) {
        trajectory[key] = series[key].checkpoints.map(point => [point.step, point.tokensB, point.gsm8k, point.mmlu]);
      }
      plane.innerHTML = `${[24, 28, 32, 34].map(tick => `<line x1="60" x2="660" y1="${planeY(tick)}" y2="${planeY(tick)}" class="motion-grid"/><text x="48" y="${planeY(tick) + 4}" text-anchor="end" class="motion-tick">${tick}</text>`).join('')}
        ${[0, 10, 20, 30, 40, 50].map(tick => `<line x1="${planeX(tick)}" x2="${planeX(tick)}" y1="35" y2="232" class="motion-grid"/><text x="${planeX(tick)}" y="257" text-anchor="middle" class="motion-tick">${tick}</text>`).join('')}
        <text x="60" y="19" class="motion-label">Knowledge · MMLU (%) ↑</text><text x="360" y="281" text-anchor="middle" class="motion-label">Reasoning · GSM8K (%) →</text>
        ${keys.map(key => `<g data-plane-run="${key}" class="history-${key}"><path d="${trajectory[key].map(([, , gsm, mmlu], index) => `${index ? 'L' : 'M'}${planeX(gsm).toFixed(2)} ${planeY(mmlu).toFixed(2)}`).join(' ')}" class="history-plane-ghost"/></g>`).join('')}
        <path data-plane-trace class="history-plane-trace"/><g data-plane-marker><circle r="14" class="history-plane-halo"/><circle r="5.5" class="history-plane-dot"/><circle r="23" fill="transparent" class="drag-hit"/></g>`;
    }

    function update() {
      const step = Number(slider.value);
      const tokens = tokensAtStep(step);
      const current = series[selected];
      const observed = Object.fromEntries(keys.map(key => [key, checkpointAt(series[key], step)]));
      const weight = ratioAt(step);
      svg.querySelector('[data-history-clip]').setAttribute('width', x(tokens) - 60);
      svg.querySelector('[data-history-cursor]').setAttribute('transform', `translate(${x(tokens)} 0)`);
      for (const group of svg.querySelectorAll('[data-curve-key]')) {
        const key = group.dataset.curveKey, metric = group.dataset.panelMetric;
        const isPrimary = key === selected;
        const isReference = !stage && key === reference && metric !== 'ratio';
        group.style.display = (stage && canExplore()) || isPrimary || isReference ? '' : 'none';
        group.classList.toggle('history-selected', isPrimary);
        group.classList.toggle('history-comparison-curve', isReference);
        const panel = panels.find(item => item.metric === metric);
        const point = metric === 'ratio' ? weight : observed[key];
        const marker = group.querySelector('circle');
        if (point) {
          marker.setAttribute('cx', x(point.tokensB)); marker.setAttribute('cy', y(panel, metric === 'ratio' ? point.ratio : point[metric]));
        }
        marker.style.display = point && (isPrimary || isReference) ? '' : 'none';
      }
      const put = (selector, value) => { figure.querySelector(selector).textContent = value; };
      put('[data-history-time]', `${tokens.toFixed(2)}B tokens`);
      put('[data-history-mmlu]', observed[selected].mmlu.toFixed(2));
      put('[data-history-gsm]', observed[selected].gsm8k.toFixed(2));
      const boundaryTokens = stage && current.stageTransitions.length ? current.stageTransitions[0].tokensB : data.warmupTokensB;
      const boundary = svg.querySelector('[data-history-boundary]');
      boundary.querySelector('line').setAttribute('x1', x(boundaryTokens)); boundary.querySelector('line').setAttribute('x2', x(boundaryTokens));
      const label = boundary.querySelector('text');
      label.setAttribute('x', x(boundaryTokens) - 7); label.setAttribute('text-anchor', 'end');
      label.textContent = stage && ['km', 'mk'].includes(selected) ? 'stage switch' : 'warmup ends';
      if (stage) {
        const phases = {
          km: step <= (current.stageTransitions[0]?.step || 50068) ? 'Knowledge stage · reasoning begins at 26.25B tokens' : 'Reasoning stage · follow the loss of earlier knowledge',
          mk: step <= (current.stageTransitions[0]?.step || 7152) ? 'Reasoning stage · knowledge begins at 3.75B tokens' : 'Reading ordinary text after the switch',
          direct: 'Both domains stay present · the direct mixture keeps equal loss coefficients',
          fixed2: step < data.warmupStep ? 'Warmup · unit loss coefficients' : 'Both streams stay present · reasoning loss is weighted ×2',
        };
        put('[data-history-phase]', phases[selected]);
        for (const button of figure.querySelectorAll('[data-history-run]')) button.setAttribute('aria-pressed', String(button.dataset.historyRun === selected));
        for (const button of momentButtons) {
          const moment = moments[button.dataset.historyMoment];
          button.setAttribute('aria-pressed', String(moment.run === selected && moment.step === step));
        }
        const samples = trajectory[selected].filter(point => point[0] <= step);
        const path = samples.map(([, , gsm, mmlu], index) => `${index ? 'L' : 'M'}${planeX(gsm).toFixed(2)} ${planeY(mmlu).toFixed(2)}`).join(' ');
        const trace = plane.querySelector('[data-plane-trace]');
        trace.setAttribute('d', path); trace.setAttribute('class', `history-plane-trace history-${selected}`);
        const marker = plane.querySelector('[data-plane-marker]');
        marker.setAttribute('transform', `translate(${planeX(observed[selected].gsm8k)} ${planeY(observed[selected].mmlu)})`);
        marker.setAttribute('class', `history-${selected}`);
      } else {
        put('[data-history-ratio]', weight ? weight.ratio.toFixed(3) : '—');
        put('[data-history-reference-mmlu]', `${series[reference].label}: ${observed[reference].mmlu.toFixed(2)}`);
        put('[data-history-reference-gsm]', `${series[reference].label}: ${observed[reference].gsm8k.toFixed(2)}`);
        put('[data-history-phase]', tokens <= data.warmupTokensB ? 'Learning-rate warmup · all relative loss weights remain 1' : 'LARE adapts online · follow the weight-ratio curve and capability curves together');
      }
      slider.setAttribute('aria-valuetext', `${tokens.toFixed(2)} billion training tokens`);
    }
    function updatePrediction() {
      if (!predictionForm) return;
      const revealed = predictionPhase === 'revealed';
      predictionOptions.disabled = predictionPhase !== 'waiting';
      predictionButton.disabled = predictionPhase === 'waiting' && !prediction;
      predictionButton.textContent = {
        waiting: 'Reveal the result',
        playing: 'Pause reveal',
        paused: 'Resume reveal',
        revealed: 'Make another prediction',
      }[predictionPhase];
      predictionState.value = `${predictionPhase}:${prediction}`;
      figure.classList.toggle('prediction-in-progress', !revealed);
      for (const element of afterPrediction) element.hidden = !revealed;
      if (revealed) {
        const start = checkpointAt(series.mk, moments.switch.step).gsm8k;
        const end = checkpointAt(series.mk, data.totalSteps).gsm8k;
        const matched = prediction === 'fall' ? 'You called it. ' : '';
        predictionResult.textContent = `${matched}GSM8K fell from ${start.toFixed(2)}% to ${end.toFixed(2)}%, a drop of ${(start - end).toFixed(2)} percentage points.`;
      } else {
        predictionResult.textContent = '';
      }
    }
    function stop() {
      playing = false; cancelAnimationFrame(frame);
      play.innerHTML = `<span aria-hidden="true">▶</span> ${stage ? 'Play curves' : 'Play adaptation'}`;
      play.setAttribute('aria-pressed', 'false');
      if (predictionPhase === 'playing') {
        predictionPhase = 'paused';
        updatePrediction();
      }
    }
    function tick(now) {
      if (!playing) return;
      const elapsed = Math.min(100, now - lastTime); lastTime = now;
      const revealing = predictionPhase === 'playing';
      const speed = revealing ? (data.totalSteps - moments.switch.step) / 5200 : data.totalSteps / 12000;
      const next = Math.min(data.totalSteps, Number(slider.value) + elapsed * speed);
      if (next >= data.totalSteps && revealing) {
        predictionPhase = 'revealed';
        updatePrediction();
      }
      slider.value = Math.round(next); update();
      if (next >= data.totalSteps) stop(); else frame = requestAnimationFrame(tick);
    }
    function startPlayback() {
      playing = true; lastTime = performance.now();
      if (canExplore()) {
        play.innerHTML = '<span aria-hidden="true">Ⅱ</span> Pause';
        play.setAttribute('aria-pressed', 'true');
      }
      frame = requestAnimationFrame(tick);
    }
    if (predictionForm) {
      const choices = [...predictionOptions.querySelectorAll('input[type="radio"]')];
      predictionOptions.addEventListener('change', () => {
        prediction = choices.find(choice => choice.checked)?.value || '';
        updatePrediction();
      });
      predictionForm.addEventListener('submit', event => {
        event.preventDefault();
        if (predictionPhase === 'playing') { stop(); return; }
        if (predictionPhase === 'revealed') {
          stop();
          predictionPhase = 'waiting';
          prediction = '';
          for (const choice of choices) choice.checked = false;
          selected = moments.switch.run;
          slider.value = moments.switch.step;
          updatePrediction();
          update();
          choices[0].focus({ preventScroll: true });
          return;
        }
        if (!prediction) return;
        if (reducedMotion.matches) {
          predictionPhase = 'revealed';
          slider.value = data.totalSteps;
          updatePrediction();
          update();
          return;
        }
        predictionPhase = 'playing';
        updatePrediction();
        startPlayback();
      });
      // The language switch stores the choice and checkpoint with the other controls.
      predictionState.addEventListener('input', () => {
        const [phase, guess] = predictionState.value.split(':');
        if (!['waiting', 'paused', 'playing', 'revealed'].includes(phase)) return;
        prediction = choices.some(choice => choice.value === guess) ? guess : '';
        predictionPhase = !prediction ? 'waiting' : phase === 'playing' ? 'paused' : phase;
        for (const choice of choices) choice.checked = choice.value === prediction;
        updatePrediction();
      });
      predictionForm.hidden = false;
      updatePrediction();
    }
    play.addEventListener('click', () => {
      if (!canExplore()) return;
      if (playing) { stop(); return; }
      if (Number(slider.value) >= data.totalSteps) slider.value = 0;
      startPlayback();
    });
    figure.querySelector('[data-history-reset]').addEventListener('click', () => { stop(); slider.value = 0; update(); });
    slider.addEventListener('input', () => { stop(); update(); });
    for (const button of figure.querySelectorAll('[data-history-run]')) button.addEventListener('click', () => {
      if (!canExplore()) return;
      selected = button.dataset.historyRun;
      update();
    });
    for (const button of momentButtons) button.addEventListener('click', () => {
      if (!canExplore()) return;
      const moment = moments[button.dataset.historyMoment];
      stop();
      selected = moment.run;
      slider.value = moment.step;
      update();
    });
    referenceSelect?.addEventListener('change', event => { reference = event.target.value; update(); });
    bindDrag(svg, point => {
      stop(); slider.value = Math.round(clamp((point.x - 60) / 600 * data.totalSteps, 0, data.totalSteps)); update();
    }, point => canExplore() && point.x >= 48 && point.x <= 675 && point.y >= panels[0].top - 5 && point.y <= finalBottom + 15);
    if (plane) bindDrag(plane, point => {
      stop();
      let nearest = trajectory[selected][0], distance = Infinity;
      for (const sample of trajectory[selected]) {
        const current = Math.hypot(planeX(sample[2]) - point.x, planeY(sample[3]) - point.y);
        if (current < distance) { nearest = sample; distance = current; }
      }
      slider.value = nearest[0]; update();
    }, point => point.x >= 48 && point.x <= 675 && point.y >= 30 && point.y <= 245);
    const observer = new IntersectionObserver(entries => { if (entries.every(entry => !entry.isIntersecting)) stop(); }, { threshold: 0 });
    observer.observe(figure);
    update(); players.push({ stop });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) players.forEach(player => player.stop()); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) players.forEach(player => player.stop()); });
})();
