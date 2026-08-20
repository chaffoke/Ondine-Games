// ═══════════════════════════════════════════════════════════════
// AudioService
// ───────────────────────────────────────
// RÔLE : jouer des sons courts synthétisés (Web Audio). Expose DEUX
//        niveaux, tous deux extraits du code déjà utilisé par les 18
//        jeux :
//          1. tone(freq, dur, type, vol) — la primitive bas niveau,
//             identique à la virgule près dans les 18 jeux actuels.
//             Un jeu qui veut ses propres sons (comme Rami, Spider,
//             Road Trip aujourd'hui) l'utilise directement.
//          2. play(presetName) — une petite bibliothèque de presets
//             GÉNÉRIQUES (déjà dans le CoreBundle Batch 1), pour les
//             jeux qui n'ont pas besoin de sons sur mesure.
// NE DOIT JAMAIS : contenir un preset nommé d'après un jeu (pas de
//        "unoSkip" ou "yamsRoll"), ni imposer qu'un événement précis
//        ("victoire") corresponde à une fréquence fixe — c'est
//        toujours le jeu qui choisit REST tone() ou play(preset).
// ═══════════════════════════════════════════════════════════════

let audioCtx = null;
let enabled = true;

function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { console.warn('[AudioService] Web Audio indisponible', e); }
  }
  return audioCtx;
}

export function tone(freq, dur, type = 'sine', vol = 0.12) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch (e) { /* silencieux : l'audio ne doit jamais casser le jeu */ }
}

// Bibliothèque de presets génériques — reprise telle quelle du
// CoreBundle Batch 1. Optionnelle : un jeu peut l'ignorer entièrement
// et n'utiliser que tone().
const PRESETS = {
  click:   () => tone(880, 0.06, 'sine', 0.10),
  place:   () => { tone(660, 0.1, 'sine', 0.14); setTimeout(() => tone(880, 0.08, 'sine', 0.10), 60); },
  success: () => [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.16), i * 90)),
  error:   () => tone(220, 0.16, 'sawtooth', 0.12),
  win:     () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.18), i * 110)),
  lose:    () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.14), i * 120)),
  flip:    () => tone(440, 0.06, 'triangle', 0.10),
  unlock:  () => [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'sine', 0.15), i * 80)),
};

export const AudioService = {
  tone,
  play(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) { console.warn('[AudioService] preset inconnu :', presetName); return; }
    preset();
  },
  setEnabled(v) { enabled = v; },
  isEnabled() { return enabled; },
};
