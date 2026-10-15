import Cube from 'cubejs';

export type SolverRequest = { id: number; facelets: string };
export type SolverResponse =
  | { type: 'ready'; ms: number }
  | { type: 'solution'; id: number; solution: string; ms: number }
  | { type: 'error'; id: number; message: string };

const post = (msg: SolverResponse) => self.postMessage(msg);

const initStart = performance.now();
Cube.initSolver();
post({ type: 'ready', ms: performance.now() - initStart });

self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const { id, facelets } = event.data;
  try {
    const start = performance.now();
    const solution = Cube.fromString(facelets).solve();
    post({ type: 'solution', id, solution, ms: performance.now() - start });
  } catch (err) {
    post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};
