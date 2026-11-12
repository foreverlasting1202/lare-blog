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
  const ratios = ['7', '3', '1'];
  const metric = document.querySelector('#replication-metric');
  const replicationCase = document.querySelector('#replication-case');
  const replicationGrid = document.querySelector('#replication-grid');
  const score = value => value.toFixed(2);
  const delta = value => `${value < 0 ? '−' : '+'}${score(Math.abs(value))}`;
  const direction = value => value < 0 ? 'decrease' : 'increase';
  function updateReplication() {
    const index = metric.value === 'mmlu' ? 0 : 1;
    const benchmark = metric.selectedOptions[0].textContent;
    const [optimizer, selectedRatio] = replicationCase.value.split('-');
    const [direct, lare] = replications[optimizer][ratios.indexOf(selectedRatio)];
    for (const cell of replicationGrid.querySelectorAll('button')) {
      const [method, mixture] = cell.dataset.replicationCase.split('-');
      const [baseline, reweighted] = replications[method][ratios.indexOf(mixture)];
      const change = reweighted[index] - baseline[index];
      cell.textContent = delta(change);
      cell.dataset.direction = direction(change);
      cell.setAttribute('aria-pressed', String(cell.dataset.replicationCase === replicationCase.value));
      cell.setAttribute('aria-label', `${method} · ${mixture}:1 · ${benchmark} · ${delta(change)}`);
    }
    document.querySelector('#replication-setting').textContent = `${optimizer} · ${selectedRatio}:1 · ${benchmark}`;
    document.querySelector('#replication-direct').textContent = score(direct[index]);
    document.querySelector('#replication-lare').textContent = score(lare[index]);
  }
  replicationGrid.innerHTML = Object.keys(replications).map(optimizer => {
    const cells = ratios.map(mixture => `<td><button type="button" data-replication-case="${optimizer}-${mixture}"></button></td>`);
    return `<tr><th scope="row">${optimizer}</th>${cells.join('')}</tr>`;
  }).join('');
  replicationGrid.addEventListener('click', event => {
    const button = event.target.closest('button[data-replication-case]');
    if (!button) return;
    replicationCase.value = button.dataset.replicationCase;
    updateReplication();
  });
  replicationCase.addEventListener('input', updateReplication);
  metric.addEventListener('change', updateReplication);
  updateReplication();
})();
