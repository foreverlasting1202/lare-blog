/* The two panels show measurements from the same pair of training steps. */
(() => {
  const methods = ['direct', 'lare'];
  const frame = { left: 36, right: 352, top: 70, bottom: 228 };
  const panels = {
    math: {
      loss: 0, accuracy: 1, left: 0.685, right: 0.317, bottom: -1.5, top: 54,
      ticks: [0.65, 0.60, 0.55, 0.50, 0.45, 0.40, 0.35],
      yStep: 10, name: ['GSM8K accuracy', 'GSM8K 准确率'],
      axis: ['Math validation loss', '数学验证 loss'],
    },
    knowledge: {
      loss: 2, accuracy: 3, left: 2.705, right: 2.315, bottom: 28.8, top: 35.75,
      ticks: [2.70, 2.60, 2.50, 2.40, 2.35],
      yStep: 1, name: ['Normalized MMLU accuracy', 'MMLU 归一化准确率'],
      axis: ['Knowledge validation loss', '知识验证 loss'],
    },
  };

  function element(tag, attributes, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function seriesMarker(method, radius) {
    if (method === 'direct') return element('circle', { r: radius });
    return element('path', { d: `M 0 ${-radius} L ${radius} 0 0 ${radius} ${-radius} 0 Z` });
  }

  function makePanel(svg, key, data, zh) {
    const spec = panels[key];
    const name = spec.name[zh ? 1 : 0];
    const axisLabel = spec.axis[zh ? 1 : 0];
    const xLabel = axisLabel + (zh ? '（向右降低）' : ' (lower to the right)');
    const clipId = 'loss-accuracy-window-' + key;
    const description = element('desc', { id: clipId + '-description' });
    const title = element('title', { id: clipId + '-title' }, name + ' / ' + axisLabel);
    svg.classList.add('loss-accuracy-svg');
    svg.setAttribute('viewBox', '0 0 360 272');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', title.id);
    svg.setAttribute('aria-describedby', description.id);
    svg.append(title, description);
    const defs = element('defs', {});
    const clip = element('clipPath', { id: clipId });
    clip.append(element('rect', { x: frame.left, y: frame.top,
      width: frame.right - frame.left, height: frame.bottom - frame.top }));
    defs.append(clip);
    const axes = element('g', {});
    const cloud = element('g', { 'clip-path': 'url(#' + clipId + ')' });
    const heads = element('g', {});
    const readings = element('g', {});
    const difference = element('text', { x: 352, y: 16, 'text-anchor': 'end', class: 'la-difference' });
    svg.append(defs, axes, cloud, heads, readings,
      element('text', { x: 2, y: 16, class: 'la-heading' }, name), difference,
      element('text', { x: (frame.left + frame.right) / 2, y: 266, 'text-anchor': 'middle', class: 'la-x-label' }, xLabel));

    const series = methods.map((method, order) => {
      const rowY = 37 + 17 * order;
      const methodName = method === 'lare' ? 'LARE' : (zh ? '直接混合' : 'Direct mixing');
      const readout = element('g', { class: 'la-' + method });
      const symbol = seriesMarker(method, method === 'lare' ? 4.5 : 3.5);
      symbol.setAttribute('transform', `translate(7 ${rowY - 3})`);
      const values = element('text', { x: 100, y: rowY, class: 'la-values' });
      readout.append(symbol, element('text', { x: 18, y: rowY, class: 'la-method' }, methodName), values);
      readings.append(readout);

      const dots = element('g', { class: 'la-' + method + ' la-dots' });
      cloud.append(dots);
      const current = element('g', { class: 'la-' + method });
      const guide = element('line', { class: 'la-guide', y2: frame.bottom });
      const marker = seriesMarker(method, method === 'lare' ? 5.7 : 4.6);
      marker.setAttribute('class', 'la-head');
      current.append(guide, marker);
      heads.append(current);
      return { rows: data[method], methodName, dots, guide, marker, values };
    });

    let left, bottom;
    function x(value) { return frame.left + (left - value) / (left - spec.right) * (frame.right - frame.left); }
    function y(percent) { return frame.bottom - (percent - bottom) / (spec.top - bottom) * (frame.bottom - frame.top); }

    function drawAxes() {
      const parts = [];
      let ticks = spec.ticks;
      if (left > spec.left) {
        const stride = [0.1, 0.2, 0.5, 1, 2, 5].find(step => (left - spec.right) / step <= 6);
        ticks = [];
        for (let n = Math.ceil(spec.right / stride); n * stride < left; n++) ticks.push(n * stride);
      }
      for (const tick of ticks) {
        parts.push(element('text', { x: x(tick), y: frame.bottom + 16, 'text-anchor': 'middle' },
          left === spec.left ? tick.toFixed(2) : String(Number(tick.toFixed(2)))));
      }
      const yStep = spec.yStep === 1 && spec.top - bottom > 8 ? 2 : spec.yStep;
      for (let tick = Math.ceil(bottom / yStep) * yStep; tick < spec.top; tick += yStep) {
        parts.push(element('line', { x1: frame.left, y1: y(tick), x2: frame.right, y2: y(tick), class: 'la-grid' }),
          element('text', { x: frame.left - 5, y: y(tick) + 3.5, 'text-anchor': 'end' }, tick + '%'));
      }
      parts.push(element('line', { x1: frame.left, y1: frame.bottom, x2: frame.right, y2: frame.bottom, class: 'la-axis' }));
      axes.replaceChildren(...parts);
    }

    return index => {
      const currentLoss = series.map(run => run.rows[index][spec.loss]);
      const currentScore = series.map(run => 100 * run.rows[index][spec.accuracy]);
      // The early checkpoints extend outside the final figure's low-loss window.
      // Follow them in until both methods fit the published view.
      const nextLeft = Math.max(spec.left, ...currentLoss.map(value => value + 0.025 * (value - spec.right)));
      const nextBottom = Math.min(spec.bottom, ...currentScore.map(value => value - 0.35));
      const rangeChanged = nextLeft !== left || nextBottom !== bottom;
      left = nextLeft;
      bottom = nextBottom;
      if (rangeChanged) drawAxes();

      series.forEach((run, method) => {
        // Checkpoint 0 is initialization. The large marker represents index, so
        // the smaller dots run from checkpoint 1 through index - 1.
        const count = index - 1;
        while (run.dots.childElementCount > count) run.dots.lastElementChild.remove();
        const start = rangeChanged ? 0 : run.dots.childElementCount;
        for (let k = start; k < count; k++) {
          const row = run.rows[k + 1];
          const existing = run.dots.children[k];
          const dot = existing || element('circle', { r: 1.7 });
          dot.setAttribute('cx', x(row[spec.loss]));
          dot.setAttribute('cy', y(100 * row[spec.accuracy]));
          if (!existing) run.dots.append(dot);
        }
        const px = x(currentLoss[method]), py = y(currentScore[method]);
        run.guide.setAttribute('x1', px);
        run.guide.setAttribute('x2', px);
        run.guide.setAttribute('y1', py);
        run.marker.setAttribute('transform', `translate(${px} ${py})`);
        run.values.textContent = `loss ${currentLoss[method].toFixed(4)}  /  ${currentScore[method].toFixed(2)}%`;
      });
      const delta = currentScore[1] - currentScore[0];
      const signed = (delta < 0 ? '−' : '+') + Math.abs(delta).toFixed(2);
      difference.textContent = 'LARE ' + signed + (zh ? ' 个百分点' : ' pp');
      description.textContent = series.map(run => run.methodName + ' ' + run.values.textContent).join(', ') +
        '. ' + difference.textContent + '. ' + xLabel;
    };
  }

  window.LARE_LOSS_ACCURACY_PLOT = {
    create(root, data, language) {
      const renderPanels = Object.keys(panels).map(key =>
        makePanel(root.querySelector('[data-loss-panel="' + key + '"]'), key, data, language.startsWith('zh')));
      return { render(index) { for (const render of renderPanels) render(index); } };
    },
  };
})();
