declare module 'cubejs' {
  export default class Cube {
    constructor(state?: Cube);
    static fromString(facelets: string): Cube;
    static random(): Cube;
    static initSolver(): void;
    static scramble(): string;
    asString(): string;
    isSolved(): boolean;
    move(moves: string): this;
    solve(maxDepth?: number): string;
    clone(): Cube;
    identity(): this;
  }
}
