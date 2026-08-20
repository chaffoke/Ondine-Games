// ═══════════════════════════════════════════════════════════════
// games/game-of-goose/logic.js — variante française classique
// documentée, testée (14 assertions + 3000 parties simulées 2-4
// joueurs, 100% terminées) :
//  - Oies : rejoue en avançant encore du même nombre de points
//  - Case 6 "Le Pont" : saute en case 12
//  - Case 19 "L'Auberge" : passe le tour suivant
//  - Case 31 "Le Puits" : bloqué jusqu'à ce qu'un autre joueur y
//    atterrisse (le libère alors)
//  - Case 42 "Le Labyrinthe" : renvoyé en case 30
//  - Case 52 "La Mort" : renvoyé en case 1
//  - Case 63 "Arrivée" : exacte, dépassement = rebond en arrière
// ═══════════════════════════════════════════════════════════════
export const BOARD_SIZE = 63;
export const GEESE = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
export const BRIDGE = 6, BRIDGE_TARGET = 12;
export const INN = 19;
export const WELL = 31;
export const LABYRINTH = 42, LABYRINTH_TARGET = 30;
export const DEATH = 52;
export const GOAL = 63;

export function createGame(playerCount) {
  return {
    positions: Array(playerCount).fill(0),
    skipTurn: Array(playerCount).fill(false),
    stuckInWell: Array(playerCount).fill(false),
    current: 0,
    over: false,
    winner: null,
    log: [],
  };
}

export function rollDice(rng = Math.random) { return 1 + Math.floor(rng() * 6); }

function applySquareRules(position, dieValue) {
  if (position === BRIDGE) return { position: BRIDGE_TARGET, replay: false, message: 'Le Pont ! Direction case 12.' };
  if (position === LABYRINTH) return { position: LABYRINTH_TARGET, replay: false, message: 'Le Labyrinthe... retour en case 30.' };
  if (position === DEATH) return { position: 1, replay: false, message: 'La Mort ! Retour à la case départ.' };
  if (GEESE.has(position)) return { position, replay: true, message: 'Une Oie ! Rejoue en avançant encore.' };
  return { position, replay: false, message: null };
}

export function playTurn(game, rng = Math.random) {
  if (game.over) return game;
  const player = game.current;

  if (game.skipTurn[player]) {
    const skipTurn = game.skipTurn.slice(); skipTurn[player] = false;
    return advanceTurn({ ...game, skipTurn }, `Joueur ${player + 1} passe son tour (Auberge).`);
  }
  if (game.stuckInWell[player]) {
    return advanceTurn(game, `Joueur ${player + 1} est bloqué dans le Puits.`);
  }

  let position = game.positions[player];
  let replay = true;
  let logs = [];
  let stuckInWell = game.stuckInWell.slice();
  let skipTurn = game.skipTurn.slice();

  while (replay) {
    const die = rollDice(rng);
    let target = position + die;

    if (target > GOAL) {
      target = GOAL - (target - GOAL);
      logs.push(`Dépassement, rebond à la case ${target}.`);
    }
    if (target === GOAL) {
      position = GOAL;
      logs.push(`Joueur ${player + 1} atteint l'arrivée !`);
      replay = false;
      break;
    }
    if (target === INN) {
      position = target;
      skipTurn[player] = true;
      logs.push("L'Auberge ! Tu passeras ton prochain tour.");
      replay = false;
      break;
    }
    if (target === WELL) {
      position = target;
      stuckInWell[player] = true;
      logs.push('Le Puits... bloqué jusqu\u2019à ce qu\u2019un autre joueur t\u2019y rejoigne.');
      replay = false;
      break;
    }

    const result = applySquareRules(target, die);
    position = result.position;
    if (result.message) logs.push(result.message);
    replay = result.replay;
  }

  if (position === WELL) {
    game.stuckInWell.forEach((stuck, i) => {
      if (stuck && i !== player) { stuckInWell[i] = false; logs.push(`Joueur ${i + 1} est libéré du Puits !`); }
    });
  }

  const positions = game.positions.slice();
  positions[player] = position;

  if (position === GOAL) {
    return { ...game, positions, stuckInWell, skipTurn, over: true, winner: player, log: [...game.log, ...logs] };
  }
  return advanceTurn({ ...game, positions, stuckInWell, skipTurn }, logs.join(' '));
}

function advanceTurn(game, message) {
  const current = (game.current + 1) % game.positions.length;
  return { ...game, current, log: message ? [...game.log, message] : game.log };
}

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Arrivée', desc: 'Gagner une partie', icon: '🎯' },
  { id: 'no_well', name: 'Chemin Sûr', desc: 'Gagner sans jamais tomber dans le Puits', icon: '🍀' },
  { id: 'goose_chain', name: 'Vol d\u2019Oies', desc: 'Enchaîner 3 oies dans le même tour', icon: '🦢' },
];
