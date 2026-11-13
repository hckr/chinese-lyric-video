Local tools (Node 22.20.0+; `.n-node-version` pins the verified version). With `n`, prefix commands with `n exec auto`, for example `n exec auto npm run workbench`. The render command is unchanged:

- **React editor:** `npm run workbench` → http://127.0.0.1:5173. [Import, editing and export](web/README.md).
- **Python / Streamlit workbench:** retained for translation generation and review. [Setup and usage](python-src/README.md); dependencies are in `python-src/requirements.txt`.
- **Remotion Studio:** `npm run dev`. Existing compositions and source songs remain unchanged.

The React app currently implements checkpoint A. Timing, Python integration and renderer/preset integration remain later milestones in [the merged roadmap](agent-docs/ROADMAP.md).

Save a frame from a video:

```
ffmpeg -i public/Angela_Zhang_Keep_Walking.mp4 -vf "select=eq(n\,369)" -vframes 1 public/thumbnail-bg-369.png
```

---

Animated emoji: Google Noto Emoji Animation (CC BY 4.0) — https://googlefonts.github.io/noto-emoji-animation/

Animated emoji assets:

```
curl -o public/grin-sweat.json "https://fonts.gstatic.com/s/e/notoemoji/latest/1f605/lottie.json"
curl -o public/heart-face.json "https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/lottie.json"
```

---

# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## Formatting

Install the development tools with `npm install` and `python-src/venv/bin/python -m pip install -r python-src/requirements-dev.txt`.

```sh
npm run format:changed      # Format modified and untracked files
npm run format:staged       # Format working copies of staged files
npm run format              # Apply Prettier and Ruff across the repository
npm run format:check        # Check formatting without changing files
npm run format:web          # JS/TS, JSON, CSS, HTML and Markdown
npm run format:python       # Python source and tests
```

Use `n exec auto npm run format:check` to select the pinned Node runtime without changing your global installation. Each formatter also has its own check command: `format:web:check` and `format:python:check`.

Prettier 3.8.1 is pinned in package.json; `.prettierrc` defines 2-space indentation, double quotes, semicolons, trailing commas and LF endings. Ruff 0.17.5 is pinned in Python development requirements; `ruff.toml` defines 4-space Python indentation, double quotes and 88-column lines. `.editorconfig` supplies consistent editor defaults. Editors can use these repository configs with their Prettier/Ruff integrations. Install the project commit hook with `npm run hooks:install` after installing Node and Python development dependencies.

`.prettierignore` excludes generated/local data, dependencies, visual prototype snapshots and the two published song modules. Ruff excludes the original `python-src/translate.py` proof of concept and the virtualenv, including when passed explicitly. Formatting commands never overwrite those excluded files. The setup does not bulk-reformat the already-committed renderer, backend or design documents; their existing formatting differences are reported by the check commands and can be handled in a separate formatting-only change.

`format:changed` includes tracked working-tree changes, staged paths and untracked files, while respecting formatter exclusions. `format:staged` selects paths from the index but formats their **working-tree copies**: neither command stages or updates the index. Review and re-stage formatting changes yourself, especially for partially staged files. Use `format:changed:check` or `format:staged:check` for a read-only check. The pre-commit hook runs `npm run format:index:check` logic against the actual staged Git blobs, blocking unformatted commits without modifying or staging files. If formatter configuration (including ignore rules, EditorConfig and Ruff settings) differs between the index and working tree, the hook blocks the check until you stage the intended configuration or restore its working copy. Run `npm run format:staged`, review and re-stage to resolve failures. Hook installation is local to each checkout.

The React development server (`npm run workbench`) automatically refreshes the browser after source changes. Saved project edits are recovered from local storage. It never opens a browser automatically; production builds do not include live reload.

Filenames are read from Git with NUL separators and passed as argument arrays, so spaces in filenames work.

Workbench render tests remove temporary bundles after each run, including failures. Screenshots, exported song fixtures and JSON reports remain available for review in `out/workbench` and `out/reference`. Run `npm run workbench:clean` when these are no longer needed; it removes those two test directories only, preserving rendered videos and thumbnails elsewhere in `out`. Reference captures must be regenerated after cleanup.
