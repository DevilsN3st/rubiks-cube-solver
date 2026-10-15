export const FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
export type Face = (typeof FACES)[number];

export interface Move {
  face: Face;
  /** Quarter turns clockwise (as seen looking at the face): 1, 2, or -1. */
  turns: 1 | 2 | -1;
}

const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };

export function parseMoves(text: string): Move[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.map((token) => {
    const match = /^([UDLRFB])(2|'|2')?$/.exec(token);
    if (!match) throw new Error(`Invalid move "${token}"`);
    const face = match[1] as Face;
    const suffix = match[2];
    const turns = suffix === "'" ? -1 : suffix ? 2 : 1;
    return { face, turns };
  });
}

export function formatMove({ face, turns }: Move): string {
  return face + (turns === -1 ? "'" : turns === 2 ? '2' : '');
}

export function formatMoves(moves: Move[]): string {
  return moves.map(formatMove).join(' ');
}

export function invertMoves(moves: Move[]): Move[] {
  return moves
    .slice()
    .reverse()
    .map(({ face, turns }) => ({ face, turns: turns === 2 ? 2 : turns === 1 ? -1 : 1 }));
}

/** Random-move scramble that never turns the same face (or axis pair redundantly) twice in a row. */
export function randomScramble(length = 25): Move[] {
  const moves: Move[] = [];
  const turnOptions: Move['turns'][] = [1, 2, -1];
  while (moves.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    const prev = moves[moves.length - 1];
    const prev2 = moves[moves.length - 2];
    if (prev && prev.face === face) continue;
    if (prev && prev2 && prev.face === OPPOSITE[face] && prev2.face === face) continue;
    moves.push({ face, turns: turnOptions[Math.floor(Math.random() * 3)] });
  }
  return moves;
}
