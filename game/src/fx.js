// The fleeting things: burst particles, floating score text and the
// shockwave rings a big death leaves behind. The world spawns them and steps
// them; the renderer draws them. All three lists live on the world state so
// a screenshot stages them like anything else.
//
// Floaters are drawn with a dark outline so a "+100" stays readable even
// when it drifts across a glowing bloom — the staged shots lost the score
// popups against the bloom glow, so every floater carries its own shadow.
export function spawnBurst(state, random, x, y, colour, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = random.range(0, Math.PI * 2);
    const v = random.range(speed * 0.3, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: random.range(0.3, 0.8),
      maxLife: 0.8,
      size: random.range(2, 5),
      colour,
    });
  }
}

/** A short-lived sparkle that drifts up and fades; the warden's trail. */
export function spawnSparkle(state, random, x, y) {
  state.particles.push({
    x: x + random.range(-8, 8),
    y: y + random.range(-8, 8),
    vx: random.range(-12, 12),
    vy: random.range(-26, -8),
    life: random.range(0.4, 0.9),
    maxLife: 0.9,
    size: random.range(1.5, 3),
    colour: '#ffe98a',
  });
}

export function spawnFloater(state, x, y, text, colour) {
  // One voice at a time: a fresh floater retires the oldest when the garden
  // gets chatty, so the frame never fills with overlapping numbers.
  if (state.floaters.length > 14) state.floaters.shift();
  state.floaters.push({ x, y, text, colour, life: 1.1 });
}

/** An expanding ring, drawn as a stroked circle that fades as it grows. */
export function spawnRing(state, x, y, colour, maxRadius = 120) {
  state.rings.push({ x, y, colour, radius: 8, maxRadius, life: 0.6, maxLife: 0.6 });
}

/** Advance particles, floaters and rings one fixed step. */
export function stepFx(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.exp(-2 * dt);
    pt.vy *= Math.exp(-2 * dt);
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
    const f = state.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) state.floaters.splice(i, 1);
  }
  for (let i = state.rings.length - 1; i >= 0; i -= 1) {
    const r = state.rings[i];
    r.life -= dt;
    const done = 1 - Math.max(0, r.life / r.maxLife);
    r.radius = 8 + done * (r.maxRadius - 8);
    if (r.life <= 0) state.rings.splice(i, 1);
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
}

export function drawFx(ctx, state) {
  for (const r of state.rings) {
    ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
    ctx.strokeStyle = r.colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.colour;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8, 10, 30, 0.9)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.colour;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
