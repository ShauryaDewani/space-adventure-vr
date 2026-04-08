# Space Adventure VR

Mobile stereoscopic VR game built with A-Frame for **CMPT 461 Immersive Computing**.

- **Student:** Shaurya Dewani
- **Project Type:** Individual Project based on A-Frame
- **Game Theme:** Space exploration, collection, and obstacle avoidance

## Project Overview

Space Adventure VR is a gaze-controlled mobile VR game designed for cardboard-style viewing.
You automatically fly forward in space and steer by looking in different directions.

- **Level 1 (Open Space):** Collect glowing rings and avoid asteroids.
- **Level 2 (Space Tunnel):** Collect crystals in a tighter corridor while avoiding barriers.
- **No hand controllers required:** all menu and gameplay interaction is head/gaze-based.

## Texture Mapping (Current Build)

Textures are loaded from `assets/textures/`:

- `./assets/textures/1801.jpg` (orange energy)
  - rings
  - crystals
  - both portals
  - splash/level-complete accent rings
- `./assets/textures/desmal14.jpg` (dark sci-fi panel)
  - splash/setup/transition/end UI panels
  - scoreboard backing panel
  - Level 2 tunnel/station walls and barrier surfaces
- `./assets/textures/rock_face_03_diff_4k.jpg` (rock)
  - Level 1 asteroid hazards

## Folder Structure

```text
Space-Adventure-VR/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ assets/
│  ├─ ASSET_PLACEHOLDERS.md
│  ├─ audio/
│  ├─ images/
│  └─ textures/
│     ├─ 1801.jpg
│     ├─ desmal14.jpg
│     └─ rock_face_03_diff_4k.jpg
└─ manual/
   └─ manual.html
```

## Setup and Run Locally

This is a static web project (no build tools needed).

### Option A: Open directly
1. Open `index.html` in a browser.
2. Click/tap the page if audio is blocked initially.

### Option B (recommended): local static server
Use one of the following:

- Python:
  ```bash
  python -m http.server 8000
  ```
- Node (if installed):
  ```bash
  npx serve .
  ```

Then open:
- [http://localhost:8000](http://localhost:8000) or
- URL shown by `serve`.

## Controls

- **Steer:** the ship follows where you look (look left/right/up/down to drift that direction).
- **Move:** automatic forward movement.
- **Select UI buttons:** gaze at buttons until fuse cursor triggers.
- **VR mode:** use browser VR button and insert phone into cardboard viewer.

Steering includes smoothing and a center deadzone to reduce jitter on low-cost mobile VR headsets.
The control model also smooths raw head input before steering, so the ship still clearly follows your gaze but feels more stable.

## Gameplay Objectives

### Level 1: Open Space
- Collect at least **3 hoops/rings** (`+10` each).
- Hoops are arranged as an easy steering tutorial path to practice look-following control.
- Avoid asteroids (each hit reduces health).
- Reach portal once ring target is completed.

### Level 2: Space Tunnel
- Collect at least **7 crystals** (`+20` each).
- Avoid tunnel barriers.
- Reach final portal after crystal target is completed.

## HUD and Score

- Scoreboard is always visible during gameplay.
- Health is always visible during gameplay.
- Final score is shown on win/game-over screen.

## Audio and Music Toggle

- Setup menu includes **Music ON/OFF** gaze button.
- Toggle affects background music only.
- Sound effects include:
  - collect
  - collision/hit
  - menu select
  - level completion

Current default config uses procedural fallback audio only, so there are no missing-audio file path errors.
If you later add audio files, set paths in `script.js` under `CONFIG.audio`.

## Collision Details

- Collectibles disappear on contact and update score instantly.
- Hazards apply damage with a short hit cooldown to prevent rapid multi-hit stacking.
- Level portals trigger state transitions when objective thresholds are met.
- Level 2 tunnel wall bounds are enforced and cause damage on wall contact.

## GitHub Pages Deployment

1. Push this project to a GitHub repository.
2. Go to **Settings → Pages**.
3. Set source to **Deploy from a branch**.
4. Select branch `main` or `master`, folder `/ (root)`.
5. Save and wait for GitHub Pages URL.

Because all paths are relative, this project is GitHub Pages ready.

## Browser/Mobile Notes

- Recommended: Chrome on Android for best mobile WebXR behavior.
- iOS support depends on browser/WebXR compatibility.
- If VR mode is unavailable, game still runs in mono 3D mode.
- For smooth mobile play, close background apps and lower phone brightness/thermal load.

## Mobile VR Submission Test Checklist

Use this checklist before recording/submitting:

- [ ] Open `index.html` on phone (or local hosted URL) and confirm splash screen appears first.
- [ ] Gaze at **Start Game**, **Music ON/OFF**, and **Instructions** to verify all setup buttons work without touch input.
- [ ] Confirm background music starts after first interaction and toggles ON/OFF correctly.
- [ ] Start Level 1 and verify HUD score/health stays visible during movement.
- [ ] Collect at least one ring and confirm score increases by +10 with collect sound.
- [ ] Hit an asteroid and confirm health decreases with hit sound.
- [ ] Collect enough rings to reveal portal, then enter portal to reach Level 1 complete screen.
- [ ] Gaze at continue button and confirm Level 2 loads with tighter tunnel feel and faster speed.
- [ ] Collect a crystal and confirm score increases by +20.
- [ ] Hit a barrier or tunnel wall and confirm damage is applied.
- [ ] Reach final portal with required crystals and verify final score on win screen.
- [ ] Test restart flow from end screen back to setup.
- [ ] Enter A-Frame VR mode and verify stereoscopic split view works with cardboard viewer.
- [ ] Run the same build from GitHub Pages URL and repeat key checks (start, score, level transitions, end).

## Customization Guide

Adjust values in `script.js` under `CONFIG`:
- health
- movement speed
- points
- collectible targets
- collision damage

Main components you can tune:
- `auto-fly` (speed, steering strength)
- `collision-loop` (collision radius checks and tunnel bounds)
- `game-manager` (state flow and win/fail conditions)

## Assignment Feature Checklist

- [x] Original game idea
- [x] Manual with setup/install/run/controls/objectives
- [x] Flash screen with student/project/course details
- [x] Setup/options screen with gaze UI
- [x] Two levels
- [x] Sound effects and looping background audio
- [x] Music toggle from setup
- [x] Always-visible scoreboard during gameplay
- [x] Gaze/head-direction controls without hands
- [x] Stereoscopic mobile VR compatibility (A-Frame VR mode)
- [x] Styled/textured-looking objects and intentional materials
- [x] Collision detection
- [x] No blood/no violence
- [x] Extra polish (health system, stars, animated collectibles, transitions)
