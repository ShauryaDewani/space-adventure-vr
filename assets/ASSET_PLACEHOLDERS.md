# Asset Placeholder Notes

You can replace these placeholder filenames with your own assets.

## Optional Audio Files
Expected by `script.js`:

- `assets/audio/space-bgm-loop.mp3`
- `assets/audio/collect.wav`
- `assets/audio/hit.wav`
- `assets/audio/menu-select.wav`
- `assets/audio/level-complete.wav`

If these files do not exist, the game still runs using procedural fallback sounds.

## Optional Texture/Image Files
Current build uses tuned material styling (emissive, roughness, metalness, opacity), so texture files are not required.

If you want to add your own textures, place files in:

- `assets/textures/`
- `assets/images/`

Then reference them from `index.html` (`<a-assets>`) and apply them in `script.js` material attributes.
