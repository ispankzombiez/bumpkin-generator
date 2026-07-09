# Bumpkin Generator

Create custom Sunflower Land bumpkins with a live wearable catalog and export-ready renders.

## Features

- Automatically pulls the latest wearable IDs and slot mapping from Sunflower Land source.
- Lets users equip one item per slot with full slot coverage.
- Generates real-time preview URLs for:
  - Chibi (`idle-small`)
  - Player icon (`idle`)
- Allows downloading both outputs.

## Live Data Source

The catalog is fetched from:

`https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/bumpkin.ts`

No manual wearable list updates are needed.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## GitHub Pages Deployment

This repo includes `.github/workflows/deploy.yml` for automatic Pages deployment.

1. Push to `main`.
2. In GitHub repository settings, enable Pages and set source to `GitHub Actions`.
3. The workflow builds and deploys `dist` automatically.

### Base Path

Vite is configured with:

`base: '/bumpkin-generator/'`

If the repository name changes, update `vite.config.ts` accordingly.
