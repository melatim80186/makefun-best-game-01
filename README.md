# Lumen Garden — Warden of the Last Light

A best-game-01 entry: an original arcade game that runs offline in a desktop
browser from static files. No libraries, no network, no build step — just
`game/index.html` and its ES modules, with all sound synthesised in WebAudio.

## The game

Shadow moths are eating the garden's light. You are Pip, the last firefly
warden. Guard the five blooms through ten waves — then face the Moth Queen.

- **Move** with WASD or the arrow keys, **aim** with the mouse, **shoot
  light** with click or Space. **P** pauses, **R** restarts, **M** mutes.
- **Moths** come in four kinds: flutters that latch onto blooms and drain
  their petals, fast zig-zagging darters, tough three-hit tankers, and
  spitters that hold their distance and lob spore globs at the blooms —
  shoot the spores down before they land.
- **Wave 10** brings the Moth Queen. Below half health she enrages: faster,
  and she calls darters instead of flutters.
- **Pickups**: dew heals a heart, shards grant triple shot for 10 seconds.
  Chained kills build a combo multiplier up to ×5.
- **Win** by clearing all ten waves; the victory screen rates the garden
  one to three stars by blooms saved. **Lose** all five blooms, or all three
  hearts, and the garden goes dark. Best score is kept in localStorage.

## Play it

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

`?seed=N` fixes the moth pattern for a reproducible game.
`?shot=start|play|boss|victory&seed=N` stages a screenshot scene instead of
running the loop.

## Layout

- `game/src/config.js` — every tuning number and colour
- `game/src/world.js` — the rules: blooms, moths, spores, waves, score
- `game/src/render.js` — everything the eye sees
- `game/src/fx.js` — particles, floating score text, shockwave rings
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/random.js` — seeded random (mulberry32)
- `game/src/shots.js` — the screenshot scenes and their autopilot
- `main.ts` — the entry program: copies game/ and screenshots/ to /output
  and writes /output/dossier.json with the vendored make.fun library
- `screenshots/` — four real renders of the game's own code

## License

MIT. See LICENSE.
