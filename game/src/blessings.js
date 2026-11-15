// The warden's blessings: after every wave but the last, the garden offers
// Pip a choice of three blessings, and the warden keeps one for the rest of
// the run. A blessing is a small permanent gift — quicker wings, hotter
// light, tougher blooms — so a run that survives grows visibly stronger,
// and the choice between them is the run's strategy: mend a torn bloom now
// or hit harder through every wave still to come.
//
// This module is pure: it knows the blessings, rolls the draft of three,
// measures what the warden already holds, and lays out the cards. The world
// owns the applying (world.js), the renderer owns the painting (render.js);
// neither has to know the other exists.
import { BLOOM } from './config.js';

/** How many blessings the garden offers after each cleared wave. */
export const DRAFT_SIZE = 3;

/** One blessing: its id, the name the card shows, a glyph, the colour its
 *  card glows, and two lines that say what it does in plain words. */
export const BLESSING_DEFS = [
  {
    id: 'swiftwings',
    name: 'Swift Wings',
    glyph: '➤',
    colour: '#ffd94d',
    lines: ['Pip flies 12% faster,', 'every wave, for the run.'],
  },
  {
    id: 'rapidlight',
    name: 'Rapid Light',
    glyph: '✦',
    colour: '#ffe98a',
    lines: ['Light leaves the warden', '15% faster, every shot.'],
  },
  {
    id: 'mothbane',
    name: 'Mothbane Rounds',
    glyph: '✚',
    colour: '#ff8a9d',
    lines: ['Each bolt of light hits', 'for +1 damage, always.'],
  },
  {
    id: 'farlight',
    name: 'Far Light',
    glyph: '☄',
    colour: '#b388ff',
    lines: ['Bolts fly 25% faster and', 'burn 25% longer in the air.'],
  },
  {
    id: 'moonpetal',
    name: 'Moonpetal Mend',
    glyph: '✿',
    colour: '#7dff9e',
    lines: ['At once, the most torn', 'living bloom regrows a petal.'],
  },
  {
    id: 'guardian',
    name: "Guardian's Oath",
    glyph: '⛨',
    colour: '#4dd8ff',
    lines: ['Latched moths drain petals', '25% more slowly, per oath.'],
  },
];

/** The blessing with this id, or undefined for an unknown one. */
export function blessingDef(id) {
  return BLESSING_DEFS.find((def) => def.id === id);
}

/** How many times the warden already holds this blessing (0 when never). */
export function heldCount(held, id) {
  return held[id] ?? 0;
}

/** One line for the HUD: what the warden holds, or '' when nothing yet. */
export function heldSummary(held) {
  const parts = [];
  for (const def of BLESSING_DEFS) {
    const count = heldCount(held, def.id);
    if (count > 0) parts.push(`${def.name} ×${count}`);
  }
  return parts.join('  ·  ');
}

/** Roll the draft: three different blessings, shuffled, from the ones that
 *  can still help. Moonpetal Mend is only offered while some living bloom
 *  is missing a petal — mending a whole garden would waste the choice. */
export function rollBlessingDraft(random, held, blooms) {
  const torn = blooms.some((bloom) => bloom.alive && bloom.petals < BLOOM.petals);
  const pool = BLESSING_DEFS.filter((def) => def.id !== 'moonpetal' || torn);
  const shuffled = random.shuffle(pool.slice());
  return shuffled.slice(0, DRAFT_SIZE).map((def) => def.id);
}

// --- what the held blessings do to the warden's numbers --------------------

/** Move speed: +12% per Swift Wings. */
export function wardenSpeedMultiplier(held) {
  return 1 + 0.12 * heldCount(held, 'swiftwings');
}

/** Time between shots: −15% per Rapid Light, never below half the base. */
export function fireIntervalMultiplier(held) {
  return Math.max(0.5, 1 - 0.15 * heldCount(held, 'rapidlight'));
}

/** Damage of one bolt of light: 1, plus 1 per Mothbane Rounds. */
export function bulletDamage(held) {
  return 1 + heldCount(held, 'mothbane');
}

/** Bolt speed: +25% per Far Light. */
export function bulletSpeedMultiplier(held) {
  return 1 + 0.25 * heldCount(held, 'farlight');
}

/** Bolt lifetime: +25% per Far Light, so the light reaches further. */
export function bulletLifeMultiplier(held) {
  return 1 + 0.25 * heldCount(held, 'farlight');
}

/** How fast a latched moth drains a petal: −25% per Guardian's Oath,
 *  never slower than a third of the base, so a drain always matters. */
export function drainTimeMultiplier(held) {
  return Math.max(1 / 3, 1 - 0.25 * heldCount(held, 'guardian'));
}

// --- where the three cards sit on the 1280x720 field -----------------------

export const BLESSING_CARD = { width: 300, height: 252, gap: 26, top: 208 };

/** The card's rectangle: three cards in a row, centred on the field. */
export function blessingCardRect(index) {
  const { width, height, gap, top } = BLESSING_CARD;
  const rowWidth = DRAFT_SIZE * width + (DRAFT_SIZE - 1) * gap;
  const left = (1280 - rowWidth) / 2;
  return { x: left + index * (width + gap), y: top, width, height };
}

/** Which card a point on the field falls on, or -1 when it hits none. */
export function blessingCardAt(x, y) {
  for (let i = 0; i < DRAFT_SIZE; i += 1) {
    const r = blessingCardRect(i);
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return i;
  }
  return -1;
}
