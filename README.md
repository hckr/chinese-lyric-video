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
