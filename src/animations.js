(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Animate the actual before/after bars on entry and between reported budgets.
  let resultsVisible = false;
  const animateResults = () => {
    if (reducedMotion.matches) return;
    document.querySelectorAll('.benchmark-bar').forEach((bar, index) => {
      bar.animate([{ width: bar.dataset.previousWidth || '0%' }, { width: bar.style.width }], {
        duration: 750, delay: Math.floor(index / 2) * 65, easing: 'cubic-bezier(.2,.7,.2,1)',
      });
    });
  };
  const resultsObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && !resultsVisible) { resultsVisible = true; animateResults(); }
  }, { threshold: .25 });
  resultsObserver.observe(document.querySelector('.results-explorer'));
  window.addEventListener('lare:results', () => { if (resultsVisible) animateResults(); });
})();
