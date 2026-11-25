(() => {
  const figure = document.getElementById('quadratic-frontiers');
  if (!figure) return;
  const zh = document.documentElement.lang.startsWith('zh');
  const text = (en, cn) => zh ? cn : en;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const graphic = (tag, attributes) => {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
    return el;
  };

  // Read back the same PDF vertices that are displayed in the static SVG.
  function frontierHeight(points, x) {
    if (x < points[0].x || x > points.at(-1).x) return null;
    const i = points.findIndex(p => p.x >= x);
    if (i === 0 || points[i].x === x) return points[i].y;
    const a = points[i - 1], b = points[i];
    return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  }

  for (const panel of figure.querySelectorAll('.q-panel')) {
    const svg = panel.querySelector('svg');
    const marks = svg.querySelector('.q-inspection');
    const readout = panel.querySelector('.q-readout');
    const prompt = readout.textContent;
    const fixed = panel.dataset.mode === 'fixed';
    const points = [...svg.querySelectorAll('[data-loss-x]')].map(el => ({
      x: Number(el.dataset.lossX) * 1000, y: 400 - Number(el.dataset.lossY) * 1000,
    }));
    const lines = [...svg.querySelectorAll('[data-frontier]')].map(el => [...el.points]);
    const labels = [text('Shared rate', '共享步长'), text('Separate rates', '分域步长')];
    const lossText = y => ((400 - y) / 1000).toFixed(3);
    const pointText = p => '(' + (p.x / 1000).toFixed(3) + ', ' + lossText(p.y) + ')';
    let cursor = null;

    function clear() {
      cursor = null;
      marks.replaceChildren();
      readout.textContent = prompt;
    }
    function inspect(value) {
      marks.replaceChildren();
      if (fixed) {
        const index = Math.max(0, Math.min(1, value));
        cursor = index;
        const p = points[index];
        marks.append(graphic('circle', {cx:p.x, cy:p.y, r:10, fill:'none', style:'stroke:var(--chart-ink)'}));
        readout.textContent = labels[index] + ' ≈ ' + pointText(p);
      } else {
        // A comparison uses the horizontal range spanned by both PDF curves.
        const lower = Math.max(...lines.map(line => line[0].x));
        const upper = Math.min(...lines.map(line => line.at(-1).x));
        const x = Math.max(lower, Math.min(upper, value));
        cursor = x;
        marks.append(graphic('line', {x1:x, x2:x, y1:0, y2:400}));
        const values = [];
        lines.forEach((line, index) => {
          const y = frontierHeight(line, x);
          if (y === null) return;
          marks.append(graphic('circle', {cx:x, cy:y, r:5, 'data-color':index ? 'separate' : 'shared'}));
          values.push(labels[index] + ' ≈ ' + lossText(y));
        });
        readout.textContent = text('Domain 1', '领域 1') + ' ≈ ' + (x / 1000).toFixed(3)
          + text(' · Domain 2 (', ' · 领域 2（') + values.join(' / ') + text(')', '）');
      }
    }
    function inspectPointer(event) {
      const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      if (pt.x < -2 || pt.y < -2 || pt.x > 402 || pt.y > 402) return clear();
      const distances = points.map(p => Math.hypot(p.x - pt.x, p.y - pt.y));
      inspect(fixed ? distances.indexOf(Math.min(...distances)) : pt.x);
    }
    svg.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') inspectPointer(event); });
    svg.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') clear(); });
    svg.addEventListener('pointerup', inspectPointer);
    svg.addEventListener('blur', clear);
    svg.addEventListener('focus', () => { if (svg.matches(':focus-visible')) inspect(fixed ? 0 : 100); });
    svg.addEventListener('keydown', event => {
      if (event.key === 'Escape') { clear(); return; }
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      if (event.key === 'Home') inspect(0);
      else if (event.key === 'End') inspect(fixed ? 1 : 400);
      else inspect((cursor ?? (fixed ? 0 : 100)) + delta * (fixed ? 1 : 5));
    });
  }

  const replay = figure.querySelector('.q-replay');
  replay.hidden = false;
  function animate() {
    if (reduced.matches) return;
    for (const curve of figure.querySelectorAll('.q-curve')) {
      const length = curve.getTotalLength();
      curve.getAnimations().forEach(animation => animation.cancel());
      curve.animate([
        {strokeDasharray:String(length), strokeDashoffset:String(length)},
        {strokeDasharray:String(length), strokeDashoffset:'0'},
      ], {duration:850, easing:'ease-out'});
    }
  }
  replay.addEventListener('click', animate);
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      animate();
      observer.disconnect();
    }
  });
  observer.observe(figure);
})();
