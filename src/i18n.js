/* Chinese is rendered at build time. This also localizes live chart readouts. */
(() => {
  const phrases = /*__ZH_DICTIONARY__*/ {};
  const patterns = [
    [/^([\d.]+) billion training tokens$/, (_, n) => `已训练 ${n} 十亿 tokens`],
    [/^(You called it\. )?GSM8K fell from ([\d.]+)% to ([\d.]+)%, a drop of ([\d.]+) percentage points\.$/, (_, matched, start, end, drop) => `${matched ? '猜对了。' : ''}GSM8K 从 ${start}% 降到了 ${end}%，下降了 ${drop} 个百分点。`],
    [/^Fixed 1:([\d.]+)( reweighting)?$/, (_, n, suffix) => `固定 1:${n}${suffix ? ' 重加权' : ''}`],
    [/^fixed 1:([\d.]+)$/, (_, n) => `固定 1:${n}`],
    [/^Weighted mean = (.+)$/, (_, n) => `加权均值 = ${n}`],
    [/^([\d.]+) times the knowledge coefficient$/, (_, n) => `知识系数的 ${n} 倍`],
    [/^Normalized coefficient shares: knowledge (.+) percent, reasoning (.+) percent\.$/, (_, k, m) => `归一化系数占比：知识 ${k}%，推理 ${m}%。`],
    [/^(.+): direct mixture (.+) percent, LARE (.+) percent$/, (_, name, direct, lare) => `${name}：直接混合 ${direct}%，LARE ${lare}%`],
    [/^([+−\-\d.]+) pp$/, (_, n) => `${n} 个百分点`],
    [/^(.+)-token matched comparison · (.+) · accuracy \(%\)$/, (_, tokens, ratio) => `${tokens}-token 匹配比较 · ${ratio} · 准确率（%）`],
    [/^At the same exposure, this run improves MMLU by (.+) and GSM8K by (.+) percentage points over direct mixing\.$/, (_, k, m) => `在相同数据暴露下，相对直接混合，本次运行的 MMLU 提高 ${k} 个百分点，GSM8K 提高 ${m} 个百分点。`],
    [/^A larger reasoning coefficient trades some knowledge for reasoning: MMLU changes by (.+) points and GSM8K by (.+) points\.$/, (_, k, m) => `更大的推理系数以部分知识能力换取推理能力：MMLU 变化 ${k} 个百分点，GSM8K 变化 ${m} 个百分点。`],
    [/^(LARE|Fixed 1:[\d.]+) · ([\d:]+) exposure$/, (_, recipe, ratio) => `${recipe === 'LARE' ? recipe : recipe.replace('Fixed', '固定')} · 数据暴露 ${ratio}`],
    [/^([\d.]+) times( reasoning coefficient)?$/, (_, n) => `推理系数 ${n} 倍`],
    [/^Measured capability frontier\. Selected (.+) at (\d+) to 1 exposure: MMLU (.+), GSM8K (.+) percent\.$/, (_, recipe, ratio, k, m) => `实测能力前沿。所选方案 ${recipe === 'LARE' ? 'LARE' : recipe.replace('fixed 1 to ', '固定 1:').replace(' weighting', ' 加权')}，数据暴露比 ${ratio}:1：MMLU ${k}%，GSM8K ${m}%。`],
    [/^vs\. direct: (.+) MMLU · (.+) GSM8K pp$/, (_, k, m) => `相对直接混合：MMLU ${k} · GSM8K ${m} 个百分点`],
    [/^Loss ratio K : R = (.+)$/, (_, ratio) => `损失权重比 K : R = ${ratio}`],
    [/^data ([\d:]+)$/, (_, ratio) => `数据 ${ratio}`],
    [/^(.+) loss ([\d.]+), inverse-square-root score ([\d.]+)$/, (_, domain, loss, score) => `${domain === 'Knowledge' ? '知识' : '推理'}损失 ${loss}，平方根倒数得分 ${score}`],
    [/^Step ([\d,]+), (.+) billion sampled tokens\. Benchmarks are the latest logged evaluation at or before this step\.$/, (_, step, tokens) => `第 ${step} 步，已采样 ${tokens} 十亿 tokens。基准分数取该步及之前最近一次日志评测。`],
    [/^(Direct mixture|Fixed 1:[\d.]+): (.+)$/, (_, label, score) => `${translate(label)}：${score}`],
    [/^Figure (\d+)\.(.*)$/, (_, n, suffix) => `图 ${n}。${suffix ? translate(suffix) : ''}`],
  ];
  function translate(value) {
    const match = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
    const [, before, raw, after] = match;
    const key = raw.replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    if (!key) return value;
    if (Object.hasOwn(phrases, key)) return before + phrases[key] + after;
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(key)) return before + key.replace(pattern, replacement) + after;
    }
    if (key.includes(' & ')) return before + key.split(' & ').map(part => translate(part)).join('与') + after;
    return value;
  }
  globalThis.LARE_I18N = { translate };
  if (typeof document === 'undefined') return;

  const chinese = document.documentElement.lang === 'zh-CN';
  const ignored = 'script,style,pre,code,math,[data-no-translate]';
  const attributes = ['aria-label', 'aria-valuetext', 'title', 'alt', 'data-caption'];
  function localize(root) {
    if (!chinese || !root.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest(ignored)) return;
      const result = translate(root.nodeValue);
      if (result !== root.nodeValue) root.nodeValue = result;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(ignored)) return;
    for (const attr of attributes) {
      if (!root.hasAttribute(attr)) continue;
      const original = root.getAttribute(attr), result = translate(original);
      if (result !== original) root.setAttribute(attr, result);
    }
    root.childNodes.forEach(localize);
  }
  if (chinese) {
    localize(document.body);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(localize);
        else if (record.type === 'characterData') localize(record.target);
        else {
          const value = record.target.getAttribute(record.attributeName);
          if (value === null) continue;
          const result = translate(value);
          if (result !== value) record.target.setAttribute(record.attributeName, result);
        }
      }
    }).observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:attributes });
  }

  // Keep the same experiment and nearby section when changing language.
  const buttonGroups = ['recipe', 'history-run'];
  function captureState() {
    const fields = Object.fromEntries([...document.querySelectorAll('input[id], select[id]')].filter(el => el.id !== 'site-theme').map(el => [el.id, el.value]));
    const buttons = Object.fromEntries(buttonGroups.map(group => [group, document.querySelector(`[data-${group}][aria-pressed="true"]`)?.getAttribute(`data-${group}`)]));
    const sections = [...document.querySelectorAll('.article-header[id], article section[id], article figure[id]')];
    const header = document.querySelector('.site-header').getBoundingClientRect().height;
    const previous = sections.filter(el => el.getBoundingClientRect().top <= header + 40).at(-1) || sections[0];
    return { fields, buttons, details:[...document.querySelectorAll('details')].map(el => el.open), adaptive:document.querySelector('#frontier-adaptive')?.getAttribute('aria-pressed') === 'true', anchor:previous?.id || 'top', offset:previous ? previous.getBoundingClientRect().top - header : 0, theme:document.querySelector('[data-theme-select]')?.value };
  }
  document.querySelectorAll('[data-language]').forEach(link => link.addEventListener('click', event => {
    if (link.getAttribute('aria-current') === 'page') { event.preventDefault(); return; }
    if (!document.querySelector('article.article-prose')) return;
    const state = captureState(), target = new URL(link.href);
    target.searchParams.set('view', JSON.stringify(state));
    target.hash = state.anchor;
    link.href = target.href;
  }));
  async function restoreState() {
    const url = new URL(location.href), encoded = url.searchParams.get('view');
    if (!encoded) return;
    try {
      const state = JSON.parse(encoded);
      document.querySelectorAll('details').forEach((el, index) => { if (state.details?.[index] !== undefined) el.open = state.details[index]; });
      for (const [id, value] of Object.entries(state.fields || {}).filter(([id]) => document.getElementById(id)?.tagName === 'SELECT')) {
        const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('change'));
      }
      for (const [id, value] of Object.entries(state.fields || {}).filter(([id]) => document.getElementById(id)?.tagName === 'INPUT')) {
        const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('input'));
      }
      const buttons = Array.isArray(state.buttons)
        ? { recipe:state.buttons[0], 'history-run':state.buttons[2] }
        : state.buttons;
      buttonGroups.forEach(group => {
        const value = buttons?.[group];
        const el = [...document.querySelectorAll(`[data-${group}]`)].find(button => button.getAttribute(`data-${group}`) === value);
        if (el) el.click();
      });
      const adaptive = document.querySelector('#frontier-adaptive');
      if (adaptive && (adaptive.getAttribute('aria-pressed') === 'true') !== !!state.adaptive) adaptive.click();
      if (state.theme) { const theme = document.querySelector('[data-theme-select]'); theme.value = state.theme; theme.dispatchEvent(new Event('change')); }
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const anchor = document.getElementById(state.anchor);
      if (anchor) window.scrollTo({ top:window.scrollY + anchor.getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().height - state.offset, behavior:'instant' });
      url.searchParams.delete('view');
      history.replaceState(null, '', url);
    } catch (error) { console.warn('Could not restore the previous reading position.', error); }
  }
  window.addEventListener('load', restoreState, { once:true });
})();
