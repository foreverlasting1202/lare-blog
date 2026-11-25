(() => {
  const figure = document.getElementById('loss-accuracy-figure');
  const data = window.LARE_LOSS_ACCURACY;
  if (!figure || !data || !window.LARE_LOSS_ACCURACY_PLOT) return;

  const player = figure.querySelector('[data-loss-player]');
  const button = player.querySelector('button');
  const slider = player.querySelector('input[type="range"]');
  const reading = player.querySelector('.dyn-progress');
  const language = document.documentElement.lang;
  const zh = language.startsWith('zh');
  const plot = window.LARE_LOSS_ACCURACY_PLOT.create(player, data, language);
  // The original figure starts at the first evaluation after initialization.
  const first = 1;
  const last = data.steps.length - 1;
  const format = new Intl.NumberFormat(language);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current;
  let frame = 0;
  let played = false;
  slider.max = last;

  function draw(index) {
    if (index === current) return;
    current = index;
    plot.render(index);
    slider.value = index;
    const step = format.format(data.steps[index]);
    const label = zh ? '第 ' + step + ' 步' : 'Step ' + step;
    slider.setAttribute('aria-valuetext', label);
    reading.textContent = label;
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    button.textContent = current === last ? (zh ? '重播' : 'Replay') : (zh ? '播放' : 'Play');
  }

  function play() {
    played = true;
    if (current === last) draw(first);
    const startIndex = current;
    const startTime = performance.now();
    const duration = 11500;
    function advance(now) {
      // The first frame timestamp can precede the click within that frame.
      const elapsed = Math.max(0, now - startTime);
      const index = Math.min(last, startIndex + Math.floor(elapsed / duration * (last - first)));
      draw(index);
      if (index < last) frame = requestAnimationFrame(advance);
      else stop();
    }
    button.textContent = zh ? '暂停' : 'Pause';
    frame = requestAnimationFrame(advance);
  }

  button.addEventListener('click', () => frame ? stop() : play());
  slider.addEventListener('input', () => {
    played = true;
    draw(slider.valueAsNumber);
    stop();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      draw(last);
      stop();
    }
  });

  draw(last);
  player.hidden = false;
  figure.classList.add('paper-chart-enhanced', 'dyn-enhanced');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.16 && !document.hidden && !played && !reduced.matches) play();
      if (!entry.isIntersecting && frame) stop();
    }, {threshold:[0, 0.16]}).observe(figure);
  }
})();
