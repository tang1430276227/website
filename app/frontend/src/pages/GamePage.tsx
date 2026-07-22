import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Gamepad2, Keyboard, Pause, Play, RotateCcw } from 'lucide-react';

// ---------- Types ----------

interface GameItem {
  id: string;
  name: string;
  nameEn: string;
  cover: string;
  gradient: string;
  controls: string;
}

// ---------- Game Data ----------

const GAMES: GameItem[] = [
  {
    id: 'tetris',
    name: '俄罗斯方块',
    nameEn: 'Tetris',
    cover: '🧱',
    gradient: 'from-sky-500 to-blue-600',
    controls: '← → 移动，↑ 旋转，↓ 加速，Space 直落',
  },
  {
    id: 'snake',
    name: '贪吃蛇',
    nameEn: 'Snake',
    cover: '🐍',
    gradient: 'from-green-500 to-emerald-600',
    controls: '方向键控制移动方向',
  },
  {
    id: 'breakout',
    name: '打砖块',
    nameEn: 'Breakout',
    cover: '🧱',
    gradient: 'from-orange-500 to-red-500',
    controls: '← → 移动挡板，Space 发球',
  },
  {
    id: 'invaders',
    name: '太空侵略者',
    nameEn: 'Space Invaders',
    cover: '👾',
    gradient: 'from-purple-600 to-pink-500',
    controls: '← → 移动，Space 射击',
  },
  {
    id: 'pacman',
    name: '吃豆人',
    nameEn: 'Pac-Man',
    cover: '🟡',
    gradient: 'from-yellow-400 to-orange-400',
    controls: '方向键控制移动方向',
  },
];

// ---------- Game Card ----------

function GameCard({ game, onClick, index }: { game: GameItem; onClick: () => void; index: number }) {
  return (
    <div className="animate-slide-in" style={{ animationDelay: `${index * 80}ms` }}>
      <button
        onClick={onClick}
        className="w-full group relative overflow-hidden rounded-xl border border-border bg-card hover:border-blue-500/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/10"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
        <div className="relative p-6 flex flex-col items-center gap-3">
          <div className="text-5xl">{game.cover}</div>
          <div className="text-center">
            <h3 className="font-bold text-foreground">{game.name}</h3>
            <p className="text-xs text-muted-foreground">{game.nameEn}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Keyboard className="w-3 h-3" />
            <span>键盘操控</span>
          </div>
        </div>
      </button>
    </div>
  );
}

// ========== TETRIS GAME ==========

function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    board: number[][];
    piece: { shape: number[][]; x: number; y: number; color: number };
    score: number;
    gameOver: boolean;
    paused: boolean;
    interval: number;
  } | null>(null);
  const animRef = useRef<number>(0);
  const lastDropRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 24;
  const COLORS = ['#000', '#00f0f0', '#0000f0', '#f0a000', '#f0f000', '#00f000', '#a000f0', '#f00000'];

  const PIECES = [
    [[1,1,1,1]],
    [[1,0,0],[1,1,1]],
    [[0,0,1],[1,1,1]],
    [[1,1],[1,1]],
    [[0,1,1],[1,1,0]],
    [[0,1,0],[1,1,1]],
    [[1,1,0],[0,1,1]],
  ];

  const createBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  const randomPiece = () => {
    const idx = Math.floor(Math.random() * PIECES.length);
    return { shape: PIECES[idx].map(r => [...r]), x: 3, y: 0, color: idx + 1 };
  };

  const collides = (board: number[][], piece: { shape: number[][]; x: number; y: number; color: number }) => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const nx = piece.x + c, ny = piece.y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  };

  const merge = (board: number[][], piece: { shape: number[][]; x: number; y: number; color: number }) => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const ny = piece.y + r;
        if (ny >= 0) board[ny][piece.x + c] = piece.color;
      }
    }
  };

  const clearLines = (board: number[][]) => {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(c => c !== 0)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    return cleared * cleared * 100;
  };

  const rotate = (shape: number[][]) => {
    const rows = shape.length, cols = shape[0].length;
    const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        rotated[c][rows - 1 - r] = shape[r][c];
    return rotated;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (game.board[r][c]) {
          ctx.fillStyle = COLORS[game.board[r][c]];
          ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK - 1, BLOCK - 1);
        } else {
          ctx.strokeStyle = '#2a2a4a';
          ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
        }
      }
    }

    // Draw piece
    const { piece } = game;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          ctx.fillStyle = COLORS[piece.color];
          ctx.fillRect((piece.x + c) * BLOCK, (piece.y + r) * BLOCK, BLOCK - 1, BLOCK - 1);
        }
      }
    }

    // Grid border
    ctx.strokeStyle = '#3a3a5a';
    ctx.strokeRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
  }, []);

  const gameLoop = useCallback((time: number) => {
    const game = gameRef.current;
    if (!game || game.gameOver || game.paused) {
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (time - lastDropRef.current > game.interval) {
      lastDropRef.current = time;
      const moved = { ...game.piece, y: game.piece.y + 1 };
      if (!collides(game.board, moved)) {
        game.piece = moved;
      } else {
        merge(game.board, game.piece);
        const pts = clearLines(game.board);
        game.score += pts;
        setScore(game.score);
        game.piece = randomPiece();
        if (collides(game.board, game.piece)) {
          game.gameOver = true;
          setGameOver(true);
        }
      }
    }

    draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  const initGame = useCallback(() => {
    gameRef.current = {
      board: createBoard(),
      piece: randomPiece(),
      score: 0,
      gameOver: false,
      paused: false,
      interval: 500,
    };
    setScore(0);
    setGameOver(false);
    setPaused(false);
    lastDropRef.current = 0;
  }, []);

  useEffect(() => {
    initGame();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [initGame, gameLoop]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (!game || game.gameOver) return;
      if (e.code === 'KeyP') {
        game.paused = !game.paused;
        setPaused(game.paused);
        return;
      }
      if (game.paused) return;

      const tryMove = (dx: number, dy: number) => {
        const moved = { ...game.piece, x: game.piece.x + dx, y: game.piece.y + dy };
        if (!collides(game.board, moved)) game.piece = moved;
      };

      switch (e.code) {
        case 'ArrowLeft': tryMove(-1, 0); break;
        case 'ArrowRight': tryMove(1, 0); break;
        case 'ArrowDown': tryMove(0, 1); break;
        case 'ArrowUp': {
          const rotated = { ...game.piece, shape: rotate(game.piece.shape) };
          if (!collides(game.board, rotated)) game.piece = rotated;
          break;
        }
        case 'Space': {
          while (!collides(game.board, { ...game.piece, y: game.piece.y + 1 })) {
            game.piece.y++;
          }
          break;
        }
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold">分数: {score}</span>
        <Button size="sm" variant="outline" onClick={() => { const g = gameRef.current; if (g) { g.paused = !g.paused; setPaused(g.paused); } }}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={initGame}><RotateCcw className="w-4 h-4" /></Button>
      </div>
      {gameOver && <div className="text-red-400 font-bold text-xl">游戏结束！</div>}
      <canvas ref={canvasRef} width={COLS * BLOCK} height={ROWS * BLOCK} className="border border-gray-600 rounded" />
    </div>
  );
}

// ========== SNAKE GAME ==========

function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    snake: { x: number; y: number }[];
    food: { x: number; y: number };
    dir: { x: number; y: number };
    score: number;
    gameOver: boolean;
    paused: boolean;
  } | null>(null);
  const animRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const GRID = 20;
  const CELL = 20;
  const SIZE = GRID * CELL;

  const randomFood = (snake: { x: number; y: number }[]) => {
    let food: { x: number; y: number };
    do {
      food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
    return food;
  };

  const initGame = useCallback(() => {
    const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    gameRef.current = {
      snake,
      food: randomFood(snake),
      dir: { x: 1, y: 0 },
      score: 0,
      gameOver: false,
      paused: false,
    };
    setScore(0);
    setGameOver(false);
    setPaused(false);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Grid
    ctx.strokeStyle = '#2a2a4a';
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
    }

    // Snake
    game.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e';
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });

    // Food
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(game.food.x * CELL + CELL / 2, game.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const gameLoop = useCallback((time: number) => {
    const game = gameRef.current;
    if (!game || game.gameOver || game.paused) {
      draw();
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (time - lastMoveRef.current > 120) {
      lastMoveRef.current = time;
      const head = { x: game.snake[0].x + game.dir.x, y: game.snake[0].y + game.dir.y };

      // Wall collision
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        game.gameOver = true;
        setGameOver(true);
      }
      // Self collision
      else if (game.snake.some(s => s.x === head.x && s.y === head.y)) {
        game.gameOver = true;
        setGameOver(true);
      } else {
        game.snake.unshift(head);
        if (head.x === game.food.x && head.y === game.food.y) {
          game.score += 10;
          setScore(game.score);
          game.food = randomFood(game.snake);
        } else {
          game.snake.pop();
        }
      }
    }

    draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  useEffect(() => {
    initGame();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [initGame, gameLoop]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (!game || game.gameOver) return;
      if (e.code === 'KeyP') { game.paused = !game.paused; setPaused(game.paused); return; }
      if (game.paused) return;

      const dirMap: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      };
      const newDir = dirMap[e.code];
      if (newDir && (newDir.x + game.dir.x !== 0 || newDir.y + game.dir.y !== 0)) {
        game.dir = newDir;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold">分数: {score}</span>
        <Button size="sm" variant="outline" onClick={() => { const g = gameRef.current; if (g) { g.paused = !g.paused; setPaused(g.paused); } }}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={initGame}><RotateCcw className="w-4 h-4" /></Button>
      </div>
      {gameOver && <div className="text-red-400 font-bold text-xl">游戏结束！分数: {score}</div>}
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="border border-gray-600 rounded" />
    </div>
  );
}

// ========== BREAKOUT GAME ==========

function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    paddle: { x: number; w: number };
    ball: { x: number; y: number; dx: number; dy: number; r: number };
    bricks: { x: number; y: number; w: number; h: number; alive: boolean; color: string }[];
    score: number;
    gameOver: boolean;
    won: boolean;
    paused: boolean;
    started: boolean;
  } | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const W = 400, H = 500;
  const BRICK_ROWS = 5, BRICK_COLS = 8;
  const BRICK_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

  const initGame = useCallback(() => {
    const bricks: { x: number; y: number; w: number; h: number; alive: boolean; color: string }[] = [];
    const bw = (W - 20) / BRICK_COLS, bh = 20;
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({ x: 10 + c * bw, y: 40 + r * (bh + 4), w: bw - 4, h: bh, alive: true, color: BRICK_COLORS[r] });
      }
    }
    gameRef.current = {
      paddle: { x: W / 2 - 40, w: 80 },
      ball: { x: W / 2, y: H - 50, dx: 3, dy: -3, r: 6 },
      bricks,
      score: 0,
      gameOver: false,
      won: false,
      paused: false,
      started: false,
    };
    setScore(0);
    setGameOver(false);
    setPaused(false);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Bricks
    game.bricks.forEach(b => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    // Paddle
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(game.paddle.x, H - 20, game.paddle.w, 12);

    // Ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, game.ball.r, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const gameLoop = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.gameOver || game.paused) {
      draw();
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Paddle movement
    if (keysRef.current.has('ArrowLeft')) game.paddle.x = Math.max(0, game.paddle.x - 6);
    if (keysRef.current.has('ArrowRight')) game.paddle.x = Math.min(W - game.paddle.w, game.paddle.x + 6);

    if (!game.started) { draw(); animRef.current = requestAnimationFrame(gameLoop); return; }

    // Ball movement
    const ball = game.ball;
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall bounce
    if (ball.x - ball.r <= 0 || ball.x + ball.r >= W) ball.dx = -ball.dx;
    if (ball.y - ball.r <= 0) ball.dy = -ball.dy;

    // Paddle bounce
    if (ball.y + ball.r >= H - 20 && ball.x >= game.paddle.x && ball.x <= game.paddle.x + game.paddle.w) {
      ball.dy = -Math.abs(ball.dy);
      const hitPos = (ball.x - game.paddle.x) / game.paddle.w;
      ball.dx = 6 * (hitPos - 0.5);
    }

    // Bottom
    if (ball.y + ball.r >= H) {
      game.gameOver = true;
      setGameOver(true);
    }

    // Brick collision
    game.bricks.forEach(b => {
      if (!b.alive) return;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        ball.dy = -ball.dy;
        game.score += 10;
        setScore(game.score);
      }
    });

    // Win check
    if (game.bricks.every(b => !b.alive)) {
      game.won = true;
      game.gameOver = true;
      setGameOver(true);
    }

    draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  useEffect(() => {
    initGame();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [initGame, gameLoop]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      const game = gameRef.current;
      if (!game) return;
      if (e.code === 'Space' && !game.started) game.started = true;
      if (e.code === 'KeyP') { game.paused = !game.paused; setPaused(game.paused); }
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.code); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold">分数: {score}</span>
        <Button size="sm" variant="outline" onClick={() => { const g = gameRef.current; if (g) { g.paused = !g.paused; setPaused(g.paused); } }}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={initGame}><RotateCcw className="w-4 h-4" /></Button>
      </div>
      {!gameRef.current?.started && !gameOver && <div className="text-blue-400 text-sm">按 Space 发球</div>}
      {gameOver && <div className="text-red-400 font-bold text-xl">{gameRef.current?.won ? '🎉 恭喜通关！' : '游戏结束！'}</div>}
      <canvas ref={canvasRef} width={W} height={H} className="border border-gray-600 rounded" />
    </div>
  );
}

// ========== SPACE INVADERS GAME ==========

function InvadersGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    player: { x: number };
    bullets: { x: number; y: number }[];
    enemies: { x: number; y: number; alive: boolean }[];
    enemyBullets: { x: number; y: number }[];
    enemyDir: number;
    score: number;
    gameOver: boolean;
    won: boolean;
    paused: boolean;
    lastEnemyShot: number;
  } | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const W = 400, H = 500;

  const initGame = useCallback(() => {
    const enemies: { x: number; y: number; alive: boolean }[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        enemies.push({ x: 40 + c * 40, y: 40 + r * 36, alive: true });
      }
    }
    gameRef.current = {
      player: { x: W / 2 - 15 },
      bullets: [],
      enemies,
      enemyBullets: [],
      enemyDir: 1,
      score: 0,
      gameOver: false,
      won: false,
      paused: false,
      lastEnemyShot: 0,
    };
    setScore(0);
    setGameOver(false);
    setPaused(false);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Player
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(game.player.x, H - 40, 30, 20);
    ctx.fillRect(game.player.x + 12, H - 48, 6, 8);

    // Bullets
    ctx.fillStyle = '#fbbf24';
    game.bullets.forEach(b => ctx.fillRect(b.x, b.y, 3, 10));

    // Enemy bullets
    ctx.fillStyle = '#ef4444';
    game.enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, 3, 10));

    // Enemies
    game.enemies.forEach(e => {
      if (!e.alive) return;
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(e.x, e.y, 28, 20);
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x + 6, e.y + 6, 4, 4);
      ctx.fillRect(e.x + 18, e.y + 6, 4, 4);
    });
  }, []);

  const gameLoop = useCallback((time: number) => {
    const game = gameRef.current;
    if (!game || game.gameOver || game.paused) {
      draw();
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Player movement
    if (keysRef.current.has('ArrowLeft')) game.player.x = Math.max(0, game.player.x - 4);
    if (keysRef.current.has('ArrowRight')) game.player.x = Math.min(W - 30, game.player.x + 4);

    // Bullets
    game.bullets = game.bullets.filter(b => { b.y -= 6; return b.y > 0; });
    game.enemyBullets = game.enemyBullets.filter(b => { b.y += 4; return b.y < H; });

    // Enemy movement
    let shouldDrop = false;
    const aliveEnemies = game.enemies.filter(e => e.alive);
    aliveEnemies.forEach(e => { e.x += game.enemyDir * 0.5; });
    if (aliveEnemies.some(e => e.x + 28 >= W || e.x <= 0)) {
      game.enemyDir = -game.enemyDir;
      shouldDrop = true;
    }
    if (shouldDrop) aliveEnemies.forEach(e => { e.y += 12; });

    // Enemy shooting
    if (time - game.lastEnemyShot > 1200 && aliveEnemies.length > 0) {
      game.lastEnemyShot = time;
      const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      game.enemyBullets.push({ x: shooter.x + 13, y: shooter.y + 20 });
    }

    // Bullet-enemy collision
    game.bullets.forEach(b => {
      game.enemies.forEach(e => {
        if (!e.alive) return;
        if (b.x >= e.x && b.x <= e.x + 28 && b.y >= e.y && b.y <= e.y + 20) {
          e.alive = false;
          b.y = -100;
          game.score += 20;
          setScore(game.score);
        }
      });
    });

    // Enemy bullet-player collision
    game.enemyBullets.forEach(b => {
      if (b.x >= game.player.x && b.x <= game.player.x + 30 && b.y >= H - 48 && b.y <= H - 20) {
        game.gameOver = true;
        setGameOver(true);
      }
    });

    // Enemy reaches bottom
    if (aliveEnemies.some(e => e.y + 20 >= H - 50)) {
      game.gameOver = true;
      setGameOver(true);
    }

    // Win
    if (aliveEnemies.length === 0) {
      game.won = true;
      game.gameOver = true;
      setGameOver(true);
    }

    draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  useEffect(() => {
    initGame();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [initGame, gameLoop]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      const game = gameRef.current;
      if (!game || game.gameOver) return;
      if (e.code === 'Space' && game.bullets.length < 3) {
        game.bullets.push({ x: game.player.x + 14, y: H - 50 });
      }
      if (e.code === 'KeyP') { game.paused = !game.paused; setPaused(game.paused); }
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.code); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold">分数: {score}</span>
        <Button size="sm" variant="outline" onClick={() => { const g = gameRef.current; if (g) { g.paused = !g.paused; setPaused(g.paused); } }}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={initGame}><RotateCcw className="w-4 h-4" /></Button>
      </div>
      {gameOver && <div className="font-bold text-xl">{gameRef.current?.won ? <span className="text-green-400">🎉 胜利！</span> : <span className="text-red-400">游戏结束！</span>}</div>}
      <canvas ref={canvasRef} width={W} height={H} className="border border-gray-600 rounded" />
    </div>
  );
}

// ========== PAC-MAN GAME ==========

function PacmanGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<{
    pacman: { x: number; y: number; dir: { x: number; y: number }; nextDir: { x: number; y: number } };
    ghosts: { x: number; y: number; dx: number; dy: number; color: string }[];
    dots: { x: number; y: number; eaten: boolean }[];
    maze: number[][];
    score: number;
    gameOver: boolean;
    won: boolean;
    paused: boolean;
    mouthOpen: number;
  } | null>(null);
  const animRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const CELL = 24;
  const MAZE = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,1,0,0,1,0,0,0,1],
    [1,1,1,0,1,1,0,0,0,1,1,0,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  const ROWS = MAZE.length, COLS = MAZE[0].length;

  const initGame = useCallback(() => {
    const dots: { x: number; y: number; eaten: boolean }[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (MAZE[r][c] === 0 && !(r === 7 && c === 7)) dots.push({ x: c, y: r, eaten: false });

    gameRef.current = {
      pacman: { x: 7, y: 7, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 } },
      ghosts: [
        { x: 1, y: 1, dx: 1, dy: 0, color: '#ef4444' },
        { x: 13, y: 1, dx: -1, dy: 0, color: '#f472b6' },
        { x: 1, y: 11, dx: 0, dy: -1, color: '#38bdf8' },
      ],
      dots,
      maze: MAZE,
      score: 0,
      gameOver: false,
      won: false,
      paused: false,
      mouthOpen: 0,
    };
    setScore(0);
    setGameOver(false);
    setPaused(false);
  }, []);

  const canMove = (x: number, y: number) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    return MAZE[y][x] === 0;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    // Maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAZE[r][c] === 1) {
          ctx.fillStyle = '#1e3a5f';
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          ctx.strokeStyle = '#3b82f6';
          ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
        }
      }
    }

    // Dots
    game.dots.forEach(d => {
      if (d.eaten) return;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(d.x * CELL + CELL / 2, d.y * CELL + CELL / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pac-Man
    const px = game.pacman.x * CELL + CELL / 2;
    const py = game.pacman.y * CELL + CELL / 2;
    const mouth = Math.abs(Math.sin(game.mouthOpen)) * 0.4;
    let angle = 0;
    if (game.pacman.dir.x === 1) angle = 0;
    else if (game.pacman.dir.x === -1) angle = Math.PI;
    else if (game.pacman.dir.y === -1) angle = -Math.PI / 2;
    else if (game.pacman.dir.y === 1) angle = Math.PI / 2;

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(px, py, CELL / 2 - 2, angle + mouth, angle + Math.PI * 2 - mouth);
    ctx.lineTo(px, py);
    ctx.fill();

    // Ghosts
    game.ghosts.forEach(g => {
      ctx.fillStyle = g.color;
      const gx = g.x * CELL + CELL / 2;
      const gy = g.y * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(gx, gy, CELL / 2 - 2, Math.PI, 0);
      ctx.lineTo(gx + CELL / 2 - 2, gy + CELL / 2 - 2);
      ctx.lineTo(gx - CELL / 2 + 2, gy + CELL / 2 - 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(gx - 4, gy - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(gx + 4, gy - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(gx - 4, gy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(gx + 4, gy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    });
  }, []);

  const gameLoop = useCallback((time: number) => {
    const game = gameRef.current;
    if (!game || game.gameOver || game.paused) {
      draw();
      animRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    game.mouthOpen += 0.15;

    if (time - lastMoveRef.current > 180) {
      lastMoveRef.current = time;

      // Try next direction
      const nd = game.pacman.nextDir;
      if (canMove(game.pacman.x + nd.x, game.pacman.y + nd.y)) {
        game.pacman.dir = { ...nd };
      }

      // Move pacman
      const nx = game.pacman.x + game.pacman.dir.x;
      const ny = game.pacman.y + game.pacman.dir.y;
      if (canMove(nx, ny)) {
        game.pacman.x = nx;
        game.pacman.y = ny;
      }

      // Eat dots
      const dot = game.dots.find(d => d.x === game.pacman.x && d.y === game.pacman.y && !d.eaten);
      if (dot) {
        dot.eaten = true;
        game.score += 10;
        setScore(game.score);
      }

      // Win check
      if (game.dots.every(d => d.eaten)) {
        game.won = true;
        game.gameOver = true;
        setGameOver(true);
      }

      // Move ghosts
      game.ghosts.forEach(g => {
        const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
        const valid = dirs.filter(d => canMove(g.x + d.x, g.y + d.y) && !(d.x === -g.dx && d.y === -g.dy));
        if (valid.length > 0) {
          const chosen = valid[Math.floor(Math.random() * valid.length)];
          g.dx = chosen.x;
          g.dy = chosen.y;
        }
        const gnx = g.x + g.dx, gny = g.y + g.dy;
        if (canMove(gnx, gny)) { g.x = gnx; g.y = gny; }
      });

      // Ghost collision
      if (game.ghosts.some(g => g.x === game.pacman.x && g.y === game.pacman.y)) {
        game.gameOver = true;
        setGameOver(true);
      }
    }

    draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  useEffect(() => {
    initGame();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [initGame, gameLoop]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (!game || game.gameOver) return;
      if (e.code === 'KeyP') { game.paused = !game.paused; setPaused(game.paused); return; }
      if (game.paused) return;

      const dirMap: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      };
      const d = dirMap[e.code];
      if (d) game.pacman.nextDir = d;
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold">分数: {score}</span>
        <Button size="sm" variant="outline" onClick={() => { const g = gameRef.current; if (g) { g.paused = !g.paused; setPaused(g.paused); } }}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={initGame}><RotateCcw className="w-4 h-4" /></Button>
      </div>
      {gameOver && <div className="font-bold text-xl">{gameRef.current?.won ? <span className="text-green-400">🎉 通关！</span> : <span className="text-red-400">游戏结束！</span>}</div>}
      <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL} className="border border-gray-600 rounded" />
    </div>
  );
}

// ========== GAME ROUTER ==========

const GAME_COMPONENTS: Record<string, React.FC> = {
  tetris: TetrisGame,
  snake: SnakeGame,
  breakout: BreakoutGame,
  invaders: InvadersGame,
  pacman: PacmanGame,
};

// ---------- Main Component ----------

export default function GamePage() {
  const [activeGame, setActiveGame] = useState<GameItem | null>(null);

  if (activeGame) {
    const GameComponent = GAME_COMPONENTS[activeGame.id];
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setActiveGame(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="text-2xl">{activeGame.cover}</div>
            <div>
              <h2 className="font-bold text-lg">{activeGame.name}</h2>
              <p className="text-xs text-muted-foreground">{activeGame.nameEn}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
            <Keyboard className="w-3.5 h-3.5" />
            <span>{activeGame.controls}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-black/50 p-4">
          <GameComponent />
        </div>
        <div className="px-6 py-2 border-t border-border bg-background/80 text-center">
          <p className="text-xs text-muted-foreground">
            💡 P键暂停 | 点击画面获取焦点后即可用键盘操作
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Gamepad2 className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            经典小游戏
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          纯HTML5 Canvas实现的经典游戏，无需加载外部资源
        </p>
        <div className="inline-flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
          <span>🎮</span>
          <span>键盘操控 · 即点即玩 · 无需等待</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
        {GAMES.map((game, i) => (
          <GameCard key={game.id} game={game} index={i} onClick={() => setActiveGame(game)} />
        ))}
      </div>

      <div className="max-w-3xl mx-auto pt-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            通用操作
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <div className="font-mono text-foreground mb-1">↑ ↓ ← →</div>
              <div>方向控制</div>
            </div>
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <div className="font-mono text-foreground mb-1">Space</div>
              <div>射击/发球/直落</div>
            </div>
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <div className="font-mono text-foreground mb-1">P</div>
              <div>暂停/继续</div>
            </div>
            <div className="bg-secondary/30 rounded-lg p-2 text-center">
              <div className="font-mono text-foreground mb-1">🔄</div>
              <div>重新开始按钮</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}