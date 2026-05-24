# spyglass — Specification

## 1. Objective

**Spyglass is an open-source web app that plays hidden-object games with branching narratives.** Players search detailed scenes for items from a list, unlock new scenes by finding or activating specific objects, follow different story paths depending on what they interact with, and watch video cutscenes that move the story along. A lightweight in-app editor lets authors upload full-frame artwork (typically a single image whose top region is the search scene and whose bottom strip is a pre-rendered HUD of object thumbnails), pair each in-scene hotspot with its matching HUD thumbnail, wire up scene transitions, and export a shareable game file.

This layout suits authors who generate scenes with image-generation tools — the whole composition (scene + HUD strip) lives in one image, and the editor's role is to draw clickable regions on top.

### Target users
- **Players** — anyone with a browser (desktop or mobile) who wants to play hidden-object / point-and-click adventures.
- **Authors** — hobbyist designers who want to publish their own games without writing code or running a server.

### Success criteria (MVP)
A release qualifies as MVP-complete when all of the following are true:
1. A player can load a game from (a) the bundled library, (b) a URL — pointing to either a manifest JSON or a `.zip` bundle, or (c) a local picker that accepts either a folder or a `.zip` — on both desktop and touch devices.
2. A game can chain together at least three scene kinds: **hidden-object scenes**, **video cutscenes**, and **splash screens** (used for title screen, intermissions, and endings). A player can complete a multi-scene game that includes at least one of each kind, with a timer, score, hints (penalty-based), and at least one branching choice that leads to a different ending.
3. In a hidden-object scene, the player clicks objects in the scene; finding one is reflected back in the HUD strip (e.g., the thumbnail is crossed out or grayed). Both halves — the target in the scene and the matching reference in the HUD — are author-defined regions on the same source image.
4. An author can:
   - upload a full-frame image and draw hotspot regions with **rectangles, polygons, or circles**,
   - **pair** an in-scene "target" region with a HUD "reference" region to form one objective,
   - mark HUD controls (hint, menu, pause) as their own region kinds so the engine can attach behaviour and accessible names,
   - upload a video cutscene and define its on-end transition (and optional captions track),
   - upload a splash image and define its advance behaviour (click, key, or timeout),
   - wire scene transitions, including branches,
   - export a self-contained game in either flat-folder or `.zip` form.
5. **The same build artifact works in three deployment modes** without modification:
   - hosted on GitHub Pages at `https://<user>.github.io/<repo>/`,
   - served by any static HTTP server (`npm run preview`, `python -m http.server`, etc.),
   - opened directly from disk via `file://` (double-click `index.html` on macOS, Windows, or Linux).
   In all three modes, both player and editor are fully usable.
6. Game files conform to a documented, versioned JSON schema; loading invalid files surfaces clear errors.
7. The player and editor are usable with a keyboard alone and announce state changes (objective found, scene transition, hint used, cutscene started/ended) to screen readers; interactive elements have accessible names and meet WCAG 2.1 AA contrast. Cutscenes have a keyboard-reachable skip control and display captions when the game provides them; first playback never autoplays with audible sound until the user has interacted.
8. **Audio:** games may specify (a) per-scene background music that loops, (b) sound effects for click, item-found, and scene-complete events, and (c) custom event sounds bound to in-game actions. Spyglass ships sensible default SFX so an author who supplies none still gets feedback. A global mute toggle and master/music/SFX volume sliders are always reachable (also via keyboard) and persist across sessions.

### Out of scope (for MVP)
- User accounts, leaderboards, multiplayer.
- Standalone audio tracks or a SFX engine. Audio that ships inside a cutscene's video file is supported; a separate background-music/SFX layer is not.
- Engine-rendered HUDs that the author *doesn't* paint into the source image. The MVP only supports HUDs baked into the artwork, with the engine attaching behaviour on top. A future version may let the engine render its own HUD for responsive/accessibility-only layouts.
- In-app marketplace or game discovery.
- Cloud-stored author drafts (drafts live in localStorage / file export).

---

## 2. Commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Produce static production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |
| `npm run typecheck` | `tsc --noEmit` against the whole project |
| `npm run lint` | ESLint over `src/` |
| `npm run format` | Prettier write |
| `npm test` | Vitest unit + component tests (watch in dev, single-run in CI) |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run validate-game <path>` | CLI helper: validate a game JSON against the schema |
| `npm run release` | Build, then produce a portable `dist.zip` of the static bundle for offline use |

`npm` is build-time tooling only — the production artifact under `dist/` is plain HTML/JS/CSS/asset files and needs no Node runtime to serve or run.

### Deployment

- **GitHub Pages:** a `.github/workflows/deploy.yml` workflow runs `npm ci && npm run build` on push to `main` and publishes `dist/` via `actions/deploy-pages`. No manual `gh-pages` branch management.
- **Other static hosts:** copy `dist/` to any static host (Netlify, Cloudflare Pages, S3+CloudFront, a plain Nginx box). No host-specific config required.
- **Offline / local:** download `dist.zip` from a GitHub release, unzip, double-click `index.html`. Works on macOS, Windows, and Linux without internet.

CI runs: `typecheck`, `lint`, `test`, `test:e2e`, `build`. All must pass before merge.

---

## 3. Project Structure

```
spyglass/
├── public/
│   └── games/                # Bundled example games (assets + manifest.json)
├── src/
│   ├── main.tsx              # Vite entry
│   ├── App.tsx               # Top-level routing (player / editor / library)
│   │
│   ├── engine/               # Game runtime — pure, no UI imports
│   │   ├── machine.ts        # Scene state machine, branching, transitions
│   │   ├── scenes/           # Per-scene-kind logic (hidden_object, cutscene, splash)
│   │   ├── objectives.ts     # Find-list tracking, target/reference pairing
│   │   ├── hints.ts          # Hint logic + penalty model
│   │   ├── score.ts          # Scoring + timer
│   │   ├── audio.ts          # Audio intent layer — emits "play click", "play music X"
│   │   └── events.ts         # Action handlers (goto, reveal, set-flag, …)
│   │
│   ├── schema/               # Game file schema + validators
│   │   ├── game.ts           # Zod schemas, TS types, version number
│   │   └── migrate.ts        # Forward migrations for older schema versions
│   │
│   ├── loaders/              # How games enter the app
│   │   ├── bundled.ts        # Read from /public/games
│   │   ├── url.ts            # Fetch either a manifest URL or a .zip URL
│   │   ├── file.ts           # File/folder/zip picker
│   │   └── bundle.ts         # Shared: unpack .zip → in-memory asset map
│   │
│   ├── player/               # Player UI
│   │   ├── PlayerView.tsx
│   │   ├── HiddenObjectScene/  # react-konva renderer for HOG scenes
│   │   │   ├── Targets/        # Clickable in-scene hotspots
│   │   │   ├── References/     # HUD-thumbnail overlays (found-state, focus)
│   │   │   └── Controls/       # Hint/menu/pause overlays bound to image regions
│   │   ├── Cutscene/         # Video player with skip + captions
│   │   ├── Splash/           # Static image / title screen with advance behaviour
│   │   ├── A11yLayer/        # DOM-parallel buttons for hotspots/controls
│   │   ├── audio/            # Audio playback driver (subscribes to engine intents)
│   │   │   ├── driver.ts     #   Plays SFX, manages looping BGM, crossfades on scene change
│   │   │   ├── defaults/     #   Built-in default SFX (click, found, complete)
│   │   │   └── settings.ts   #   Mute + per-channel volume, persisted to localStorage
│   │   └── input/            # Pointer + touch + keyboard unification, gestures
│   │
│   ├── editor/               # Authoring UI
│   │   ├── EditorView.tsx
│   │   ├── HotspotCanvas/    # Draw rectangles, polygons, or circles on an image
│   │   ├── Pairing/          # Link an in-scene target region to a HUD reference region
│   │   ├── Inspector/        # Edit selected region's kind, label, action, etc.
│   │   ├── SceneKindPanels/  # Different forms per scene kind:
│   │   │   ├── HiddenObject/ #   image + objectives + controls + interactives
│   │   │   ├── Cutscene/     #   video + captions + on-end target + skip policy
│   │   │   └── Splash/       #   image + advance trigger (click/key/timeout) + target
│   │   ├── SceneGraph/       # Visualize/edit scene-to-scene transitions
│   │   └── export.ts         # Serialize project to flat folder or .zip bundle
│   │
│   ├── state/                # Zustand stores
│   │   ├── playerStore.ts
│   │   └── editorStore.ts
│   │
│   ├── components/           # Shared UI primitives
│   ├── hooks/                # Shared React hooks
│   └── utils/                # Small, dependency-free helpers
│
├── tests/
│   ├── unit/                 # Mirrors src/ structure
│   └── e2e/                  # Playwright specs (player flow, editor flow)
│
├── docs/
│   ├── game-format.md        # Game JSON schema reference for authors
│   └── architecture.md       # High-level overview for contributors
│
├── specs/
│   └── 0001-project-overview.md  # This file. Additional specs use the same numbered prefix.
├── README.md
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .github/
    └── workflows/
        ├── ci.yml            # typecheck / lint / test / build on PR
        └── deploy.yml        # build + actions/deploy-pages on push to main
```

### Architectural rules
- **Engine is UI-free.** `src/engine/` may not import React, Konva, or anything DOM (including `HTMLAudioElement`/`AudioContext`). The engine *describes* what should play ("emit click sfx", "start music `forest.mp3` looping"); `player/audio/` is the only place that touches audio APIs.
- **Loaders produce validated game objects.** Anything entering the app via `src/loaders/` must pass Zod validation before reaching the engine.
- **One game = one immutable object.** The engine treats the loaded game as read-only; runtime state lives separately in the store.
- **Scenes are a discriminated union.** Every scene has a `kind` of `hidden_object`, `cutscene`, or `splash`. Adding a new kind is an explicit, schema-versioned change.
- **HUD lives in the artwork; behaviour lives in the engine.** The author paints the HUD into the scene image; the engine attaches click handlers, accessible names, and visual found-state overlays based on the regions the author marked. The engine never assumes pixel positions — only the region geometry stored in the game file.
- **Relative asset paths everywhere.** Vite is configured with `base: './'` so the build runs unchanged from a GitHub Pages subpath, a custom domain, or `file://`. No code may construct paths assuming a known origin.

---

## 4. Code Style

- **Language:** TypeScript with `strict: true`. No `any` (use `unknown` + narrowing).
- **React:** Function components + hooks only. No class components. Avoid prop-drilling beyond two levels — reach for Zustand or context.
- **State:** Zustand for cross-cutting state (current game, scene, score, editor selection). Local component state for purely local UI concerns.
- **Validation:** Zod schemas are the source of truth for game-file shapes; derive TS types from them with `z.infer`.
- **Naming:**
  - PascalCase for components and component files (`PlayerView.tsx`)
  - camelCase for modules, functions, variables
  - `kebab-case` is reserved for asset filenames inside game bundles
- **Imports:** Absolute imports from `src/` via the `@/` alias. No deep relative paths (`../../../`).
- **Comments:** Default to none. Add one only when the *why* is non-obvious (a constraint, a workaround, a subtle invariant). Names should carry the *what*.
- **Formatting/linting:** Prettier (default config) + ESLint with `@typescript-eslint/recommended` and `react-hooks/recommended`. CI fails on lint or format drift.
- **Dependencies:** Keep them few. New runtime dependencies require a brief justification in the PR description.

---

## 5. Testing Strategy

The engine is the highest-risk, lowest-UI piece, so it gets the most tests.

### Unit (Vitest) — primary safety net
- **Engine** (`src/engine/`): exhaustive coverage of scene transitions, branching choices, objective completion, hint penalties, timer/score math. Tests run against pure functions and the state machine — fast, no DOM.
- **Schema** (`src/schema/`): round-trip fixtures (valid + invalid samples); migration tests for each historical schema version.
- **Loaders** (`src/loaders/`): mock fetch + file inputs; verify rejection of malformed inputs.

### Component (Vitest + React Testing Library)
- Player HUD updates (objective list, timer, hint button states).
- Editor inspector saves edits back to store.
- Touch/mouse pointer unification.
- Accessibility: focus order, accessible names, and `aria-live` announcements verified with `jest-axe` — zero violations on rendered views.

### End-to-end (Playwright)
- **Player flow:** splash (title) → cutscene (intro video, exercised with both watch-through and skip) → hidden-object scene (find all objects via target hotspots while HUD references update) → branching choice → second hidden-object scene → cutscene (outro) → splash (ending). Run on both Chromium and WebKit; emulate touch on at least one mobile profile. Run a keyboard-only variant of the same flow.
- **Editor flow:** open a full-frame image → draw a rectangle target in the scene → draw the matching reference in the HUD strip → pair them into one objective → repeat for a polygon and a circle → mark a hint-button control region → add a cutscene scene with a video and on-end target → add a splash scene with a click-to-advance target → wire transitions → export both as a flat folder and as a `.zip` → load each exported form in the player and play it through.
- **Loading paths:** verify URL (manifest), URL (`.zip`), local-folder, and local-`.zip` loads all work from cold.
- **Deployment modes:** the same built `dist/` runs the player flow in three Playwright configurations — served at `/spyglass/` (GitHub Pages subpath), served at `/` (root), and loaded via a `file://` URL.
- **Audio:** verify click/found/complete SFX fire on the right events (via spy on the audio driver), background music starts on scene enter and stops on scene leave, mute toggle silences everything, and volume settings persist across reloads.

### Conventions
- Mirror `src/` paths under `tests/unit/`.
- Fixtures live in `tests/fixtures/games/` as small, real JSON bundles.
- No test relies on network (fixtures + mocks only).
- Coverage gate: engine + schema must stay above 90% line coverage. UI areas have no hard gate but should have at least smoke tests.

---

## 6. Boundaries

### Always
- **Stay static-deployable, and runnable from `file://`.** The app must build to plain HTML/JS/CSS that (a) runs from any static host (including GitHub Pages on a `/repo/` subpath), and (b) runs when `index.html` is opened directly from disk. This means: Vite `base: './'`, no service workers required for core gameplay, no APIs that require a secure context for core gameplay, no hard-coded absolute paths or origins.
- **Validate before loading.** Every incoming game (bundled, URL, file) passes through Zod validation. Invalid games surface a readable error rather than crashing the player.
- **Support touch alongside mouse.** Every interaction in the player and editor must work with a finger on a phone or tablet, not just a mouse cursor.
- **Be accessible by default.** Target WCAG 2.1 AA: full keyboard operability (Tab order, focus rings, keyboard activation of hotspots), accessible names on every interactive element, `aria-live` announcements for objective-found / scene-change / hint-used / timer-warning / cutscene-started/-ended events, and contrast-checked color choices. Konva hotspots must have a parallel DOM representation (or `role`/`aria-*`) so screen readers can reach them. Cutscenes never autoplay with audible sound on first load; a keyboard-reachable skip control is always present; captions are rendered when the game supplies a WebVTT track.
- **Version the game-file schema.** Every game has a `version` field. Loaders run forward migrations through `src/schema/migrate.ts` so existing games keep working.
- **Keep the engine UI-free.** `src/engine/` must not import React, Konva, or anything DOM-related.
- **Document game-format changes.** Any change to the JSON schema is reflected in `docs/game-format.md` in the same PR.

### Ask first
- **Adding a new runtime dependency.** Each one grows the bundle and the maintenance surface.
- **Changing the game-file schema in a non-additive way.** Additions are usually fine; renames, removals, or semantic changes need a heads-up + a migration path.
- **Introducing optional cloud features.** Even if optional (e.g., publish-to-CDN helper), anything that calls a remote service needs an explicit OK because it complicates the static-deploy story.
- **Large refactors that span engine + UI in one PR.** Split them.

### Never
- **No backend requirement.** Don't add features that *require* a server to function. Optional integrations are an "ask first" item, not a never — the hard rule is that the player and editor must always work offline against a static host.
- **No telemetry without explicit opt-in.** No usage analytics, error reporting, or any outbound calls beyond fetching game manifests the user pointed at.
- **Never use secure-context-only APIs for required flows.** Service workers, clipboard write, `getUserMedia`, etc., must be optional progressive-enhancement only — never required to start, play, or edit a game. (Reason: this would break `file://` and some intranet deployments.)
- **Never autoplay audio with sound.** Background music starts muted until the user interacts (browser policy enforces this anyway; we must handle it cleanly, not crash). The mute state is sticky.
- **No silent breaking changes to game files.** Existing valid games must keep loading, either as-is or via a documented migration.
- **No `--no-verify` / skipping CI gates.** If a check fails, fix the underlying issue.
- **No bundled *example* assets over 1 MB without compression review.** This applies to games we ship in `public/games/` (so the app loads fast). User-loaded games may be arbitrarily large; the player must handle them progressively — videos stream from URL loads via HTTP range when possible, and `.zip` loads must show a clear "loading" state for large bundles rather than hanging silently.

---

## Decisions log

Settled before implementation began:

1. **Game bundle format:** support both flat folder (`manifest.json` + assets) and `.zip`, for local picker *and* URL loading.
2. **Hotspot shape primitives:** rectangles, polygons, and circles — all three from MVP, in both schema and editor.
3. **Accessibility scope:** in scope from the start (WCAG 2.1 AA — keyboard, screen-reader announcements, contrast). See the matching "Always" boundary.
4. **Scene kinds:** three kinds at MVP — `hidden_object`, `cutscene`, `splash`. Title/intro/ending screens are expressed as `splash` (or `cutscene` when video). No separate "game intro" concept; the game's `startScene` simply points at one.
5. **Full-frame artwork with baked-in HUD:** authors upload a single image per HOG scene containing both the search area and the HUD strip. The editor pairs an in-scene *target* region with a HUD *reference* region to form an objective. Engine-rendered HUDs (where the engine draws the inventory itself) are deferred post-MVP.
6. **HUD controls:** the author marks dedicated regions for HUD controls (`hint`, `menu`, `pause`); the engine binds behaviour and accessible names to those regions. Authors who omit a control region forfeit that control for that scene.
7. **Cutscene captions:** WebVTT tracks supplied alongside the video. Captions are optional per cutscene but recommended; spyglass renders any provided track and exposes a toggle.
8. **Three deployment modes from one build:** the same `dist/` runs on GitHub Pages (subpath), any static host (root), and `file://`. Enforced by `base: './'` in Vite config and a "no secure-context-required APIs in core flows" boundary.
9. **Audio model:** per-scene optional looping background music + per-event SFX (click, found, complete, and game-defined custom events). Engine emits *intents*; the player's audio driver does the actual playback so the engine stays UI/DOM-free. Default SFX ship with the app; authors override by including audio files in their game bundle. A persisted mute + volume control is always reachable.
