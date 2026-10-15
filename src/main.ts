import Cube from 'cubejs';
import './style.css';
import { CubeView, FACE_COLORS } from './cubeView';
import { FACES, formatMove, formatMoves, invertMoves, parseMoves, randomScramble, type Face, type Move } from './moves';
import { Solver } from './solver';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = new CubeView($('viewport'));
const solver = new Solver();
const model = new Cube();

const ui = {
  status: $('status'),
  scramble: $<HTMLButtonElement>('scramble'),
  solve: $<HTMLButtonElement>('solve'),
  reset: $<HTMLButtonElement>('reset'),
  solution: $('solution'),
  stepBack: $<HTMLButtonElement>('step-back'),
  play: $<HTMLButtonElement>('play'),
  stepForward: $<HTMLButtonElement>('step-forward'),
  movePad: $('move-pad'),
  algForm: $<HTMLFormElement>('alg-form'),
  algInput: $<HTMLInputElement>('alg-input'),
  algError: $('alg-error'),
  speed: $<HTMLInputElement>('speed'),
  net: $('net'),
  facelets: $('facelets'),
};

let solverReady = false;
let solving = false;
/** Moves waiting to be animated. Each is applied to `model` as soon as it is queued. */
const queue: { move: Move; done: () => void }[] = [];
let draining = false;

let solution: Move[] = [];
let solutionIndex = 0;
let playing = false;

const moveDuration = () => 660 - Number(ui.speed.value);

function enqueue(moves: Move[]): Promise<void> {
  if (moves.length === 0) return Promise.resolve();
  model.move(formatMoves(moves));
  renderState();
  const promises = moves.map((move) => new Promise<void>((done) => queue.push({ move, done })));
  void drain();
  return promises[promises.length - 1];
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const { move, done } = queue.shift()!;
    await view.turn(move, moveDuration());
    done();
  }
  draining = false;
  updateButtons();
}

/** Any move that isn't part of the current solution invalidates it. */
function manualMoves(moves: Move[]) {
  stopPlayback();
  clearSolution();
  if (solverReady) ui.status.textContent = 'Solver ready';
  return enqueue(moves);
}

function clearSolution(message = '') {
  solution = [];
  solutionIndex = 0;
  renderSolution(message);
}

function stopPlayback() {
  playing = false;
  updateButtons();
}

async function play() {
  if (playing) return stopPlayback();
  playing = true;
  updateButtons();
  while (playing && solutionIndex < solution.length) {
    const move = solution[solutionIndex++];
    renderSolution();
    await enqueue([move]);
  }
  playing = false;
  updateButtons();
}

function step(direction: 1 | -1) {
  if (playing || draining) return;
  if (direction === 1 && solutionIndex < solution.length) {
    void enqueue([solution[solutionIndex++]]);
  } else if (direction === -1 && solutionIndex > 0) {
    void enqueue(invertMoves([solution[--solutionIndex]]));
  }
  renderSolution();
  updateButtons();
}

async function solve() {
  if (!solverReady || solving) return;
  stopPlayback();
  clearSolution();
  if (model.isSolved()) {
    renderSolution('Already solved!');
    return;
  }
  solving = true;
  updateButtons();
  ui.status.textContent = 'Solving…';
  try {
    const { solution: text, ms } = await solver.solve(model.asString());
    solution = parseMoves(text);
    solutionIndex = 0;
    ui.status.textContent = `Found a ${solution.length}-move solution in ${ms.toFixed(0)} ms`;
    renderSolution();
  } catch (err) {
    ui.status.textContent = `Solver error: ${(err as Error).message}`;
  } finally {
    solving = false;
    updateButtons();
  }
}

function reset() {
  stopPlayback();
  for (const { done } of queue.splice(0)) done();
  view.reset();
  model.identity();
  clearSolution();
  renderState();
  ui.status.textContent = solverReady ? 'Solver ready' : ui.status.textContent;
}

// ---------- Rendering ----------

function renderSolution(message = '') {
  ui.solution.replaceChildren();
  ui.solution.classList.toggle('empty', solution.length === 0);
  if (solution.length === 0) {
    ui.solution.textContent = message || 'Scramble the cube, then press Solve.';
  }
  solution.forEach((move, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (i < solutionIndex ? ' done' : '') + (i === solutionIndex ? ' next' : '');
    chip.textContent = formatMove(move);
    ui.solution.appendChild(chip);
  });
  updateButtons();
}

/** Draws the facelet string as an unfolded cross:  U on top, L F R B across, D below. */
function renderState() {
  const facelets = model.asString();
  ui.facelets.textContent = facelets;
  const offsets: Record<Face, [number, number]> = { U: [0, 3], L: [3, 0], F: [3, 3], R: [3, 6], B: [3, 9], D: [6, 3] };
  const order: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  ui.net.replaceChildren();
  order.forEach((face, f) => {
    const [row, col] = offsets[face];
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'facelet';
      cell.style.gridRow = String(row + Math.floor(i / 3) + 1);
      cell.style.gridColumn = String(col + (i % 3) + 1);
      cell.style.background = FACE_COLORS[facelets[f * 9 + i] as Face];
      ui.net.appendChild(cell);
    }
  });
}

function updateButtons() {
  const busy = playing || solving;
  ui.solve.disabled = !solverReady || busy;
  ui.scramble.disabled = busy;
  ui.play.disabled = solution.length === 0 || (!playing && solutionIndex >= solution.length);
  ui.play.textContent = playing ? '⏸' : '▶';
  ui.stepBack.disabled = playing || draining || solutionIndex === 0;
  ui.stepForward.disabled = playing || draining || solutionIndex >= solution.length;
}

// ---------- Wiring ----------

for (const face of FACES) {
  for (const suffix of ['', "'", '2']) {
    const button = document.createElement('button');
    button.textContent = face + suffix;
    button.style.setProperty('--face', FACE_COLORS[face]);
    button.addEventListener('click', () => manualMoves(parseMoves(face + suffix)));
    ui.movePad.appendChild(button);
  }
}

ui.scramble.addEventListener('click', () => {
  const scramble = randomScramble();
  void manualMoves(scramble);
  ui.status.textContent = `Scramble: ${formatMoves(scramble)}`;
});
ui.solve.addEventListener('click', () => void solve());
ui.reset.addEventListener('click', reset);
ui.play.addEventListener('click', () => void play());
ui.stepForward.addEventListener('click', () => step(1));
ui.stepBack.addEventListener('click', () => step(-1));

ui.algForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const moves = parseMoves(ui.algInput.value);
    ui.algError.textContent = '';
    void manualMoves(moves);
  } catch (err) {
    ui.algError.textContent = (err as Error).message;
  }
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
  const face = event.key.toUpperCase();
  if ((FACES as readonly string[]).includes(face)) {
    void manualMoves([{ face: face as Face, turns: event.shiftKey ? -1 : 1 }]);
  } else if (event.key === ' ') {
    event.preventDefault();
    if (solution.length) void play();
  }
});

solver.ready.then((ms) => {
  solverReady = true;
  ui.status.textContent = `Solver ready (tables built in ${(ms / 1000).toFixed(1)} s)`;
  updateButtons();
});

renderState();
renderSolution();
