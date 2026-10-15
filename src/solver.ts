import type { SolverRequest, SolverResponse } from './solver.worker';

/** Runs Kociemba's two-phase solver in a Web Worker so table generation and search never block the UI. */
export class Solver {
  private worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  private nextId = 0;
  private pending = new Map<number, { resolve: (s: { solution: string; ms: number }) => void; reject: (e: Error) => void }>();

  readonly ready: Promise<number>;

  constructor() {
    let markReady!: (ms: number) => void;
    this.ready = new Promise((resolve) => (markReady = resolve));

    this.worker.onmessage = (event: MessageEvent<SolverResponse>) => {
      const msg = event.data;
      if (msg.type === 'ready') {
        markReady(msg.ms);
        return;
      }
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.type === 'solution') entry.resolve({ solution: msg.solution, ms: msg.ms });
      else entry.reject(new Error(msg.message));
    };
  }

  async solve(facelets: string): Promise<{ solution: string; ms: number }> {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, facelets } satisfies SolverRequest);
    });
  }
}
