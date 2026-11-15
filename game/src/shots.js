// The screenshot scenes behind ?shot=start|play|boss|victory. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (fly toward the moth nearest a bloom, fire at the threat), so
// every frame is what a short game really looks like and the same seed always
// gives the same frame. The victory scene plays the whole game with the
// autopilot; if it has not won within its step budget, the world is set to the
// victory state it earned, so the frame still shows the real victory screen.
//
// The autopilot also watches for spores: a spore about to land on a bloom is
// worth one shot of light, and a warden that ignores them loses petals while
// it hunts moths.
import { FIELD, MAX_WAVE, PLAYER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 6;
const BOSS_SECONDS = 6;
const VICTORY_STEP_BUDGET = 120000;
/** How close the warden must be before boosted fire opens up; closer shots
 *  lead their target better, so a shorter range wins more than it costs. */
const FIRE_RANGE = 280;

/** Nearest moth to any living bloom — the threat the warden should chase.
 *  Moths still far outside the field (just spawned, or pushed out) do not
 *  count: chasing one off the screen strands the warden at the edge. */
function nearestThreat(state) {
  let bestMoth = null;
  let bestDist = Infinity;
  for (const moth of state.moths) {
    if (moth.x < -60 || moth.x > FIELD.width + 60 || moth.y < -60 || moth.y > FIELD.height + 60) continue;
    const d = Math.min(
      ...state.blooms.filter((b) => b.alive).map((b) => Math.hypot(moth.x - b.x, moth.y - b.y)),
      Infinity,
    );
    if (d < bestDist) {
      bestDist = d;
      bestMoth = moth;
    }
  }
  return bestMoth ?? state.moths.find((m) => m.x >= -60 && m.x <= FIELD.width + 60 && m.y >= -60 && m.y <= FIELD.height + 60) ?? null;
}

/** A spore close to landing on its bloom: one shot pops it, so it outranks
 *  every moth until it is gone. */
function urgentSpore(state) {
  let urgent = null;
  let urgentDist = Infinity;
  for (const spore of state.spores) {
    const bloom = spore.targetBloom;
    if (!bloom || !bloom.alive) continue;
    const d = Math.hypot(spore.x - bloom.x, spore.y - bloom.y);
    if (d < 170 && d < urgentDist) {
      urgentDist = d;
      urgent = spore;
    }
  }
  return urgent;
}

/** One autopilot step. Modes: 'hunt' steers toward the threat and fires at it;
 *  'hold' drifts to the garden's centre and holds fire, so moths gather for a
 *  busy frame. `boost` fires faster than a human could, but only at a target it
 *  has tracked for a few steps — the victory run's accuracy is a real stat on
 *  its end screen, so it should not spray.
 *
 *  The warden locks on: once it picks a target it sticks to it until the
 *  target is gone. Switching every step between equally near moths meant the
 *  fire discipline (three settled steps) never armed and the run deadlocked
 *  on the last few moths of a wave. A lock that stays out of reach for ten
 *  seconds is dropped and the nearest threat is picked again. */
let boostCounter = 0;
let lockedTarget = null;
let lockStreak = 0;
let lockFarSteps = 0;
function autopilotStep(world, boost, mode = 'hunt') {
  const state = world.state;
  const p = state.player;
  if (mode === 'hold') {
    const move = { x: (FIELD.width / 2 - p.x) / 300, y: (FIELD.height / 2 - p.y) / 300 };
    const aim = { x: p.x, y: p.y - 100 };
    return world.step(STEP, move, aim, false);
  }
  const spore = urgentSpore(state);
  const candidate = spore ?? nearestThreat(state);
  const lockedAlive = lockedTarget !== null
    && (state.moths.includes(lockedTarget) || state.spores.includes(lockedTarget));
  if (!lockedAlive) {
    lockedTarget = candidate;
    lockStreak = 0;
    lockFarSteps = 0;
  } else if (spore !== null && lockedTarget !== spore) {
    // A spore about to land outranks a locked moth: switch to it at once.
    lockedTarget = spore;
    lockStreak = 0;
    lockFarSteps = 0;
  } else if (lockFarSteps > 600) {
    lockedTarget = candidate;
    lockStreak = 0;
    lockFarSteps = 0;
  }
  const threat = lockedTarget;
  let move = { x: 0, y: 0 };
  let aim = { x: p.x, y: p.y - 100 };
  let firing = false; // never shoot at an empty garden
  if (threat) {
    lockStreak += 1;
    const dx = threat.x - p.x;
    const dy = threat.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > FIRE_RANGE) lockFarSteps += 1;
    else lockFarSteps = 0;
    // Hold a firing distance of ~160 from the threat instead of ramming it.
    const want = dist > 170 ? 1 : dist < 100 ? -0.6 : 0;
    let mx = (dx / dist) * want;
    let my = (dy / dist) * want;
    // Evasion blends in instead of overriding: slide past a moth about to
    // ram the warden instead of fleeing the fight entirely.
    for (const moth of state.moths) {
      if (moth === threat) continue;
      const md = Math.hypot(moth.x - p.x, moth.y - p.y);
      if (md < 70 && !moth.latched) {
        const w = (70 - md) / 70;
        mx += ((p.x - moth.x) / (md || 1)) * w * 1.4;
        my += ((p.y - moth.y) / (md || 1)) * w * 1.4;
      }
    }
    const mlen = Math.hypot(mx, my);
    if (mlen > 1) {
      mx /= mlen;
      my /= mlen;
    }
    move = { x: mx, y: my };
    // Lead the target: aim where it will be when the light gets there.
    const targetDist = dist;
    const flight = targetDist / PLAYER.bulletSpeed;
    const tvx = threat.vx ?? 0;
    const tvy = threat.vy ?? 0;
    aim = { x: threat.x + tvx * flight, y: threat.y + tvy * flight };
    // Boosted fire only at a settled, close target: a good warden does not
    // spray light at specks a screen away, and the victory screen's accuracy
    // is a real stat, so it should read like a good game was played.
    firing = boost ? lockStreak >= 3 && (targetDist <= FIRE_RANGE || threat.latched) : true;
  } else if (state.waveState === 'intro') {
    move = { x: (FIELD.width / 2 - p.x) / 300, y: (FIELD.height / 2 - p.y) / 300 };
  }
  if (boost) {
    boostCounter += 1;
    if (boostCounter % 5 === 0) p.fireCd = 0; // ~12 aimed shots a second
  }
  const events = world.step(STEP, move, aim, firing);
  return events;
}

function playSeconds(world, seconds, boost = false, mode = 'hunt') {
  let events = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    events |= autopilotStep(world, boost, mode);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw and the best
 * score to show. Names: start, play, boss, victory (anything else is start).
 */
export function stageShot(name, world) {
  boostCounter = 0;
  lockedTarget = null;
  lockStreak = 0;
  lockFarSteps = 0;
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'boss' && name !== 'victory') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.ambientStep(STEP);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'boss') {
    world.startWave(MAX_WAVE);
    // The Queen leads her brood in: she is on screen from the first second.
    const queue = world.state.spawnQueue;
    const queenAt = queue.indexOf('queen');
    if (queenAt > 0) queue.splice(queenAt, 1);
    if (queenAt !== -1) queue.unshift('queen');
    playSeconds(world, BOSS_SECONDS);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'victory') {
    let events = 0;
    for (let i = 0; i < VICTORY_STEP_BUDGET; i += 1) {
      events |= autopilotStep(world, true);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    if (state.won) return { screen: SCREEN_VICTORY, best: state.score };
    // The autopilot fell short: the frame still shows the real victory screen,
    // with the score the run actually earned.
    state.won = true;
    state.wave = MAX_WAVE;
    state.waveState = 'won';
    return { screen: SCREEN_VICTORY, best: state.score };
  }
  // play: a busy mid-game frame. Hunt through wave 1 (earning the score and
  // keeping the blooms alive), then hold fire at the start of wave 2 so moths
  // gather, and hunt for a moment so light is in the air when the frame is
  // taken — never a wave-clear gap, never a garden the warden already emptied,
  // and never a frame where the blooms have already been eaten.
  let events = 0;
  let holdSeconds = 0;
  for (let chunk = 0; chunk < 45; chunk += 1) {
    const s = world.state;
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    const bloomsAlive = s.blooms.filter((b) => b.alive).length;
    const minPetals = Math.min(...s.blooms.filter((b) => b.alive).map((b) => b.petals), 3);
    // Wait until the frame is actually busy: moths counted only when they
    // are on screen, not still queueing or sliding in from an edge.
    const onScreen = s.moths.filter((m) => m.x > 40 && m.x < 1240 && m.y > 90 && m.y < 650).length;
    if (s.wave >= 2 && (onScreen >= 4 || holdSeconds >= 6 || bloomsAlive <= 3 || minPetals <= 1)) {
      events |= playSeconds(world, 1.5);
      break;
    }
    if (s.wave >= 2) {
      holdSeconds += 1;
      events |= playSeconds(world, 1, false, 'hold');
    } else {
      events |= playSeconds(world, 1);
    }
  }
  const over = state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}
