(() => {
  const lang = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const local = text => typeof text === 'string' ? text : text[lang];
  const copy = lang === 'zh' ? {
    replay: '重播', view: '选择指标', legend: '显示曲线', context: '实验设置', weight: '权重比',
    ratio: '数学 / 知识权重', x: '训练 token 数（十亿）',
    empty: '选择一条曲线即可查看', hint: '悬停或轻触查看曲线近似值', unit: '训练 tokens',
    steps: '训练步数（千步）', stepHint: '悬停或轻触查看该次评测结果', accuracy: '准确率',
    gradientNorm: '梯度范数', normHint: '悬停查看读数，缺测时会标出相邻实测的步数。', normTrend: '浅线为实测值，深线为滑动中位数。', logScale: '对数刻度',
    noMeasurement: '本步未记录', nearestMeasurement: '邻近实测', firstMeasurement: '首次实测', lastMeasurement: '末次实测',
    keys: '用左右方向键查看相邻曲线点，Home 和 End 跳到两端，Esc 收起读数。',
  } : {
    replay: 'Replay', view: 'Select metric', legend: 'Visible curves', context: 'Experiment', weight: 'Weight ratio',
    ratio: 'Math / knowledge weight', x: 'Training tokens (billions)',
    empty: 'Select a curve to display', hint: 'Hover or tap for approximate curve values', unit: 'training tokens',
    steps: 'Training steps (thousands)', stepHint: 'Hover or tap to inspect an evaluation', accuracy: 'Accuracy',
    gradientNorm: 'Gradient norm', normHint: 'Hover or tap for values. Missing readings show the nearest measured step.', normTrend: 'Faint lines show measurements. Bold lines show rolling medians. ', logScale: 'log scale',
    noMeasurement: 'No reading at this step', nearestMeasurement: 'Nearest reading', firstMeasurement: 'First reading', lastMeasurement: 'Last reading',
    keys: 'Use left and right arrows to inspect adjacent points, Home and End for the endpoints, and Escape to dismiss.',
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const chartViews = new Map();
  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function graphic(tag, attrs = {}, content) {
    const el = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function button(className, text) {
    const el = element('button', className, text);
    el.type = 'button';
    return el;
  }
  function styleOf(series) {
    return window.LARE_PAPER_STYLES?.[series.key] || {color: series.color, dash: series.dashed ? '5 3' : ''};
  }
  function metricName(metric) { return metric === 'weightRatio' ? copy.weight : metric; }
  function nearest(items, target, accessor) {
    let first = 0, last = items.length - 1;
    while (first < last) {
      const middle = Math.floor((first + last) / 2);
      if (accessor(items[middle]) < target) first = middle + 1;
      else last = middle;
    }
    if (!first) return first;
    return target - accessor(items[first - 1]) <= accessor(items[first]) - target ? first - 1 : first;
  }
  const tokenLabel = value => Number(value.toFixed(value < 10 ? 2 : 1)) + 'B';

  function mount(image, data, config) {
    const slug = image.dataset.paperChart;
    const steps = data.xUnit === 'kSteps';
    const xMax = data.xMax ?? data.tokensB;
    const formatX = steps
      ? value => Math.round(value * 1000).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')
      : tokenLabel;
    const stepLabel = value => lang === 'zh' ? '第 ' + formatX(value) + ' 步' : 'Step ' + formatX(value);
    const figure = image.closest('figure');
    const card = element('div', 'paper-chart');
    const head = element('div', 'paper-chart-header');
    const heading = element('div', 'paper-chart-heading');
    const figureNo = figure.querySelector('.figure-number')?.textContent;
    if (figureNo) heading.append(element('span', 'paper-chart-kicker', figureNo));
    const title = element('h3', 'paper-chart-title', local(config.title));
    title.id = slug + '-chart-title';
    heading.append(title);
    const replay = button('paper-chart-replay', copy.replay);
    const replayIcon = element('span', '', '↻');
    replayIcon.setAttribute('aria-hidden', 'true');
    replay.prepend(replayIcon);
    head.append(heading, replay);

    const views = element('div', 'paper-chart-views');
    const tabs = element('div', 'paper-chart-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', copy.view);
    const legends = element('div', 'paper-chart-legend');
    legends.setAttribute('role', 'group');
    legends.setAttribute('aria-label', copy.legend);
    const stage = element('div', 'paper-chart-stage');
    const chart = graphic('svg', {
      class: 'paper-chart-svg', tabindex: '0', role: 'group', 'aria-labelledby': title.id,
      'aria-describedby': slug + '-chart-help', 'aria-keyshortcuts': 'ArrowLeft ArrowRight Home End Escape',
    });
    const tip = element('div', 'paper-chart-tooltip');
    tip.hidden = true;
    tip.setAttribute('aria-hidden', 'true');
    stage.append(chart, tip);
    const footer = element('div', 'paper-chart-footer');
    const firstPanel = data.panels[0];
    let readingHint = steps ? copy.stepHint : copy.hint;
    if (firstPanel.metric === 'gradientNorm') {
      readingHint = (firstPanel.series.some(series => series.trend) ? copy.normTrend : '') + copy.normHint;
    }
    const reading = element('span', 'paper-chart-reading', readingHint);
    footer.append(reading);
    const help = element('span', 'sr-only paper-chart-inspect', copy.keys);
    help.id = slug + '-chart-help';
    const status = element('span', 'sr-only');
    status.setAttribute('role', 'status');
    card.append(head);
    if (data.panels.length > 1) card.append(views);
    card.append(legends, stage, footer, help, status);

    let selected = config.firstPanel ?? 0;
    const allPanels = data.panels.map((_, i) => i);
    const contexts = config.contexts;
    let context = contexts?.findIndex(group => group.panels.includes(selected));
    let contextSelect;
    if (contexts) {
      const field = element('label', 'paper-chart-context');
      const select = element('select');
      contextSelect = select;
      contexts.forEach((group, i) => select.add(new Option(local(group.label), String(i))));
      select.value = String(context);
      select.addEventListener('change', () => {
        context = Number(select.value);
        const options = contexts[context].panels;
        changePanel(options.find(i => data.panels[i].metric === data.panels[selected].metric) ?? options[0]);
      });
      field.append(element('span', '', local(config.contextLabel || copy.context)), select);
      views.append(field);
    }
    views.append(tabs);
    const hiddenSeries = data.panels.map(() => new Set());
    let width = 0, height, left, right, top, bottom;
    let x, y, times = [], hoverLayer, revealClip;
    let inspection = -1, frame = 0, entered = false;

    function clearInspection() {
      inspection = -1;
      hoverLayer?.replaceChildren();
      tip.hidden = true;
      status.textContent = '';
    }
    function finish() {
      cancelAnimationFrame(frame);
      frame = 0;
      revealClip?.setAttribute('width', right - left);
    }
    function reveal(duration) {
      finish();
      if (reduced.matches || document.hidden || !stage.getBoundingClientRect().width) return;
      clearInspection();
      revealClip.setAttribute('width', '0');
      const start = performance.now();
      function tick(now) {
        const t = Math.max(0, Math.min(1, (now - start) / duration));
        revealClip.setAttribute('width', (right - left) * t);
        frame = t < 1 ? requestAnimationFrame(tick) : 0;
      }
      frame = requestAnimationFrame(tick);
    }
    function changePanel(index) {
      selected = index;
      const activePanels = contexts?.[context]?.panels || allPanels;
      // Preserve focus when the current metric is switched using its button.
      const focused = tabs.contains(document.activeElement);
      tabs.replaceChildren();
      for (const i of activePanels.length > 1 ? activePanels : []) {
        const control = button('paper-chart-tab', metricName(data.panels[i].metric));
        control.setAttribute('aria-pressed', String(selected === i));
        control.addEventListener('click', () => { if (i !== selected) changePanel(i); });
        tabs.append(control);
        if (focused && selected === i) control.focus({preventScroll: true});
      }
      const panel = data.panels[selected];
      legends.replaceChildren();
      for (const series of [...panel.series, ...(panel.guides || [])]) {
        const style = styleOf(series);
        const guide = panel.guides?.includes(series);
        const control = button('paper-chart-series');
        control.style.setProperty('--series-color', style.color);
        control.setAttribute('aria-pressed', String(!hiddenSeries[selected].has(series.key)));
        const swatch = graphic('svg', {class: 'paper-chart-swatch', width: '22', height: '10', viewBox: '0 0 22 10', 'aria-hidden': 'true'});
        swatch.append(graphic('line', {x1: 1, x2: 21, y1: 5, y2: 5, stroke: style.color, 'stroke-width': 2.4, 'stroke-dasharray': style.dash || (guide ? '5 3' : 'none')}));
        control.append(swatch, element('span', '', local(series.label)));
        control.addEventListener('click', () => {
          const hidden = hiddenSeries[selected];
          if (hidden.has(series.key)) hidden.delete(series.key);
          else hidden.add(series.key);
          control.setAttribute('aria-pressed', String(!hidden.has(series.key)));
          draw();
        });
        legends.append(control);
      }
      draw();
      if (entered) reveal(650);
    }

    function draw() {
      clearInspection();
      finish();
      const measured = Math.round(stage.getBoundingClientRect().width);
      // A panel in a closed disclosure receives its true size when opened.
      width = measured || 600;
      height = width < 470 ? 244 : 290;
      left = width < 470 ? 33 : 41;
      right = width - 12;
      top = 46;
      bottom = height - 47;
      const panel = data.panels[selected];
      const [low, high] = panel.yDomain;
      x = value => left + value / xMax * (right - left);
      const scaleY = panel.yScale === 'log' ? Math.log10 : value => value;
      const yMin = scaleY(low), ySpan = scaleY(high) - yMin;
      y = value => bottom - (scaleY(value) - yMin) / ySpan * (bottom - top);
      chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
      chart.setAttribute('width', width);
      chart.setAttribute('height', height);
      chart.replaceChildren();
      let yTitle;
      if (panel.metric === 'gradientNorm') yTitle = copy.gradientNorm;
      else if (panel.metric === 'weightRatio') yTitle = copy.ratio;
      else yTitle = (panel.metric === 'accuracy' ? copy.accuracy : panel.metric) + ' (%)';
      if (panel.yScale === 'log') yTitle += ' · ' + copy.logScale;
      chart.append(graphic('title', {}, local(config.title) + ' · ' + yTitle));
      chart.append(graphic('text', {x: left, y: 16, class: 'paper-chart-axis-title paper-chart-ylabel'}, yTitle));
      for (const n of panel.yTicks) {
        chart.append(graphic('line', {x1: left, x2: right, y1: y(n), y2: y(n), class: 'paper-chart-grid'}));
        chart.append(graphic('text', {x: left - 8, y: y(n), 'dominant-baseline': 'middle', 'text-anchor': 'end', class: 'paper-chart-axis-label'}, n));
      }
      chart.append(graphic('line', {x1: left, x2: right, y1: bottom, y2: bottom, class: 'paper-chart-axis'}));
      const ticks = data.xTicks;
      let previous = -Infinity;
      for (let i = 0; i < ticks.length; i++) {
        const pos = x(ticks[i]), last = i === ticks.length - 1;
        if (!last && (pos - previous < 29 || x(ticks.at(-1)) - pos < 29)) continue;
        previous = pos;
        chart.append(graphic('line', {x1: pos, x2: pos, y1: bottom, y2: bottom + 4, class: 'paper-chart-axis'}));
        chart.append(graphic('text', {x: pos, y: bottom + 17, 'text-anchor': 'middle', class: 'paper-chart-axis-label'}, ticks[i]));
      }
      chart.append(graphic('text', {x: (left + right) / 2, y: height - 5, 'text-anchor': 'middle', class: 'paper-chart-axis-title paper-chart-xlabel'}, steps ? copy.steps : copy.x));

      const markers = config.panels?.[selected]?.markers || config.markers || [];
      for (const [i, marker] of markers.entries()) {
        const pos = x(marker.x);
        const towardLeft = pos > (left + right) / 2;
        const markerTop = width < 320 && i % 2 === 1 ? top - 20 : top;
        chart.append(graphic('line', {x1:pos, x2:pos, y1:markerTop, y2:bottom, class:'paper-chart-marker-line'}));
        chart.append(graphic('text', {x:pos + (towardLeft ? -4 : 4), y:markerTop - 6, 'text-anchor':towardLeft ? 'end' : 'start', class:'paper-chart-marker-label'}, local(marker.label)));
      }
      const clipId = 'curves-' + slug;
      const defs = graphic('defs'), clip = graphic('clipPath', {id: clipId});
      revealClip = graphic('rect', {x:left, y:top, width:right-left, height:bottom-top});
      clip.append(revealClip);
      defs.append(clip);
      chart.append(defs);
      const lines = graphic('g', {'clip-path': 'url(#' + clipId + ')'});
      const visible = panel.series.filter(s => !hiddenSeries[selected].has(s.key));
      const guides = (panel.guides || []).filter(s => !hiddenSeries[selected].has(s.key));
      const plotPoints = points => points.map(([a,b]) => x(a).toFixed(2) + ',' + y(b).toFixed(2)).join(' ');
      for (const series of visible.filter(s => s.trend)) {
        lines.append(graphic('polyline', {
          points:plotPoints(series.points), stroke:styleOf(series).color, 'stroke-width':1.1, 'stroke-opacity':0.33,
          class:'paper-chart-line', 'data-series':series.key,
        }));
      }
      for (const series of [...guides, ...visible]) {
        const style = styleOf(series);
        const points = plotPoints(series.trend || series.points);
        const guide = guides.includes(series);
        lines.append(graphic('polyline', {
          points, fill:'none', stroke:style.color, 'stroke-dasharray':style.dash || (guide ? '5 3' : 'none'),
          'stroke-width':guide ? 1.5 : 2.3, 'stroke-linejoin':'round', 'stroke-linecap':'round',
          class:'paper-chart-line', 'data-series':series.key,
        }));
      }
      if (panel.metric === 'gradientNorm') {
        for (const series of visible) {
          const [step, norm] = series.points.at(-1);
          lines.append(graphic('circle', {cx:x(step), cy:y(norm), r:2.6,
            fill:styleOf(series).color, class:'paper-chart-point'}));
        }
      }
      chart.append(lines);
      if (!visible.length && !guides.length) chart.append(graphic('text', {x:(left+right)/2, y:(top+bottom)/2, 'text-anchor':'middle', class:'paper-chart-axis-title'}, copy.empty));
      // PDF serialization can place coincident vertices a small fraction of a
      // pixel apart. Give each such column a single keyboard stop.
      const sortedTimes = [...new Set(visible.flatMap(series => series.points.map(p => p[0])))].sort((a,b) => a-b);
      times = [];
      for (const t of sortedTimes) {
        if (!times.length || t - times.at(-1) > xMax / 100000) times.push(t);
      }
      hoverLayer = graphic('g', {class:'paper-chart-inspection', 'pointer-events':'none', 'aria-hidden':'true'});
      chart.append(hoverLayer);
    }

    function inspect(index, announce = false) {
      if (!times.length || index < 0 || index >= times.length) return;
      entered = true;
      finish();
      if (index === inspection && !announce) return;
      inspection = index;
      const time = times[index], pos = x(time), panel = data.panels[selected];
      hoverLayer.replaceChildren(graphic('line', {x1:pos, x2:pos, y1:top, y2:bottom, class:'paper-chart-crosshair'}));
      const tipTitle = steps ? stepLabel(time) : '≈ ' + formatX(time) + ' ' + copy.unit;
      tip.replaceChildren(element('div', 'paper-chart-tooltip-title', tipTitle));
      const description = [tipTitle];
      const norms = panel.metric === 'gradientNorm';
      for (const series of panel.series.filter(s => !hiddenSeries[selected].has(s.key))) {
        const points = series.points;
        const tolerance = xMax / 100000;
        const first = points[0][0], last = points.at(-1)[0];
        if (!norms && (time < first - tolerance || time > last + tolerance)) continue;
        const [a,b] = points[nearest(points, time, point => point[0])];
        if (!norms && steps && a !== time) continue;
        const color = styleOf(series).color;
        const row = element('div', 'paper-chart-tooltip-row');
        const key = element('span', 'paper-chart-tooltip-key');
        const dot = element('i', 'paper-chart-dot');
        dot.style.setProperty('--series-color', color);
        key.append(dot, document.createTextNode(local(series.label)));
        if (norms && a !== time) {
          row.append(key, element('span', 'paper-chart-tooltip-missing', copy.noMeasurement));
          const source = time < first ? copy.firstMeasurement : time > last ? copy.lastMeasurement : copy.nearestMeasurement;
          const detail = source + ' · ' + stepLabel(a) + ' · ' + Number(b.toPrecision(3));
          tip.append(row, element('div', 'paper-chart-tooltip-detail', detail));
          description.push(local(series.label) + ' ' + copy.noMeasurement + '. ' + detail);
          continue;
        }
        hoverLayer.append(graphic('circle', {cx:x(a), cy:y(b), r:3.3, fill:color, class:'paper-chart-point'}));
        const isWeight = panel.metric === 'weightRatio';
        let value;
        if (norms) value = Number(b.toPrecision(3)).toString();
        else if (steps) value = b.toFixed(2) + '%';
        else value = '≈ ' + b.toFixed(isWeight ? 2 : 1) + (isWeight ? '×' : '%');
        // Some paths were sampled at different positions. Attach the actual x
        // to its value instead of synthesizing a checkpoint at the cursor.
        if (formatX(a) !== formatX(time)) value += ' · ' + formatX(a);
        row.append(key, element('strong', 'paper-chart-tooltip-value', value));
        tip.append(row);
        description.push(local(series.label) + ' ' + value);
      }
      tip.hidden = false;
      tip.style.left = Math.max(3, Math.min(width - tip.offsetWidth - 3, pos < width/2 ? pos + 12 : pos - tip.offsetWidth - 12)) + 'px';
      tip.style.top = Math.max(3, Math.min(top + 2, height - tip.offsetHeight - 3)) + 'px';
      if (announce) status.textContent = description.join(' · ');
    }

    function inspectPointer(event) {
      const rect = chart.getBoundingClientRect();
      const px = (event.clientX - rect.left) * width / rect.width;
      const py = (event.clientY - rect.top) * height / rect.height;
      const norms = data.panels[selected].metric === 'gradientNorm';
      if (px < left - 6 || px > (norms ? width : right + 6) || py < top - 6 || py > bottom + (norms ? 22 : 6) || !times.length) {
        clearInspection();
        return;
      }
      const time = (px-left)/(right-left)*xMax;
      inspect(nearest(times, time, t => t));
    }
    chart.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') inspectPointer(ev); });
    chart.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') clearInspection(); });
    chart.addEventListener('pointerup', inspectPointer);
    chart.addEventListener('blur', clearInspection);
    chart.addEventListener('focus', () => {
      if (chart.matches(':focus-visible') && times.length) inspect(0, true);
    });
    chart.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { clearInspection(); return; }
      if (!times.length) return;
      let index = inspection;
      switch (ev.key) {
        case 'ArrowLeft': index--; break;
        case 'ArrowRight': index++; break;
        case 'Home': index = 0; break;
        case 'End': index = times.length - 1; break;
        default: return;
      }
      ev.preventDefault();
      inspect(Math.max(0, Math.min(times.length - 1, index)), true);
    });
    document.addEventListener('pointerdown', ev => {
      if (inspection >= 0 && !card.contains(ev.target)) clearInspection();
    });
    replay.addEventListener('click', () => reveal(1350));
    reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });

    image.before(card);
    changePanel(selected);
    figure.classList.add('paper-chart-enhanced');
    new ResizeObserver(entries => {
      const next = Math.round(entries[0].contentRect.width);
      if (next && next !== width) draw();
    }).observe(stage);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        if (!entered) {
          entered = true;
          reveal(850);
        }
      }
    }, {threshold: 0.18});
    observer.observe(stage);

    chartViews.set(slug, {
      capture() {
        const hidden = hiddenSeries.map(set => [...set]);
        if (!hidden.some(keys => keys.length) && selected === (config.firstPanel ?? 0)) return null;
        return {panel: selected, hidden};
      },
      restore(view) {
        if (!Number.isInteger(view?.panel) || !data.panels[view.panel]) return;
        data.panels.forEach((panel, index) => {
          const saved = view.hidden?.[index];
          const keys = [...panel.series, ...(panel.guides || [])].map(series => series.key);
          hiddenSeries[index] = new Set(Array.isArray(saved) ? keys.filter(key => saved.includes(key)) : []);
        });
        if (contexts) {
          context = contexts.findIndex(group => group.panels.includes(view.panel));
          contextSelect.value = String(context);
        }
        changePanel(view.panel);
        finish();
      },
    });
  }

  document.querySelectorAll('img[data-paper-chart]').forEach(image => {
    const key = image.dataset.paperChart;
    const data = window.LARE_PAPER_SERIES?.[key], config = window.LARE_PAPER_CHARTS?.[key];
    if (data?.panels.length && config) mount(image, data, config);
  });
  window.LARE_PAPER_VIEW = {
    capture: () => Object.fromEntries([...chartViews].map(([key, view]) => [key, view.capture()]).filter(([, state]) => state)),
    restore: snapshot => {
      for (const [key, view] of Object.entries(snapshot || {})) chartViews.get(key)?.restore(view);
    },
  };
})();
