# LARE blog

A bilingual research blog on pretraining a 1.5B model for knowledge and mathematical reasoning. The article follows the experiments from a stalled GSM8K curve through data mixing, loss weighting, and grouping sources by calibration loss.

- [中文](https://foreverlasting1202.github.io/lare-blog/)
- [English](https://foreverlasting1202.github.io/lare-blog/en/blog/lare/)
- [Paper](https://arxiv.org/abs/2610.32141)

## Local preview

Use Node.js 20 or newer. Install the build dependencies once, then build and preview the site.

```sh
npm ci
npm run build
npm run preview
```

Open `http://localhost:4321/` for Chinese or `http://localhost:4321/en/blog/lare/` for English. After editing the source, rebuild and refresh.

## Deployment

The GitHub Actions workflow in `.github/workflows/pages.yml` builds and validates the website on pushes and pull requests to `main`. Pushes to `main` and manual workflow runs also publish `dist/` to this repository's GitHub Pages site.

Pages uses **Settings → Pages → Build and deployment → Source: GitHub Actions**. The deployment job is restricted to `foreverlasting1202/lare-blog` on `main`, with a repository-scoped `GITHUB_TOKEN` and the `github-pages` environment. No personal access token or deployment secret is required in the workflow.

This is a project site at `/lare-blog/`. Its workflow does not modify the separate personal-homepage repository. No custom domain is configured in this project.

The build validates internal links, asset and font paths, and cross-page anchors at both a domain root and a project subdirectory. It rejects machine-specific URLs and excludes development logs, audits, and manuscript files from the output. The article reports the paper’s numerical results and reproduces its training-curve figures.

## Editing

- [中文正文](article/zh-CN.md) and [English article](article/en.md): edit the title, subtitle, TL;DR, section headings and paragraphs here. Each named figure marker inserts an existing figure at that point.
- `src/index.html`: shared layout, interactive figures and the labeled equation groups in sections 4 and 5.
- `src/locales/zh-CN.json`: Chinese translations.
- `src/i18n.js`: dynamic labels and language-switch state preservation.
- `src/app.js`, `src/animations.js`, `src/studies.js`: interactive comparisons, measured source sorting, and benchmark controls.
- `src/quadratic-frontier.js` and `src/quadratic-frontier.css`: interactive views of the linear-regression example from the paper.
- `src/paper-playback.js`: responsive training charts, metric selection, curve inspection and replay. The original figures remain available as PDFs and in the print layout.
- `src/*.css`: typography, layout, charts, and responsive styles.
- `src/research-story.css`: research notes, original figures, and the source-grouping diagram.
- `public/`: fonts, icons, and the measured chart data used by the site.
- `public/figures/sources.json`: provenance and interpretation notes for reused figures.
- `scripts/prepare-figure-series.py`: regenerate `public/figures/paper-series.json` from the vector paths and axes in the six paper PDFs. The optional extraction step uses Python and pypdf. The long-run figure retains the paper’s 11-checkpoint smoothing.
- `scripts/paper-chart-config.mjs`: bilingual chart titles, opening panels, phase markers and series styles.
- `scripts/build.mjs` and `scripts/check-site.mjs`: static build and validation.

中文正文用 Markdown 编写。改好 [article/zh-CN.md](article/zh-CN.md) 后，在 blog 目录运行 `npm run build`，刷新预览就能看到。行末的 `{#overview}` 等标记用于目录与语言切换，`<!-- figure:stage-history -->` 等标记决定图的位置。配图和界面译文在 `src/locales/zh-CN.json`。

行内公式直接写在句子里，例如 `领域 $j$ 的采样比例为 $p_j$。`。独立公式另起一段，例如 `$$\eta_j = \bar{\eta}\,w_j$$`。构建时 KaTeX 会排好公式，数学字体和样式随网页一起发布，离线也能阅读。

[OUTLINE.md](OUTLINE.md) 保存原始提纲和配图计划。[EXPERIMENTS_NEEDED.md](EXPERIMENTS_NEEDED.md) 记录论文中各项数值的出处，以及供复核的实验资料。

The optional `npm run package` command creates `releases/lare-site.zip`. GitHub Actions builds directly from source and does not use that ZIP.

## Credits

The site layout, Training Farm branding, and citation footer follow [Training Farm / PURO](https://training.farm/blog/puro/) and the [SMELT reference site](https://github.com/Outsider565/smelt-preview). Original Training Farm site credits are retained in the footer. About Us links point to the corresponding Training Farm pages.

Noto Sans CJK SC fonts are distributed under the license in `public/fonts/OFL.txt`; their source and subset details are recorded in `public/fonts/README.txt`.
