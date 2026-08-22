// ═══════════════════════════════════════════════════════════════
// ONDINE RACING — moteur de course en logique pure.
// Modèle arcade déterministe : position 1D le long d'une boucle
// fermée définie par des points de contrôle (waypoints). La vitesse
// max en chaque point est DÉRIVÉE de la géométrie (courbure locale),
// pas une donnée parallèle à synchroniser à la main — même géométrie
// pour le rendu ET le gameplay, une seule source de vérité.
// Testé : géométrie des 5 circuits (longueurs, boucles fermées),
// moteur (progression, virages, boost, tours, arrivée), et 900
// simulations IA (300×3 difficultés) sans blocage ni état incohérent,
// avec différenciation réelle prouvée entre les 3 niveaux.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// SPORTS — architecture data-driven, un seul moteur réel pour
// l'instant ('racing', qui réutilise le moteur circuit existant).
// Les autres sports sont volontairement des placeholders "à venir" :
// pas de faux gameplay, aucun sport ne peut être lancé tant que
// hasEngine n'est pas true. physicsProfile/vehicleProfile/
// economyProfile sont préparés pour de futures phases (non lus par
// le moteur actuel), pour éviter une restructuration complète quand
// les vrais moteurs Rallye/Stock Car/etc. seront développés.
// ═══════════════════════════════════════════════════════════════
export const SPORTS = {
  racing:      { id: 'racing',      order: 1, name: 'Course',        icon: '🏎️', desc: 'Circuit classique, vitesse pure.', vehicleType: 'Formule',      hasEngine: true,  defaultUnlocked: true,  unlockCondition: null,
    physicsProfile: 'circuit', vehicleProfile: 'formula', economyProfile: 'standard' },
  rally:       { id: 'rally',       order: 2, name: 'Rallye',        icon: '🚗', desc: 'Terrains variés, conduite technique.', vehicleType: 'Rallye',    hasEngine: true,  defaultUnlocked: false, unlockCondition: 'Débloqué au niveau 2',
    physicsProfile: 'offroad', vehicleProfile: 'rally', economyProfile: 'standard' },
  stockCar:    { id: 'stockCar',    order: 3, name: 'Stock Car',     icon: '🏁', desc: 'Ovale, contact, stratégie.', vehicleType: 'Stock Car',      hasEngine: false, defaultUnlocked: false, unlockCondition: 'Bientôt disponible',
    physicsProfile: 'oval', vehicleProfile: 'stockcar', economyProfile: 'standard' },
  superbike:   { id: 'superbike',   order: 4, name: 'Superbike',     icon: '🏍️', desc: 'Moto, prise de risque maximale.', vehicleType: 'Moto',        hasEngine: false, defaultUnlocked: false, unlockCondition: 'Bientôt disponible',
    physicsProfile: 'bike', vehicleProfile: 'superbike', economyProfile: 'standard' },
  speedster:   { id: 'speedster',   order: 5, name: 'Speedster',     icon: '⚡', desc: 'Vitesse extrême en ligne.', vehicleType: 'Prototype',        hasEngine: false, defaultUnlocked: false, unlockCondition: 'Bientôt disponible',
    physicsProfile: 'drag', vehicleProfile: 'speedster', economyProfile: 'standard' },
  monsterTruck:{ id: 'monsterTruck',order: 6, name: 'Monster Truck', icon: '🚛', desc: 'Franchissement, spectacle.', vehicleType: 'Monster Truck',     hasEngine: false, defaultUnlocked: false, unlockCondition: 'Bientôt disponible',
    physicsProfile: 'offroad-heavy', vehicleProfile: 'monstertruck', economyProfile: 'standard' },
};

export const TRACKS = {
  cote_sirenes: {
    id: 'cote_sirenes', name: 'Côte des Sirènes', icon: '🌊', theme: 'ocean',
    colors: { bg: '#062a4a', track: '#0d3f5f', accent: '#38bdf8' },
    waypoints: [[50,10],[80,15],[92,35],[85,55],[92,75],[70,90],[40,88],[15,70],[10,45],[25,20]],
  },
  ondine_city: {
    id: 'ondine_city', name: 'Ondine City', icon: '🌆', theme: 'city',
    colors: { bg: '#1a0a3a', track: '#2a1550', accent: '#c084fc' },
    waypoints: [[20,10],[80,10],[80,35],[55,35],[55,50],[85,50],[85,90],[15,90],[15,65],[40,65],[40,50],[15,50]],
  },
  foret_nocturne: {
    id: 'foret_nocturne', name: 'Forêt Nocturne', icon: '🌲', theme: 'forest',
    colors: { bg: '#0a1f14', track: '#123320', accent: '#34d399' },
    waypoints: [[50,8],[65,20],[60,35],[85,40],[80,60],[60,58],[65,80],[45,92],[30,75],[35,55],[15,50],[20,25]],
  },
  mont_blizzard: {
    id: 'mont_blizzard', name: 'Mont Blizzard', icon: '❄️', theme: 'snow',
    colors: { bg: '#0e2333', track: '#1c3d52', accent: '#e0f2fe' },
    waypoints: [[50,12],[75,25],[88,50],[75,75],[50,88],[25,75],[12,50],[25,25]],
  },
  volcan_violet: {
    id: 'volcan_violet', name: 'Volcan Violet', icon: '🌋', theme: 'volcano',
    colors: { bg: '#2a0a1a', track: '#4a1030', accent: '#f472b6' },
    waypoints: [[50,10],[70,18],[90,30],[78,42],[90,58],[75,72],[85,88],[55,85],[45,68],[25,75],[10,55],[30,45],[10,30],[30,15]],
  },
  // ═══ RALLYE — 3 tracés distincts, fusionnés dans TRACKS (préfixe
  // rally_) pour réutiliser tel quel computeTrackGeometry/trackPointAt
  // sans aucune modification du moteur de géométrie. rallyMeta porte
  // les données propres au contre-la-montre (difficulté, seuils de
  // récompense) — jamais lues par le moteur Course. ═══
  rally_forest: {
    id: 'rally_forest', name: 'Spéciale Forêt', icon: '🌲', theme: 'forest',
    colors: { bg: '#0a1f14', track: '#123320', accent: '#34d399' },
    waypoints: [[15,15],[35,12],[42,28],[30,35],[45,45],[60,32],[75,40],[70,58],[85,62],[80,80],[60,85],[45,70],[28,75],[20,55],[35,50],[18,38]],
    rallyMeta: { difficulty: 'Technique', desc: 'Virages serrés, parcours exigeant.', goldTime: 24, silverTime: 30, bronzeTime: 40 },
  },
  rally_mountain: {
    id: 'rally_mountain', name: 'Spéciale Montagne', icon: '⛰️', theme: 'snow',
    colors: { bg: '#0e2333', track: '#1c3d52', accent: '#e0f2fe' },
    waypoints: [[50,10],[78,22],[85,45],[65,55],[80,70],[55,88],[30,80],[20,60],[35,50],[15,35],[30,15]],
    rallyMeta: { difficulty: 'Moyen', desc: 'Grandes courbes, changements de direction.', goldTime: 21, silverTime: 27, bronzeTime: 35 },
  },
  rally_desert: {
    id: 'rally_desert', name: 'Spéciale Désert', icon: '🏜️', theme: 'volcano',
    colors: { bg: '#2a1a0a', track: '#4a3010', accent: '#fbbf24' },
    waypoints: [[10,50],[30,15],[60,20],[90,10],[92,40],[70,45],[85,75],[55,90],[30,80],[12,85]],
    rallyMeta: { difficulty: 'Rapide', desc: 'Longues portions, vitesse pure.', goldTime: 24, silverTime: 30, bronzeTime: 40 },
  },
};

// Liste explicite des circuits COURSE — indispensable maintenant que
// les circuits Rallye (rally_*) sont fusionnés dans le même objet
// TRACKS (pour réutiliser computeTrackGeometry/trackPointAt tel
// quel) : la progression de niveau qui débloque des circuits Course
// ne doit JAMAIS itérer sur Object.keys(TRACKS) directement, sous
// peine de débloquer un circuit Rallye par erreur.
export const COURSE_TRACK_IDS = ['cote_sirenes', 'ondine_city', 'foret_nocturne', 'mont_blizzard', 'volcan_violet'];
export const RALLY_TRACK_IDS = ['rally_forest', 'rally_mountain', 'rally_desert'];

export function dist(a, b) { return Math.hypot(b[0]-a[0], b[1]-a[1]); }
export function computeTrackGeometry(track) {
  const wp = track.waypoints;
  const n = wp.length;
  const segLengths = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = wp[i], b = wp[(i+1)%n];
    const d = dist(a, b);
    segLengths.push(d);
    total += d;
  }
  const speedMult = [];
  for (let i = 0; i < n; i++) {
    const prev = wp[(i-1+n)%n], cur = wp[i], next = wp[(i+1)%n];
    const v1 = [cur[0]-prev[0], cur[1]-prev[1]];
    const v2 = [next[0]-cur[0], next[1]-cur[1]];
    const a1 = Math.atan2(v1[1], v1[0]), a2 = Math.atan2(v2[1], v2[0]);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2*Math.PI - diff;
    const mult = Math.max(0.45, 1 - (diff / Math.PI) * 0.65);
    speedMult.push(mult);
  }
  const cumulative = [0];
  for (let i = 0; i < n; i++) cumulative.push(cumulative[i] + segLengths[i]);
  return { wp, n, segLengths, total, speedMult, cumulative };
}

const GEOMETRY_CACHE = {};
export function getGeometry(trackId) {
  if (!GEOMETRY_CACHE[trackId]) GEOMETRY_CACHE[trackId] = computeTrackGeometry(TRACKS[trackId]);
  return GEOMETRY_CACHE[trackId];
}

export function trackPointAt(trackId, progressAlongLap) {
  const geo = getGeometry(trackId);
  const p = ((progressAlongLap % geo.total) + geo.total) % geo.total;
  let segIdx = 0;
  while (segIdx < geo.n - 1 && geo.cumulative[segIdx+1] <= p) segIdx++;
  const segStart = geo.cumulative[segIdx];
  const segLen = geo.segLengths[segIdx] || 1;
  const t = (p - segStart) / segLen;
  const a = geo.wp[segIdx], b = geo.wp[(segIdx+1)%geo.n];
  const x = a[0] + (b[0]-a[0])*t, y = a[1] + (b[1]-a[1])*t;
  const angle = Math.atan2(b[1]-a[1], b[0]-a[0]) * 180/Math.PI;
  const m1 = geo.speedMult[segIdx], m2 = geo.speedMult[(segIdx+1)%geo.n];
  const speedMultiplier = m1 + (m2-m1)*t;
  return { x, y, angle, speedMultiplier };
}

// ═══════════════════════════════════════════════════════════════
// VOITURES — 4 voitures, vraies statistiques différentes.
// ═══════════════════════════════════════════════════════════════
export const CARS = {
  purple_rocket: { id:'purple_rocket', name:'Purple Rocket', icon:'💜', color:'#a855f7',
    baseSpeed:1.0, cornerGrip:0.55, accel:1.0, boostPower:1.55 },
  blue_flash: { id:'blue_flash', name:'Blue Flash', icon:'💙', color:'#38bdf8',
    baseSpeed:1.18, cornerGrip:0.30, accel:0.85, boostPower:1.5 },
  golden_bolt: { id:'golden_bolt', name:'Golden Bolt', icon:'💛', color:'#fbbf24',
    baseSpeed:0.95, cornerGrip:0.45, accel:1.35, boostPower:1.6 },
  red_beast: { id:'red_beast', name:'Red Beast', icon:'❤️', color:'#f87171',
    baseSpeed:0.92, cornerGrip:0.75, accel:0.9, boostPower:1.45 },
};

export const OPPONENT_NAMES = [
  { name: 'Turbo', icon: '🐆' }, { name: 'Flash', icon: '⚡' }, { name: 'Rocket', icon: '🚀' },
  { name: 'Mimi', icon: '🎀' }, { name: 'Rex', icon: '🦖' },
];

export const LAPS_PER_RACE = 3;
export const BOOST_MAX = 100, BOOST_COST = 100, BOOST_REGEN_PER_TICK = 1.1, BOOST_DURATION_TICKS = 22;
export const TICK_MS = 100;

export const STRATEGY = {
  attack:   { speedMult: 1.08, boostRegenMult: 0.8,  riskMult: 1.3 },
  balanced: { speedMult: 1.0,  boostRegenMult: 1.0,  riskMult: 1.0 },
  defense:  { speedMult: 0.94, boostRegenMult: 1.25, riskMult: 0.7 },
};

export function upgradeBonus(upgrades) {
  const u = upgrades || { engine:0, turbo:0, tires:0, boost:0 };
  return {
    speedBonus: 1 + u.engine*0.025,
    accelBonus: 1 + u.turbo*0.06,
    gripBonus: Math.min(0.95, (u.tires*0.08)),
    boostBonus: 1 + u.boost*0.08,
  };
}

// ═══════════════════════════════════════════════════════════════
// AMÉLIORATIONS — architecture générique, catégories Performance et
// Économie. Chaque définition suffit à calculer coût/bonus à
// n'importe quel niveau (pas de plafond artificiel comme l'ancien
// système à 3 paliers fixes) : cost(level) = baseCost * growth^level.
// Performance (engine/turbo/tires/boost) alimente upgradeBonus()
// ci-dessus, donc un achat modifie réellement tickRace() au tick
// suivant. Économie (marketing/sponsors) alimente le revenu passif,
// géré côté UI (n'a pas sa place dans la physique de course).
// ═══════════════════════════════════════════════════════════════
export const UPGRADES_DEF = {
  engine:    { name: 'Moteur',        icon: '🏎️', category: 'performance', baseCost: 20, growth: 1.15, bonusPerLevel: 2.5, unit: '%', desc: 'Vitesse de pointe' },
  turbo:     { name: 'Turbo',         icon: '⚡', category: 'performance', baseCost: 20, growth: 1.15, bonusPerLevel: 6,   unit: '%', desc: 'Accélération en sortie de virage' },
  tires:     { name: 'Pneus',         icon: '🛞', category: 'performance', baseCost: 20, growth: 1.15, bonusPerLevel: 8,   unit: '%', desc: 'Adhérence en virage' },
  boost:     { name: 'Boost',         icon: '💥', category: 'performance', baseCost: 25, growth: 1.18, bonusPerLevel: 8,   unit: '%', desc: 'Puissance du bouton BOOST manuel (pas l\u2019accélération)' },
  marketing: { name: 'Marketing',     icon: '📣', category: 'economie',    baseCost: 15, growth: 1.12, bonusPerLevel: 0.15, unit: '$/s', desc: 'Revenu passif' },
  sponsors:  { name: 'Sponsors',      icon: '🤝', category: 'economie',    baseCost: 35, growth: 1.14, bonusPerLevel: 0.30, unit: '$/s', desc: 'Revenu passif (sponsors majeurs)' },
};

/** Coût pour acheter le PROCHAIN niveau (passer de `level` à `level+1`). */
export function upgradeCost(type, level) {
  const def = UPGRADES_DEF[type];
  return Math.round(def.baseCost * Math.pow(def.growth, level));
}

/** Revenu passif total ($/s), calculé depuis les upgrades économie. */
export function computeRevenuePerSec(upgrades) {
  const u = upgrades || {};
  let total = 1; // revenu de base, cohérent avec l'affichage initial "$1/s" déjà présent dans le projet
  Object.keys(UPGRADES_DEF).forEach((type) => {
    const def = UPGRADES_DEF[type];
    if (def.category === 'economie') total += (u[type] || 0) * def.bonusPerLevel;
  });
  return Math.round(total * 100) / 100;
}

export function createCar(slotId, carDefId, name, icon, color, isPlayer, upgrades, strategyId) {
  return {
    slotId, carDef: carDefId, name, icon, color, isPlayer,
    upgrades: upgrades || { engine:0, turbo:0, tires:0, boost:0 },
    strategy: strategyId || 'balanced',
    progress: 0, lap: 1, finished: false, finishTick: null, finishRank: null,
    boostMeter: BOOST_MAX, boosting: 0, currentSpeed: 0,
    overtakes: 0, boostsUsed: 0,
  };
}

export function createRace(trackId, playerCarDefId, playerUpgrades, playerStrategy, rng = Math.random) {
  const geo = getGeometry(trackId);
  const opponentDefIds = Object.keys(CARS).filter(id => id !== playerCarDefId);
  const pool = [...opponentDefIds, ...Object.keys(CARS)];
  const cars = [createCar(0, playerCarDefId, 'Toi', CARS[playerCarDefId].icon, CARS[playerCarDefId].color, true, playerUpgrades, playerStrategy)];
  for (let i = 0; i < 5; i++) {
    const defId = pool[i % pool.length];
    const opp = OPPONENT_NAMES[i];
    cars.push(createCar(i+1, defId, opp.name, opp.icon, CARS[defId].color, false, null, 'balanced'));
  }
  return { trackId, totalLength: geo.total * LAPS_PER_RACE, lapLength: geo.total, laps: LAPS_PER_RACE, cars, tick: 0, over: false, startedAt: null };
}

// ═══════════════════════════════════════════════════════════════
// TICK — avance toutes les voitures d'un pas de temps. Chaque
// voiture (joueur ET IA) respecte EXACTEMENT les mêmes règles
// physiques ; seuls les paramètres (baseSpeed, décisions de boost)
// diffèrent. Aucune triche d'IA.
// ═══════════════════════════════════════════════════════════════
export function tryActivateBoost(car) {
  if (car.finished || car.boosting > 0 || car.boostMeter < BOOST_COST) return false;
  car.boostMeter -= BOOST_COST;
  car.boosting = BOOST_DURATION_TICKS;
  car.boostsUsed++;
  return true;
}

export function tickRace(race, boostRequests) {
  if (race.over) return race;
  const geo = getGeometry(race.trackId);
  const cars = race.cars.map(c => ({ ...c }));

  cars.forEach((car) => {
    if (car.finished) return;
    if (boostRequests && boostRequests.has(car.slotId)) tryActivateBoost(car);

    const carDef = CARS[car.carDef];
    const bonus = upgradeBonus(car.upgrades);
    const strat = STRATEGY[car.strategy] || STRATEGY.balanced;

    const progressInLap = car.progress % geo.total;
    const track = trackPointAt(race.trackId, progressInLap);
    const cornerPenalty = (1 - track.speedMultiplier) * (1 - carDef.cornerGrip) * (1 - bonus.gripBonus);
    // accelBonus (Turbo) : le moteur n'a pas de notion de vitesse qui
    // monte progressivement (calcul instantané à chaque tick, pas une
    // simulation d'inertie) — donc "accélération" est modélisée comme
    // la capacité à conserver plus de vitesse en sortant d'un virage
    // (où cornerPenalty est le plus fort). Réduit le malus de virage
    // proportionnellement à accelBonus, plutôt qu'un simple bonus
    // plat qui ferait doublon avec Moteur (speedBonus). BUG CORRIGÉ :
    // accelBonus était déjà calculé dans upgradeBonus() mais jamais
    // utilisé ici — le Turbo n'avait donc jusqu'ici aucun effet réel.
    const accelReduction = (bonus.accelBonus - 1); // ex: 0.06 pour turbo niveau 1
    let speed = carDef.baseSpeed * bonus.speedBonus * strat.speedMult * (1 - cornerPenalty * (1 - accelReduction));
    if (car.boosting > 0) {
      speed *= carDef.boostPower * bonus.boostBonus;
      car.boosting--;
    }
    car.currentSpeed = speed;
    car.progress += speed;

    car.boostMeter = Math.min(BOOST_MAX, car.boostMeter + BOOST_REGEN_PER_TICK * strat.boostRegenMult);

    const newLap = Math.floor(car.progress / geo.total) + 1;
    car.lap = Math.min(newLap, race.laps);

    if (car.progress >= race.totalLength && !car.finished) {
      car.finished = true;
      car.finishTick = race.tick;
      car.progress = race.totalLength;
    }
  });

  const finishedOrder = cars.filter(c => c.finished).sort((a,b) => a.finishTick - b.finishTick);
  const stillRacing = cars.filter(c => !c.finished).sort((a,b) => b.progress - a.progress);
  finishedOrder.forEach((c, i) => { c.finishRank = i + 1; });
  const ranked = [...finishedOrder, ...stillRacing];
  ranked.forEach((c, i) => {
    const newRank = i + 1;
    if (c.rank !== undefined && newRank < c.rank) c.overtakes = (c.overtakes || 0) + (c.rank - newRank);
    c.rank = newRank;
  });

  const allFinished = cars.every(c => c.finished);
  return { ...race, cars: ranked, tick: race.tick + 1, over: allFinished };
}

// ═══════════════════════════════════════════════════════════════
// RÉCOMPENSES — crédits/XP calculés à partir du classement final.
// ═══════════════════════════════════════════════════════════════
export const REWARD_TABLE = { 1: 150, 2: 110, 3: 85, 4: 60, 5: 40, 6: 25 };
export const XP_TABLE =     { 1: 80,  2: 60,  3: 45,  4: 30, 5: 20, 6: 10 };

// ═══════════════════════════════════════════════════════════════
// RALLYE — moteur contre-la-montre, séparé du moteur multi-voitures
// de Course mais réutilisant tout ce qui est générique : upgradeBonus,
// trackPointAt/getGeometry (mêmes TRACKS fusionnés), CARS, les
// constantes de boost. Différences volontaires : 1 seule voiture (pas
// d'IA, pas de classement), chronométré en TEMPS RÉEL (dtMs variable
// venant de requestAnimationFrame côté UI, pas un tick fixe), et un
// profil physique "spéciale" où les virages pénalisent davantage
// (RALLY_CORNER_WEIGHT), cohérent avec "davantage d'importance à
// l'adhérence" demandé.
// ═══════════════════════════════════════════════════════════════
export const RALLY_CORNER_WEIGHT = 1.4;

export function createRallyRun(trackId, carDefId, upgrades) {
  return {
    trackId, carDef: carDefId,
    upgrades: upgrades || { engine: 0, turbo: 0, tires: 0, boost: 0 },
    progress: 0, finished: false, elapsedMs: 0,
    boostMeter: BOOST_MAX, boosting: 0, currentSpeed: 0, boostsUsed: 0,
  };
}

/** Avance la simulation d'un pas de TEMPS RÉEL (dtMs, venant de
 *  requestAnimationFrame côté UI) — pas un tick fixe, pour que le
 *  chronomètre reste juste même si le framerate varie. Retourne un
 *  NOUVEL objet (immuable, même convention que tickRace). */
export function tickRallyRun(run, dtMs, boostRequested) {
  if (run.finished) return run;
  const r = { ...run };
  if (boostRequested) tryActivateRallyBoost(r);

  const carDef = CARS[r.carDef];
  const bonus = upgradeBonus(r.upgrades);
  const geo = getGeometry(r.trackId);
  const track = trackPointAt(r.trackId, r.progress);
  const accelReduction = (bonus.accelBonus - 1);
  const rawCornerPenalty = (1 - track.speedMultiplier) * (1 - carDef.cornerGrip) * (1 - bonus.gripBonus) * RALLY_CORNER_WEIGHT;
  const cornerPenalty = Math.min(0.92, rawCornerPenalty); // jamais figer complètement la voiture
  let speed = carDef.baseSpeed * bonus.speedBonus * (1 - cornerPenalty * (1 - accelReduction));
  if (r.boosting > 0) {
    speed *= carDef.boostPower * bonus.boostBonus;
    r.boosting = Math.max(0, r.boosting - dtMs);
  }
  r.currentSpeed = speed;
  // même échelle que le moteur Course (speed = unités/tick de TICK_MS),
  // converti proportionnellement au vrai temps écoulé.
  r.progress += speed * (dtMs / TICK_MS);
  r.elapsedMs += dtMs;
  r.boostMeter = Math.min(BOOST_MAX, r.boostMeter + (BOOST_REGEN_PER_TICK / TICK_MS) * dtMs);

  if (r.progress >= geo.total && !r.finished) {
    r.finished = true;
    r.progress = geo.total;
  }
  return r;
}

export function tryActivateRallyBoost(run) {
  if (run.boosting > 0 || run.boostMeter < BOOST_COST) return false;
  run.boostMeter -= BOOST_COST;
  run.boosting = BOOST_DURATION_TICKS * TICK_MS; // durée identique à Course, exprimée en ms
  run.boostsUsed = (run.boostsUsed || 0) + 1;
  return true;
}

/** Résultat bronze/argent/or selon les seuils définis DANS les
 *  données du parcours (rallyMeta), jamais codés en dur dans l'UI —
 *  cohérent avec l'exigence explicite. Récompense cohérente avec
 *  l'économie actuelle (échelle proche de REWARD_TABLE de Course). */
export function computeRallyResult(track, elapsedMs) {
  const seconds = elapsedMs / 1000;
  const meta = track.rallyMeta;
  let medal = null, credits = 20; // participation minimale
  if (seconds <= meta.goldTime) { medal = 'gold'; credits = 120; }
  else if (seconds <= meta.silverTime) { medal = 'silver'; credits = 70; }
  else if (seconds <= meta.bronzeTime) { medal = 'bronze'; credits = 40; }
  return { seconds, medal, credits };
}

export function computeRewards(playerCar, difficulty) {
  const diffMult = { easy: 0.8, normal: 1, hard: 1.3 }[difficulty] || 1;
  const rank = playerCar.finishRank || 6;
  const credits = Math.round(REWARD_TABLE[rank] * diffMult);
  const xp = Math.round(XP_TABLE[rank] * diffMult);
  return { credits, xp, rank };
}

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Première Victoire', desc: 'Terminer 1er une course', icon: '🏆' },
  { id: 'first_podium', name: 'Premier Podium', desc: 'Terminer dans le top 3', icon: '🥉' },
  { id: 'perfect_boost', name: 'Boost Parfait', desc: 'Utiliser le boost 5 fois dans une course', icon: '⚡' },
  { id: 'streak_3', name: '3 Victoires Consécutives', desc: 'Enchaîner 3 victoires', icon: '🔥' },
  { id: 'races_10', name: '10 Courses', desc: 'Terminer 10 courses', icon: '🏎️' },
  { id: 'champion', name: 'Champion', desc: 'Gagner sur les 5 circuits', icon: '👑' },
  { id: 'late_overtake', name: 'Dépassement de Dernière Seconde', desc: 'Dépasser un adversaire dans le dernier tour et gagner', icon: '💨' },
];
