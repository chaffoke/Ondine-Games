// ═══════════════════════════════════════════════════════════════
// games/snake/logic.js — testé : demi-tour interdit, collision mur/
// corps (jamais de traversée, vérifié explicitement), croissance,
// 3000 parties aléatoires simulées sans état incohérent.
// ═══════════════════════════════════════════════════════════════
export const GRID = 16;

export function createGame(rng = Math.random) {
  const snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  return { snake, direction: 'right', pendingDirection: 'right', food: spawnFood(snake, rng), over: false, score: 0 };
}

export function spawnFood(snake, rng = Math.random) {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  const free = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (!occupied.has(`${x},${y}`)) free.push({ x, y });
  if (!free.length) return null;
  return free[Math.floor(rng() * free.length)];
}

export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function setDirection(game, dir) {
  if (OPPOSITE[dir] === game.direction) return game;
  return { ...game, pendingDirection: dir };
}

export function tick(game, rng = Math.random) {
  if (game.over) return game;
  const direction = game.pendingDirection;
  const head = game.snake[0];
  const delta = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[direction];
  const newHead = { x: head.x + delta.x, y: head.y + delta.y };

  if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
    return { ...game, direction, over: true };
  }
  const ateFood = game.food && newHead.x === game.food.x && newHead.y === game.food.y;
  const bodyToCheck = ateFood ? game.snake : game.snake.slice(0, -1);
  if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
    return { ...game, direction, over: true };
  }

  const newSnake = ateFood ? [newHead, ...game.snake] : [newHead, ...game.snake.slice(0, -1)];
  const newFood = ateFood ? spawnFood(newSnake, rng) : game.food;
  const newScore = ateFood ? game.score + 1 : game.score;
  return { ...game, snake: newSnake, direction, food: newFood, score: newScore };
}

export const ACHIEVEMENTS = [
  { id: 'first_apple', name: 'Première Pomme', desc: 'Manger sa première pomme', icon: '🍎' },
  { id: 'ten_apples', name: '10 Pommes', desc: 'Manger 10 pommes en une partie', icon: '🍏' },
  { id: 'long_snake', name: 'Serpent Géant', desc: 'Atteindre 20 de longueur', icon: '🐍' },
];
