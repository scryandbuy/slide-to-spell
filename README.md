# Slide To Spell: Word Search

[Play The Game](https://scryandbuy.github.io/slide-to-spell/)

A touch-first word puzzle game with 100 levels. Slide rows and columns, find the listed words, and earn stars based on your move count.

## Test On iPhone Or iPad

1. Open the game link in Safari.
2. Tap **Play Level 1** to begin.
3. Try portrait and landscape, the level map, settings, and returning to an unfinished level after reloading.

Progress saves in the current browser on that device. This testing site has its own saved progress, separate from other versions of the game. Use a normal browser tab and keep website data enabled to retain it.

You can also add the link to your Home Screen from Safari's Share menu. An internet connection is required to load the game. This is the browser testing version.

## Run Locally

No build step or package installation is required. Serve this folder with any static web server. For example:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765/`.

## Deployment

GitHub Pages serves the `main` branch from the repository root. `.nojekyll` preserves the static files as supplied. All runtime assets are included and use relative paths so the game works under the project URL.

The game files were exported from source commit `d4c326095478c076c792ed66102618b086baaf30` on November 2, 2026. This export adds only the GitHub documentation, deployment marker, ignore rules, and Apple touch-icon metadata.

Third-party notices are preserved in `WORDNIK-MIT.txt`, `STAR-ICON-LICENSE.txt`, and `assets/fonts/OFL.txt`.
