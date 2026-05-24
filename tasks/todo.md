# Spyglass MVP — Todo

Vertical slices, in execution order. Cross items off only when the slice's acceptance criteria pass.
Full detail per slice lives in [`plan.md`](./plan.md).

Legend: `[ ]` pending · `[~]` in progress · `[x]` done · `⛳` human-review checkpoint

---

## Phase A — Foundation

- [x] **S1 · foundation-and-splash** — Vite+React+TS scaffold, schema v1 (splash only), engine state machine, bundled loader, PlayerView + Splash + A11yLayer, Zustand store, CI workflow. Acceptance: `npm run dev` shows splash, click/Enter advances, all CI gates green, jest-axe clean, builds run via `file://`.
  - [x] Vite + TS + ESLint + Prettier + `@/` alias + `base: './'`
  - [x] Vitest + RTL + jest-axe configured
  - [x] Playwright configured (Chromium project + one smoke spec)
  - [x] Zod schema v1 (splash only) + identity `migrate()`
  - [x] Engine `machine.ts` + `scenes/splash.ts` + unit tests
  - [x] `loaders/bundled.ts` + fixture `public/games/hello/` (two splashes)
  - [x] `playerStore.ts` (Zustand)
  - [x] `PlayerView` + `Splash` + `A11yLayer` (`aria-live`)
  - [x] Engine-purity ESLint rule banning React/Konva/DOM imports in `src/engine/`
  - [x] `.github/workflows/ci.yml` (typecheck/lint/format:check/test/test:e2e/build)
  - [x] `fetchSafe` + e2e `file://` test (XHR fallback for Chromium's file:// fetch block)
  - [x] dev/preview/`file://` smoke-verified

## Phase B — Scene kinds

- [x] **S2 · cutscene-with-captions** — schema v2 cutscene, engine cutscene scene, `<video>` player with captions + skip + muted-first-play, e2e watch-through + skip.
- [ ] **S3 · hidden-object-basic** — schema v3 rect regions + objectives, `objectives.ts` + tests, react-konva Targets/References + A11y parallel DOM, pointer/touch/keyboard unification, e2e find-all + auto-advance.
- [ ] **S4 · hotspot-shapes-and-controls** — schema v4 polygon + circle + control region kinds (`hint`/`menu`/`pause`), geometry helpers, control bindings, e2e for each shape.

⛳ **Checkpoint A→B** — spec §1 #2 holds for splash → cutscene → HOG → splash; mouse/touch/keyboard parity confirmed.

## Phase C — Game mechanics

- [ ] **S5 · timer-score-hints** — schema v5 timer/scoring/hints, `score.ts` + `hints.ts` with exhaustive tests, HUD widgets, hint-region visual pulse, `aria-live` timer warnings.
- [ ] **S6 · branching-and-flags** — schema v6 actions + `FlagExpr` AST, `events.ts` + `flags.ts`, secret-objective branch in fixture, e2e for both endings.

⛳ **Checkpoint B→C** — engine + schema coverage ≥ 90% line; spec §1 #2 fully passes.

## Phase D — Audio

- [ ] **S7 · audio-intents-and-driver** — schema v7 audio, pure `engine/audio.ts` intent emitter, `player/audio/driver.ts` (SFX + BGM + crossfade), default SFX bundled, settings persistence, no autoplay-with-sound.

⛳ **Checkpoint C→D** — engine remains UI/DOM-free; mute persists; spec §1 #8 passes.

## Phase E — Loading

- [ ] **S8 · url-and-zip-loading** — `loaders/bundle.ts` (jszip), `loaders/url.ts` (manifest + zip), asset-URL resolver, Library URL input, e2e against served fixtures.
- [ ] **S9 · local-folder-and-zip-picker** — `loaders/file.ts`, Library buttons (folder on desktop, zip everywhere), Playwright upload tests.

⛳ **Checkpoint D→E** — all four load paths green; player feature-complete.

## Phase F — Editor

- [ ] **S10 · editor-shell-and-rect-hotspots** — `EditorView`, `HotspotCanvas` (rect tool), `editorStore` with localStorage persistence.
- [ ] **S11 · editor-polygon-circle-pairing** — polygon + circle tools, Pairing UI with connector lines, Objective.label edits.
- [ ] **S12 · editor-scene-kinds-and-inspector** — `SceneKindPanels` for splash/cutscene/HOG, Inspector for region kinds, inline Zod validation.
- [ ] **S13 · editor-scene-graph-and-branching** — `SceneGraph` view, branching action editor, unreachable-scene warnings.
- [ ] **S14 · editor-export-and-round-trip** — `export.ts` for folder + zip, validate-before-download, e2e build-export-load round-trip for both formats.

⛳ **Checkpoint E→F** — spec §1 #4 fully passes; round-trip works in both formats.

## Phase G — Deployment + polish

- [ ] **S15 · three-deployment-modes** — `deploy.yml`, `npm run release` → `dist.zip`, audit for absolute paths, Playwright e2e in `/`, `/spyglass/`, and `file://` modes.
- [ ] **S16 · polish-docs-coverage** — `docs/game-format.md`, `docs/architecture.md`, `README.md`, 90% coverage gate for engine + schema, jest-axe on all top-level views, schema migration regression tests, MVP checklist.

⛳ **Final checkpoint** — all eight spec §1 success criteria pass. Tag `v0.1.0`, cut a Release.

---

## Cross-cutting (every slice)

- [ ] jest-axe assertion on any new top-level view
- [ ] keyboard-only path in e2e for any new interactive surface
- [ ] schema migration written + legacy fixture committed (when schema changes)
- [ ] engine-purity ESLint rule remains green
- [ ] new runtime dependencies justified in PR description
