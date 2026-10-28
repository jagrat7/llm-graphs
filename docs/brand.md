# Brand marks

- **Wordmark** — `TokenWordmark` in `src/ui/components/brand-marks.tsx`. The name split the way a tokenizer would ("LL", "M", " Graph", "s"), set in Space Mono.
- **Seal** — the "TRUST ME BRO" stamp, ring text included at every size: `public/logo512.png`, `public/logo192.png`, `public/favicon-96.png`, and the multi-size `public/favicon.ico`. There is deliberately no simplified version.
- **Alternate mark** — the raised-eyebrow face, `EyebrowMark` in the same file and `public/brand/eyebrow.svg`. Not used in the product today; kept for social cards and one-offs.

Source for the icon render lives in `dev/app-icon.html`; re-render with `bun dev/render-app-icon.ts` after editing it.
