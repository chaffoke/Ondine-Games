// ═══════════════════════════════════════════════════════════════
// games/bataille-navale/ui.js
// ═══════════════════════════════════════════════════════════════
import { SIZE, FLEET, createEmptyBoard, placeShip, autoPlaceFleet, fireShot, allShipsSunk, ACHIEVEMENTS } from './logic.js';
import { createAIState, playAIShot } from './ai.js';

export function createUI(sdk) {
  let playerBoard, enemyBoard, aiState, difficulty = 'normal';
  let phase = 'placement'; // placement | battle | over
  let placementIdx = 0;
  let orientation = 'h';
  let turn = 'player';
  let shotsFired = 0, missesCount = 0;
  let firstShotSinks = 0;
  let winner = null;

  function setDifficulty(d) {
    difficulty = d;
    ['Easy', 'Normal', 'Hard'].forEach((k) => document.getElementById('diff' + k)?.classList.toggle('sel', k.toLowerCase() === d || (k === 'Hard' && d === 'difficile')));
  }

  function startGame() {
    playerBoard = createEmptyBoard();
    enemyBoard = createEmptyBoard();
    autoPlaceFleet(enemyBoard);
    aiState = createAIState();
    phase = 'placement';
    placementIdx = 0; orientation = 'h';
    turn = 'player'; shotsFired = 0; missesCount = 0; firstShotSinks = 0; winner = null;
    sdk.navigation.go('splace');
    renderPlacement();
  }

  function toggleOrientation() { orientation = orientation === 'h' ? 'v' : 'h'; renderPlacement(); }

  function onPlacementCellClick(cellIdx) {
    if (placementIdx >= FLEET.length) return;
    const ok = placeShip(playerBoard, FLEET[placementIdx], cellIdx, orientation);
    if (!ok) { sdk.audio.play('error'); sdk.toast.show('Placement invalide ici'); return; }
    sdk.audio.play('click');
    placementIdx++;
    if (placementIdx >= FLEET.length) startBattle();
    else renderPlacement();
  }

  function autoPlacePlayer() {
    playerBoard = createEmptyBoard();
    autoPlaceFleet(playerBoard);
    placementIdx = FLEET.length;
    sdk.audio.play('success');
    startBattle();
  }

  function startBattle() {
    phase = 'battle';
    sdk.navigation.go('sg');
    render();
  }

  function onEnemyCellClick(cellIdx) {
    if (phase !== 'battle' || turn !== 'player') return;
    if (enemyBoard.shots[cellIdx] !== null) return;
    const result = fireShot(enemyBoard, cellIdx);
    shotsFired++;
    if (result.result === 'miss') { missesCount++; sdk.audio.play('error'); render(); setTimeout(aiTurn, 500); return; }
    // touché : rejoue
    sdk.audio.play('success');
    if (result.sunkShip) {
      if (result.sunkShip.cells.length === 1 || (result.sunkShip.hitCells && result.sunkShip.hitCells.size === 1)) firstShotSinks++;
      sdk.toast.show(`💥 ${result.sunkShip.name} coulé !`);
      sdk.audio.play('win');
    }
    render();
    if (allShipsSunk(enemyBoard)) { endGame('player'); return; }
    // rejoue automatiquement (tour toujours au joueur)
  }

  function aiTurn() {
    if (phase !== 'battle') return;
    turn = 'ai';
    render();
    setTimeout(() => {
      const result = playAIShot(playerBoard, aiState, difficulty);
      render();
      if (allShipsSunk(playerBoard)) { endGame('ai'); return; }
      if (result.result === 'hit') { setTimeout(aiTurn, 600); } // l'IA rejoue aussi si elle touche
      else { turn = 'player'; render(); }
    }, 500);
  }

  function endGame(who) {
    phase = 'over'; winner = who;
    sdk.stats.increment('games');
    if (who === 'player') {
      sdk.stats.increment('wins');
      sdk.achievements.unlock('first_win', 'Première Victoire', '🎯');
      if (missesCount === 0) sdk.achievements.unlock('no_miss', 'Tir Parfait', '🎯');
      if (firstShotSinks > 0) sdk.achievements.unlock('first_shot_sink', 'Coup de Chance', '🍀');
      if (difficulty === 'difficile') sdk.achievements.unlock('beat_hard', 'Amiral', '⭐');
      sdk.audio.play('win');
    } else {
      sdk.stats.increment('losses');
      sdk.audio.play('lose');
    }
    render();
  }

  function goHome() { renderHome(); sdk.navigation.go('sh'); }

  // ── Rendu ──
  function renderPlacement() {
    const host = document.getElementById('placeGrid');
    host.innerHTML = '';
    for (let i = 0; i < SIZE * SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'navcell' + (playerBoard.cellShip[i] !== null ? ' ship' : '');
      el.onclick = () => onPlacementCellClick(i);
      host.appendChild(el);
    }
    const current = FLEET[placementIdx];
    document.getElementById('placeLabel').textContent = current ? `Place : ${current.name} (${current.size} cases) — ${orientation === 'h' ? 'Horizontal' : 'Vertical'}` : 'Flotte placée !';
  }

  function renderBoard(hostId, board, clickable) {
    const host = document.getElementById(hostId);
    host.innerHTML = '';
    for (let i = 0; i < SIZE * SIZE; i++) {
      const el = document.createElement('div');
      const shot = board.shots[i];
      const showShip = !clickable && board.cellShip[i] !== null; // grille du joueur : montre ses propres navires
      el.className = 'navcell' + (showShip ? ' ship' : '') + (shot === 'hit' ? ' hit' : '') + (shot === 'miss' ? ' miss' : '');
      if (clickable) el.onclick = () => onEnemyCellClick(i);
      host.appendChild(el);
    }
  }

  function render() {
    renderBoard('enemyGrid', enemyBoard, phase === 'battle' && turn === 'player');
    renderBoard('myGrid', playerBoard, false);
    document.getElementById('turnLabel').textContent =
      phase === 'over' ? (winner === 'player' ? '🏆 Victoire !' : '💀 Défaite...') :
      turn === 'player' ? 'À toi de tirer' : "L'IA tire…";
    document.getElementById('shotsCount').textContent = `${shotsFired} tirs`;
    document.getElementById('overBanner').style.display = phase === 'over' ? '' : 'none';
  }

  function renderHome() {
    const host = document.getElementById('homeStatsNav');
    host.innerHTML = '';
    [{ v: sdk.stats.get('games'), l: '🎮 Parties' }, { v: sdk.stats.get('wins'), l: '🏆 Victoires' }]
      .forEach((s) => { const el = document.createElement('div'); el.className = 'statCard'; el.style.flex = '1';
        el.innerHTML = `<div class="v">${s.v}</div><div class="l">${s.l}</div>`; host.appendChild(el); });
  }

  function renderAchievements() {
    const list = document.getElementById('achListNav');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = sdk.achievements.isUnlocked(a.id);
      const el = document.createElement('div');
      el.className = 'achCard' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `<div class="ic">${a.icon}</div><div><div class="name">${a.name}</div><div class="desc">${a.desc}</div></div>`;
      list.appendChild(el);
    });
  }
  function showStats() { renderAchievements(); sdk.navigation.go('sstats'); }

  return { setDifficulty, startGame, toggleOrientation, autoPlacePlayer, goHome, showStats, renderHome };
}
