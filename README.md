# LARE blog

An interactive tutorial on knowledge, reasoning, and learning more from the same training data, available in English and Chinese.

- [中文](https://foreverlasting1202.github.io/lare-blog/)
- [English](https://foreverlasting1202.github.io/lare-blog/en/blog/lare/)
- [Paper](https://arxiv.org/abs/2610.32141)

## Local preview

Use Node.js 20 or newer. The project has no third-party build dependencies.

```sh
npm run build
npm run preview
```

Open `http://localhost:4321/` for Chinese or `http://localhost:4321/en/blog/lare/` for English. After editing the source, rebuild and refresh.

## Deployment

The GitHub Actions workflow in `.github/workflows/pages.yml` builds and validates the website on pushes and pull requests to `main`. Pushes to `main` and manual workflow runs also publish `dist/` to this repository's GitHub Pages site.

Pages uses **Settings → Pages → Build and deployment → Source: GitHub Actions**. The deployment job is restricted to `foreverlasting1202/lare-blog` on `main`, with a repository-scoped `GITHUB_TOKEN` and the `github-pages` environment. No personal access token or deployment secret is required in the workflow.

This is a project site at `/lare-blog/`. Its workflow does not modify the separate personal-homepage repository. No custom domain is configured in this project.

The build validates internal links, asset and font paths, and cross-page anchors at both a domain root and a project subdirectory. It rejects machine-specific URLs and excludes development logs, audits, and manuscript files from the output. The interactive charts load the bundled observations in `public/data/training-history.js`.

## Editing

- `src/index.html`: English tutorial and native MathML formulas.
- `src/locales/zh-CN.json`: Chinese translations.
- `src/i18n.js`: dynamic labels and language-switch state preservation.
- `src/app.js`, `src/animations.js`, `src/history.js`, `src/studies.js`: interactive comparisons and training histories.
- `src/*.css`: typography, layout, charts, and responsive styles.
- `public/`: fonts, icons, and the measured chart data used by the site.
- `scripts/build.mjs` and `scripts/check-site.mjs`: static build and validation.

The optional `npm run package` command creates `releases/lare-site.zip`. GitHub Actions builds directly from source and does not use that ZIP.

## Credits

The site layout, Training Farm branding, and citation footer follow [Training Farm / PURO](https://training.farm/blog/puro/) and the [SMELT reference site](https://github.com/Outsider565/smelt-preview). Original Training Farm site credits are retained in the footer. About Us links point to the corresponding Training Farm pages.

Noto Sans CJK SC fonts are distributed under the license in `public/fonts/OFL.txt`; their source and subset details are recorded in `public/fonts/README.txt`.
