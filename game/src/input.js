// Keyboard (WASD/arrows to move, Space to shoot, P/Esc pause, R restart,
// M mute) and mouse (move aims, click shoots). One action bitset per frame,
// consumed by the loop with takeActions(), so a press is never read twice.
//
// The mouse position is stored in the 1280x720 playfield's coordinates, not
// the window's, so aiming is the same whatever the window size. Losing the
// window (alt-tab, a notification) clears the held keys, so the warden never
// keeps flying on a key the player already let go of.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouse = { x: 640, y: 300, down: false, seen: false };

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1280,
      y: ((clientY - rect.top) / rect.height) * 720,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
    if (event.key === 'm' || event.key === 'M') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    mouse = { ...canvasPoint(event.clientX, event.clientY), down: mouse.down, seen: true };
  });
  canvas.addEventListener('mousedown', (event) => {
    mouse = { ...canvasPoint(event.clientX, event.clientY), down: true, seen: true };
  });
  window.addEventListener('mouseup', () => {
    mouse = { ...mouse, down: false };
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  return {
    direction,
    get firing() {
      return keys.has(' ') || mouse.down;
    },
    get mouse() {
      return mouse;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test/autopilot hook: pretend a key is held. */
    setKey(key, down) {
      if (down) keys.add(key);
      else keys.delete(key);
    },
    setMouse(x, y, down) {
      mouse = { x, y, down, seen: true };
    },
  };
}
