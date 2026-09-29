# Jango production artwork v2

Imported from `/Users/namu/Documents/Codex/2026-09-29/JANGO-Character-Kit` on 2026-09-29.
The external folder is read-only reference material, not a build dependency.

- `kit-v3/`: six unmodified 1254px transparent source PNGs and the original kit manifest/report. LOVE remains reference-only.
- `reference/`: BIBLE and style guide; `bible-master-idle.png` preserves the original app idle used for BIBLE measurements.
- `generated/`: five built-in image_gen reference edits (empty, worry, speak, point, icon). Exact prompts are in `prompts.json`; no CLI model fallback was used.
- `manifest.json`: application mood mapping, immutable source hashes, explicit uniform transforms and reviewed output bounds.

The kit's original reports apply to its six source files; their numeric claims are not automatically claims about the generated additions.
Generated additions were visually compared with the kit. Every source remains unchanged; alpha=1 dust in generated files is removed only in deterministic app derivatives.

Application rules are in [the active character guide](../../docs/JANGO_CHARACTER_STYLE_GUIDE.md).
Run `mascot:sync` → `mascot:build` → `branding:sync` → `store:sync` after building shared.
Run their audits before shipping. A source hash mismatch requires reviewing the new source and updating the manifest deliberately; audit never re-approves artwork automatically.

Do not copy the kit's `work/`, ZIPs, redundant HTML or historical previews into the app bundle.
The old visual rules are retained in [the archived v1 guide](../../docs/archive/JANGO_CHARACTER_STYLE_GUIDE_v1.md).

Additional generated poses now have [numeric anatomy evidence](./measurements/README.md), independent of the kit's original measurements.
`mascot:measure` records the measurements; `mascot:anatomy:audit` rejects stale evidence and non-passing anatomy.
The icon has confirmed numeric failures; the other four poses require review. Source hashes and visual provenance are not declarations that every BIBLE measurement passes.
