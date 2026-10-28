# Brand marks

- **Wordmark** — `TokenWordmark` in `src/ui/components/brand-marks.tsx`. The name split the way a tokenizer would ("LL", "M", " Graph", "s"), set in Space Mono.
- **Seal** — the "TRUST ME BRO" stamp. Full version with ring text is `public/logo192.png` and `public/logo512.png`; the ring-and-check reduction for small sizes is `public/favicon.svg`, `public/favicon.ico`, and the `TrustSeal` component.
- **Alternate mark** — the raised-eyebrow face, `EyebrowMark` in the same file and `public/brand/eyebrow.svg`. Not used in the product today; kept for social cards and one-offs.

Source for the icon render lives in `dev/app-icon.html`; re-render with `bun dev/render-app-icon.ts` after editing it.
