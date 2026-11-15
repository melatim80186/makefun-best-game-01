// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.
//
// LUMEN GARDEN: Pip, the last firefly warden, defends five glowing blooms
// from shadow moths over ten waves, then faces the Moth Queen. Moths come in
// four kinds — flutter, darter, tanker and the ranged spitter — and the Queen
// enrages below half health. A moth latched onto a bloom drains its petals;
// a bloom with no petals left goes dark. Lose all five blooms, or all three
// hearts, and the garden goes dark.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves in a full game; clearing wave 10 wins. */
export const MAX_WAVE = 10;

export const BEST_KEY = 'lumengarden.best';

/** The strip at the bottom edge where the controls hint sits; moths and
 *  spores never fly below it, so the hint is never covered by a wing. */
export const FOOTER_TOP = 684;

export const PLAYER = {
  radius: 16,
  speed: 350,
  maxHp: 3,
  fireInterval: 0.16,
  bulletSpeed: 900,
  bulletRadius: 7,
  bulletLife: 1.4,
  invulnSeconds: 1.6,
  accel: 2600,
  /** A warden at full speed leaves a faint light trail; below this speed it fades. */
  trailSpeed: 200,
};

/** Moth kinds: flutter (basic), darter (fast zig-zag), tanker (tough),
 *  spitter (keeps its distance and lobs spore globs at the blooms) and
 *  queen (the boss of wave 10). */
export const MOTH = {
  flutter: { radius: 15, speed: 62, hp: 1, score: 100, drainSeconds: 2.0 },
  darter: { radius: 12, speed: 118, hp: 1, score: 150, drainSeconds: 1.7 },
  tanker: { radius: 22, speed: 40, hp: 3, score: 250, drainSeconds: 1.5 },
  spitter: { radius: 14, speed: 74, hp: 2, score: 200, drainSeconds: 0 },
  queen: { radius: 46, speed: 52, hp: 45, score: 2000, drainSeconds: 1.2 },
};

/** How a spitter fights: it holds this far from its bloom and lobs a spore
 *  every few seconds. A spore drifts to the bloom and eats a petal on impact;
 *  one shot of light pops it out of the air. */
export const SPORE = {
  radius: 8,
  speed: 130,
  lobSeconds: 3.4,
  lobJitter: 1.2,
  holdDistance: 250,
  lifeSeconds: 6,
};

/** The Queen enrages below this share of her health: faster, and she calls
 *  darters instead of flutters. */
export const QUEEN_ENRAGE_BELOW = 0.5;
export const QUEEN_ENRAGE_SPEED = 1.6;
export const QUEEN_SUMMON_SECONDS = 4.5;

export const BLOOM = {
  count: 5,
  petals: 3,
  radius: 26,
  /** Bloom hues, one per bloom, so each reads as its own flower. */
  hues: ['#ff6b9d', '#ffc44d', '#b388ff', '#4dd8ff', '#ff8a5c'],
  names: ['Rose', 'Amber', 'Violet', 'Cyan', 'Coral'],
};

/** Points for clearing a wave: base plus a bonus per bloom still alive. */
export const WAVE_CLEAR_BASE = 250;
export const WAVE_CLEAR_PER_BLOOM = 150;

export const COMBO_WINDOW = 3;
export const COMBO_PER_MULTIPLIER = 5;
export const COMBO_MAX_MULTIPLIER = 5;

export const PICKUP = {
  dewChance: 0.12, // heals one heart
  shardChance: 0.08, // triple shot for 10 seconds
  shardSeconds: 10,
  radius: 14,
  lifeSeconds: 9,
};

/** The night-garden palette. */
export const PALETTE = {
  skyTop: '#0a0e26',
  skyBottom: '#1c2a52',
  groundTop: '#14261e',
  groundBottom: '#0c1a14',
  moon: '#ffe9a8',
  star: '#e8ecff',
  player: '#ffd94d',
  playerGlow: '#ffedb0',
  bullet: '#ffe98a',
  mothBody: '#3b2d5c',
  mothWing: '#7d5fd6',
  mothEye: '#ff5d7a',
  spitterSac: '#9fe870',
  spore: '#a8e063',
  sporeGlow: 'rgba(168, 224, 99, 0.55)',
  queenBody: '#2c1b4d',
  queenWing: '#8a5cff',
  queenEnrage: '#ff7a5c',
  text: '#f2f0ff',
  textDim: '#aab3d6',
  danger: '#ff5d7a',
  panel: 'rgba(10, 14, 38, 0.82)',
  panelEdge: 'rgba(255, 217, 77, 0.55)',
  footerPill: 'rgba(8, 10, 30, 0.66)',
};
