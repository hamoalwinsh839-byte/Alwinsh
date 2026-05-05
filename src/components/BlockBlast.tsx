import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { randomShape, shapeBounds, type Shape } from "@/lib/blockShapes";
import { sfx, isMuted, setMuted } from "@/lib/sfx";

const GRID = 8;
const BLOCK_COLORS = [
  "",
  "bg-block-1",
  "bg-block-2",
  "bg-block-3",
  "bg-block-4",
  "bg-block-5",
  "bg-block-6",
  "bg-block-7",
];

type Board = number[][];

const emptyBoard = (): Board =>
  Array.from({ length: GRID }, () => Array(GRID).fill(0));

function canPlace(board: Board, shape: Shape, row: number, col: number) {
  for (const [r, c] of shape.cells) {
    const rr = row + r;
    const cc = col + c;
    if (rr < 0 || rr >= GRID || cc < 0 || cc >= GRID) return false;
    if (board[rr][cc] !== 0) return false;
  }
  return true;
}

function placeShape(board: Board, shape: Shape, row: number, col: number): Board {
  const b = board.map((r) => r.slice());
  for (const [r, c] of shape.cells) b[row + r][col + c] = shape.color;
  return b;
}

function findClears(board: Board) {
  const rowsToClear = new Set<number>();
  const colsToClear = new Set<number>();
  for (let r = 0; r < GRID; r++) if (board[r].every((v) => v !== 0)) rowsToClear.add(r);
  for (let c = 0; c < GRID; c++) {
    let full = true;
    for (let r = 0; r < GRID; r++) if (board[r][c] === 0) { full = false; break; }
    if (full) colsToClear.add(c);
  }
  return { rowsToClear, colsToClear };
}

function applyClears(board: Board, rowsToClear: Set<number>, colsToClear: Set<number>) {
  const cellsCleared: [number, number][] = [];
  const b = board.map((row, r) =>
    row.map((v, c) => {
      if (rowsToClear.has(r) || colsToClear.has(c)) {
        if (v !== 0) cellsCleared.push([r, c]);
        return 0;
      }
      return v;
    })
  );
  return { board: b, cellsCleared };
}

function anyShapeFits(board: Board, shapes: (Shape | null)[]) {
  for (const s of shapes) {
    if (!s) continue;
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++)
        if (canPlace(board, s, r, c)) return true;
  }
  return false;
}

export default function BlockBlast() {
  // Start with empty tray to avoid SSR hydration mismatch (Math.random differs).
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [tray, setTray] = useState<(Shape | null)[]>([null, null, null]);
  const [hydrated, setHydrated] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const [floaters, setFloaters] = useState<{ id: number; r: number; c: number; text: string }[]>([]);
  const [hover, setHover] = useState<{ shape: Shape; row: number; col: number; valid: boolean } | null>(null);
  const [shake, setShake] = useState(false);
  const [muted, setMutedState] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ shapeIdx: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragShapeIdx, setDragShapeIdx] = useState<number | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const floaterId = useRef(0);
  const cellSizeRef = useRef(40);

  // Initialize random state on client only
  useEffect(() => {
    setTray([randomShape(), randomShape(), randomShape()]);
    setBest(Number(localStorage.getItem("bb_best") || 0));
    setMutedState(isMuted());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (score > best) {
      setBest(score);
      localStorage.setItem("bb_best", String(score));
    }
  }, [score, best]);

  const refillTrayIfEmpty = useCallback((next: (Shape | null)[]) => {
    if (next.every((s) => s === null)) {
      return [randomShape(), randomShape(), randomShape()];
    }
    return next;
  }, []);

  const checkGameOver = useCallback((b: Board, t: (Shape | null)[]) => {
    if (!anyShapeFits(b, t)) {
      setTimeout(() => {
        setGameOver(true);
        sfx.gameOver();
      }, 400);
    }
  }, []);

  const triggerFloater = (r: number, c: number, text: string) => {
    const id = ++floaterId.current;
    setFloaters((f) => [...f, { id, r, c, text }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
  };

  const commitPlacement = (shapeIdx: number, row: number, col: number) => {
    const shape = tray[shapeIdx];
    if (!shape) return;
    if (!canPlace(board, shape, row, col)) {
      setShake(true);
      sfx.invalid();
      setTimeout(() => setShake(false), 300);
      return;
    }
    const placed = placeShape(board, shape, row, col);
    const placeScore = shape.cells.length;

    const { rowsToClear, colsToClear } = findClears(placed);
    const linesCleared = rowsToClear.size + colsToClear.size;

    if (linesCleared > 0) {
      const { board: cleared, cellsCleared } = applyClears(placed, rowsToClear, colsToClear);
      const keys = new Set(cellsCleared.map(([r, c]) => `${r}-${c}`));
      setBoard(placed);
      setPopping(keys);
      const newCombo = combo + 1;
      setCombo(newCombo);
      setComboFlash(newCombo);
      sfx.clear(newCombo);
      if (newCombo > 1) setTimeout(() => sfx.combo(newCombo), 100);
      setTimeout(() => setComboFlash(0), 800);
      const lineBonus = linesCleared * 10 * GRID;
      const multiBonus = linesCleared > 1 ? linesCleared * 25 : 0;
      const comboBonus = newCombo > 1 ? newCombo * 20 : 0;
      const total = placeScore + lineBonus + multiBonus + comboBonus;
      setScore((s) => s + total);
      const avgR = Math.round(cellsCleared.reduce((a, [r]) => a + r, 0) / cellsCleared.length);
      const avgC = Math.round(cellsCleared.reduce((a, [, c]) => a + c, 0) / cellsCleared.length);
      triggerFloater(avgR, avgC, `+${total}`);

      setTimeout(() => {
        setPopping(new Set());
        setBoard(cleared);
        const nextTray = refillTrayIfEmpty(tray.map((s, i) => (i === shapeIdx ? null : s)));
        setTray(nextTray);
        checkGameOver(cleared, nextTray);
      }, 380);
    } else {
      setCombo(0);
      setBoard(placed);
      sfx.place();
      setScore((s) => s + placeScore);
      const nextTray = refillTrayIfEmpty(tray.map((s, i) => (i === shapeIdx ? null : s)));
      setTray(nextTray);
      checkGameOver(placed, nextTray);
    }
  };

  const computeHover = (clientX: number, clientY: number, shape: Shape) => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const cellSize = (rect.width - 16) / GRID;
    cellSizeRef.current = cellSize;
    const { rows, cols } = shapeBounds(shape);
    const liftY = isTouch ? -cellSize * 2.2 : 0;
    const localX = clientX - rect.left - 8 - (cellSize * cols) / 2 + cellSize / 2;
    const localY = clientY - rect.top - 8 + liftY - (cellSize * rows) / 2 + cellSize / 2;
    const col = Math.round(localX / cellSize);
    const row = Math.round(localY / cellSize);
    if (row >= 0 && row + rows <= GRID && col >= 0 && col + cols <= GRID) {
      return { shape, row, col, valid: canPlace(board, shape, row, col) };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent, shapeIdx: number) => {
    if (gameOver) return;
    const shape = tray[shapeIdx];
    if (!shape) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsTouch(e.pointerType !== "mouse");
    dragInfo.current = { shapeIdx };
    setDragShapeIdx(shapeIdx);
    setDragPos({ x: e.clientX, y: e.clientY });
    sfx.pick();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragInfo.current === null) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    const shape = tray[dragInfo.current.shapeIdx];
    if (!shape) return;
    const h = computeHover(e.clientX, e.clientY, shape);
    setHover(h);
  };

  const onPointerUp = () => {
    if (dragInfo.current && hover && hover.valid) {
      commitPlacement(dragInfo.current.shapeIdx, hover.row, hover.col);
    } else if (dragInfo.current && hover && !hover.valid) {
      setShake(true);
      sfx.invalid();
      setTimeout(() => setShake(false), 300);
    }
    dragInfo.current = null;
    setDragShapeIdx(null);
    setDragPos(null);
    setHover(null);
  };

  const reset = () => {
    setBoard(emptyBoard());
    setTray([randomShape(), randomShape(), randomShape()]);
    setScore(0);
    setCombo(0);
    setGameOver(false);
    setPopping(new Set());
  };

  const toggleMute = () => {
    const v = !muted;
    setMuted(v);
    setMutedState(v);
  };

  const previewCells = useMemo(() => {
    const map = new Map<string, { color: number; valid: boolean }>();
    if (!hover) return map;
    for (const [r, c] of hover.shape.cells) {
      map.set(`${hover.row + r}-${hover.col + c}`, { color: hover.shape.color, valid: hover.valid });
    }
    return map;
  }, [hover]);

  const highlightLines = useMemo(() => {
    const rows = new Set<number>();
    const cols = new Set<number>();
    if (!hover || !hover.valid) return { rows, cols };
    const placed = placeShape(board, hover.shape, hover.row, hover.col);
    const c = findClears(placed);
    return { rows: c.rowsToClear, cols: c.colsToClear };
  }, [hover, board]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 py-5 select-none relative overflow-hidden"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: "none" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-30 bg-block-6" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-25 bg-block-5" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full blur-3xl opacity-20 bg-accent" />
      </div>

      {/* Brand bar */}
      <div className="w-full max-w-[460px] flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-accent to-block-5 shadow-[0_0_20px_var(--primary)] flex items-center justify-center font-black text-primary-foreground text-sm">
            A
          </div>
          <div className="leading-none">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">Alwinsh</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Studio</div>
          </div>
        </div>
        <button
          onClick={toggleMute}
          className="w-9 h-9 rounded-lg bg-card/60 ring-1 ring-border flex items-center justify-center text-foreground hover:bg-card transition"
          aria-label="Toggle sound"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-br from-primary via-accent to-block-5 bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(255,200,100,0.3)] mb-1">
        BLOCK BLAST
      </h1>
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4">by Alwinsh</div>

      {/* Score row */}
      <div className="w-full max-w-[460px] grid grid-cols-3 gap-2 mb-3">
        <ScorePanel label="Score" value={score} accent />
        <ScorePanel label="Combo" value={combo} icon="🔥" />
        <ScorePanel label="Best" value={best} icon="⭐" />
      </div>

      {/* Combo flash */}
      <div className="h-7 mb-1 flex items-center justify-center">
        {comboFlash > 1 && (
          <div key={comboFlash} className="text-accent font-black text-lg animate-pop drop-shadow-[0_0_12px_var(--accent)]">
            ✨ COMBO x{comboFlash}!
          </div>
        )}
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className={`relative w-full max-w-[460px] aspect-square p-2 rounded-3xl bg-[var(--grid-bg)] ring-1 ring-border ${shake ? "animate-shake" : ""}`}
        style={{ boxShadow: "var(--shadow-glow), inset 0 0 40px rgba(0,0,0,0.5)" }}
      >
        <div className="grid grid-cols-8 gap-1 w-full h-full">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r}-${c}`;
              const preview = previewCells.get(key);
              const isPop = popping.has(key);
              const onClearLine = highlightLines.rows.has(r) || highlightLines.cols.has(c);
              const showPreview = preview && cell === 0;

              const colorClass = cell
                ? BLOCK_COLORS[cell]
                : showPreview
                ? preview!.valid
                  ? BLOCK_COLORS[preview!.color]
                  : "bg-destructive/40"
                : "bg-grid-cell";

              return (
                <div
                  key={key}
                  className={[
                    "rounded-md transition-all duration-100",
                    colorClass,
                    showPreview && preview!.valid ? "opacity-70 ring-2 ring-white/60" : "",
                    cell || (showPreview && preview!.valid)
                      ? "shadow-[inset_0_2px_0_rgba(255,255,255,0.3),0_2px_0_rgba(0,0,0,0.25)]"
                      : "",
                    onClearLine && !cell && !showPreview ? "bg-grid-cell ring-1 ring-accent/60" : "",
                    onClearLine ? "brightness-125" : "",
                    isPop ? "animate-pop" : "",
                  ].join(" ")}
                />
              );
            })
          )}
        </div>

        {floaters.map((f) => {
          const cellPct = 100 / GRID;
          return (
            <div
              key={f.id}
              className="absolute pointer-events-none font-black text-3xl bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent animate-float-up drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              style={{
                left: `${(f.c + 0.5) * cellPct}%`,
                top: `${(f.r + 0.5) * cellPct}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {f.text}
            </div>
          );
        })}

        {gameOver && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center gap-3 z-20 animate-pop">
            <div className="text-6xl mb-2">💥</div>
            <h2 className="text-4xl font-black bg-gradient-to-br from-destructive to-accent bg-clip-text text-transparent">
              Game Over
            </h2>
            <p className="text-foreground text-lg">Score: <span className="font-black text-primary text-2xl">{score}</span></p>
            <p className="text-muted-foreground text-sm">⭐ Best: {best}</p>
            <button
              onClick={reset}
              className="mt-2 px-8 py-3 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-black shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              Play Again
            </button>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-2">
              © Alwinsh
            </div>
          </div>
        )}
      </div>

      {/* Tray */}
      <div className="w-full max-w-[460px] mt-5 grid grid-cols-3 gap-2 p-3 rounded-2xl bg-card/50 ring-1 ring-border backdrop-blur-sm">
        {tray.map((shape, i) => (
          <TraySlot
            key={i}
            shape={shape}
            isDragging={dragShapeIdx === i}
            onPointerDown={(e) => onPointerDown(e, i)}
          />
        ))}
      </div>

      <button
        onClick={reset}
        className="mt-5 px-5 py-2 rounded-xl bg-secondary/70 text-secondary-foreground font-semibold text-sm hover:bg-secondary transition ring-1 ring-border"
      >
        ↻ New Game
      </button>

      {/* Footer credit */}
      <div className="mt-6 mb-2 text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Designed & Developed by
        </div>
        <div className="text-sm font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-[0.3em] mt-1">
          ALWINSH
        </div>
        <div className="text-[9px] text-muted-foreground/60 mt-1">© {new Date().getFullYear()} Alwinsh — All rights reserved</div>
      </div>

      {hydrated && dragShapeIdx !== null && tray[dragShapeIdx] && dragPos && (
        <DragGhost
          shape={tray[dragShapeIdx]!}
          x={dragPos.x}
          y={dragPos.y}
          cellSize={cellSizeRef.current}
          lift={isTouch ? cellSizeRef.current * 2.2 : 0}
        />
      )}
    </div>
  );
}

function ScorePanel({ label, value, accent, icon }: { label: string; value: number; accent?: boolean; icon?: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 ring-1 ring-border bg-card/60 backdrop-blur-sm flex flex-col items-center ${accent ? "shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_30%,transparent)]" : ""}`}>
      <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
        {icon} {label}
      </span>
      <span className={`text-2xl font-black tabular-nums leading-none mt-1 ${accent ? "bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function TraySlot({
  shape,
  isDragging,
  onPointerDown,
}: {
  shape: Shape | null;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  if (!shape)
    return <div className="aspect-square rounded-xl bg-background/30 ring-1 ring-border/40" />;
  const { rows, cols } = shapeBounds(shape);
  const set = new Set(shape.cells.map(([r, c]) => `${r}-${c}`));
  const maxDim = Math.max(rows, cols);
  const cellPct = Math.min(80 / maxDim, 18);
  return (
    <div
      onPointerDown={onPointerDown}
      className={`relative aspect-square rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-25 scale-90" : "hover:scale-105"
      }`}
      style={{ touchAction: "none" }}
    >
      <div
        className="grid gap-[2px]"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          width: `${cellPct * cols}%`,
          height: `${cellPct * rows}%`,
        }}
      >
        {Array.from({ length: rows * cols }).map((_, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          const filled = set.has(`${r}-${c}`);
          return (
            <div
              key={idx}
              className={
                filled
                  ? `${BLOCK_COLORS[shape.color]} rounded-[4px] shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_2px_0_rgba(0,0,0,0.25)]`
                  : ""
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function DragGhost({
  shape,
  x,
  y,
  cellSize,
  lift,
}: {
  shape: Shape;
  x: number;
  y: number;
  cellSize: number;
  lift: number;
}) {
  const { rows, cols } = shapeBounds(shape);
  const set = new Set(shape.cells.map(([r, c]) => `${r}-${c}`));
  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: x - (cellSize * cols) / 2,
        top: y - lift - (cellSize * rows) / 2,
        width: cellSize * cols,
        height: cellSize * rows,
      }}
    >
      <div
        className="grid gap-1 w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {Array.from({ length: rows * cols }).map((_, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          const filled = set.has(`${r}-${c}`);
          return (
            <div
              key={idx}
              className={
                filled
                  ? `${BLOCK_COLORS[shape.color]} rounded-md shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_3px_0_rgba(0,0,0,0.35)] scale-110`
                  : ""
              }
            />
          );
        })}
      </div>
    </div>
  );
}
