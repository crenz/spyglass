# Spyglass MVP — Implementation Plan

Source spec: [`specs/0001-project-overview.md`](../specs/0001-project-overview.md). The MVP is "complete" when all eight success criteria in §1 of that spec pass.

This plan slices the MVP into **16 vertical slices** grouped into **7 phases**. Each slice ends in something a user can observe (a player flow, an editor flow, or a CI signal) — no horizontal "schema layer for the whole app, then engine layer for the whole app" passes. Each phase ends in a checkpoint where the human reviews progress before the next phase begins.

---

## Guiding principles

1. **Vertical slices end in an observable demo.** Every slice — even the foundation one — produces something a human can poke at (a running scene, a green CI, a round-tripped export).
2. **Schema, engine, and UI grow together.** A scene kind is added end-to-end (Zod → engine → loader fixture → player UI → e2e test) in one slice, not three.
3. **A11y and tests are not deferred.** Each UI-touching slice includes its jest-axe smoke + keyboard path. Engine slices include exhaustive unit tests. Skipping this is what creates the "polish phase" tar pit.
4. **The foundation slice is allowed to be larger than the others.** Scaffolding, schema v1, engine skeleton, loader, store, UI shell, CI — all of it pays back in every subsequent slice. Trying to vertical-slice the scaffold itself is false economy.
5. **One game fixture grows through the slices.** The bundled `hello` game starts as two splash screens and gains a cutscene, then a HOG, then branching, etc. This keeps the end-to-end Playwright test alive at every step.
6. **Static-deployable from day one.** `base: './'` in Vite config from Slice 1, not retrofitted in Slice 15.

---

## Dependency graph

```
                       ┌──────────────────────────┐
                       │ Slice 1  Foundation +    │
                       │          Splash player   │
                       └──────────────┬───────────┘
                                      │
            ┌──────────────┬──────────┼─────────────┬─────────────┐
            ▼              ▼          ▼             ▼             ▼
        ┌───────┐    ┌─────────┐  ┌──────────┐ ┌─────────┐  ┌─────────┐
        │ S2    │    │ S3      │  │ S7       │ │ S8      │  │ S15     │
        │ Cut-  │    │ HOG     │  │ Audio    │ │ URL+ZIP │  │ Deploy  │
        │ scene │    │ basic   │  │ intents  │ │ loading │  │ modes   │
        └───┬───┘    └────┬────┘  └────┬─────┘ └────┬────┘  └────┬────┘
            │             │            │            │            │
            │       ┌─────┼──────┐     │            ▼            │
            │       ▼     ▼      ▼     │       ┌─────────┐       │
            │   ┌─────┐ ┌────┐ ┌────┐  │       │ S9      │       │
            │   │ S4  │ │ S5 │ │ S6 │  │       │ Local   │       │
            │   │ Hot │ │Tmr │ │Brn │  │       │ picker  │       │
            │   │spot │ │/Hnt│ │ch  │  │       └────┬────┘       │
            │   └──┬──┘ └─┬──┘ └─┬─┘  │            │            │
            │      │      │      │     │            ▼            │
            │      └──────┴──────┴─────┴──┐    ┌─────────────────┴┐
            │                             │    │ S10–S14 Editor   │
            │                             │    │ (5 sub-slices)   │
            │                             │    └───────┬──────────┘
            │                             │            │
            └─────────────────────────────┴────────────┴──────────┐
                                                                  ▼
                                                          ┌────────────┐
                                                          │ S16 Polish │
                                                          │ + docs +   │
                                                          │ coverage   │
                                                          └────────────┘
```

**Hard dependencies** (cannot start B before A): drawn as edges above.
**Soft dependencies** (technically parallelizable but easier in order): S7 (audio) is easier after S3 because there's a real scene to hook SFX into; S15 (deployment modes) makes more sense after at least one full player flow is working; S10–S14 (editor) are sequential because each editor slice consumes the previous one's UI.

A solo author should walk the slices in numerical order. A multi-agent fan-out could parallelize S2/S3, then S4/S5/S6 once S3 lands, then S7/S8/S15 after S6.

---

## Phase A — Foundation (Slice 1)

### Slice 1 · `foundation-and-splash` · Hello, splash

**Goal.** Run `npm run dev` and see a splash screen from a bundled game; click or press Enter to advance to a second splash. Same flow works keyboard-only. CI is green on a fresh clone.

**Scope.**
- Vite + React + TypeScript scaffold. `strict: true`. `@/` alias. `base: './'`. Prettier + ESLint with `@typescript-eslint/recommended` and `react-hooks/recommended`. `.editorconfig`.
- Vitest + React Testing Library + `jest-axe` configured. Playwright configured with one Chromium project.
- `src/schema/game.ts` — Zod v1 schema with only the `splash` scene kind: `Game { id, version: 1, title, startScene, scenes: Scene[] }`, `Scene = SplashScene { id, kind: 'splash', image, advance: { kind: 'click' | 'key' | 'timeout', timeoutMs? }, onAdvance: { gotoSceneId } }`. Derive TS types via `z.infer`. `migrate.ts` exports an identity `migrate(game)` function as a stub.
- `src/engine/machine.ts` — pure state machine: `init(game) → state`, `dispatch(state, action) → state`, supports actions `advance` and `goto`. Linear transitions only. No flags, no scoring yet.
- `src/engine/scenes/splash.ts` — splash-specific transition rules.
- `src/loaders/bundled.ts` — reads `/public/games/hello/manifest.json`, validates via Zod, returns immutable `Game`.
- `public/games/hello/` — first fixture: `title.png`, `intro.png`, `manifest.json` with two splash scenes.
- `src/state/playerStore.ts` — Zustand store holding `{ game, engineState }`.
- `src/App.tsx`, `src/main.tsx`, `src/player/PlayerView.tsx`, `src/player/Splash/Splash.tsx`, `src/player/A11yLayer/` — minimal UI shell. Splash renders the image; on click/Enter/timeout dispatches `advance`. `aria-live="polite"` region announces scene changes. Splash has an accessible name from the scene `title` (fallback) or `aria-label`.
- `tests/unit/engine/machine.test.ts` — covers `init`, `advance`, `goto`, invalid transitions.
- `tests/unit/schema/game.test.ts` — round-trips a valid splash-only game; rejects three malformed fixtures with readable errors.
- `tests/unit/loaders/bundled.test.ts` — loads the `hello` fixture; rejects a tampered fixture.
- `tests/unit/player/Splash.test.tsx` — RTL: renders, advances on click and on Enter, fires axe-clean.
- `tests/e2e/player-splash.spec.ts` — Playwright: load app, see splash 1, click, see splash 2.
- `.github/workflows/ci.yml` — typecheck, lint, test, test:e2e, build. All required.

**Acceptance criteria.**
- `npm install && npm run dev` opens the app and shows splash 1.
- Click anywhere on splash 1 → splash 2. Press Enter on splash 1 (focused) → splash 2.
- Screen reader announces "Splash: <title>" on each transition (verified via test, not manual).
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` all pass locally.
- CI workflow passes on the slice's PR.
- jest-axe reports zero violations on the rendered splash view.
- The built `dist/` opens in a browser via `file://` and shows the same splash flow (manual check).

**Verification steps.**
1. `npm ci && npm run test && npm run test:e2e && npm run build` → all green.
2. `npm run dev` → manual click + keyboard walk-through.
3. `npx http-server dist -p 8080` → walk-through at `http://localhost:8080/`.
4. `open dist/index.html` (macOS) → walk-through via `file://`.

**Risks.**
- Konva is not introduced yet — splash uses a plain `<img>` inside an `<a>`/`<button>`. Don't pull in Konva until S3.
- The schema lock-in: stay minimal. Pairing, regions, audio, branching, flags — none of it exists yet. Add it when its slice arrives.

---

## Phase B — Scene kinds (Slices 2–4) · Full player experience

### Slice 2 · `cutscene-with-captions` · Intro video plays

**Goal.** Add a cutscene scene kind. `hello` game becomes splash → cutscene → splash. Skip button works. Captions render when a WebVTT track is supplied. First load never autoplays with audible sound.

**Scope.**
- Schema v2: add `CutsceneScene { id, kind: 'cutscene', video, captions?, skipPolicy: 'always' | 'after-ms', onEnd: { gotoSceneId } }`. Bump schema version; add `migrate v1 → v2` (additive, returns game unchanged with `version: 2`).
- `src/engine/scenes/cutscene.ts` — transitions on `videoEnded` and on `skip`.
- `src/player/Cutscene/Cutscene.tsx` — `<video>` with `muted` on first play (until user interacts), `<track kind="captions">` when WebVTT provided, keyboard-reachable Skip button, `aria-live` announcement on start/end.
- Engine emits `cutscene.started` / `cutscene.ended` notification events (consumed by A11yLayer for announcements).
- Add `intro.mp4` (small, public-domain clip) + `intro.vtt` to `public/games/hello/`.
- Unit tests: cutscene state machine, skip semantics, on-end transition.
- Component test: captions render, Skip button is focusable, muted on first play.
- Update e2e: splash → cutscene (run once watch-through, once Skip) → splash. Keyboard-only variant.

**Acceptance.** Cutscene plays, captions visible, Skip works via mouse + keyboard, no audible sound on first load, transitions advance on end and on skip, jest-axe clean.

**Verification.** `npm test`, `npm run test:e2e`, manual walk-through with screen reader on at least once.

---

### Slice 3 · `hidden-object-basic` · Find the items (rectangles only)

**Goal.** Add a hidden-object scene. Rectangle hotspots only. Author-marked target regions are clickable; finding a target updates its paired reference in the baked-in HUD strip (grayed out). `hello` becomes splash → cutscene → HOG → splash.

**Scope.**
- Schema v3: add `Region = { id, shape: 'rect', rect: {x,y,w,h} }` (polygon/circle reserved for S4). Add `HiddenObjectScene { id, kind: 'hidden_object', image, regions: Region[], objectives: Objective[], onComplete: { gotoSceneId } }`. `Objective = { id, label, targetRegionId, referenceRegionId }`. Pairings reference region IDs, not coordinates. Migrate v2 → v3 (additive).
- `src/engine/objectives.ts` — pure: `findObjective(state, regionId) → state | null` (returns null if region isn't an active target). `isSceneComplete(state)`. Tests cover both halves of every pairing.
- `src/engine/scenes/hidden_object.ts` — transition on complete.
- `src/player/HiddenObjectScene/` — react-konva renderer:
  - `Targets/` — clickable hotspot layer over the scene region of the image. Found targets become non-interactive.
  - `References/` — overlays on the HUD strip. When the paired target is found, draw a "found-state" overlay (semi-transparent gray + diagonal line).
  - `A11yLayer/` — parallel DOM `<button>` per active objective with `aria-label` from `objective.label`, keyboard activation, `aria-live` announcement on find.
- Pointer-coalescing input: tap, click, and keyboard-activation all dispatch the same `find(objectiveId)` action.
- Add `scene-1.png` (single full-frame image with scene on top, HUD strip on bottom) + region coordinates in the manifest.
- Unit tests: objectives module exhaustively (every pairing, every order, double-find rejection).
- Component test: a found target updates its paired reference's visual state; both halves derive from the same region IDs.
- Touch support test (Playwright touch profile).
- E2E: full HOG flow — find 3 items, scene auto-advances on last find.

**Acceptance.** Player finds all hotspots via mouse, touch, and keyboard. HUD reference grays out on find. Scene auto-advances on completion. jest-axe clean.

**Verification.** `npm test`, `npm run test:e2e` (Chromium + WebKit + one touch profile), manual screen-reader walk.

---

### Slice 4 · `hotspot-shapes-and-controls` · Polygon, circle, hint/menu/pause regions

**Goal.** Extend hotspot primitives to polygons and circles. Add HUD control region kinds (`hint`, `menu`, `pause`) — the engine binds behaviour and accessible names to author-marked regions.

**Scope.**
- Schema v4: `Region.shape ∈ { 'rect', 'polygon', 'circle' }`; `polygon: {points: [x,y][]}`; `circle: {cx, cy, r}`. Add region kinds beyond `target`/`reference`: `hint`, `menu`, `pause`. Migrate v3 → v4.
- Geometry helpers: `pointInPolygon`, `pointInCircle`. Property-based tests against known fixtures.
- Engine: control region kinds bind to engine actions — `hint` requests a hint, `menu` opens a menu overlay, `pause` toggles pause. (Hint behaviour minimal in this slice — just emits an event; penalty model is S5.)
- Player: Konva renderers for polygon + circle hotspots. Pause overlay + minimal menu component.
- Update fixture HOG scene to include one polygon target, one circle target, and a hint-control region.
- Tests: geometry helpers, engine actions for each control kind, e2e adds a hint-region click that fires a "hint requested" announcement.

**Acceptance.** Polygon and circle hotspots are clickable. Hint/menu/pause control regions are reachable via mouse, touch, and keyboard.

---

## ⛳ Checkpoint A → B (after Slice 4)

Human review confirms: a player can complete a splash → cutscene → HOG → splash game using rect/polygon/circle hotspots, with mouse, touch, or keyboard. CI green; jest-axe clean; e2e green on Chromium + WebKit + one touch profile.

If any of those fail, fix before continuing.

---

## Phase C — Game mechanics (Slices 5–6)

### Slice 5 · `timer-score-hints` · Penalty-based hint model

**Goal.** Add a timer (counts elapsed seconds per HOG scene), a score (per-objective value minus per-hint penalty), and the hint logic (highlights an unfound objective; charges penalty; respects per-scene hint budget).

**Scope.**
- Schema v5: `HiddenObjectScene.timer?: { startMs }`, `scoring?: { perObjective, hintPenalty, maxHints }`, `Objective.value?` override. Migrate v4 → v5.
- `src/engine/score.ts`, `src/engine/hints.ts` — pure modules with exhaustive tests (zero hints, exceeded budget, last-objective-found-after-hint, etc.).
- Player HUD: timer display, score display, hint button bound to the author-marked hint-control region (from S4). Visual hint = pulse a target hotspot for ~2s.
- A11y: timer warnings (e.g., 10s left if `endMs` is set) announced via `aria-live="assertive"`. Hint usage announced.
- E2e: complete HOG, request 1 hint, verify timer + score values.

**Acceptance.** Timer, score, and penalty-aware hints all work; score is computed deterministically from the event log.

---

### Slice 6 · `branching-and-flags` · One choice, two endings

**Goal.** A HOG scene's `onComplete` can branch based on which optional objectives were completed (or other game flags). The fixture game gains a branch leading to one of two ending splash screens.

**Scope.**
- Schema v6: `onComplete` becomes `Action | Action[]`. `Action = { goto } | { setFlag, value } | { reveal, regionId } | { conditional, when: FlagExpr, then: Action, else?: Action }`. `FlagExpr` is a small AST: `flag`, `not`, `and`, `or`, equality. Migrate v5 → v6 (wrap existing `onComplete.gotoSceneId` into `{ goto: ... }`).
- `src/engine/events.ts` — action dispatcher; pure; tests cover every action plus conditional combinators.
- `src/engine/flags.ts` — flag store (lives in engineState, not the loaded game).
- Update fixture: an optional secret objective in the HOG scene sets a `found_secret` flag; the ending branches between `ending_good` and `ending_neutral`.
- E2e: two passes — one that finds the secret (lands on `ending_good`), one that doesn't (lands on `ending_neutral`).

**Acceptance.** Branching works; both endings reachable from the same fixture; engine remains pure (no DOM, no React imports).

---

## ⛳ Checkpoint B → C (after Slice 6)

Human review confirms: spec §1 criterion 2 ("at least three scene kinds, completable multi-scene game with timer, score, hints, branching → different endings") passes end-to-end against the fixture. Engine coverage ≥ 90% line. No regressions in jest-axe or e2e.

---

## Phase D — Audio (Slice 7)

### Slice 7 · `audio-intents-and-driver` · Music, SFX, mute, persistence

**Goal.** Engine emits audio *intents*; the player's audio driver plays them. Default SFX ship with the app. Authors can override and add per-scene BGM. Mute + per-channel volumes persist across reloads.

**Scope.**
- Schema v7: `SoundRef = string` (relative path inside the bundle). `Scene.audio?: { bgm?: SoundRef, sfx?: Record<EventName, SoundRef> }`. Game-level `defaultSfx?: Partial<Record<EventName, SoundRef>>`. Migrate v6 → v7.
- `src/engine/audio.ts` — pure: emits intents `{ kind: 'sfx', name, sound? }` and `{ kind: 'bgm-start' | 'bgm-stop', sound? }` to a subscriber. No `Audio`/`AudioContext` imports.
- `src/player/audio/driver.ts` — subscribes to engine intents; plays via `HTMLAudioElement` for short SFX and a long-lived element for BGM; crossfade on scene change (configurable, default 500ms).
- `src/player/audio/defaults/` — bundled default SFX for `click`, `found`, `complete`. Each < 50 KB.
- `src/player/audio/settings.ts` — mute + master/music/SFX volume; persisted to localStorage under `spyglass.audio`.
- A11y: mute toggle + volume sliders are always reachable from a persistent corner control; keyboard-operable; announced state changes.
- Browser-policy compliance: BGM doesn't start until first user interaction (use a captured `gesturedYet` flag).
- Unit tests: engine audio intent emission per event; settings persistence.
- E2e: walk through fixture with `audio-driver` spied — assert intents fire in the right order; toggle mute, reload page, confirm sticky.

**Acceptance.** Spec §1 criterion 8 satisfied. No autoplay-with-sound on first load. CI green.

---

## ⛳ Checkpoint C → D (after Slice 7)

Audio works end-to-end; engine remains UI/DOM-free; mute persists; defaults ship.

---

## Phase E — Loading (Slices 8–9)

### Slice 8 · `url-and-zip-loading` · Load any game from a URL

**Goal.** The Library page accepts a URL pointing at either a `manifest.json` or a `.zip` bundle and loads it. Asset resolution uses an in-memory map for zip-loaded games (no service worker, no fetch from disk).

**Scope.**
- `src/loaders/bundle.ts` — accepts a `Blob`/`ArrayBuffer`, unpacks zip via `jszip` (or equivalent — review dependency in PR), returns `{ manifest, assets: Map<path, Blob> }`. Reject zips > 50 MB by default with a clear error and confirm-to-continue.
- `src/loaders/url.ts` — sniff `Content-Type` and URL suffix; route to manifest or zip path. HTTP range fetch unsupported in this slice (videos in zips are fully buffered; document the trade-off).
- Asset-URL resolver: components consume `assetUrl(path)`; for bundled/loose loads this is a relative path string; for zip loads it returns a `blob:` URL minted from the asset map.
- Library UI: a single-field URL input with submit; shows progress + clear errors on failure.
- Tests: unit for both loaders (mocked fetch); e2e loads a `manifest.json` URL and a `.zip` URL from a Playwright-served fixture directory.

**Acceptance.** Spec §1 criterion 1 (URL paths) works for both manifest and zip URLs.

---

### Slice 9 · `local-folder-and-zip-picker` · Open a game from disk

**Goal.** The Library page also accepts a local folder (`webkitdirectory`) or a local `.zip` via `<input type="file">`. Touch devices fall back to the file picker (folder pickers are desktop-only — document this).

**Scope.**
- `src/loaders/file.ts` — accepts a `FileList`; if it's a single `.zip`, delegate to `bundle.ts`; otherwise build the asset map directly from `file.webkitRelativePath` entries.
- Library UI: two buttons — "Open folder" (hidden on touch via media query) and "Open file (.zip)".
- E2e: Playwright-driven file upload with both a folder fixture and a zip fixture.

**Acceptance.** Spec §1 criterion 1 (local picker) works on desktop (folder + zip) and touch (zip only). The chosen game plays through end-to-end.

---

## ⛳ Checkpoint D → E (after Slice 9)

All four load paths work (bundled, URL-manifest, URL-zip, local). Player is feature-complete except for branching that the editor will surface. Pause before starting the editor — the player surface area shouldn't grow further during Phase F.

---

## Phase F — Editor (Slices 10–14)

### Slice 10 · `editor-shell-and-rect-hotspots` · Draw a rectangle on an image

**Goal.** Editor view loads. Upload an image. Draw rectangle hotspots on it. Drafts persist to localStorage.

**Scope.**
- `src/editor/EditorView.tsx`, `src/editor/HotspotCanvas/` (react-konva), `src/state/editorStore.ts` (Zustand + localStorage middleware).
- Rectangle tool: click-and-drag to draw; click-to-select; drag-to-move; corner-handles to resize; Delete to remove.
- Tests: store round-trip; canvas component test for draw + select + delete.
- E2e (editor): open editor, upload an image, draw two rectangles, reload page, confirm drafts still present.

**Acceptance.** Authoring shell exists; rect hotspots can be drawn and persist.

---

### Slice 11 · `editor-polygon-circle-pairing` · Three shapes + pair targets to references

**Goal.** Add polygon (click-to-add-vertex, double-click to close) and circle (click-and-drag-radius) tools. Add the Pairing UI: select a target region, then click a reference region in the HUD strip to bind them as one objective.

**Scope.**
- `src/editor/HotspotCanvas/` extended; geometry helpers reused from S4.
- `src/editor/Pairing/` — visual mode that shows current target → reference pairings as connector lines on the canvas; click-to-pair / click-to-unpair workflow.
- Inspector panel surfaces pair state and lets the author edit the `Objective.label`.
- Tests: pairing reducer; component tests for polygon + circle drawing; e2e drawing all three primitives + pairing two of them.

**Acceptance.** All three hotspot primitives are drawable. An author can pair targets with references into objectives.

---

### Slice 12 · `editor-scene-kinds-and-inspector` · Forms for splash, cutscene, HOG

**Goal.** SceneKindPanels for each of the three scene kinds, plus Inspector that edits the selected region's kind (`target` / `reference` / `hint` / `menu` / `pause`) and per-scene fields.

**Scope.**
- `src/editor/SceneKindPanels/HiddenObject/`, `Cutscene/`, `Splash/` — distinct forms.
  - Splash: image upload + advance behaviour (click / key / timeoutMs) + on-advance scene target.
  - Cutscene: video upload + optional VTT upload + skip policy + on-end target.
  - HiddenObject: scene image + objectives + controls (delegates to S10/S11 canvas).
- `src/editor/Inspector/` — context-sensitive form for the selected region or scene; mirrors the schema.
- Validation: per-form Zod validation surfaces errors inline.
- Tests: each form's save-to-store; e2e adds a splash + a cutscene + a HOG to a draft.

**Acceptance.** An author can populate all three scene kinds within the editor.

---

### Slice 13 · `editor-scene-graph-and-branching` · Visualize transitions

**Goal.** A SceneGraph view shows scenes as nodes and transitions as edges. Authors can wire transitions and create branches.

**Scope.**
- `src/editor/SceneGraph/` — react-flow (or a small custom svg renderer — pick in PR; flag if a new dep).
- Branching editor: a small AST builder for `FlagExpr` and `Action[]` from S6.
- Validation: warn on unreachable scenes and dangling transitions.
- E2e: build a 4-scene graph with one branch, confirm graph reflects the draft.

**Acceptance.** Authors can wire and visualize transitions including branches.

---

### Slice 14 · `editor-export-and-round-trip` · Flat folder + .zip

**Goal.** Export the draft as either a flat folder (browser file-save into a chosen directory via `showDirectoryPicker`, with `<a download>` zip fallback) or a `.zip` bundle. Round-trip the export back through the loader and play it.

**Scope.**
- `src/editor/export.ts` — serialize manifest + collect referenced assets + zip them via `jszip`. Validate output against current Zod schema before download.
- UI: an Export menu with the two options.
- E2e (the big one): build a complete game in the editor → export as folder → load via local-folder picker → play through. Then export as `.zip` → load via local-`.zip` picker → play through.

**Acceptance.** Spec §1 criterion 4 satisfied. Round-trip works for both export formats. This closes the editor loop.

---

## ⛳ Checkpoint E → F (after Slice 14)

Major MVP gates passed. Run the full spec §1 checklist; any failures become blocking work before Phase G.

---

## Phase G — Deployment + polish (Slices 15–16)

### Slice 15 · `three-deployment-modes` · One build, three hosts

**Goal.** The same built `dist/` runs identically (a) on GitHub Pages at `/<repo>/`, (b) at root on any static host, (c) via `file://`. Playwright proves it.

**Scope.**
- `.github/workflows/deploy.yml` — build on push to `main`, publish via `actions/deploy-pages`.
- `package.json` `release` script — `npm run build && npx zx scripts/zip-dist.mjs` (or shell equivalent) → `dist.zip` artifact.
- Audit codebase for any absolute paths or origin assumptions (grep for `/assets`, `window.location.origin`, hard-coded `/spyglass/`, etc.).
- `tests/e2e/deployment.config.ts` — Playwright configs for three serving modes (`/`, `/spyglass/`, `file://`). Re-run the player flow in each.
- Add `npm run validate-game` CLI helper (`scripts/validate-game.mjs`) for offline schema validation.

**Acceptance.** Spec §1 criterion 5 satisfied: Playwright passes in all three modes against an unmodified `dist/`.

---

### Slice 16 · `polish-docs-coverage` · Ship-ready

**Goal.** Documentation, coverage gates, and the final tidy-up.

**Scope.**
- `docs/game-format.md` — authoring reference. Every Zod schema field documented. Examples for splash, cutscene, HOG, branching, audio.
- `docs/architecture.md` — engine/loader/UI/store boundaries; explains the "engine is UI-free" rule and the asset-URL resolver.
- `README.md` — quickstart for players (Library + open-from-URL), authors (open editor + export), and contributors (`npm install && npm test && npm run dev`).
- Coverage gate in CI: `engine/` + `schema/` line coverage ≥ 90% (fails CI below threshold).
- jest-axe coverage: every top-level rendered view (PlayerView, EditorView, LibraryView, settings panels) has an axe assertion.
- Schema migration test pattern: snapshot the v1 fixture in `tests/fixtures/games/legacy/` and assert `migrate()` brings it to current version without loss.
- Final manual pass against spec §1 criteria 1–8 — record results in `tasks/mvp-checklist.md`.

**Acceptance.** All eight spec §1 success criteria pass. Coverage gates green. Docs render cleanly.

---

## ⛳ Final checkpoint (after Slice 16)

MVP complete. Tag `v0.1.0`. Update README with the GitHub Pages URL. Cut a GitHub Release with `dist.zip`.

---

## Cross-cutting policies (apply to every slice)

- **A11y per slice.** Every UI-touching slice adds jest-axe to its new views and a keyboard-only path to its e2e coverage. Do not defer to Slice 16.
- **Schema migrations per slice.** Every schema-touching slice writes `migrate vN → vN+1` plus a fixture in `tests/fixtures/games/legacy/vN/` to keep round-trips honest.
- **Engine purity guard.** Add an ESLint rule (custom or `eslint-plugin-import` `no-restricted-imports`) that bans React, Konva, DOM, and HTML audio imports inside `src/engine/`. Wire it in Slice 1; it pays for itself by Slice 7.
- **Bundle weight.** Every slice that adds a runtime dependency justifies it in the PR. Slice 7 (audio defaults), Slice 8 (jszip), and Slice 13 (react-flow if chosen) are the obvious candidates — flag them.
- **One game fixture.** Keep evolving `public/games/hello/` rather than spawning a new fixture per slice. New scene-kind fixtures (e.g., a stress-test for polygons) live in `tests/fixtures/games/`.

---

## Risks and trade-offs

| Risk | Where it bites | Mitigation |
|---|---|---|
| Konva + react-konva learning curve eats Slice 3 | Slice 3 | Time-box; if blocked at 2 days, drop to plain SVG for rects and revisit Konva in Slice 4 with polygons/circles. |
| Zip loader memory blow-up for large videos | Slice 8 | 50 MB soft cap with confirm-to-continue; document HTTP-range as post-MVP. |
| `showDirectoryPicker` not in Safari | Slice 14 | Fall back to zip download for export-as-folder when the API isn't available. |
| `file://` breaks anything via CORS or module loading | All slices, surfaces in Slice 1 | Vite `base: './'` + relative imports + no fetch-from-disk in core flows. CI runs the e2e in `file://` mode from Slice 15 to catch regressions. |
| Editor scope creep | Phase F | Phase F is sequential and pre-defined; resist adding multi-select, undo/redo, copy/paste until post-MVP. |
| A11y debt accumulates if deferred | Every UI slice | Lint-style enforcement: a slice without jest-axe + keyboard e2e doesn't merge. |
| Schema churn breaks downstream slices | Phases B–F | Every schema change ships its migration in the same PR. Legacy fixtures in `tests/fixtures/games/legacy/` regression-test this. |

---

## Suggested workstream parallelization

If multiple agents/developers are available after Slice 1 lands:

- **Stream α (player)**: S2 → S3 → S4 → S5 → S6.
- **Stream β (audio + loaders)**: S7 → S8 → S9. Can start once S3 lands (S7 wants a real scene to test against).
- **Stream γ (deployment)**: S15. Can start once S3 lands.
- **Stream δ (editor)**: S10 → S11 → S12 → S13 → S14. Must wait until Phase B is done (the editor consumes the same schema).
- **Final**: S16 merges last, after all streams are integrated.
