// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// blessing, paused, victory and game over.
//
// ?seed=N fixes the moth pattern. ?shot=start|play|boss|victory (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. window.__lumengarden exposes the live
// state for play-testing.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld, EVENT_BLESSING, EVENT_BLOOM_HURT, EVENT_BOSS, EVENT_ENRAGE, EVENT_HURT,
  EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SPORE_POP, EVENT_SPIT,
  EVENT_WAVE_CLEAR, EVENT_WAVE_START, EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, pickBlessingCard, SCREEN_BLESSING, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Guard the five blooms.');
  }

  function endGame(won) {
    screen = won ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.victory();
    else audio.gameOver();
    announce(won ? `Victory! Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    // On the blessing screen, 1 / 2 / 3 (or a click) takes a card, and the
    // garden resumes. Nothing else on this screen spends the press, though
    // R still restarts the run from here.
    if (screen === SCREEN_BLESSING) {
      const pick = actions & ACTION_PICK_1 ? 0 : actions & ACTION_PICK_2 ? 1 : actions & ACTION_PICK_3 ? 2 : -1;
      if (pick >= 0 && world.chooseBlessing(pick)) {
        screen = SCREEN_PLAY;
        announce('Blessing chosen. Keep guarding the garden.');
      }
      if (actions & ACTION_RESTART) startGame();
      return;
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playEvents(events) {
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_BLOOM_HURT) audio.bloomHurt();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_BLESSING) audio.blessing();
    if (events & EVENT_WAVE_START) audio.waveStart();
    if (events & EVENT_BOSS) audio.bossRoar();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SPIT) audio.spit();
    if (events & EVENT_SPORE_POP) audio.sporePop();
    if (events & EVENT_ENRAGE) {
      audio.enrage();
      announce('The Moth Queen enrages!');
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.ambientStep(STEP);
      return;
    }
    const move = input.direction();
    const mouse = input.mouse;
    const aim = mouse.seen ? { x: mouse.x, y: mouse.y } : { x: world.state.player.x, y: world.state.player.y - 100 };
    const events = world.step(STEP, move, aim, input.firing);
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY) && !world.state.blessingDraft) {
        step();
        accumulator -= STEP;
      }
      // The garden just offered a blessing: hold the fight on the choice
      // screen until the warden picks one, instead of letting moths feed.
      if (world.state.blessingDraft && screen === SCREEN_PLAY) {
        screen = SCREEN_BLESSING;
        announce('Choose a blessing: press 1, 2 or 3, or click a card.');
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting moths feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A click anywhere on the title / end screens starts the game; on the
  // blessing screen it takes the card under the cursor instead.
  canvas.addEventListener('mousedown', () => {
    audio.unlock();
    if (screen === SCREEN_BLESSING) {
      const card = pickBlessingCard(input.mouse.x, input.mouse.y);
      if (card >= 0 && world.chooseBlessing(card)) {
        screen = SCREEN_PLAY;
        announce('Blessing chosen. Keep guarding the garden.');
      }
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) startGame();
  });

  window.__lumengarden = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    start: startGame,
    input,
    world,
  };

  announce('Lumen Garden. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
