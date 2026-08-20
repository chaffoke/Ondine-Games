// ═══════════════════════════════════════════════════════════════
// Random Engine
// ───────────────────────────────────────
// RÔLE : mélange Fisher-Yates générique.
// ───────────────────────────────────────
// DÉVIATION DOCUMENTÉE par rapport au CoreBundle Batch 1 : la version
// d'origine (`shuffle(arr)`) mélangeait EN PLACE et retournait le
// même tableau. Or les 8+ implémentations dupliquées dans les jeux
// Batch 2/3 (`shuffleArr`) font toutes une COPIE et ne mutent jamais
// le tableau source — c'est le comportement majoritaire réellement
// utilisé (8+ jeux contre 1 seul, Uno, sur l'ancienne version
// mutante). Kevin a explicitement demandé de "respecter le
// comportement réellement utilisé par les jeux" plutôt que de
// recopier l'ancienne version sans vérifier — c'est ce qui est fait
// ici : shuffle() ne mute JAMAIS le tableau passé, retourne toujours
// une nouvelle copie mélangée.
//
// Conséquence pour la migration d'Uno (non faite dans cette phase) :
// son code interne compte actuellement sur la mutation en place ;
// migrer Uno vers ce RandomEngine nécessitera de vérifier ses appels
// à shuffle() un par un, pas juste un remplacement mécanique.
// ═══════════════════════════════════════════════════════════════

/** Fisher-Yates — retourne TOUJOURS une nouvelle copie mélangée,
 *  ne modifie jamais le tableau passé en argument. */
export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
