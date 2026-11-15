// Everything the eye sees: the night garden, the blooms, the moths, the
// spores, the warden, the HUD and the five screens (title, play, paused,
// victory, game over). The canvas is a fixed 1280x720; CSS scales it to the
// window.
//
// Readability rules learned from the first screenshots: the controls hint
// sits on its own dark pill so a moth flying low never covers it; every
// floating score has a dark outline so it survives crossing a bloom's glow;
// the wave banner and the boss label sit on pills of their own; and the
// title screen's blooms are dimmed and dropped below the lettering, so no
// flower ever sits on the title.
import { BLOOM, COMBO_WINDOW, FIELD, MAX_WAVE, PALETTE, PICKUP, PLAYER, SPORE } from './config.js';
import { drawFx } from './fx.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowCircle(ctx, x, y, radius, colour, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, colour);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Centred text with a dark outline, readable over any of the garden. */
function outlinedText(ctx, text, x, y) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(8, 10, 30, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

export function createRenderer(canvas) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');

  function drawBackground(state) {
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyBottom);
    sky.addColorStop(0.56, PALETTE.groundTop);
    sky.addColorStop(1, PALETTE.groundBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars.
    for (const s of state.stars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(state.time * 1.4 + s.twinkle);
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon with a soft halo.
    glowCircle(ctx, 1120, 92, 120, 'rgba(255, 233, 168, 0.35)', 1);
    ctx.fillStyle = PALETTE.moon;
    ctx.beginPath();
    ctx.arc(1120, 92, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 202, 130, 0.35)';
    ctx.beginPath();
    ctx.arc(1108, 82, 7, 0, Math.PI * 2);
    ctx.arc(1132, 104, 5, 0, Math.PI * 2);
    ctx.arc(1124, 76, 3, 0, Math.PI * 2);
    ctx.fill();

    // Distant treeline silhouettes.
    ctx.fillStyle = '#0e1a24';
    ctx.beginPath();
    ctx.moveTo(0, 400);
    for (let x = 0; x <= FIELD.width; x += 64) {
      ctx.lineTo(x, 392 - Math.abs(Math.sin(x * 0.013)) * 26);
    }
    ctx.lineTo(FIELD.width, 430);
    ctx.lineTo(0, 430);
    ctx.closePath();
    ctx.fill();

    // Grass tufts, deterministic from the index so the garden never shimmers.
    ctx.strokeStyle = 'rgba(74, 125, 92, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 46; i += 1) {
      const gx = (i * 137.5) % FIELD.width;
      const gy = 470 + ((i * 89) % 230);
      const sway = Math.sin(state.time * 0.8 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + sway, gy - 12, gx + sway * 1.6, gy - 18);
      ctx.stroke();
    }

    // Ambient fireflies drifting over the garden.
    for (const f of state.fireflies) {
      const fx = f.x + Math.sin(state.time * f.speed + f.phase) * 26;
      const fy = f.y + Math.cos(state.time * f.speed * 0.8 + f.phase) * 14;
      const a = 0.35 + 0.3 * Math.sin(state.time * 2 + f.phase * 3);
      glowCircle(ctx, fx, fy, 10, 'rgba(255, 217, 77, 0.8)', a);
    }
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(640, 360, 320, 640, 360, 760);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(4, 6, 18, 0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawBloom(bloom, time, showLabel = true, yOffset = 0) {
    const x = bloom.x;
    const y = bloom.y + yOffset;
    const sway = Math.sin(bloom.sway * 1.2) * 4;
    if (!bloom.alive) {
      ctx.strokeStyle = 'rgba(120, 120, 140, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + 26);
      ctx.quadraticCurveTo(x + sway, y, x + sway, y - 14);
      ctx.stroke();
      ctx.fillStyle = 'rgba(90, 90, 110, 0.7)';
      ctx.beginPath();
      ctx.arc(x + sway, y - 16, 7, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const flash = bloom.drainFlash > 0 ? 0.5 : 0;
    glowCircle(ctx, x, y - 8, 64 + flash * 30, bloom.hue, 0.28 + flash * 0.3);
    // A bloom down to its last petal pulses red: defend it now.
    if (bloom.petals === 1) {
      const pulse = 0.35 + 0.25 * Math.sin(time * 6);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ff5d7a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 8, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Stem.
    ctx.strokeStyle = '#3f8f5f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 26);
    ctx.quadraticCurveTo(x + sway, y + 4, x + sway, y - 10);
    ctx.stroke();
    // Petals: one per petal left, so damage is visible at a glance.
    const petals = bloom.petals;
    for (let i = 0; i < petals; i += 1) {
      const a = (i / Math.max(1, petals)) * Math.PI * 2 + Math.sin(bloom.sway) * 0.1;
      const px = x + sway + Math.cos(a) * 15;
      const py = y - 12 + Math.sin(a) * 15;
      ctx.fillStyle = bloom.hue;
      ctx.beginPath();
      ctx.ellipse(px, py, 12, 8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glowing heart.
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(x + sway, y - 12, 7, 0, Math.PI * 2);
    ctx.fill();
    if (showLabel) {
      ctx.fillStyle = 'rgba(242, 240, 255, 0.9)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bloom.name, x, y + 46);
      ctx.textAlign = 'left';
    }
  }

  function drawMoth(moth) {
    const flap = Math.sin(moth.wingPhase);
    const wingSpread = 0.55 + Math.abs(flap) * 0.55;
    const isQueen = moth.kind === 'queen';
    const body = isQueen ? PALETTE.queenBody : PALETTE.mothBody;
    const wing = moth.enraged ? '#c05cff' : isQueen ? PALETTE.queenWing : PALETTE.mothWing;
    const facing = moth.vx < -4 ? -1 : 1;
    if (isQueen) {
      glowCircle(ctx, moth.x, moth.y, 110, moth.enraged ? 'rgba(255, 122, 92, 0.4)' : 'rgba(138, 92, 255, 0.35)', 0.8);
    } else if (moth.kind === 'spitter') {
      glowCircle(ctx, moth.x, moth.y, 40, 'rgba(159, 232, 112, 0.28)', 0.9);
    } else {
      glowCircle(ctx, moth.x, moth.y, 34, 'rgba(125, 95, 214, 0.30)', 0.9);
    }
    ctx.save();
    ctx.translate(moth.x, moth.y);
    ctx.scale(facing, 1);
    // Wings.
    ctx.fillStyle = wing;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.ellipse(-moth.radius * 0.7, -moth.radius * (0.5 + wingSpread * 0.35), moth.radius * 0.95, moth.radius * (0.45 + wingSpread * 0.4), -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-moth.radius * 0.6, moth.radius * (0.4 + wingSpread * 0.3), moth.radius * 0.8, moth.radius * (0.35 + wingSpread * 0.3), 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Body.
    ctx.fillStyle = moth.hitFlash > 0 ? '#ffffff' : body;
    ctx.beginPath();
    ctx.ellipse(0, 0, moth.radius * 0.62, moth.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    // A spitter carries a glowing green spore sac under its body.
    if (moth.kind === 'spitter') {
      ctx.fillStyle = PALETTE.spitterSac;
      ctx.beginPath();
      ctx.arc(0, moth.radius * 0.55, moth.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20, 40, 10, 0.7)';
      ctx.beginPath();
      ctx.arc(0, moth.radius * 0.55, moth.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Antennae.
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(moth.radius * 0.4, -moth.radius * 0.7);
    ctx.quadraticCurveTo(moth.radius * 0.9, -moth.radius * 1.3, moth.radius * 1.1, -moth.radius * 1.1);
    ctx.moveTo(moth.radius * 0.4, -moth.radius * 0.7);
    ctx.quadraticCurveTo(moth.radius * 0.7, -moth.radius * 1.4, moth.radius * 0.3, -moth.radius * 1.5);
    ctx.stroke();
    // Glowing eyes.
    ctx.fillStyle = moth.enraged ? PALETTE.queenEnrage : PALETTE.mothEye;
    ctx.beginPath();
    ctx.arc(moth.radius * 0.34, -moth.radius * 0.28, 3.4, 0, Math.PI * 2);
    ctx.arc(moth.radius * 0.34, moth.radius * 0.28, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Health pips for tough moths.
    if (moth.maxHp > 1) {
      ctx.fillStyle = 'rgba(10, 14, 38, 0.7)';
      ctx.fillRect(moth.x - 22, moth.y - moth.radius - 14, 44, 6);
      ctx.fillStyle = moth.enraged ? '#ff7a5c' : '#ff5d7a';
      ctx.fillRect(moth.x - 21, moth.y - moth.radius - 13, 42 * (moth.hp / moth.maxHp), 4);
    }
    if (moth.latched) {
      ctx.fillStyle = '#ff8a9d';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      outlinedText(ctx, 'DRAINING!', moth.x, moth.y - moth.radius - 18);
      ctx.textAlign = 'left';
    }
  }

  function drawSpore(spore) {
    glowCircle(ctx, spore.x, spore.y, 26, PALETTE.sporeGlow, 0.9);
    ctx.fillStyle = PALETTE.spore;
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, SPORE.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(30, 50, 15, 0.65)';
    ctx.beginPath();
    ctx.arc(spore.x - 2, spore.y - 2, 3.5, 0, Math.PI * 2);
    ctx.arc(spore.x + 3, spore.y + 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(p, time) {
    const blink = p.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.35;
    glowCircle(ctx, p.x, p.y, 56, 'rgba(255, 217, 77, 0.5)', 0.9);
    // A dotted aim guide, so the warden's facing reads at a glance.
    ctx.fillStyle = 'rgba(255, 233, 138, 0.55)';
    for (let d = 36; d <= 64; d += 14) {
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * d, p.y + Math.sin(p.angle) * d, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glow trail.
    ctx.strokeStyle = 'rgba(255, 217, 77, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(p.angle) * 34, p.y - Math.sin(p.angle) * 34);
    ctx.lineTo(p.x - Math.cos(p.angle) * 18, p.y - Math.sin(p.angle) * 18);
    ctx.stroke();
    // Wings.
    const flap = Math.sin(time * 30);
    ctx.fillStyle = 'rgba(255, 240, 190, 0.85)';
    ctx.beginPath();
    ctx.ellipse(p.x - 6, p.y - 12 - flap * 3, 10, 5, -0.6, 0, Math.PI * 2);
    ctx.ellipse(p.x - 6, p.y + 12 + flap * 3, 10, 5, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 13, 10, p.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5b00';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Aim tick.
    ctx.strokeStyle = 'rgba(255, 233, 138, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    ctx.lineTo(p.x + Math.cos(p.angle) * 27, p.y + Math.sin(p.angle) * 27);
    ctx.stroke();
    // Triple-shot timer ring.
    if (p.tripleUntil > time) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (p.tripleUntil - time)) / PICKUP.shardSeconds);
      ctx.stroke();
    }
  }

  function drawHud(state, best) {
    const alive = state.blooms.filter((b) => b.alive).length;
    ctx.fillStyle = 'rgba(10, 14, 38, 0.72)';
    roundRect(ctx, 12, 10, 1256, 56, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 217, 77, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, 28, 38);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}`, 28, 58);
    // Hearts.
    for (let i = 0; i < PLAYER.maxHp; i += 1) {
      const hx = 330 + i * 34;
      ctx.fillStyle = i < state.player.hp ? '#ff5d7a' : 'rgba(255, 93, 122, 0.25)';
      ctx.beginPath();
      ctx.arc(hx, 32, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i < state.player.hp ? '#ffd7de' : 'rgba(255, 215, 222, 0.25)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', hx, 37);
    }
    // Wave.
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${Math.max(1, state.wave)} / ${MAX_WAVE}`, 640, 38);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '14px system-ui, sans-serif';
    const waveLabel = state.waveState === 'intro'
      ? (state.wave >= MAX_WAVE ? 'The Queen approaches…' : `Wave ${state.wave + 1} incoming…`)
      : state.waveState === 'active'
        ? `${state.moths.length + state.spawnQueue.length} moths left`
        : '';
    ctx.fillText(waveLabel, 640, 58);
    // Blooms alive; a garden down to one bloom flashes the count red.
    ctx.textAlign = 'right';
    const oneLeft = alive === 1;
    ctx.fillStyle = oneLeft && Math.floor(state.time * 4) % 2 === 0 ? '#ff5d7a' : PALETTE.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`✿ ${alive} / ${BLOOM.count} blooms`, 1252, 38);
    // Combo, with a timer bar under it while it lives.
    if (state.multiplier > 1) {
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`COMBO ×${state.multiplier}`, 1252, 60);
      ctx.fillStyle = 'rgba(255, 217, 77, 0.3)';
      ctx.fillRect(1152, 63, 100, 3);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(1152, 63, 100 * (state.comboTimer / COMBO_WINDOW), 3);
    } else if (state.combo > 0) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`combo ${state.combo}`, 1252, 60);
    }
    ctx.textAlign = 'left';
    // Boss bar: the label sits above the bar now, never on top of the fill,
    // and the whole block clears the HUD panel above it.
    if (state.boss) {
      const b = state.boss;
      ctx.textAlign = 'center';
      ctx.fillStyle = b.enraged ? '#ff7a5c' : '#f2f0ff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(b.enraged ? 'THE MOTH QUEEN — ENRAGED' : 'THE MOTH QUEEN', 640, 84);
      ctx.fillStyle = 'rgba(10, 14, 38, 0.72)';
      roundRect(ctx, 440, 90, 400, 16, 8);
      ctx.fill();
      ctx.fillStyle = b.enraged ? '#ff7a5c' : '#8a5cff';
      const w = 384 * (b.hp / b.maxHp);
      if (w > 0) {
        roundRect(ctx, 448, 92, Math.max(8, w), 12, 6);
        ctx.fill();
      }
      ctx.textAlign = 'left';
    }
    // Controls hint on its own pill, so a moth flying low never covers it.
    const hint = 'WASD / arrows — move    ·    mouse — aim    ·    click / Space — shoot    ·    P — pause    ·    M — mute';
    ctx.font = '13px system-ui, sans-serif';
    const hintW = ctx.measureText(hint).width;
    ctx.fillStyle = PALETTE.footerPill;
    roundRect(ctx, 10, 688, hintW + 20, 22, 11);
    ctx.fill();
    ctx.fillStyle = 'rgba(170, 179, 214, 0.95)';
    ctx.fillText(hint, 20, 704);
  }

  function drawPanel(title, lines, accent) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 340, 150, 600, 400, 18);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText(title, 640, 226);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '19px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, 640, 282 + i * 32));
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press ENTER or click to play again  ·  R restarts', 640, 514);
    ctx.textAlign = 'left';
  }

  function drawTitle(state, best) {
    drawBackground(state);
    // Blooms sit behind the title, dimmed and dropped below the lettering so
    // no flower ever sits on the title itself.
    ctx.save();
    ctx.globalAlpha = 0.32;
    for (const bloom of state.blooms) drawBloom(bloom, state.time, false, 130);
    ctx.restore();
    // The warden hovers below the prompt line, out of the lettering, instead
    // of sitting on the story text at the garden's centre.
    drawPlayer({ ...state.player, x: 640, y: 618, angle: -Math.PI / 2 }, state.time);
    ctx.fillStyle = 'rgba(8, 10, 30, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    glowCircle(ctx, 640, 190, 200, 'rgba(255, 217, 77, 0.25)', 0.9);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.fillText('LUMEN GARDEN', 640, 208);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('Warden of the Last Light', 640, 252);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('Shadow moths are eating the garden\'s light. You are Pip, the last firefly warden.', 640, 300);
    ctx.fillText('Guard the five blooms through ten waves — then face the Moth Queen.', 640, 330);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('WASD / arrows — fly      ·      mouse — aim      ·      click / Space — shoot light', 640, 392);
    ctx.fillText('Moths latched onto a bloom drain its petals. Spitters lob spores — shoot them down.', 640, 424);
    ctx.fillText('Lose all five blooms, or all three hearts, and the garden goes dark.', 640, 456);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 24px system-ui, sans-serif';
    const pulse = 0.8 + 0.2 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillText('— Press ENTER or click to begin —', 640, 528);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(`Best score: ${best.toLocaleString('en-US')}`, 640, 566);
    }
    ctx.textAlign = 'left';
  }

  function drawVictory(state, best) {
    drawWorld(state, false);
    ctx.fillStyle = 'rgba(8, 10, 30, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const alive = state.blooms.filter((b) => b.alive).length;
    const stars = alive >= 5 ? 3 : alive >= 3 ? 2 : 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('THE GARDEN BLOOMS AGAIN', 640, 190);
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), 640, 250);
    const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
    drawPanelLinesOnly([
      `You cleared all ${MAX_WAVE} waves and the Moth Queen is gone.`,
      `Score  ${state.score.toLocaleString('en-US')}    ·    Best  ${Math.max(best, state.score).toLocaleString('en-US')}`,
      `Blooms saved  ${alive} / ${BLOOM.count}    ·    Moths banished  ${state.kills}`,
      `Shot accuracy  ${accuracy}%    ·    ${state.shotsFired} lights fired`,
    ]);
    ctx.textAlign = 'left';
  }

  function drawPanelLinesOnly(lines) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = '19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, 640, 300 + i * 32));
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press ENTER or click to play again  ·  R restarts', 640, 470);
    ctx.textAlign = 'left';
  }

  function drawOver(state, best) {
    drawWorld(state, false);
    ctx.fillStyle = 'rgba(8, 10, 30, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const alive = state.blooms.filter((b) => b.alive).length;
    const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
    const reason = alive === 0 ? 'Every bloom went dark.' : 'Pip\'s light went out.';
    drawPanel('THE GARDEN WENT DARK', [
      reason,
      `You reached wave ${Math.max(1, state.wave)} of ${MAX_WAVE} and banished ${state.kills} moths.`,
      `Score  ${state.score.toLocaleString('en-US')}    ·    Best  ${Math.max(best, state.score).toLocaleString('en-US')}`,
      `Blooms saved  ${alive} / ${BLOOM.count}    ·    Shot accuracy  ${accuracy}%`,
    ], '#ff5d7a');
  }

  function drawWorld(state, showLabels = true) {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(state);
    for (const bloom of state.blooms) drawBloom(bloom, state.time, showLabels);
    for (const pk of state.pickups) drawPickup(pk);
    for (const moth of state.moths) drawMoth(moth);
    for (const spore of state.spores) drawSpore(spore);
    for (const b of state.bullets) {
      glowCircle(ctx, b.x, b.y, 20, 'rgba(255, 233, 138, 0.85)', 0.9);
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    drawFx(ctx, state);
    drawVignette();
    if (!state.over && !state.won) drawPlayer(state.player, state.time);
    ctx.restore();
  }

  function drawPickup(pk) {
    const bob = Math.sin(pk.phase) * 3;
    const blink = pk.life < 2.5 && Math.floor(pk.life * 6) % 2 === 0;
    if (blink) return;
    if (pk.kind === 'dew') {
      glowCircle(ctx, pk.x, pk.y + bob, 26, 'rgba(125, 255, 158, 0.6)', 0.9);
      ctx.fillStyle = '#7dff9e';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c1a14';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', pk.x, pk.y + bob + 4);
    } else {
      glowCircle(ctx, pk.x, pk.y + bob, 30, 'rgba(255, 217, 77, 0.7)', 0.9);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(pk.x, pk.y + bob - 12);
      ctx.lineTo(pk.x + 9, pk.y + bob + 8);
      ctx.lineTo(pk.x - 9, pk.y + bob + 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best) {
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    if (screen === SCREEN_VICTORY) {
      drawVictory(state, best);
      return;
    }
    if (screen === SCREEN_OVER) {
      drawOver(state, best);
      return;
    }
    drawWorld(state);
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8, 10, 30, 0.55)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPanel('PAUSED', [
        'The moths wait in the dark.',
        'Press P or ENTER to keep guarding the garden.',
      ], '#ffd94d');
    }
    if (state.waveState === 'intro' && screen === SCREEN_PLAY && !state.over && !state.won) {
      const label = state.wave >= MAX_WAVE ? 'THE MOTH QUEEN AWAKENS' : `WAVE ${state.wave + 1}`;
      const sub = state.wave >= MAX_WAVE ? 'Banish her brood, then bring her down.' : 'Get ready — the moths are coming.';
      ctx.font = 'bold 34px system-ui, sans-serif';
      const labelW = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(8, 10, 30, 0.6)';
      roundRect(ctx, 640 - labelW / 2 - 24, 116, labelW + 48, 84, 14);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(label, 640, 150);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(sub, 640, 184);
      ctx.textAlign = 'left';
    }
  }

  return { draw };
}
