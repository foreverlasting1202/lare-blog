// Reading order and annotations for the paper figures. Coordinates use billions of training tokens.
const label = (en, zh) => ({ en, zh });
const context = (en, zh, panels) => ({ label: label(en, zh), panels });
const at = (x, en, zh) => ({ x, label: label(en, zh) });
const switchPoints = [at(3.75, 'Switch to knowledge', '转入知识'), at(26.25, 'Switch to math', '转入数学')];
const warmup = [at(20_000 * 524_288 / 1e9, 'Warmup ends', '预热结束')];
const shortRun = at(120, '120B run ends', '短训练结束');

export const chartConfig = {
  'april-pilot': {
    title: label('Knowledge improved. What happened to math?', '知识题答对得更多了，数学题呢？'),
    firstPanel: 0,
  },
  'domain-gradient-norm': {
    title: label('How large are the gradients from knowledge and math?', '知识和数学各自产生了多大的梯度？'),
    firstPanel: 0,
  },
  'math-rich-pilot': {
    title: label('How high can GSM8K scores climb with a math-heavy mix?', '数学占比高时，GSM8K 能涨到多少？'),
    firstPanel: 0,
  },
  'low-math-pilot': {
    title: label('When does GSM8K start to rise with less math?', '数学占比低时，GSM8K 什么时候才开始涨？'),
    firstPanel: 0,
  },
  'matched-schedules': {
    title: label('What survives the switch to a second domain?', '换一个领域训练，先学的还能剩下多少？'),
    firstPanel: 1,
    contextLabel: label('Schedule', '训练方式'),
    contexts: [context('Two stages', '分阶段训练', [0, 1]), context('Mixed throughout', '全程混合', [2, 3])],
    markers: warmup, panels: [{ markers: switchPoints }, { markers: switchPoints }],
  },
  'lare-training': {
    title: label('How LARE finds a weight for mathematics', 'LARE 怎样给数学调权重？'),
    firstPanel: 2, markers: warmup,
  },
  'long-training': {
    title: label('Does the gain hold from 120B to 240B tokens?', '从 120B 训到 240B，优势还在吗？'),
    firstPanel: 1, markers: [shortRun],
  },
  'grouping-trajectories': {
    title: label('What changes when sources share a weight?', '哪些数据来源适合共用一个权重？'),
    firstPanel: 1, markers: warmup,
  },
};

const line = (color, dash = '') => ({ color: `var(--paper-trace-${color})`, dash });
export const seriesStyles = {
  pilotMmlu: line('teal', '7 3'), pilotGsm: line('accent'),
  gradKnowledge: line('coral'), gradMath: line('blue'),
  mathWiki305: line('teal'), mathWiki301: line('blue', '7 3'),
  mathWiki300: line('accent'), mathWiki155: line('amber', '2 3'),
  lowMathBlue: line('blue'), lowMathGreen: line('green', '7 3'),
  direct: line('ink'), lare: line('accent'),
  knowledgeToMath: line('teal', '7 3'), mathToKnowledge: line('accent'),
  fixed2: line('amber', '6 3'), fixed3: line('teal'), fixed4: line('violet', '8 3'), fixed7: line('blue', '2 3'),
  direct4x: line('slate', '5 3'), lare4x: line('violet', '5 3'),
  direct8x: line('ink'), lare8x: line('accent'),
  lareDomain: line('teal', '7 3'), lareSource: line('amber', '3 3'), lareGrouped: line('accent'),
};
