#!/usr/bin/env python3
"""
build_standalone.py — Fusionne core/ + un jeu (games/<id>/) en un seul
fichier HTML sans aucun import ES module, pour permettre un test direct
(file:// ou content://) sans serveur HTTP.

ADAPTÉ de l'ancien build_standalone.py (Batch 1) — MÊME PRINCIPE EXACT,
pas une réécriture : tout core/ est concaténé dans une IIFE (fonction
auto-exécutée) plutôt que laissé en déclarations globales nues, pour
éviter toute collision de nom entre deux jeux différents (ex: deux
`let audioCtx` privés à deux services différents entreraient en
collision s'ils étaient concaténés tels quels au niveau global — c'est
exactement le problème que l'IIFE résout, comme documenté dans la
version d'origine).

Différence avec l'ancien script (nécessaire, pas cosmétique) :
  - l'ancien core/ était un seul niveau de fichiers ; le nouveau a des
    sous-dossiers (services/, engines/, sdk/, storage/, ui/) avec de
    vraies dépendances internes (StatsService importe storage/keys.js,
    DialogService importe ui/components.js, CardEngine importe
    RandomEngine.js, createSDK.js importe presque tout) — l'ORDRE de
    concaténation dans CORE_FILES_IN_ORDER doit respecter ces
    dépendances (un fichier qui importe X doit être concaténé APRÈS X).
  - l'ancien jeu avait 2 balises <script> inline (bootstrap + jeu) ;
    le nouveau a 3 fichiers séparés (logic.js/ui.js/game.js) chargés
    via <script type="module" src="./game.js">, donc CE script résout
    aussi les imports RELATIFS entre ces 3 fichiers (pas seulement les
    imports vers core/), dans l'ordre logic.js → ui.js → game.js.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # racine ondine-games-2/
CORE = ROOT / 'core'
GAMES = ROOT / 'games'
OUT = ROOT / 'games-dist'
OUT.mkdir(exist_ok=True)

# Ordre de dépendance réel (vérifié par lecture des imports de chaque
# fichier) — un fichier qui importe X doit apparaître APRÈS X ici.
CORE_FILES_IN_ORDER = [
    CORE / 'data' / 'characters.js',                  # aucune dépendance interne
    CORE / 'storage' / 'keys.js',                    # aucune dépendance interne
    CORE / 'engines' / 'RandomEngine.js',             # aucune dépendance interne
    CORE / 'engines' / 'GridEngine.js',
    CORE / 'engines' / 'CardEngine.js',                # importe RandomEngine
    CORE / 'engines' / 'DiceEngine.js',
    CORE / 'engines' / 'AIEngine.js',
    CORE / 'engines' / 'SnapshotStore.js',
    CORE / 'ui' / 'components.js',                     # aucune dépendance interne
    CORE / 'services' / 'NotificationService.js',
    CORE / 'services' / 'StatsService.js',              # importe storage/keys.js
    CORE / 'services' / 'AchievementsService.js',       # importe storage/keys.js
    CORE / 'services' / 'AudioService.js',
    CORE / 'services' / 'SaveService.js',               # importe storage/keys.js
    CORE / 'services' / 'DialogService.js',             # importe ui/components.js
    CORE / 'services' / 'NavigationService.js',
    CORE / 'sdk' / 'createSDK.js',                       # importe tous les services + RandomEngine
    CORE / 'sdk' / 'GameRegistry.js',
]

# DOTALL : un import peut être écrit sur plusieurs lignes
# (`import {\n  a, b,\n} from '...';`) — le script doit le retirer
# entièrement, pas seulement sa première ligne.
IMPORT_LINE_RE = re.compile(r'^\s*import\s.*?;\s*$', re.MULTILINE | re.DOTALL)
EXPORT_FUNC_RE = re.compile(r'^export\s+(async\s+function|function)\s+(\w+)', re.MULTILINE)
EXPORT_CONST_RE = re.compile(r'^export\s+const\s+(\w+)', re.MULTILINE)


def strip_and_collect(src):
    """Retire les import/export d'un fichier, collecte les noms publics
    (ceux qui étaient précédés de `export`)."""
    public_names = []
    for m in EXPORT_FUNC_RE.finditer(src):
        public_names.append(m.group(2))
    for m in EXPORT_CONST_RE.finditer(src):
        public_names.append(m.group(1))
    src = IMPORT_LINE_RE.sub('', src)
    src = re.sub(r'^export\s+(async\s+function|function|const)', r'\1', src, flags=re.MULTILINE)
    return src, public_names


def build_core_bundle():
    bodies = []
    all_public = []
    for f in CORE_FILES_IN_ORDER:
        src = f.read_text(encoding='utf-8')
        stripped, names = strip_and_collect(src)
        bodies.append(f'// ── {f.relative_to(CORE)} ──\n' + stripped)
        all_public.extend(names)
    seen = set()
    dedup_public = [n for n in all_public if not (n in seen or seen.add(n))]
    body = '\n\n'.join(bodies)
    exports_obj = ', '.join(dedup_public)
    return f"const CoreBundle = (function() {{\n{body}\n\nreturn {{ {exports_obj} }};\n}})();"


def strip_local_and_core_imports(src):
    """Retire TOUTE ligne import (qu'elle vienne de core/ ou d'un
    fichier local du jeu comme ./logic.js) — après concaténation dans
    l'ordre logic.js → ui.js → game.js, tous les noms sont déjà dans
    la même portée, un import serait redondant (et invalide, puisque
    ce n'est plus un module ES à ce stade)."""
    src = IMPORT_LINE_RE.sub('', src)
    src = re.sub(r'^export\s+(async\s+function|function|const)', r'\1', src, flags=re.MULTILINE)
    return src


CORE_IMPORT_RE = re.compile(r'import\s*\{([^}]*)\}\s*from\s*[\'"][^\'"]*core/[^\'"]+[\'"]\s*;?', re.DOTALL)
LOCAL_IMPORT_RE = re.compile(r'import\s*\{[^}]*\}\s*from\s*[\'"](\./[^\'"]+)[\'"]\s*;?', re.DOTALL)


def collect_local_import_files(src):
    """Fichiers locaux (./xxx.js) importés par un fichier de jeu —
    nécessaire pour un tri topologique correct : un jeu peut avoir
    plus que logic.js/ui.js/game.js (ex: ai.js pour Bataille Navale),
    et l'ordre de concaténation doit respecter ces dépendances."""
    return [m.group(1)[2:] for m in LOCAL_IMPORT_RE.finditer(src)]


def order_game_files(game_dir):
    """Tri topologique des fichiers .js du dossier d'un jeu (hors
    index.html/manifest.json/styles.css) à partir de leurs imports
    locaux réels — généralise au-delà du triplet fixe logic/ui/game.
    `game.js` (point d'entrée) est toujours placé en dernier."""
    js_files = sorted(p.name for p in game_dir.glob('*.js'))
    deps = {}
    for name in js_files:
        src = (game_dir / name).read_text(encoding='utf-8')
        deps[name] = [d for d in collect_local_import_files(src) if d in js_files]

    ordered = []
    visited = set()
    def visit(name):
        if name in visited: return
        visited.add(name)
        for dep in deps.get(name, []):
            visit(dep)
        ordered.append(name)
    for name in js_files:
        visit(name)

    # game.js (point d'entrée) doit toujours être en dernier, même si
    # le tri topologique pur le placerait ailleurs (il n'est importé
    # par personne, donc rien ne le contraint naturellement à la fin)
    if 'game.js' in ordered:
        ordered.remove('game.js')
        ordered.append('game.js')
    return ordered


def collect_core_import_names(src):
    """Scanne les `import { X, Y } from '../../core/...'` d'un fichier
    de jeu et retourne les noms importés — nécessaire pour construire
    la déstructuration CoreBundle avec EXACTEMENT ce dont le jeu a
    besoin (pas une liste figée : un futur jeu peut importer un engine
    qu'aucun autre jeu n'utilise, ex. GridEngine, AIEngine...)."""
    names = []
    for m in CORE_IMPORT_RE.finditer(src):
        for part in m.group(1).split(','):
            part = part.strip()
            if not part:
                continue
            name = part.split(' as ')[-1].strip() if ' as ' in part else part
            names.append(name)
    return names


def build_standalone(game_id):
    game_dir = GAMES / game_id
    html = (game_dir / 'index.html').read_text(encoding='utf-8')

    # ── 1. CoreBundle (inchangé dans son principe) ──
    core_bundle_src = build_core_bundle()

    # ── 2. Concatène logic.js → ui.js → game.js (ordre de dépendance
    #        du jeu lui-même), en retirant tous les import/export, et
    #        collecte au passage TOUT ce que le jeu importe de core/
    #        (pas une liste figée — voir collect_core_import_names) ──
    game_parts = []
    needed_core_names = []
    for filename in order_game_files(game_dir):
        path = game_dir / filename
        src = path.read_text(encoding='utf-8')
        needed_core_names.extend(collect_core_import_names(src))
        game_parts.append(f'// ── games/{game_id}/{filename} ──\n' + strip_local_and_core_imports(src))
    game_bundle_src = '\n\n'.join(game_parts)

    seen = set()
    dedup_needed = [n for n in needed_core_names if not (n in seen or seen.add(n))]
    destructure_line = f"const {{ {', '.join(dedup_needed)} }} = CoreBundle;" if dedup_needed else ''

    final_script = core_bundle_src + f'\n\n// ── jeu (imports résolus par concaténation) ──\n{destructure_line}\n\n' + game_bundle_src

    # ── 3. Remplace <script type="module" src="./game.js"> par le script
    #        fusionné. IMPORTANT : re.sub interprète les backslashes dans
    #        une chaîne de remplacement (\1, \g<name>...) — le JS généré
    #        peut légitimement contenir des backslashes (regex, \n dans
    #        une chaîne, etc.), donc on utilise une fonction de
    #        remplacement (jamais interprétée) plutôt qu'une chaîne. ──
    html = re.sub(
        r'<script type="module" src="\./game\.js"></script>',
        lambda m: '<script>\n' + final_script + '\n</script>',
        html,
    )

    # ── 4. Inline le CSS (design-tokens.css partagé + styles.css du jeu) ──
    tokens_css = (CORE / 'design-tokens.css').read_text(encoding='utf-8')
    game_css_path = game_dir / 'styles.css'
    game_css = game_css_path.read_text(encoding='utf-8') if game_css_path.exists() else ''
    html = html.replace(
        '<link rel="stylesheet" href="../../core/design-tokens.css">',
        f'<style>\n{tokens_css}\n</style>',
    )
    html = html.replace(
        '<link rel="stylesheet" href="./styles.css">',
        f'<style>\n{game_css}\n</style>',
    )

    out_path = OUT / f'{game_id}.html'
    out_path.write_text(html, encoding='utf-8')
    print(f'OK: {game_id}.html ({len(html)} caractères)')
    return out_path


if __name__ == '__main__':
    game_ids = sys.argv[1:] or ['morpion', 'reflexe']
    for gid in game_ids:
        build_standalone(gid)
