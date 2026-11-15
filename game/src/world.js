// The whole game state and its rules: the warden, the blooms, the moths,
// the spores, the bullets, the pickups, the waves and the score. Pure
// simulation — no drawing, no input — stepped in fixed 1/60 s slices by the
// loop or by the shot stager. Events are a bitset so the loop can play the
// matching sound and announce.
//
// Four moth kinds hunt the blooms. Flutters drift in and latch on. Darters
// zig-zag fast. Tankers soak three hits. Spitters hold their distance and
// lob spore globs that drift to a bloom and eat a petal on impact — shoot
// the spore down first. On wave 10 the Moth Queen arrives; below half health
// she enrages, moves faster and calls darters instead of flutters.
import {
  BLOOM, COMBO_MAX_MULTIPLIER, COMBO_PER_MULTIPLIER, COMBO_WINDOW, FIELD,
  FOOTER_TOP, MAX_WAVE, MOTH, PICKUP, PLAYER, QUEEN_ENRAGE_BELOW,
  QUEEN_ENRAGE_SPEED, QUEEN_SUMMON_SECONDS, SPORE, STEP,
  WAVE_CLEAR_BASE, WAVE_CLEAR_PER_BLOOM,
} from './config.js';
import { spawnBurst, spawnFloater, spawnRing, spawnSparkle, stepFx } from './fx.js';

export const EVENT_KILL = 1;
export const EVENT_HURT = 2;
export const EVENT_BLOOM_HURT = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_WAVE_START = 16;
export const EVENT_PICKUP = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;
export const EVENT_BOSS = 256;
export const EVENT_SPIT = 512;
export const EVENT_ENRAGE = 1024;
export const EVENT_SPORE_POP = 2048;

/** Where a moth enters: just outside one of the four edges. */
function spawnPoint(random) {
  const side = random.int(0, 3);
  const margin = 30;
  if (side === 0) return { x: random.range(0, FIELD.width), y: -margin };
  if (side === 1) return { x: FIELD.width + margin, y: random.range(0, FIELD.height) };
  if (side === 2) return { x: random.range(0, FIELD.width), y: FIELD.height + margin };
  return { x: -margin, y: random.range(0, FIELD.height) };
}

/** The wave's roster: the count grows, darters join from wave 2, spitters
 *  from wave 3 and tankers from wave 4; wave 10 adds the Queen herself. */
export function waveRoster(wave) {
  const roster = [];
  const total = 6 + wave * 3;
  for (let i = 0; i < total; i += 1) {
    if (wave >= 4 && i % 7 === 6) roster.push('tanker');
    else if (wave >= 3 && i % 5 === 4) roster.push('spitter');
    else if (wave >= 2 && i % 3 === 2) roster.push('darter');
    else roster.push('flutter');
  }
  if (wave === MAX_WAVE) roster.push('queen');
  return roster;
}

function makeBloom(random, index) {
  // Blooms sit in a loose ring around the garden's centre, never on the edge.
  const angle = (index / BLOOM.count) * Math.PI * 2 - Math.PI / 2;
  const radiusX = 380;
  const radiusY = 210;
  return {
    id: index,
    name: BLOOM.names[index],
    hue: BLOOM.hues[index],
    x: FIELD.width / 2 + Math.cos(angle) * radiusX + random.range(-30, 30),
    y: FIELD.height / 2 + Math.sin(angle) * radiusY + random.range(-20, 20),
    petals: BLOOM.petals,
    alive: true,
    drainFlash: 0,
    sway: random.range(0, Math.PI * 2),
  };
}

function makeMoth(kind, x, y, random) {
  const spec = MOTH[kind];
  return {
    kind,
    x,
    y,
    radius: spec.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    speed: spec.speed * random.range(0.9, 1.15),
    score: spec.score,
    drainSeconds: spec.drainSeconds,
    targetBloom: null,
    latched: false,
    drainTimer: 0,
    wingPhase: random.range(0, Math.PI * 2),
    zigPhase: random.range(0, Math.PI * 2),
    hitFlash: 0,
    spawnTimer: 0,
    chargeTimer: random.range(3, 6),
    charging: 0,
    lobTimer: random.range(1.5, SPORE.lobSeconds),
    enraged: false,
    vx: 0,
    vy: 0,
  };
}

function makeSpore(x, y, bloom, random) {
  return {
    x,
    y,
    targetBloom: bloom,
    radius: SPORE.radius,
    speed: SPORE.speed * random.range(0.9, 1.1),
    life: SPORE.lifeSeconds,
    wobble: random.range(0, Math.PI * 2),
    vx: 0,
    vy: 0,
  };
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    wave: 0,
    waveState: 'intro', // intro -> active -> clear -> intro ... -> won
    waveTimer: 2.5,
    spawnQueue: [],
    spawnTimer: 0,
    blooms: [],
    player: null,
    bullets: [],
    moths: [],
    spores: [],
    pickups: [],
    particles: [],
    floaters: [],
    rings: [],
    stars: [],
    fireflies: [],
    shake: 0,
    trailTimer: 0,
    over: false,
    won: false,
    boss: null,
    best: 0,
  };

  function initScenery() {
    state.stars = [];
    for (let i = 0; i < 150; i += 1) {
      state.stars.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, 430),
        r: random.range(0.6, 2.1),
        twinkle: random.range(0, Math.PI * 2),
      });
    }
    state.fireflies = [];
    for (let i = 0; i < 18; i += 1) {
      state.fireflies.push({
        x: random.range(0, FIELD.width),
        y: random.range(80, FIELD.height),
        phase: random.range(0, Math.PI * 2),
        speed: random.range(0.2, 0.7),
      });
    }
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveState = 'active';
    state.spawnQueue = random.shuffle(waveRoster(wave));
    state.spawnTimer = 0.4;
    if (wave === MAX_WAVE) state.boss = null;
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.wave = 0;
    state.waveState = 'intro';
    state.waveTimer = 2.5;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.blooms = [];
    for (let i = 0; i < BLOOM.count; i += 1) state.blooms.push(makeBloom(random, i));
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hp: PLAYER.maxHp,
      invuln: 0,
      fireCd: 0,
      tripleUntil: 0,
    };
    state.bullets = [];
    state.moths = [];
    state.spores = [];
    state.pickups = [];
    state.particles = [];
    state.floaters = [];
    state.rings = [];
    state.shake = 0;
    state.trailTimer = 0;
    state.over = false;
    state.won = false;
    state.boss = null;
    initScenery();
  }

  function nearestBloom(x, y) {
    let bestBloom = null;
    let bestDist = Infinity;
    for (const bloom of state.blooms) {
      if (!bloom.alive) continue;
      const d = Math.hypot(bloom.x - x, bloom.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestBloom = bloom;
      }
    }
    return bestBloom;
  }

  /** One petal lost, whatever ate it: a draining moth or a landed spore.
   *  Returns the events it raises; sets state.over when the last bloom dies. */
  function losePetal(bloom) {
    let events = 0;
    bloom.petals -= 1;
    events |= EVENT_BLOOM_HURT;
    spawnBurst(state, random, bloom.x, bloom.y, bloom.hue, 8, 120);
    if (bloom.petals <= 0) {
      bloom.alive = false;
      spawnFloater(state, bloom.x, bloom.y - 30, `${bloom.name} bloom lost`, '#ff8a9d');
      if (state.blooms.every((b) => !b.alive)) {
        state.over = true;
        events |= EVENT_OVER;
      }
    }
    return events;
  }

  function killMoth(moth, index) {
    state.moths.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    state.multiplier = Math.min(COMBO_MAX_MULTIPLIER, 1 + Math.floor(state.combo / COMBO_PER_MULTIPLIER));
    const gained = moth.score * state.multiplier;
    state.score += gained;
    spawnBurst(state, random, moth.x, moth.y, moth.kind === 'queen' ? '#c9a6ff' : '#b48cff', moth.kind === 'queen' ? 42 : 14, 240);
    spawnFloater(state, moth.x, moth.y - 10, `+${gained}`, '#ffe98a');
    if (moth.kind === 'queen') {
      state.boss = null;
      state.shake = 14;
      spawnRing(state, moth.x, moth.y, '#c9a6ff', 200);
      spawnFloater(state, moth.x, moth.y - 44, 'THE QUEEN FALLS!', '#c9a6ff');
    }
    if (random.chance(PICKUP.dewChance) && state.player.hp < PLAYER.maxHp) {
      state.pickups.push({ kind: 'dew', x: moth.x, y: moth.y, life: PICKUP.lifeSeconds, phase: 0 });
    } else if (random.chance(PICKUP.dewChance + PICKUP.shardChance)) {
      state.pickups.push({ kind: 'shard', x: moth.x, y: moth.y, life: PICKUP.lifeSeconds, phase: 0 });
    }
  }

  function fireBullet(angle) {
    const p = state.player;
    state.bullets.push({
      x: p.x + Math.cos(angle) * (PLAYER.radius + 6),
      y: p.y + Math.sin(angle) * (PLAYER.radius + 6),
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      radius: PLAYER.bulletRadius,
      life: PLAYER.bulletLife,
    });
    state.shotsFired += 1;
  }

  /** Advance the simulation one fixed step. `move` is {x, y} in [-1, 1], `aim` is the
   *  point the warden faces, `firing` whether the trigger is held. Returns events. */
  function step(dt, move, aim, firing) {
    let events = 0;
    if (state.over || state.won) return events;
    state.time += dt;
    const p = state.player;

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    // --- wave flow ---------------------------------------------------------
    if (state.waveState === 'intro') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        startWave(state.wave + 1);
        events |= EVENT_WAVE_START;
        if (state.wave === MAX_WAVE) events |= EVENT_BOSS;
      }
    } else if (state.waveState === 'active') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const kind = state.spawnQueue.shift();
          const at = spawnPoint(random);
          const moth = makeMoth(kind, at.x, at.y, random);
          state.moths.push(moth);
          if (kind === 'queen') state.boss = moth;
          state.spawnTimer = Math.max(0.35, 1.15 - state.wave * 0.07);
        }
      } else if (state.moths.length === 0 && state.spores.length === 0) {
        const alive = state.blooms.filter((b) => b.alive).length;
        const bonus = WAVE_CLEAR_BASE + WAVE_CLEAR_PER_BLOOM * alive;
        state.score += bonus;
        spawnFloater(state, FIELD.width / 2, 200, `WAVE ${state.wave} CLEAR  +${bonus}`, '#ffd94d');
        events |= EVENT_WAVE_CLEAR;
        if (state.wave >= MAX_WAVE) {
          state.won = true;
          state.waveState = 'won';
          // Freeze the frame clean: no bullets or floating text over the victory screen.
          state.bullets = [];
          state.spores = [];
          state.floaters = [];
          events |= EVENT_WIN;
          return events;
        }
        state.waveState = 'intro';
        state.waveTimer = 3;
      }
    }

    // --- player ------------------------------------------------------------
    p.vx += move.x * PLAYER.accel * dt;
    p.vy += move.y * PLAYER.accel * dt;
    const drag = Math.exp(-8 * dt);
    p.vx *= drag;
    p.vy *= drag;
    const speed = Math.hypot(p.vx, p.vy);
    const maxSpeed = PLAYER.speed;
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    }
    p.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, p.x + p.vx * dt));
    p.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, p.y + p.vy * dt));
    p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    if (p.invuln > 0) p.invuln -= dt;
    p.fireCd -= dt;
    if (firing && p.fireCd <= 0) {
      p.fireCd = PLAYER.fireInterval;
      const triple = state.time < p.tripleUntil;
      fireBullet(p.angle);
      if (triple) {
        fireBullet(p.angle - 0.22);
        fireBullet(p.angle + 0.22);
      }
    }
    // A fast warden leaves a faint trail of light.
    state.trailTimer -= dt;
    if (speed > PLAYER.trailSpeed && state.trailTimer <= 0) {
      state.trailTimer = 0.05;
      spawnSparkle(state, random, p.x - Math.cos(p.angle) * 14, p.y - Math.sin(p.angle) * 14);
    }

    // --- bullets ------------------------------------------------------------
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      // Spores first: they are small and a shot spent popping one is a shot
      // that did not kill a moth, so the order is a real trade-off.
      let spent = false;
      for (let j = state.spores.length - 1; j >= 0; j -= 1) {
        const spore = state.spores[j];
        if (Math.hypot(b.x - spore.x, b.y - spore.y) < b.radius + spore.radius) {
          state.bullets.splice(i, 1);
          state.spores.splice(j, 1);
          state.shotsHit += 1;
          spawnBurst(state, random, spore.x, spore.y, '#a8e063', 8, 160);
          events |= EVENT_SPORE_POP;
          spent = true;
          break;
        }
      }
      if (spent) continue;
      for (let j = state.moths.length - 1; j >= 0; j -= 1) {
        const moth = state.moths[j];
        if (Math.hypot(b.x - moth.x, b.y - moth.y) < b.radius + moth.radius) {
          state.bullets.splice(i, 1);
          state.shotsHit += 1;
          moth.hp -= 1;
          moth.hitFlash = 0.12;
          spawnBurst(state, random, b.x, b.y, '#ffe98a', 5, 140);
          if (moth.hp <= 0) killMoth(moth, j);
          break;
        }
      }
    }

    // --- spores --------------------------------------------------------------
    for (let i = state.spores.length - 1; i >= 0; i -= 1) {
      const spore = state.spores[i];
      spore.life -= dt;
      spore.wobble += dt * 5;
      const bloom = spore.targetBloom;
      if (spore.life <= 0 || !bloom || !bloom.alive) {
        state.spores.splice(i, 1);
        continue;
      }
      const dx = bloom.x - spore.x;
      const dy = bloom.y - spore.y;
      const dist = Math.hypot(dx, dy) || 1;
      // A lazy wobble across the drift, so spores read as alive, not arrows.
      const wob = Math.sin(spore.wobble) * 0.35;
      const px = -dy / dist * wob;
      const py = dx / dist * wob;
      spore.vx = (dx / dist + px) * spore.speed;
      spore.vy = (dy / dist + py) * spore.speed;
      spore.x += spore.vx * dt;
      spore.y += spore.vy * dt;
      if (spore.y > FOOTER_TOP) spore.y = FOOTER_TOP;
      if (dist < BLOOM.radius + spore.radius) {
        state.spores.splice(i, 1);
        events |= losePetal(bloom);
        if (state.over) return events;
      }
    }

    // --- moths ---------------------------------------------------------------
    for (let i = state.moths.length - 1; i >= 0; i -= 1) {
      const moth = state.moths[i];
      moth.wingPhase += dt * (moth.kind === 'darter' ? 26 : moth.enraged ? 24 : 16);
      moth.zigPhase += dt * 3;
      if (moth.hitFlash > 0) moth.hitFlash -= dt;
      // The Queen enrages below half health: faster, and her summons turn
      // from flutters into darters.
      if (moth.kind === 'queen' && !moth.enraged && moth.hp <= moth.maxHp * QUEEN_ENRAGE_BELOW) {
        moth.enraged = true;
        state.shake = 10;
        spawnRing(state, moth.x, moth.y, '#ff7a5c', 170);
        spawnFloater(state, moth.x, moth.y - 60, 'THE QUEEN ENRAGES!', '#ff7a5c');
        events |= EVENT_ENRAGE;
      }
      if (moth.latched) {
        const bloom = moth.targetBloom;
        if (!bloom || !bloom.alive) {
          moth.latched = false;
          moth.targetBloom = null;
          continue;
        }
        moth.drainTimer -= dt;
        bloom.drainFlash = 0.25;
        if (moth.drainTimer <= 0) {
          moth.drainTimer = moth.drainSeconds;
          events |= losePetal(bloom);
          if (state.over) return events;
        }
        continue;
      }
      // Steer: most moths chase the nearest living bloom; the Queen charges
      // the warden instead, and spitters hold their distance and lob spores.
      let tx;
      let ty;
      if (moth.kind === 'queen') {
        moth.chargeTimer -= dt;
        if (moth.chargeTimer <= 0) {
          moth.charging = 1.1;
          moth.chargeTimer = random.range(4, 6.5);
        }
        if (moth.charging > 0) {
          moth.charging -= dt;
          tx = p.x;
          ty = p.y;
        } else {
          tx = FIELD.width / 2 + Math.cos(state.time * 0.4) * 260;
          ty = FIELD.height / 2 + Math.sin(state.time * 0.55) * 150;
        }
        if (moth.spawnTimer <= 0) {
          moth.spawnTimer = QUEEN_SUMMON_SECONDS;
          const at = { x: moth.x + random.range(-40, 40), y: moth.y + random.range(-40, 40) };
          state.moths.push(makeMoth(moth.enraged ? 'darter' : 'flutter', at.x, at.y, random));
          spawnFloater(state, moth.x, moth.y - 56, 'The Queen calls her brood!', '#c9a6ff');
        } else {
          moth.spawnTimer -= dt;
        }
      } else if (moth.kind === 'spitter') {
        const bloom = nearestBloom(moth.x, moth.y);
        if (!bloom) continue;
        moth.targetBloom = bloom;
        const dx = moth.x - bloom.x;
        const dy = moth.y - bloom.y;
        const dist = Math.hypot(dx, dy) || 1;
        // Hold the lobbing distance: drift in when too far, back off close
        // up. (dx, dy) point from the bloom to the spitter, so closing in
        // means moving against them.
        const want = dist > SPORE.holdDistance + 40 ? 1 : dist < SPORE.holdDistance - 60 ? -1 : 0;
        tx = moth.x - (dx / dist) * want * 60;
        ty = moth.y - (dy / dist) * want * 60;
        moth.lobTimer -= dt;
        if (moth.lobTimer <= 0) {
          if (dist < SPORE.holdDistance + 120) {
            moth.lobTimer = SPORE.lobSeconds + random.range(-SPORE.lobJitter, SPORE.lobJitter);
            state.spores.push(makeSpore(moth.x, moth.y + 10, bloom, random));
            spawnBurst(state, random, moth.x, moth.y + 10, '#a8e063', 4, 90);
            events |= EVENT_SPIT;
          } else {
            // Too far to lob: try again shortly once back in range, instead
            // of letting the timer run away negative.
            moth.lobTimer = random.range(0.5, 1.5);
          }
        }
      } else {
        const bloom = nearestBloom(moth.x, moth.y);
        if (!bloom) continue;
        moth.targetBloom = bloom;
        tx = bloom.x;
        ty = bloom.y;
      }
      let dx = tx - moth.x;
      let dy = ty - moth.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist;
      dy /= dist;
      if (moth.kind === 'darter') {
        const perp = Math.sin(moth.zigPhase) * 0.7;
        const px = -dy * perp;
        const py = dx * perp;
        dx += px;
        dy += py;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
      }
      let spd = moth.speed;
      if (moth.kind === 'queen' && moth.charging > 0) spd *= 3.4;
      if (moth.enraged) spd *= QUEEN_ENRAGE_SPEED;
      moth.x += dx * spd * dt;
      moth.y += dy * spd * dt;
      moth.vx = dx * spd;
      moth.vy = dy * spd;
      // Never drift below the footer strip, where the controls hint lives,
      // and never hide up under the HUD bar at the top edge.
      if (moth.y > FOOTER_TOP) moth.y = FOOTER_TOP;
      if (moth.y < 78) moth.y = 78;
      // Reached a bloom: latch on and drain it (spitters and the Queen never latch).
      if (moth.kind !== 'queen' && moth.kind !== 'spitter' && moth.targetBloom) {
        const b = moth.targetBloom;
        if (Math.hypot(moth.x - b.x, moth.y - b.y) < BLOOM.radius + moth.radius - 6) {
          moth.latched = true;
          moth.drainTimer = moth.drainSeconds;
        }
      }
      // Touching the warden hurts the warden and costs the moth its life.
      if (Math.hypot(moth.x - p.x, moth.y - p.y) < moth.radius + PLAYER.radius - 2) {
        if (p.invuln <= 0) {
          p.hp -= 1;
          p.invuln = PLAYER.invulnSeconds;
          state.shake = 10;
          state.combo = 0;
          state.multiplier = 1;
          events |= EVENT_HURT;
          spawnBurst(state, random, p.x, p.y, '#ff5d7a', 16, 220);
          const kbx = (p.x - moth.x) / (Math.hypot(p.x - moth.x, p.y - moth.y) || 1);
          const kby = (p.y - moth.y) / (Math.hypot(p.x - moth.x, p.y - moth.y) || 1);
          p.vx += kbx * 520;
          p.vy += kby * 520;
          if (p.hp <= 0) {
            state.over = true;
            events |= EVENT_OVER;
            return events;
          }
        }
        if (moth.kind !== 'queen') {
          spawnBurst(state, random, moth.x, moth.y, '#b48cff', 10, 180);
          state.moths.splice(i, 1);
        } else {
          moth.charging = 0;
          moth.chargeTimer = 3;
        }
      }
    }

    // --- pickups ---------------------------------------------------------------
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      pk.phase += dt * 4;
      if (pk.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < PICKUP.radius + PLAYER.radius) {
        if (pk.kind === 'dew' && p.hp < PLAYER.maxHp) p.hp += 1;
        if (pk.kind === 'shard') p.tripleUntil = state.time + PICKUP.shardSeconds;
        spawnFloater(state, p.x, p.y - 26, pk.kind === 'dew' ? '+1 heart' : 'TRIPLE LIGHT!', pk.kind === 'dew' ? '#7dff9e' : '#ffd94d');
        state.pickups.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }

    // --- fleeting things, blooms -------------------------------------------------
    stepFx(state, dt);
    for (const bloom of state.blooms) {
      bloom.sway += dt;
      if (bloom.drainFlash > 0) bloom.drainFlash -= dt;
    }
    return events;
  }

  /** Ambient-only step for the title screen: fireflies drift, blooms sway. */
  function ambientStep(dt) {
    state.time += dt;
    for (const bloom of state.blooms) bloom.sway += dt;
  }

  reset();
  return { state, reset, step, ambientStep, startWave, waveRoster };
}

export { STEP };
