// ═══════════════════════════════════════════════════════════════
// games/echo-inverse/audioEngine.js
//
// Moteur audio générique et réutilisable. Aucune fonction ici ne
// sait — ni ne doit savoir — si l'audio manipulé provient d'un
// placeholder de test ou d'un vrai fichier de voix française :
// c'est strictement la même chaîne de traitement PCM dans les deux
// cas. C'est ce découplage qui garantit qu'ajouter les vraies
// phrases plus tard n'exigera aucun changement de ce fichier.
// ═══════════════════════════════════════════════════════════════

let sharedAudioContext = null;
function getAudioContext() {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedAudioContext;
}

/** Charge un fichier audio LOCAL via fetch(). ATTENTION — confirmé
 *  empiriquement : fetch() ET XMLHttpRequest sont TOUS DEUX bloqués
 *  par Chromium pour charger un fichier binaire externe séparé
 *  depuis file:// (contrairement à ce qu'on pourrait supposer). Cette
 *  fonction ne fonctionnera donc QUE si le jeu est un jour servi en
 *  http(s)://, jamais en file:// tel que déployé actuellement. Gardée
 *  pour clarté/référence — la fonction réellement utilisée par le
 *  jeu final est `loadAudioFromBase64` ci-dessous. */
export async function loadAudioFile(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Impossible de charger ${path} (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

/** Charge un audio depuis une chaîne base64 déjà embarquée dans le
 *  JS livré — LE mécanisme réellement utilisable en file://. C'est
 *  exactement le même principe que build_standalone.py utilise déjà
 *  pour fusionner tout le reste du projet en un fichier autonome :
 *  aucun fichier binaire externe séparé, tout est inline. */
export async function loadAudioFromBase64(base64String) {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const ctx = getAudioContext();
  return ctx.decodeAudioData(bytes.buffer);
}

/** Inversion PCM RÉELLE : inverse l'ordre des échantillons de
 *  chaque canal. Fonctionne identiquement quelle que soit la
 *  provenance du buffer (fichier local ou enregistrement micro). */
export function reverseAudioBuffer(audioBuffer) {
  const ctx = getAudioContext();
  const reversed = ctx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    const dst = reversed.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[src.length - 1 - i];
    }
  }
  return reversed;
}

/** Joue un AudioBuffer et retourne une promesse résolue à la fin de
 *  la lecture (utile pour enchaîner des étapes de test/gameplay). */
export function playAudioBuffer(audioBuffer) {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start();
  });
}

/** Micro : demande la permission, enregistre, retourne un vrai Blob.
 *  `onStateChange` est appelé avec 'recording' / 'stopped' pour que
 *  l'UI puisse réagir sans dupliquer cette logique. Le flux micro est
 *  TOUJOURS proprement arrêté (tracks.stop()) après l'enregistrement
 *  — jamais laissé actif en arrière-plan. */
export async function recordFromMicrophone(durationMs, onStateChange) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  if (onStateChange) onStateChange('recording');
  await new Promise((r) => setTimeout(r, durationMs));
  recorder.stop();
  await stopped;
  if (onStateChange) onStateChange('stopped');

  // libération explicite et systématique du micro — jamais de flux
  // laissé actif après l'enregistrement
  stream.getTracks().forEach((t) => t.stop());

  const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
  return blob;
}

/** Décode un Blob (enregistrement micro OU fichier chargé) en
 *  AudioBuffer — même fonction pour les deux cas, encore une fois
 *  aucune branche spécifique au placeholder. */
export async function decodeBlob(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

/** Vérification mathématique utilitaire : compare deux AudioBuffer
 *  échantillon par échantillon (tolérance pour les erreurs
 *  d'arrondi flottant). */
export function buffersApproximatelyEqual(a, b, epsilon = 1e-6) {
  if (a.numberOfChannels !== b.numberOfChannels || a.length !== b.length) return false;
  for (let ch = 0; ch < a.numberOfChannels; ch++) {
    const da = a.getChannelData(ch), db = b.getChannelData(ch);
    for (let i = 0; i < da.length; i++) {
      if (Math.abs(da[i] - db[i]) > epsilon) return false;
    }
  }
  return true;
}
