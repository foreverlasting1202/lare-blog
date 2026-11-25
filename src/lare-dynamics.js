/* The four panels of the paper's 30B-token Muon figure share one playhead. */
(() => {
  const figure = document.querySelector('#adaptive-history');
  const data = window.LARE_PAPER_SERIES?.['lare-training'];
  if (!figure || !data || data.panels.length !== 3) return;

  const zh = document.documentElement.lang.startsWith('zh');
  const t = (en, cn) => zh ? cn : en;
  const html = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const svg = (tag, attrs, content) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const chart = html('div', 'paper-chart dyn-chart');
  const header = html('div', 'paper-chart-header');
  const heading = html('div', 'paper-chart-heading');
  heading.append(html('span', 'paper-chart-kicker', figure.querySelector('.figure-number').textContent),
    html('h3', 'paper-chart-title', t('How does LARE compare with fixed weights?', 'LARE 选出的权重，和手动选的比起来怎样？')));
  header.append(heading);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const playback = html('button', 'dyn-play');
  playback.type = 'button';
  const slider = html('input', 'dyn-slider');
  const budget = data.tokensB;
  slider.type = 'range';
  slider.min = 0;
  slider.max = budget;
  slider.step = 0.1;
  slider.setAttribute('aria-label', t('Training progress in billions of tokens', '训练进度（十亿 tokens）'));
  const progress = html('span', 'dyn-progress');
  progress.setAttribute('aria-hidden', 'true');
  const controls = html('div', 'dyn-controls');
  controls.append(playback, slider, progress);

  const axes = html('div', 'dyn-grid');
  const [knowledge, math, weight] = data.panels;
  const ratioReading = html('strong', 'dyn-ratio-reading');
  const specs = [
    [t('Knowledge', '知识'), 'MMLU (%)', data.xTicks, knowledge.yTicks, [0, budget], knowledge.yDomain],
    [t('Mathematics', '数学'), 'GSM8K (%)', data.xTicks, math.yTicks, [0, budget], math.yDomain],
    [t('Relative loss weight', '相对 loss 权重'), t('Math / knowledge weight', '数学权重 / 知识权重'), data.xTicks, weight.yTicks, [0, budget], weight.yDomain],
    [t('Final scores', '最终成绩'), 'MMLU (%)', [30, 35, 40, 45, 50], [31, 31.5, 32, 32.5], [26.5, 50.5], [30.9, 32.5]],
  ];
  const left = 35, right = 318, top = 12, base = 128;
  const clips = [];
  let endpoints, pending;
  const activeFocus = new Map();
  const buttons = new Map();
  const seriesNames = new Map(knowledge.series.map(line => [
    line.key, line.key === 'direct' ? t('Direct 1:1', '直接混合 1∶1') : line.label[zh ? 'zh' : 'en']
  ]));
  const pointGroup = key => {
    const node = svg('g', {});
    node.classList.add('dyn-series', 'dyn-' + key);
    if (!activeFocus.has(key)) activeFocus.set(key, []);
    activeFocus.get(key).push(node);
    return node;
  };
  const legend = html('div', 'paper-chart-legend dyn-legend');
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', t('Highlight a method', '突出显示一种方法'));
  let selected = null;
  function select(key) {
    selected = selected === key ? null : key;
    activeFocus.forEach((nodes, id) => {
      for (const node of nodes) node.classList.toggle('dyn-muted', selected !== null && selected !== id);
      buttons.get(id).setAttribute('aria-pressed', String(selected === id));
    });
    updateReadout();
  }
  for (const [key, label] of seriesNames) {
    const button = html('button', 'paper-chart-series');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    const swatch = svg('svg', {viewBox:'0 0 24 10', class:'paper-chart-swatch dyn-' + key, 'aria-hidden':'true'});
    swatch.append(svg('path', {d:'M1 5 H23', class:'dyn-line'}));
    button.append(swatch, document.createTextNode(label));
    button.addEventListener('click', () => select(key));
    buttons.set(key, button);
    legend.append(button);
  }

  const panels = [knowledge, math, weight];
  const results = new Map(knowledge.series.map(line => [line.key, {
    mmlu:line.points,
    gsm:math.series.find(s => s.key === line.key).points,
  }]));
  const labelOffsets = {
    direct: [7, 14], fixed2: [-5, -10], fixed3: [0, 14],
    fixed4: [11, 5], fixed7: [5, 13], lare: [7, -8],
  };
  for (const [index, [name, yLabel, xTicks, yTicks, xBounds, yBounds]] of specs.entries()) {
    const isScatter = index === 3;
    const panel = html('div', 'dyn-panel');
    const panelTitle = html('h4', 'dyn-panel-title', String.fromCharCode(97 + index) + ' · ' + name);
    const yCaption = html('div', 'dyn-ylabel', yLabel);
    if (index === 2) yCaption.append(ratioReading);
    const xLabel = isScatter ? 'GSM8K (%)' : t('Training tokens (B)', '训练 tokens（十亿）');
    const drawing = svg('svg', {viewBox:'0 0 328 166', preserveAspectRatio:'xMidYMid meet', role:'img',
      'aria-label': name + ' · ' + xLabel + ' · ' + yLabel, class:'dyn-plot'});
    const x = n => left + (n - xBounds[0]) / (xBounds[1] - xBounds[0]) * (right - left);
    const y = n => base - (n - yBounds[0]) / (yBounds[1] - yBounds[0]) * (base - top);
    if (!isScatter) {
      const warmupX = x(weight.guides[0].points[0][0]);
      drawing.append(svg('rect', {x:left, y:top, width:warmupX-left, height:base-top, class:'dyn-warmup'}),
        svg('line', {x1:warmupX, x2:warmupX, y1:top, y2:base, class:'dyn-switch'}));
      if (index === 2) drawing.append(svg('text', {x:(left+warmupX)/2, y:top+11, 'text-anchor':'middle', class:'dyn-phase'}, t('Warmup', '预热')));
    }
    for (const tick of xTicks) {
      drawing.append(svg('line', {x1:x(tick), y1:top, x2:x(tick), y2:base, class:'dyn-gridline'}),
        svg('text', {x:x(tick), y:base + 14, 'text-anchor':'middle'}, tick));
    }
    for (const tick of yTicks) {
      drawing.append(svg('line', {x1:left, y1:y(tick), x2:right, y2:y(tick), class:'dyn-gridline'}),
        svg('text', {x:left - 5, y:y(tick) + 3, 'text-anchor':'end'}, tick));
    }
    drawing.append(svg('path', {d:'M' + left + ' ' + top + 'V' + base + 'H' + right, class:'dyn-border'}),
      svg('text', {x:(left + right)/2, y:161, 'text-anchor':'middle', class:'dyn-axis-label'}, xLabel));
    if (!isScatter) {
      const clipId = 'lare-dynamics-clip-' + index;
      const clip = svg('clipPath', {id:clipId});
      const windowRect = svg('rect', {x:left, y:top - 1, width:right - left + 1, height:base - top + 2});
      clip.append(windowRect);
      const defs = svg('defs', {});
      defs.append(clip);
      const layer = svg('g', {'clip-path':'url(#' + clipId + ')'});
      const source = panels[index];
      function addLine(line, guide) {
        const group = pointGroup(line.key);
        const points = line.points.map(([tx, val], i) => (i ? 'L' : 'M') + x(tx).toFixed(2) + ' ' + y(val).toFixed(2));
        group.append(svg('path', {d:points.join(' '), class:'dyn-line' + (guide ? ' dyn-guide' : '')}));
        if (!guide) {
          const [tx, val] = line.points.at(-1);
          group.append(svg('circle', {cx:x(tx), cy:y(val), r:2, class:'dyn-point'}));
        }
        layer.append(group);
      }
      for (const guide of source.guides || []) addLine(guide, true);
      for (const line of source.series) addLine(line, false);
      drawing.append(defs, layer);
      clips.push({rect:windowRect, x});
    } else {
      endpoints = svg('g', {class:'dyn-endpoints'});
      const atEnd = key => {
        const run = results.get(key);
        return [x(run.gsm.at(-1)[1]), y(run.mmlu.at(-1)[1])];
      };
      const fixed = knowledge.series.filter(s => s.key.startsWith('fixed'));
      const polyline = fixed.map(s => atEnd(s.key).join(',')).join(' ');
      const [ax,ay] = atEnd('direct'), [bx,by] = atEnd('lare');
      const length = Math.hypot(bx-ax, by-ay);
      const ux = (bx-ax)/length, uy = (by-ay)/length;
      const tx = bx - 7*ux, ty = by - 7*uy;
      endpoints.append(svg('polyline', {points:polyline, class:'dyn-connection'}),
        svg('path', {d:'M' + ax + ' ' + ay + 'L' + tx + ' ' + ty +
          'm' + (-5*ux+2.4*uy) + ' ' + (-5*uy-2.4*ux) + 'L' + tx + ' ' + ty +
          'l' + (-5*ux-2.4*uy) + ' ' + (-5*uy+2.4*ux), class:'dyn-connection dyn-improvement'}));
      for (const run of knowledge.series) {
        // The paper's scatter uses the last plotted observations, including Direct.
        const {mmlu: mmluPoints, gsm: gsmPoints} = results.get(run.key);
        const mmlu = mmluPoints.at(-1)[1], gsm = gsmPoints.at(-1)[1];
        const [cx, cy] = atEnd(run.key), group = pointGroup(run.key);
        const text = seriesNames.get(run.key) + ' · MMLU ' + mmlu.toFixed(2) + '% · GSM8K ' + gsm.toFixed(2) + '%';
        group.append(svg('title', {}, text));
        if (run.key === 'direct') {
          group.append(svg('rect', {x:cx - 3.5, y:cy - 3.5, width:7, height:7, class:'dyn-point dyn-square'}));
        } else if (run.key === 'lare') {
          group.append(svg('rect', {x:cx-4, y:cy-4, width:8, height:8,
            transform:'rotate(45 ' + cx + ' ' + cy + ')', class:'dyn-point'}));
        } else {
          group.append(svg('circle', {cx, cy, r:3.8, class:'dyn-point'}));
        }
        const [dx, dy] = labelOffsets[run.key];
        const label = run.key === 'direct' ? t('Direct', '直接') : run.key === 'lare' ? 'LARE' : '1:' + run.key.slice(5);
        group.append(svg('text', {x:cx+dx, y:cy+dy, 'text-anchor':run.key === 'fixed2' ? 'end' : 'start', class:'dyn-point-label'}, label));
        endpoints.append(group);
      }
      pending = svg('text', {x:(left+right)/2, y:(top+base)/2, 'text-anchor':'middle', class:'dyn-pending'}, t('Endpoints appear at 30B tokens', '训练到 30B tokens 时显示终点'));
      drawing.append(pending, endpoints);
    }
    panel.append(panelTitle, yCaption, drawing);
    axes.append(panel);
  }

  const reading = html('span', 'dyn-reading');
  const footer = html('div', 'paper-chart-footer');
  footer.append(reading);
  const instruction = t('Select a method above to highlight its curves.', '点选图例可单独突出一种方法。');
  let current = budget, frame = 0, played = false;
  function updateReadout() {
    let text = instruction;
    if (selected) {
      const {mmlu, gsm} = results.get(selected);
      const i = mmlu.findLastIndex(([token]) => token <= current);
      const [token, score] = mmlu[i];
      text = seriesNames.get(selected) + ' · ' + t('Evaluation at ', '评测于 ') + Number(token.toFixed(2)) +
        'B · MMLU ' + score.toFixed(2) + '% · GSM8K ' + gsm[i][1].toFixed(2) + '%';
    }
    if (reading.textContent !== text) reading.textContent = text;
  }
  function render(tokens) {
    current = tokens;
    const latestRatio = weight.series[0].points.findLast(([time]) => time <= tokens);
    ratioReading.textContent = latestRatio ? ' ≈ ' + latestRatio[1].toFixed(2) : '';
    for (const {rect, x} of clips) rect.setAttribute('width', Math.max(0, x(tokens) - left + (tokens === budget ? 1 : 0)));
    const done = tokens >= budget;
    endpoints.style.visibility = done ? 'visible' : 'hidden';
    pending.style.visibility = done ? 'hidden' : 'visible';
    const short = Number(tokens.toFixed(1)) + 'B';
    if (slider.value !== String(tokens)) slider.value = tokens;
    slider.setAttribute('aria-valuetext', short + ' tokens');
    progress.textContent = short + ' / ' + budget + 'B';
    updateReadout();
  }
  function labelPlay() {
    playback.textContent = frame ? t('Pause', '暂停') : current >= budget ? t('Replay', '重播') : t('Play', '播放');
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    labelPlay();
  }
  function play() {
    played = true;
    if (current >= budget) render(0);
    const from = current;
    const start = performance.now();
    function tick(now) {
      const to = Math.min(budget, from + (now - start) * budget / 6500);
      render(to);
      if (to < budget) frame = requestAnimationFrame(tick);
      else stop();
    }
    frame = requestAnimationFrame(tick);
    labelPlay();
  }
  playback.addEventListener('click', () => frame ? stop() : play());
  slider.addEventListener('input', () => { played = true; render(Number(slider.value)); stop(); });
  reduced.addEventListener('change', () => { if (reduced.matches) { played = true; render(budget); stop(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

  chart.append(header, legend, axes, controls, footer);
  figure.insertBefore(chart, figure.firstElementChild);
  figure.classList.add('paper-chart-enhanced', 'dyn-enhanced');
  render(budget);
  labelPlay();
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !played && !reduced.matches) play();
      if (!entry.isIntersecting && frame) stop();
    }, {threshold:0.12});
    observer.observe(figure);
  }
})();
