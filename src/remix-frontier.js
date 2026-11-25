(() => {
  const figure = document.getElementById('remix-frontier');
  if (!figure) return;

  const zh = document.documentElement.lang.startsWith('zh');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const replay = figure.querySelector('.rf-replay');
  const reading = figure.querySelector('.rf-reading');
  const markers = [...figure.querySelectorAll('.rf-marker')].sort(
    (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
  );
  // Each connector joins separate experiments in the order of their settings.
  const segments = [...figure.querySelectorAll('.rf-segment')].map(line => ({
    line, order: Number(line.dataset.order),
    x1: parseFloat(line.getAttribute('x1')), y1: parseFloat(line.getAttribute('y1')),
    x2: parseFloat(line.getAttribute('x2')), y2: parseFloat(line.getAttribute('y2')),
  }));
  const hint = zh ? '点选终点，查看该组的配比、权重和成绩。' : 'Select a point to see its mixture, weight and scores.';
  let frame = 0;
  let selected = null;

  function renderFrame(time) {
    for (const {line, order, x1, y1, x2, y2} of segments) {
      const progress = Math.min(1, Math.max(0, time / 510 - (order - 1)));
      line.setAttribute('x2', (x1 + progress * (x2 - x1)) + '%');
      line.setAttribute('y2', (y1 + progress * (y2 - y1)) + '%');
    }
    for (const marker of markers) {
      const offset = Number(marker.dataset.order) * 510;
      marker.style.opacity = String(Math.min(1, Math.max(0, (time - offset) / 150)));
    }
  }

  function finish() {
    cancelAnimationFrame(frame);
    frame = 0;
    renderFrame(Infinity);
  }

  function clearReading() {
    if (selected) selected.setAttribute('aria-pressed', 'false');
    selected = null;
    reading.textContent = hint;
  }

  function play() {
    finish();
    clearReading();
    if (reduced.matches) return;
    const start = performance.now();
    renderFrame(0);
    function tick(now) {
      renderFrame(now - start);
      if (now - start < 3210) frame = requestAnimationFrame(tick);
      else finish();
    }
    frame = requestAnimationFrame(tick);
  }

  function description(marker) {
    const {ratio, weight, gsm, mmlu} = marker.dataset;
    return zh
      ? '知识∶数学 ' + ratio.replace(':', '∶') + ' · 数学权重 ' + weight + '× · MMLU ' + mmlu + '% · GSM8K ' + gsm + '%'
      : 'Knowledge:math ' + ratio + ' · Math weight ' + weight + '× · MMLU ' + mmlu + '% · GSM8K ' + gsm + '%';
  }

  function inspect(marker) {
    finish();
    if (selected) selected.setAttribute('aria-pressed', 'false');
    selected = marker;
    marker.setAttribute('aria-pressed', 'true');
    reading.textContent = description(marker);
  }

  markers.forEach((marker, index) => {
    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute('aria-label', description(marker));
    marker.setAttribute('aria-pressed', 'false');
    marker.addEventListener('focus', () => inspect(marker));
    marker.addEventListener('click', () => inspect(marker));
    marker.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') inspect(marker);
    });
    marker.addEventListener('keydown', event => {
      switch (event.key) {
        case 'Enter':
        case ' ': event.preventDefault(); inspect(marker); break;
        case 'ArrowRight':
        case 'ArrowLeft': {
          event.preventDefault();
          const delta = event.key === 'ArrowRight' ? 1 : -1;
          markers[(index + delta + markers.length) % markers.length].focus();
          break;
        }
        case 'Escape': clearReading(); break;
      }
    });
  });

  reading.hidden = false;
  clearReading();
  replay.hidden = false;
  replay.addEventListener('click', play);
  window.addEventListener('beforeprint', finish);
  reduced.addEventListener('change', finish);
  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        if (!selected && !frame) play();
      }
    }, {threshold: 0.45});
    observer.observe(figure);
  }
})();
