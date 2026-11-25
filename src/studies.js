(() => {
  // Tables 8 and 9, direct and LARE endpoints, each ordered [MMLU, GSM8K].
  const replications = {
    AdamW: [
      [[31.30, 21.91], [31.40, 33.66]],
      [[31.98, 37.07], [31.95, 46.63]],
      [[31.58, 54.66], [31.02, 60.50]],
    ],
    Muon: [
      [[31.40, 27.67], [32.24, 39.80]],
      [[32.16, 43.67], [32.05, 55.19]],
      [[31.67, 59.89], [31.15, 65.13]],
    ],
    ActGD: [
      [[31.82, 28.58], [31.99, 34.50]],
      [[31.59, 39.95], [31.56, 47.38]],
      [[31.53, 54.89], [30.59, 59.74]],
    ],
  };
  const plot = document.querySelector('#replication-plot');
  if (!plot) return;
  const metric = document.querySelector('#replication-metric');
  const ratio = document.querySelector('#replication-ratio');
  const rows = [...plot.querySelectorAll('.replication-row')];
  const ticks = [...plot.querySelectorAll('.replication-axis span')];
  function updateReplication() {
    const index = metric.value === 'mmlu' ? 0 : 1;
    const domain = index === 0 ? [30, 31, 32, 33] : [0, 25, 50, 75];
    plot.style.setProperty('--min', domain[0]);
    plot.style.setProperty('--range', domain[3] - domain[0]);
    ticks.forEach((label, i) => { label.textContent = domain[i]; });
    for (const row of rows) {
      const [direct, lare] = replications[row.dataset.optimizer][ratio.selectedIndex];
      row.style.setProperty('--direct', direct[index]);
      row.style.setProperty('--lare', lare[index]);
      const values = row.querySelectorAll('.replication-value');
      values[0].textContent = direct[index].toFixed(2);
      values[1].textContent = lare[index].toFixed(2);
    }
    document.querySelector('#replication-axis-title').textContent =
      metric.selectedOptions[0].textContent + ' (%) · ' + ratio.selectedOptions[0].textContent;
  }
  document.querySelector('.replication-filters').hidden = false;
  metric.addEventListener('change', updateReplication);
  ratio.addEventListener('change', updateReplication);
  updateReplication();

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      plot.classList.add('replication-entering');
      plot.getBoundingClientRect();
      requestAnimationFrame(() => plot.classList.remove('replication-entering'));
    }, {threshold: 0.25});
    observer.observe(plot);
  }
})();

(() => {
  const figure = document.querySelector('.grouping-figure');
  if (!figure) return;
  const board = figure.querySelector('.source-triplets');
  const lists = [...board.querySelectorAll('.source-cards')];
  const cards = [...board.querySelectorAll('.source-tile')];
  const byId = [...cards].sort((a, b) => Number(a.dataset.sourceId) - Number(b.dataset.sourceId));
  const byLoss = [...cards].sort((a, b) => Number(b.dataset.loss) - Number(a.dataset.loss));
  const buttons = [...figure.querySelectorAll('.group-stages button')];
  const play = figure.querySelector('.group-play');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const t = value => document.documentElement.lang === 'zh-CN' ? window.LARE_I18N.translate(value) : value;
  const status = [
    'The sources start in their original order. Each card shows its measured validation loss.',
    'Follow each source ID as the cards move from highest loss to lowest.',
    'Each group of three shares a LARE weight.',
  ];
  let step = 0, playing = false, autoStarted = false;
  let timer, moves = [], priorPrintStep;

  function stopMoves() {
    for (const move of moves) move.cancel();
    moves = [];
  }
  function showStep(next, animate = true) {
    const positions = animate && !reduced.matches
      ? new Map(cards.map(card => [card, card.getBoundingClientRect()])) : null;
    stopMoves();
    step = next;
    const order = step === 0 ? byId : byLoss;
    figure.dataset.groupStep = String(step);
    if (step === 2) board.removeAttribute('role');
    else board.setAttribute('role', 'list');
    lists.forEach((list, i) => {
      const members = order.slice(i * 3, (i + 1) * 3);
      list.replaceChildren(...members);
      const label = list.previousElementSibling;
      if (step === 2) {
        label.removeAttribute('aria-hidden');
        list.removeAttribute('role');
        list.setAttribute('aria-labelledby', label.id);
      } else {
        label.setAttribute('aria-hidden', 'true');
        list.setAttribute('role', 'presentation');
        list.removeAttribute('aria-labelledby');
      }
    });
    // Move the same card between its measured positions, including across rows.
    if (positions) {
      for (const [index, card] of order.entries()) {
        const before = positions.get(card), after = card.getBoundingClientRect();
        const dx = before.left - after.left, dy = before.top - after.top;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) continue;
        moves.push(card.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ], { duration: 810, delay: (index % 6) * 19, fill: 'backwards', easing: 'cubic-bezier(.25,.75,.25,1)' }));
      }
    }
    figure.querySelector('.grouping-heading').textContent = t(status[step]);
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === step)));
  }
  function updatePlayButton() {
    play.textContent = t(playing ? 'Pause' : step === 2 ? 'Replay the sort' : 'Play grouping');
  }
  function scheduleNextStep() {
    timer = setTimeout(() => {
      showStep(step + 1);
      if (step < 2) {
        scheduleNextStep();
      } else {
        playing = false;
        updatePlayButton();
      }
    }, step === 0 ? 1650 : 2150);
  }
  function setPlaying(active) {
    clearTimeout(timer);
    playing = active;
    updatePlayButton();
    if (playing) {
      for (const move of moves) if (move.playState === 'paused') move.play();
      scheduleNextStep();
    } else {
      for (const move of moves) if (move.playState === 'running') move.pause();
    }
  }
  play.addEventListener('click', () => {
    autoStarted = true;
    if (step === 2) showStep(0, false);
    setPlaying(!playing);
  });
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    autoStarted = true;
    setPlaying(false);
    showStep(index);
    updatePlayButton();
  }));
  showStep(0, false);
  setPlaying(false);
  figure.querySelector('.group-controls').hidden = false;
  const observer = new IntersectionObserver(entries => {
    const visible = entries.some(e => e.intersectionRatio >= .2);
    if (visible && !autoStarted && !document.hidden && !reduced.matches) {
      autoStarted = true;
      setPlaying(true);
    } else if (!visible && playing) {
      setPlaying(false);
    }
  }, { threshold: [0,.2] });
  observer.observe(figure);
  let lastWidth = board.getBoundingClientRect().width;
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - lastWidth) > 0.5) stopMoves();
    lastWidth = entry.contentRect.width;
  }).observe(board);
  reduced.addEventListener('change', () => {
    stopMoves();
    if (reduced.matches) setPlaying(false);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
  window.addEventListener('beforeprint', () => {
    priorPrintStep = step;
    setPlaying(false);
    showStep(2, false);
  });
  window.addEventListener('afterprint', () => {
    if (priorPrintStep === undefined) return;
    showStep(priorPrintStep, false);
    setPlaying(false);
    priorPrintStep = undefined;
  });
})();
