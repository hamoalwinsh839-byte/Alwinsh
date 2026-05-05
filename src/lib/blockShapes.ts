export type Cell = [number, number]; // [row, col]
export type Shape = { cells: Cell[]; color: number };

// Shapes defined by relative cell coords (0-indexed)
const SHAPES: Cell[][] = [
  // Singles & lines
  [[0,0]],
  [[0,0],[0,1]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[1,0]],
  [[0,0],[1,0],[2,0]],
  [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
  // Squares
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  // L shapes (4 rotations)
  [[0,0],[1,0],[1,1]],
  [[0,0],[0,1],[1,0]],
  [[0,0],[0,1],[1,1]],
  [[0,1],[1,0],[1,1]],
  // Larger L
  [[0,0],[1,0],[2,0],[2,1],[2,2]],
  [[0,0],[0,1],[0,2],[1,0],[2,0]],
  [[0,0],[0,1],[0,2],[1,2],[2,2]],
  [[0,2],[1,2],[2,0],[2,1],[2,2]],
  // T shape
  [[0,0],[0,1],[0,2],[1,1]],
  [[0,1],[1,0],[1,1],[2,1]],
  [[0,1],[1,0],[1,1],[1,2]],
  [[0,0],[1,0],[1,1],[2,0]],
  // S/Z
  [[0,1],[0,2],[1,0],[1,1]],
  [[0,0],[0,1],[1,1],[1,2]],
  // Diagonal 2
  [[0,0],[1,1]],
  [[0,1],[1,0]],
  // Diagonal 3
  [[0,0],[1,1],[2,2]],
  [[0,2],[1,1],[2,0]],
];

export function randomShape(): Shape {
  const cells = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const color = 1 + Math.floor(Math.random() * 7);
  return { cells: cells.map(([r, c]) => [r, c]), color };
}

export function shapeBounds(shape: Shape) {
  let maxR = 0, maxC = 0;
  for (const [r, c] of shape.cells) {
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  return { rows: maxR + 1, cols: maxC + 1 };
}
