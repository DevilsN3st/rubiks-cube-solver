# Rubik's Cube Solver

An interactive 3D Rubik's cube in the browser. Scramble it, turn faces yourself, and let it find and animate a solution using Kociemba's two-phase algorithm (typically 22 moves or fewer, found in milliseconds).

## Run

```bash
npm install
npm run dev
```

## Features

- 3D cube (Three.js) with drag-to-orbit camera and animated face turns
- Scramble, Solve, and Reset
- Solution playback: play/pause, step forward/back, adjustable speed
- Move pad, keyboard controls (`U D L R F B`, Shift for prime, Space to play), and an algorithm input (`R U R' U'`)
- Unfolded 2D net and facelet string of the current state

## How it works

- `src/cubeView.ts` renders 27 cubies and animates turns by rotating a layer around a pivot, then snapping positions/orientations back to the grid.
- `src/main.ts` keeps the logical cube state (via [`cubejs`](https://github.com/ldez/cubejs)) in sync with the animation queue.
- `src/solver.worker.ts` builds the solver's pruning tables and runs searches in a Web Worker so the UI never blocks.
