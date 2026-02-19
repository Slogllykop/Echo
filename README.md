# Echo Chrome Extension

## Setup

```bash
pnpm install
```

## Development (HMR)

```bash
pnpm dev
```

Keep the dev server running while the extension is loaded in Chrome.

## Production Build

```bash
pnpm build
```

Load unpacked extension from `dist/manifest.json`.

## Troubleshooting

### `Service worker registration failed. Status code: 3`

This usually means Chrome is loading a manifest that points at dev-only or source files.

Use one of these flows:

1. Dev flow: run `pnpm dev` and keep it running.
2. Stable flow: run `pnpm build`, then load `dist/manifest.json` in `chrome://extensions`.

Do not load the project root `manifest.json` directly in Chrome for packaged usage.
