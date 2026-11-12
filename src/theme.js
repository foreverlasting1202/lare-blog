(() => {
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { preference = localStorage.getItem('lare-theme') || 'system'; } catch {}
  if (!['system', 'light', 'dark'].includes(preference)) preference = 'system';
  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#151a17' : '#ffffff');
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
  }
  document.querySelectorAll('[data-theme-select]').forEach(select => select.addEventListener('change', () => {
    preference = select.value;
    try { localStorage.setItem('lare-theme', preference); } catch {}
    apply();
  }));
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  apply();
  document.querySelectorAll('[data-theme-control]').forEach(control => { control.hidden = false; });
})();
