// ═══════════════════════════════════════════════════════════════
// games/echo-inverse/assets/audio/phrases/phrases.json (structure
// de référence — copié en JS pour le prototype, sera chargé en JSON
// pur une fois les vraies phrases fournies).
//
// IMPORTANT : les deux entrées ci-dessous sont des PLACEHOLDERS
// techniques (tons synthétiques, pas une voix). Le champ `placeholder`
// vaut `true` explicitement — le moteur de jeu final DEVRA vérifier
// ce champ et refuser de démarrer une vraie partie si des entrées
// placeholder sont encore présentes dans la banque de données livrée.
// ═══════════════════════════════════════════════════════════════
export const PHRASES_DB = [
  {
    id: '__placeholder-short',
    texte: '[PLACEHOLDER TECHNIQUE — pas une vraie phrase]',
    difficulte: 'facile',
    fichier: 'assets/audio/phrases/__PLACEHOLDER_short.wav',
    duree: 1.2,
    placeholder: true,
  },
  {
    id: '__placeholder-long',
    texte: '[PLACEHOLDER TECHNIQUE — pas une vraie phrase, plus long]',
    difficulte: 'difficile',
    fichier: 'assets/audio/phrases/__PLACEHOLDER_long.wav',
    duree: 3.6,
    placeholder: true,
  },
];

/** Une fois les vraies phrases fournies, chaque entrée suivra
 *  exactement cette même forme, avec `placeholder: false` (ou le
 *  champ simplement absent) :
 *  {
 *    id: 'phrase-001',
 *    texte: 'Le petit renard mange une pomme.',
 *    difficulte: 'facile',
 *    fichier: 'assets/audio/phrases/phrase-001.wav',
 *    duree: 1.8,
 *  }
 */
