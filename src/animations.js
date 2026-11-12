/* Motion explains published endpoints and the analytic LARE rule.
 * No empirical training curves or intermediate benchmark scores are invented.
 */
(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const text = (selector, value) => { $(selector).textContent = value; };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const position = (svg, event) => {
    const point = new DOMPoint(event.clientX, event.clientY);
    return point.matrixTransform(svg.getScreenCTM().inverse());
  };
  const motionObservers = [];
  function observeMotion(figure) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const running = entry.isIntersecting && !reducedMotion.matches && !document.hidden;
        figure.classList.toggle('motion-visible', running);
      }
    }, { threshold: .05 });
    observer.observe(figure);
    motionObservers.push({ observer, figure });
  }
  // Pointer capture keeps horizontal scrubbing stable on mouse, pen, and touch.
  function dragOn(svg, start, move, finish = () => {}) {
    let dragging = false;
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !start(event, position(svg, event))) return;
      dragging = true;
      svg.setPointerCapture(event.pointerId);
      svg.classList.add('is-dragging');
      move(event, position(svg, event));
    });
    svg.addEventListener('pointermove', event => { if (dragging) move(event, position(svg, event)); });
    const end = () => { if (!dragging) return; dragging = false; svg.classList.remove('is-dragging'); finish(); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('lostpointercapture', end);
  }

  // Published capability endpoints. A sweep is a sequence of real runs.
  const frontierData = {
    '7': { fixed: [[27.67, 31.40], [38.59, 32.27], [42.46, 32.08], [43.29, 32.07], [48.98, 31.19]], adaptive: [39.80, 32.24], ratio: 2.41 },
    '3': { fixed: [[43.67, 32.16], [51.40, 32.20], [56.71, 31.75], [56.41, 31.44], [58.23, 30.89]], adaptive: [55.19, 32.05] },
  };
  const multipliers = [1, 2, 3, 4, 7];
  const remixPoints = [[27.67, 31.40], [43.67, 32.16], [59.89, 31.67]];
  const frontierSvg = $('#frontier-svg');
  const fx = value => 62 + (value - 25) / 40 * 600;
  const fy = value => 307 - (value - 30.5) / 2.2 * 265;
  const pathThrough = points => points.map(([x, y], index) => `${index ? 'L' : 'M'}${fx(x).toFixed(2)} ${fy(y).toFixed(2)}`).join(' ');
  let frontierAdaptive = false;
  let frontierTimer = null;
  frontierSvg.innerHTML = `${[31, 31.5, 32, 32.5].map(value => `<line x1="62" x2="662" y1="${fy(value)}" y2="${fy(value)}" class="motion-grid"/><text x="49" y="${fy(value) + 4}" text-anchor="end" class="motion-tick">${value.toFixed(1)}</text>`).join('')}
    ${[30, 40, 50, 60].map(value => `<line x1="${fx(value)}" x2="${fx(value)}" y1="42" y2="307" class="motion-grid"/><text x="${fx(value)}" y="329" text-anchor="middle" class="motion-tick">${value}</text>`).join('')}
    <text x="62" y="22" class="motion-label">Knowledge · MMLU (%) ↑</text><text x="362" y="359" text-anchor="middle" class="motion-label">Reasoning · GSM8K (%) →</text>
    <path d="${pathThrough(remixPoints)}" class="frontier-remix-path"/>
    ${remixPoints.map(([x, y], index) => `<g><rect x="${fx(x) - 4.5}" y="${fy(y) - 4.5}" width="9" height="9" class="frontier-remix-dot"/><text x="${fx(x) + (index === 2 ? -9 : 9)}" y="${fy(y) + 19}" text-anchor="${index === 2 ? 'end' : 'start'}" class="motion-small">data ${[7, 3, 1][index]}:1</text></g>`).join('')}
    <path id="frontier-fixed-path" class="frontier-fixed-path"/>
    <g id="frontier-fixed-points"></g>
    <path id="frontier-crosshair" class="frontier-crosshair"/>
    <g id="frontier-adaptive-dot"><path d="M0 -8 8 0 0 8 -8 0Z" class="frontier-adaptive-dot"/></g>
    <g id="frontier-active-dot"><circle r="15" class="frontier-active-halo"/><circle r="6" class="frontier-active-core"/><circle r="23" fill="transparent" class="drag-hit"/><text id="frontier-point-label" x="0" y="-23" text-anchor="middle" class="frontier-point-label">1:2</text></g>`;
  function stopFrontier() {
    clearInterval(frontierTimer); frontierTimer = null;
    $('#frontier-play').innerHTML = '<span aria-hidden="true">▶</span> Play weight sweep';
    $('#frontier-play').setAttribute('aria-pressed', 'false');
  }
  function updateFrontier() {
    const mixture = $('#frontier-mixture').value;
    const data = frontierData[mixture];
    const index = Number($('#frontier-weight').value);
    const value = multipliers[index];
    const [gsm, mmlu] = frontierAdaptive ? data.adaptive : data.fixed[index];
    $('#frontier-fixed-path').setAttribute('d', pathThrough(data.fixed));
    $('#frontier-fixed-points').innerHTML = data.fixed.map(([x, y], pointIndex) => `<circle cx="${fx(x)}" cy="${fy(y)}" r="4.3" class="frontier-fixed-dot"/><text x="${fx(x)}" y="${fy(y) + (pointIndex % 2 ? 21 : -13)}" text-anchor="middle" class="motion-small frontier-run-label">1:${multipliers[pointIndex]}</text>`).join('');
    $('#frontier-active-dot').style.transform = `translate(${fx(gsm)}px, ${fy(mmlu)}px)`;
    $('#frontier-active-dot').classList.toggle('adaptive-selected', frontierAdaptive);
    $('#frontier-adaptive-dot').style.transform = `translate(${fx(data.adaptive[0])}px, ${fy(data.adaptive[1])}px)`;
    $('#frontier-crosshair').setAttribute('d', `M62 ${fy(mmlu)}H${fx(gsm)}V307`);
    text('#frontier-point-label', frontierAdaptive ? 'LARE' : `1:${value}`);
    text('#frontier-mmlu', mmlu.toFixed(2)); text('#frontier-gsm', gsm.toFixed(2));
    text('#frontier-selection', `${frontierAdaptive ? 'LARE' : `Fixed 1:${value}`} · ${mixture}:1 exposure`);
    const deltaK = mmlu - data.fixed[0][1], deltaM = gsm - data.fixed[0][0];
    const signed = number => `${number >= 0 ? '+' : '−'}${Math.abs(number).toFixed(2)}`;
    text('#frontier-delta', `vs. direct: ${signed(deltaK)} MMLU · ${signed(deltaM)} GSM8K pp`);
    text('#frontier-weight-label', frontierAdaptive ? 'LARE · coefficients selected online' : `Loss ratio K : R = 1 : ${value}`);
    $('#frontier-weight').setAttribute('aria-valuetext', frontierAdaptive ? 'LARE selected; use the slider to return to fixed weights' : `${value} times reasoning coefficient`);
    $('#frontier-adaptive').setAttribute('aria-pressed', String(frontierAdaptive));
    $('#frontier-adaptive').textContent = frontierAdaptive ? 'LARE selected ◆' : 'Show LARE ◆';
    frontierSvg.setAttribute('aria-label', `Measured capability frontier. Selected ${frontierAdaptive ? 'LARE' : `fixed 1 to ${value} weighting`} at ${mixture} to 1 exposure: MMLU ${mmlu.toFixed(2)}, GSM8K ${gsm.toFixed(2)} percent.`);
  }
  $('#frontier-weight').addEventListener('input', () => { stopFrontier(); frontierAdaptive = false; updateFrontier(); });
  $('#frontier-mixture').addEventListener('change', () => { stopFrontier(); updateFrontier(); });
  $('#frontier-adaptive').addEventListener('click', () => { stopFrontier(); frontierAdaptive = !frontierAdaptive; updateFrontier(); });
  $('#frontier-play').addEventListener('click', () => {
    if (frontierTimer) { stopFrontier(); return; }
    frontierAdaptive = false; $('#frontier-weight').value = 0; updateFrontier();
    $('#frontier-play').innerHTML = '<span aria-hidden="true">Ⅱ</span> Pause sweep';
    $('#frontier-play').setAttribute('aria-pressed', 'true');
    frontierTimer = setInterval(() => {
      const index = Number($('#frontier-weight').value);
      if (index >= 4) { frontierAdaptive = true; updateFrontier(); stopFrontier(); return; }
      $('#frontier-weight').value = index + 1; updateFrontier();
    }, 1250);
  });
  dragOn(frontierSvg, (_event, point) => {
    if (point.x < 50 || point.x > 680 || point.y < 25 || point.y > 320) return false;
    stopFrontier(); frontierAdaptive = false; return true;
  }, (_event, point) => {
    const points = frontierData[$('#frontier-mixture').value].fixed;
    const distances = points.map(([x, y]) => Math.hypot(fx(x) - point.x, fy(y) - point.y));
    $('#frontier-weight').value = distances.indexOf(Math.min(...distances));
    updateFrontier();
  });
  updateFrontier();

  // Direct manipulation of the mathematical controller, not learned data.
  const controllerSvg = $('#controller-svg');
  const cx = loss => 52 + (loss - .2) / 5.8 * 294;
  const cy = raw => 251 - (raw - .35) / 2.0 * 205;
  const curve = Array.from({ length: 101 }, (_, index) => { const loss = .2 + 5.8 * index / 100; return `${index ? 'L' : 'M'}${cx(loss).toFixed(2)} ${cy(1 / Math.sqrt(loss)).toFixed(2)}`; }).join(' ');
  controllerSvg.innerHTML = `${[.5, 1, 1.5, 2].map(value => `<line x1="52" x2="346" y1="${cy(value)}" y2="${cy(value)}" class="motion-grid"/><text x="40" y="${cy(value) + 4}" text-anchor="end" class="motion-tick">${value.toFixed(1)}</text>`).join('')}
    ${[1, 2, 3, 4, 5, 6].map(value => `<text x="${cx(value)}" y="277" text-anchor="middle" class="motion-tick">${value}</text>`).join('')}
    <text x="52" y="24" class="motion-label">Inverse-square-root score r</text><text x="199" y="304" text-anchor="middle" class="motion-label">Smoothed domain loss ℓ̂ →</text>
    <path d="${curve}" class="inverse-curve"/>
    <path id="controller-k-wire" class="controller-k-wire"/><path id="controller-m-wire" class="controller-m-wire"/>
    <path d="M471 161C496 161 490 92 531 92" class="controller-k-output signal-wire"/><path d="M471 161C496 161 490 224 531 224" class="controller-m-output signal-wire"/>
    <circle cx="443" cy="161" r="29" class="normalizer-node"/><text x="443" y="167" text-anchor="middle" class="normalizer-label">÷ Z</text><text x="443" y="209" text-anchor="middle" class="motion-small">Z = ∑ π̂ᵢrᵢ</text>
    <rect x="532" y="60" width="137" height="66" rx="3" class="controller-k-box"/><text x="600" y="80" text-anchor="middle" class="motion-small output-domain">Knowledge weight</text><text id="controller-k-output-value" x="600" y="108" text-anchor="middle" class="controller-weight">1.000</text>
    <rect x="532" y="192" width="137" height="66" rx="3" class="controller-m-box"/><text x="600" y="212" text-anchor="middle" class="motion-small output-domain">Reasoning weight</text><text id="controller-m-output-value" x="600" y="240" text-anchor="middle" class="controller-weight">1.000</text>
    <g id="controller-k-point" data-loss-domain="knowledge" tabindex="0" role="slider" aria-label="Knowledge loss" aria-valuemin="0.2" aria-valuemax="6" aria-valuenow="4"><circle r="18" class="controller-point-halo"/><circle r="7" class="controller-k-point"/><circle r="24" fill="transparent" class="drag-hit"/><text x="0" y="-23" text-anchor="middle" class="controller-point-label">K</text></g>
    <g id="controller-m-point" data-loss-domain="math" tabindex="0" role="slider" aria-label="Reasoning loss" aria-valuemin="0.2" aria-valuemax="6" aria-valuenow="1"><circle r="18" class="controller-point-halo"/><circle r="7" class="controller-m-point"/><circle r="24" fill="transparent" class="drag-hit"/><text x="0" y="-23" text-anchor="middle" class="controller-point-label">R</text></g>`;
  let controllerFrame = 0;
  function updateController() {
    const lossK = Number($('#knowledge-loss').value), lossM = Number($('#math-loss').value);
    const rawK = 1 / Math.sqrt(lossK + 1e-8), rawM = 1 / Math.sqrt(lossM + 1e-8);
    const normalization = (7 * rawK + rawM) / 8;
    for (const [domain, loss, raw, key] of [['knowledge', lossK, rawK, 'k'], ['math', lossM, rawM, 'm']]) {
      const point = $(`#controller-${key}-point`);
      point.style.transform = `translate(${cx(loss)}px, ${cy(raw)}px)`;
      point.setAttribute('aria-valuenow', loss.toFixed(2));
      point.setAttribute('aria-orientation', 'horizontal');
      point.setAttribute('aria-valuetext', `${domain === 'knowledge' ? 'Knowledge' : 'Reasoning'} loss ${loss.toFixed(2)}, inverse-square-root score ${raw.toFixed(3)}`);
      point.querySelector('.controller-point-label').setAttribute('y', key === 'm' && Math.abs(cx(lossK) - cx(lossM)) < 34 ? 29 : -23);
      $(`#controller-${key}-wire`).setAttribute('d', `M${cx(loss)} ${cy(raw)}C385 ${cy(raw)} 380 161 413 161`);
      text(`#controller-${key}-output-value`, (raw / normalization).toFixed(3));
      $(`.controller-${key}-output`).style.strokeWidth = 1.5 + raw / normalization * 1.1;
    }
    const preset = Math.abs(lossK - lossM) < .01 ? 'equal' : lossK > lossM ? 'math' : 'knowledge';
    $$('[data-loss-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lossPreset === preset)));
  }
  let dragDomain;
  dragOn(controllerSvg, (event, point) => {
    const target = event.target.closest('[data-loss-domain]');
    if (target) dragDomain = target.dataset.lossDomain;
    else {
      if (point.x < 40 || point.x > 360 || point.y < 35 || point.y > 260) return false;
      const distances = ['knowledge', 'math'].map(domain => {
        const loss = Number($(`#${domain}-loss`).value);
        return Math.hypot(point.x - cx(loss), point.y - cy(1 / Math.sqrt(loss)));
      });
      dragDomain = distances[0] < distances[1] ? 'knowledge' : 'math';
    }
    cancelAnimationFrame(controllerFrame); return true;
  }, (_event, point) => {
    const input = $(`#${dragDomain}-loss`);
    input.value = clamp(.2 + (point.x - 52) / 294 * 5.8, .2, 6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  $$('[data-loss-domain]').forEach(point => point.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); cancelAnimationFrame(controllerFrame);
    const input = $(`#${point.dataset.lossDomain}-loss`);
    input.value = event.key === 'Home' ? .2 : event.key === 'End' ? 6 : clamp(Number(input.value) + (['ArrowRight', 'ArrowUp'].includes(event.key) ? .05 : -.05), .2, 6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  $$('[data-loss-preset]').forEach(button => button.addEventListener('click', () => {
    cancelAnimationFrame(controllerFrame);
    const startK = Number($('#knowledge-loss').value), startM = Number($('#math-loss').value);
    const target = { equal: [2, 2], math: [4, 1], knowledge: [1, 4] }[button.dataset.lossPreset];
    const begin = performance.now(), duration = reducedMotion.matches ? 0 : 650;
    const tick = now => {
      const progress = duration ? clamp((now - begin) / duration, 0, 1) : 1;
      const eased = 1 - (1 - progress) ** 3;
      $('#knowledge-loss').value = startK + (target[0] - startK) * eased;
      $('#math-loss').value = startM + (target[1] - startM) * eased;
      $('#math-loss').dispatchEvent(new Event('input', { bubbles: true }));
      if (progress < 1) controllerFrame = requestAnimationFrame(tick);
    };
    controllerFrame = requestAnimationFrame(tick);
  }));
  $('#knowledge-loss').addEventListener('pointerdown', () => cancelAnimationFrame(controllerFrame));
  $('#math-loss').addEventListener('pointerdown', () => cancelAnimationFrame(controllerFrame));
  window.addEventListener('lare:rule', updateController);
  updateController();
  observeMotion($('#controller-animation'));

  // Animate the actual before/after bars on entry and between reported budgets.
  let resultsVisible = false;
  const animateResults = () => {
    if (reducedMotion.matches) return;
    $$('.benchmark-bar').forEach((bar, index) => {
      bar.animate([{ width: bar.dataset.previousWidth || '0%' }, { width: bar.style.width }], {
        duration: 750, delay: Math.floor(index / 2) * 65, easing: 'cubic-bezier(.2,.7,.2,1)',
      });
    });
  };
  const resultsObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && !resultsVisible) { resultsVisible = true; animateResults(); }
  }, { threshold: .25 });
  resultsObserver.observe($('.results-explorer'));
  window.addEventListener('lare:results', () => { if (resultsVisible) animateResults(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopFrontier(); cancelAnimationFrame(controllerFrame); }
    motionObservers.forEach(({ observer, figure }) => {
      if (document.hidden) figure.classList.remove('motion-visible');
      else { observer.unobserve(figure); observer.observe(figure); }
    });
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { stopFrontier(); }
    motionObservers.forEach(({ observer, figure }) => { observer.unobserve(figure); observer.observe(figure); });
  });
})();
