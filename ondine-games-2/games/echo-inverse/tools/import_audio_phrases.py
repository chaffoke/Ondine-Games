#!/usr/bin/env python3
"""
tools/import_audio_phrases.py — Outil d'intégration des phrases audio
pour Echo Inverse (Ondine Games).

CONTRAT D'ENTRÉE ATTENDU
========================
Un dossier audio contenant les fichiers (.mp3 / .wav / .ogg), nommés
exactement comme l'`id` de la phrase :

    audio/
      phrase-001.mp3
      phrase-002.mp3
      phrase-003.mp3

Un fichier manifeste JSON associant chaque id à son texte et sa
difficulté :

    manifest.json
    [
      {"id": "phrase-001", "texte": "Le chat mange une glace.", "difficulte": "facile"},
      {"id": "phrase-002", "texte": "Le chien court dans le jardin.", "difficulte": "facile"},
      {"id": "phrase-003", "texte": "Le rat porte un chapeau.", "difficulte": "normal"}
    ]

Le champ "difficulte" est optionnel (defaut: "normal").

SORTIE
======
Un fichier JS unique (data/phrases-generated.js par défaut) exportant
PHRASES_DB — chaque entrée contient id / texte / difficulte / duree
(mesurée réellement via ffprobe, jamais déduite) / audioBase64 (le
fichier audio embarqué, pas une référence à charger dynamiquement —
fetch()/XMLHttpRequest sont bloqués sur file://, confirmé en Phase B)
/ mimeType. Ce fichier est directement compatible avec la structure
déjà validée du prototype Phase B (mêmes noms de champs).

VALIDATIONS EFFECTUÉES (chaque phrase, indépendamment)
========================================================
- id présent, non vide, sans doublon dans le manifeste
- texte présent, non vide
- fichier audio correspondant trouvé dans le dossier audio
- fichier audio non vide (taille > 0 octet)
- fichier réellement décodable (ffprobe réussit, pas seulement présent)
- format audio reconnu (mp3 / wav / ogg — vorbis)
- durée récupérée réellement (jamais 0, jamais aberrante : entre
  0.3s et 15s par défaut, configurable)
- détection des fichiers audio "orphelins" (présents dans le dossier
  mais absents du manifeste) — signalés, pas bloquants

Le traitement est DÉTERMINISTE : les entrées sont toujours triées par
id avant génération, donc deux exécutions sur les mêmes données
produisent un fichier de sortie strictement identique.

USAGE
=====
  python3 import_audio_phrases.py --audio-dir <dossier> --manifest <fichier.json> --output <sortie.js>
  python3 import_audio_phrases.py --audio-dir <dossier> --manifest <fichier.json> --audit-only
"""
import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path

SUPPORTED_FORMATS = {'mp3', 'wav', 'ogg', 'vorbis'}
MIME_BY_EXT = {'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'}
MIN_DURATION_SEC = 0.3
MAX_DURATION_SEC = 15.0
VALID_DIFFICULTIES = {'facile', 'normal', 'difficile', 'expert', 'chaos'}


class ImportError_(Exception):
    """Erreur bloquante pour UNE entrée — n'interrompt pas les autres."""
    pass


def probe_audio(path: Path):
    """Interroge le fichier via ffprobe (100% local, aucun réseau).
    Lève ImportError_ si le fichier n'est pas un audio valide/décodable."""
    if not path.exists():
        raise ImportError_(f"fichier introuvable : {path}")
    if path.stat().st_size == 0:
        raise ImportError_(f"fichier vide (0 octet) : {path}")
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration,format_name',
             '-show_entries', 'stream=codec_type,codec_name', '-of', 'json', str(path)],
            capture_output=True, text=True, timeout=15,
        )
    except FileNotFoundError:
        raise ImportError_("ffprobe introuvable sur le système — impossible de valider l'audio localement")
    except subprocess.TimeoutExpired:
        raise ImportError_(f"ffprobe a expiré (fichier corrompu ou anormalement volumineux ?) : {path}")
    if result.returncode != 0 or not result.stdout.strip():
        raise ImportError_(f"fichier illisible/non décodable par ffprobe : {path} — {result.stderr.strip()[:200]}")
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise ImportError_(f"sortie ffprobe illisible pour : {path}")

    audio_streams = [s for s in data.get('streams', []) if s.get('codec_type') == 'audio']
    if not audio_streams:
        raise ImportError_(f"aucun flux audio détecté dans : {path}")
    codec = audio_streams[0].get('codec_name', '')
    # IMPORTANT : on valide le CONTENEUR (format_name — wav/mp3/ogg), pas
    # le codec interne. Un WAV standard a le codec interne "pcm_s16le",
    # pas "wav" — confondre les deux fait rejeter à tort tous les WAV
    # valides (bug réel trouvé en testant l'outil sur ses propres cas
    # nominaux avant de le considérer fiable).
    format_name = data.get('format', {}).get('format_name', '')
    format_tokens = set(format_name.split(','))  # ffprobe peut renvoyer "wav" seul, ou "ogg,..." pour certains conteneurs
    if not (format_tokens & SUPPORTED_FORMATS):
        raise ImportError_(f"format de conteneur non supporté ({format_name}, codec interne {codec}) : {path} — attendu parmi {SUPPORTED_FORMATS}")

    duration_str = data.get('format', {}).get('duration')
    if duration_str is None:
        raise ImportError_(f"durée introuvable (fichier corrompu ?) : {path}")
    duration = float(duration_str)
    if duration <= 0:
        raise ImportError_(f"durée nulle ou négative ({duration}s) : {path}")
    if duration < MIN_DURATION_SEC:
        raise ImportError_(f"durée anormalement courte ({duration:.2f}s < {MIN_DURATION_SEC}s) : {path}")
    if duration > MAX_DURATION_SEC:
        raise ImportError_(f"durée anormalement longue ({duration:.2f}s > {MAX_DURATION_SEC}s) : {path}")

    return {'duration': round(duration, 3), 'codec': codec}


def find_audio_file(audio_dir: Path, phrase_id: str):
    """Cherche <id>.mp3, <id>.wav, ou <id>.ogg dans cet ordre de préférence."""
    for ext in ('.mp3', '.wav', '.ogg'):
        candidate = audio_dir / f"{phrase_id}{ext}"
        if candidate.exists():
            return candidate
    return None


def load_manifest(manifest_path: Path):
    if not manifest_path.exists():
        print(f"ERREUR FATALE : manifeste introuvable : {manifest_path}", file=sys.stderr)
        sys.exit(1)
    try:
        entries = json.loads(manifest_path.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        print(f"ERREUR FATALE : manifeste JSON invalide : {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(entries, list):
        print("ERREUR FATALE : le manifeste doit être une liste JSON d'objets", file=sys.stderr)
        sys.exit(1)
    return entries


def process(audio_dir: Path, manifest_path: Path):
    """Traite le manifeste entrée par entrée. Retourne (valides, erreurs,
    avertissements) — ne s'arrête jamais à la première erreur : chaque
    phrase est indépendante, une erreur n'empêche pas de traiter les
    autres (mais le résultat global sera refusé s'il reste des erreurs
    au moment de générer la sortie, sauf mode audit)."""
    entries = load_manifest(manifest_path)
    valid = []
    errors = []
    warnings = []
    seen_ids = set()

    for i, entry in enumerate(entries):
        ctx = f"entrée #{i+1}"
        phrase_id = entry.get('id', '').strip() if isinstance(entry.get('id'), str) else ''
        if not phrase_id:
            errors.append(f"{ctx} : id manquant ou vide")
            continue
        ctx = f"'{phrase_id}'"
        if phrase_id in seen_ids:
            errors.append(f"{ctx} : id en double dans le manifeste")
            continue
        seen_ids.add(phrase_id)

        texte = entry.get('texte', '').strip() if isinstance(entry.get('texte'), str) else ''
        if not texte:
            errors.append(f"{ctx} : texte manquant ou vide")
            continue

        difficulte = entry.get('difficulte', 'normal')
        if difficulte not in VALID_DIFFICULTIES:
            warnings.append(f"{ctx} : difficulté '{difficulte}' non reconnue, remplacée par 'normal'")
            difficulte = 'normal'

        audio_path = find_audio_file(audio_dir, phrase_id)
        if audio_path is None:
            errors.append(f"{ctx} : aucun fichier audio trouvé ({phrase_id}.mp3/.wav/.ogg) dans {audio_dir}")
            continue

        try:
            info = probe_audio(audio_path)
        except ImportError_ as e:
            errors.append(f"{ctx} : {e}")
            continue

        raw_bytes = audio_path.read_bytes()
        b64 = base64.b64encode(raw_bytes).decode('ascii')
        mime = MIME_BY_EXT.get(audio_path.suffix.lower(), 'audio/mpeg')

        valid.append({
            'id': phrase_id, 'texte': texte, 'difficulte': difficulte,
            'duree': info['duration'], 'audioBase64': b64, 'mimeType': mime,
            'sourceFile': audio_path.name, 'sourceSizeBytes': len(raw_bytes),
        })

    # fichiers orphelins : présents dans le dossier mais jamais référencés
    if audio_dir.exists():
        referenced_stems = {e.get('id', '') for e in entries if isinstance(e.get('id'), str)}
        for f in audio_dir.iterdir():
            if f.suffix.lower() in ('.mp3', '.wav', '.ogg') and f.stem not in referenced_stems:
                warnings.append(f"fichier orphelin (non référencé dans le manifeste) : {f.name}")

    # tri déterministe par id
    valid.sort(key=lambda p: p['id'])
    return valid, errors, warnings


def print_audit(valid, errors, warnings):
    total_duration = sum(p['duree'] for p in valid)
    by_diff = {}
    for p in valid:
        by_diff[p['difficulte']] = by_diff.get(p['difficulte'], 0) + 1

    print("═" * 60)
    print("AUDIT DE LA BANQUE DE PHRASES")
    print("═" * 60)
    print(f"{len(valid) + len(errors)} phrase(s) trouvée(s) dans le manifeste")
    print(f"{len(valid)} phrase(s) valide(s)")
    print(f"{len(errors)} erreur(s)")
    print(f"{len(warnings)} avertissement(s)")
    print(f"Durée totale (phrases valides) : {total_duration:.1f}s ({total_duration/60:.1f} min)")
    if by_diff:
        print("Répartition par difficulté :")
        for diff, count in sorted(by_diff.items()):
            print(f"  - {diff} : {count}")
    if errors:
        print("\nERREURS :")
        for e in errors:
            print(f"  ❌ {e}")
    if warnings:
        print("\nAVERTISSEMENTS :")
        for w in warnings:
            print(f"  ⚠️  {w}")
    print("═" * 60)


def generate_output(valid, output_path: Path):
    lines = []
    lines.append("// ═══════════════════════════════════════════════════════════════")
    lines.append("// FICHIER GÉNÉRÉ AUTOMATIQUEMENT par tools/import_audio_phrases.py")
    lines.append("// NE PAS MODIFIER À LA MAIN — relancer l'outil à la place.")
    lines.append("// ═══════════════════════════════════════════════════════════════")
    lines.append("export const PHRASES_DB = [")
    for p in valid:
        lines.append("  {")
        lines.append(f"    id: {json.dumps(p['id'])},")
        lines.append(f"    texte: {json.dumps(p['texte'], ensure_ascii=False)},")
        lines.append(f"    difficulte: {json.dumps(p['difficulte'])},")
        lines.append(f"    duree: {p['duree']},")
        lines.append(f"    mimeType: {json.dumps(p['mimeType'])},")
        lines.append(f"    audioBase64: {json.dumps(p['audioBase64'])},")
        lines.append("  },")
    lines.append("];")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description="Importe et valide une banque de phrases audio pour Echo Inverse.")
    parser.add_argument('--audio-dir', required=True, help="Dossier contenant les fichiers audio")
    parser.add_argument('--manifest', required=True, help="Fichier manifest.json (id/texte/difficulte)")
    parser.add_argument('--output', default=None, help="Fichier JS de sortie (omis en mode --audit-only)")
    parser.add_argument('--audit-only', action='store_true', help="Affiche seulement le rapport, n'écrit rien")
    args = parser.parse_args()

    audio_dir = Path(args.audio_dir)
    manifest_path = Path(args.manifest)

    valid, errors, warnings = process(audio_dir, manifest_path)
    print_audit(valid, errors, warnings)

    if args.audit_only:
        sys.exit(1 if errors else 0)

    if errors:
        print("\n❌ Génération ANNULÉE : des erreurs bloquantes subsistent. Corrige-les puis relance l'outil.", file=sys.stderr)
        sys.exit(1)

    if not args.output:
        print("\n❌ --output requis hors mode --audit-only", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)
    generate_output(valid, output_path)
    print(f"\n✅ {len(valid)} phrase(s) écrite(s) dans {output_path}")
    sys.exit(0)


if __name__ == '__main__':
    main()
