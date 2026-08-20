// ═══════════════════════════════════════════════════════════════
// core/data/characters.js
// Bibliothèque de personnages partagée entre les jeux Ondine Games
// qui proposent un choix d'animal cosmétique (Puzzle Mosaïque,
// Labyrinthe, et les futurs jeux qui en auraient besoin).
// Extensible : ajouter un objet à ce tableau suffit à faire
// apparaître un nouveau personnage dans TOUS les jeux qui
// consomment cette liste — aucune duplication de logique par animal.
// ═══════════════════════════════════════════════════════════════
export const CHARACTERS = [
  { id: 'cat',    name: 'Chat',      symbol: '🐱' },
  { id: 'dog',    name: 'Chien',     symbol: '🐶' },
  { id: 'rat',    name: 'Rat',       symbol: '🐭' },
  { id: 'fox',    name: 'Renard',    symbol: '🦊' },
  { id: 'rabbit', name: 'Lapin',     symbol: '🐰' },
  { id: 'panda',  name: 'Panda',     symbol: '🐼' },
  { id: 'frog',   name: 'Grenouille',symbol: '🐸' },
  { id: 'koala',  name: 'Koala',     symbol: '🐨' },
];

export const DEFAULT_CHARACTER_ID = 'cat';

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS.find(c => c.id === DEFAULT_CHARACTER_ID);
}
