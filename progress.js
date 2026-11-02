(function (root) {
  'use strict';
  const boards = typeof module !== 'undefined' && module.exports ? require('./boards.js') : root.SlideBoards;
  const engine = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.SlideEngine;
  const rewards = typeof module !== 'undefined' && module.exports ? require('./rewards.js') : root.SlideRewards;
  const integer = value => Number.isInteger(value) && value >= 0;
  const knownIndex = id => boards.findIndex(board => board.id === id);
  const clampCount = value => Math.max(1, Math.min(boards.length, Number.isInteger(value) ? value : 1));
  function completionRecord(board, moves, prior, trustStars = true) {
    const bestMoves = Math.min(moves, integer(prior && prior.bestMoves) ? prior.bestMoves : moves);
    const record = {completed: true, lastMoves: moves, bestMoves};
    record.stars = rewards.recordStars(board.number, trustStars ? {...record, stars: prior && prior.stars} : record);
    return record;
  }
  function recordsFrom(value, trustStars) {
    const result = {};
    for (const board of boards) {
      const item = value && value[board.id];
      if (item && item.completed === true && integer(item.lastMoves)) result[board.id] = completionRecord(board, item.lastMoves, item, trustStars);
    }
    return result;
  }
  function unlockedFrom(records, floor) {
    let unlocked = clampCount(floor);
    const totalStars = rewards.totalStars(boards, records);
    while (unlocked < boards.length && records[boards[unlocked - 1].id]?.completed === true) {
      const required = rewards.gateRequirement(unlocked);
      if (required && totalStars < required) break;
      unlocked++;
    }
    return unlocked;
  }
  function archivesFrom(value) {
    if (!Array.isArray(value)) return [];
    const result = [];
    for (const item of value) {
      if (!item || item.completed !== true || knownIndex(item.boardId) < 0 || !integer(item.lastMoves) || !integer(item.boardSize) || item.boardSize < 2 || item.boardSize > 100) continue;
      const clean = {boardId: item.boardId, completed: true, lastMoves: item.lastMoves, boardSize: item.boardSize, definitionVersion: integer(item.definitionVersion) ? item.definitionVersion : 1};
      const key = JSON.stringify(clean);
      if (!result.some(prior => JSON.stringify(prior) === key)) result.push(clean);
    }
    return result;
  }
  function normalizeState(raw, legacy) {
    if (!raw || typeof raw !== 'object') return null;
    const current = boards.find(board => board.id === raw.boardId);
    if (!current) return null;
    const compatibleVersion = Number.isInteger(raw.definitionVersion) && raw.definitionVersion > 0 && raw.definitionVersion < current.definitionVersion &&
      Array.isArray(current.compatibleDefinitionVersions) && current.compatibleDefinitionVersions.includes(raw.definitionVersion);
    const archived = compatibleVersion && Array.isArray(current.compatibleDefinitions) && current.compatibleDefinitions.find(definition =>
      definition && definition.id === current.id && definition.definitionVersion === raw.definitionVersion);
    if (!legacy && raw.definitionVersion !== current.definitionVersion && !compatibleVersion) return null;
    const source = archived || current, compatible = Boolean(archived) || (!legacy && compatibleVersion);
    const size = source.size;
    if (!Array.isArray(source.rows) || source.rows.length !== size || !source.rows.every(row => typeof row === 'string' && row.length === size) || !Array.isArray(source.targets)) return null;
    if (!Array.isArray(raw.board) || raw.board.length !== size || !integer(raw.moves)) return null;
    if (!Array.isArray(raw.targets) || JSON.stringify(raw.targets) !== JSON.stringify(source.targets)) return null;
    const ids = new Map(), board = [];
    for (let r = 0; r < size; r++) {
      if (!Array.isArray(raw.board[r]) || raw.board[r].length !== size) return null;
      const row = [];
      for (let c = 0; c < size; c++) {
        const tile = raw.board[r][c];
        if (!tile || !/^t[1-9][0-9]*$/.test(tile.id) || typeof tile.letter !== 'string' || !/^[A-Z]$/.test(tile.letter) || typeof tile.locked !== 'boolean' || ids.has(tile.id)) return null;
        const clean = {id: tile.id, letter: tile.letter, locked: tile.locked};
        row.push(clean); ids.set(tile.id, {r, c, tile: clean});
      }
      board.push(row);
    }
    if (compatible) {
      for (let id = 1; id <= size * size; id++) if (!ids.has('t' + id)) return null;
      const letters = board.flat().map(tile => tile.letter).sort().join('');
      if (letters !== source.rows.join('').split('').sort().join('')) return null;
    }
    if (!Array.isArray(raw.found) || raw.found.length > source.targets.length) return null;
    const found = [], foundWords = new Set(), lockedIds = new Set();
    for (const item of raw.found) {
      if (!item || !source.targets.includes(item.word) || foundWords.has(item.word) || !Array.isArray(item.ids) || item.ids.length !== item.word.length || new Set(item.ids).size !== item.ids.length) return null;
      const positions = item.ids.map(id => ids.get(id));
      if (positions.some(position => !position || !position.tile.locked)) return null;
      const dr = positions[1].r - positions[0].r, dc = positions[1].c - positions[0].c;
      if (Math.abs(dr) + Math.abs(dc) !== 1 || positions.some((position, i) => position.r !== positions[0].r + dr * i || position.c !== positions[0].c + dc * i)) return null;
      if (positions.map(position => position.tile.letter).join('') !== item.word) return null;
      found.push({word: item.word, ids: [...item.ids]}); foundWords.add(item.word); item.ids.forEach(id => lockedIds.add(id));
    }
    if ([...ids.values()].some(position => position.tile.locked !== lockedIds.has(position.tile.id))) return null;
    const finished = found.length === source.targets.length;
    if (typeof raw.finished !== 'boolean' || raw.finished !== finished) return null;
    let lastAction = null;
    const action = raw.lastAction;
    if (action && action.type === 'shift' && ['row', 'column'].includes(action.axis) && integer(action.index) && action.index < size && [-1, 1].includes(action.direction))
      lastAction = {type: 'shift', axis: action.axis, index: action.index, direction: action.direction};
    else if (action && action.type === 'find' && source.targets.includes(action.word))
      lastAction = {type: 'find', word: action.word, lockedIds: Array.isArray(action.lockedIds) ? action.lockedIds.filter(id => lockedIds.has(id)) : []};
    return {
      boardId: source.id, definitionVersion: legacy && !archived ? current.definitionVersion : raw.definitionVersion, board, targets: [...source.targets], moves: raw.moves,
      found, finished, nextId: Math.max(...[...ids.keys()].map(id => Number(id.slice(1)))) + 1, lastAction
    };
  }
  function withHistory(raw, legacy) {
    const state = normalizeState(raw, legacy);
    if (!state) return null;
    state.history = [];
    if (Array.isArray(raw.history)) {
      for (const snapshot of raw.history.slice(-500)) {
        const clean = normalizeState(snapshot, legacy);
        if (!clean || clean.boardId !== state.boardId || clean.definitionVersion !== state.definitionVersion) return null;
        state.history.push(clean);
      }
    }
    return state;
  }
  function isUnlocked(progress, index) {
    const count = progress && progress.starPolicyVersion === 1 ? unlockedFrom(progress.records || {}, progress.grandfatheredUnlocked) : clampCount(progress && progress.unlocked);
    return Number.isInteger(index) && index >= 0 && index < boards.length && index < count;
  }
  function gateStatus(progress, nextLevelIndex) {
    if (!Number.isInteger(nextLevelIndex) || nextLevelIndex < 10 || nextLevelIndex >= boards.length || nextLevelIndex % 10 !== 0) return null;
    const records = progress && progress.records || {}, requiredStars = rewards.gateRequirement(nextLevelIndex);
    const totalStars = rewards.totalStars(boards, records), completedLevels = boards.slice(0, nextLevelIndex).filter(board => records[board.id]?.completed === true).length;
    return {requiredStars, totalStars, starsRemaining: Math.max(0, requiredStars - totalStars), completedLevels, requiredLevels: nextLevelIndex,
      levelsComplete: completedLevels === nextLevelIndex, grandfathered: nextLevelIndex < clampCount(progress && progress.grandfatheredUnlocked), unlocked: isUnlocked(progress, nextLevelIndex)};
  }
  function restore(payload) {
    const raw = payload && typeof payload === 'object' ? payload : {};
    const legacy = raw.schemaVersion !== 2 && raw.schema !== 2 && raw.version !== 2;
    const currentPolicy = raw.starPolicyVersion === 1, oldPolicy = !Object.prototype.hasOwnProperty.call(raw, 'starPolicyVersion');
    const records = recordsFrom(raw.records, currentPolicy), archive = archivesFrom(raw.archive);
    let grandfatheredUnlocked = clampCount(raw.grandfatheredUnlocked);
    if (oldPolicy) grandfatheredUnlocked = Math.max(grandfatheredUnlocked, clampCount(raw.unlocked));
    if (legacy && raw.best && typeof raw.best === 'object') {
      for (const board of boards) {
        const old = raw.best[board.id];
        if (!old || !(old.completed === true || Number(old.stars) > 0) || !integer(old.moves)) continue;
        if (oldPolicy) grandfatheredUnlocked = Math.max(grandfatheredUnlocked, Math.min(boards.length, knownIndex(board.id) + 2));
        // Only the middle puzzle kept the same eight-wide definition. Older
        // completions still preserve access, but changed boards need fresh finds.
        if (board.size === 8 && !records[board.id]) records[board.id] = completionRecord(board, old.moves, null);
        const entry = {boardId: board.id, completed: true, lastMoves: old.moves, boardSize: 8, definitionVersion: 1};
        if (!archive.some(item => JSON.stringify(item) === JSON.stringify(entry))) archive.push(entry);
      }
    }
    if (oldPolicy) for (let i = 0; i < boards.length; i++) if (records[boards[i].id]) grandfatheredUnlocked = Math.max(grandfatheredUnlocked, Math.min(boards.length, i + 2));
    let state = withHistory(raw.state, legacy), requested = state ? knownIndex(state.boardId) : knownIndex(raw.state && raw.state.boardId);
    if (oldPolicy && state) grandfatheredUnlocked = Math.max(grandfatheredUnlocked, Math.min(boards.length, requested + (state.finished ? 2 : 1)));
    let unlocked = unlockedFrom(records, grandfatheredUnlocked);
    if (requested < 0) requested = 0;
    if (requested >= unlocked) { requested = unlocked - 1; state = null; }
    if (!state) state = engine.createGame(boards[requested].id);
    // A valid completed saved state is also completion evidence, even if a write
    // was interrupted between saving that state and updating its level record.
    if (state.finished) {
      records[state.boardId] = completionRecord(boards[requested], state.moves, records[state.boardId]);
      unlocked = unlockedFrom(records, grandfatheredUnlocked);
    }
    return {schemaVersion: 2, starPolicyVersion: 1, grandfatheredUnlocked, state, sound: typeof raw.sound === 'boolean' ? raw.sound : false, records, unlocked, archive};
  }
  function record(progress, state) {
    const source = progress && typeof progress === 'object' ? progress : {};
    const base = restore({...source, schemaVersion: 2});
    const index = knownIndex(state && state.boardId);
    if (index < 0 || !isUnlocked(base, index)) return base;
    const clean = withHistory(state, false);
    if (!clean) return base;
    base.state = clean;
    if (clean.finished) {
      base.records[clean.boardId] = completionRecord(boards[index], clean.moves, base.records[clean.boardId]);
      base.unlocked = unlockedFrom(base.records, base.grandfatheredUnlocked);
    }
    return base;
  }
  const api = {restore, record, isUnlocked, gateStatus};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlideProgress = api;
})(typeof window !== 'undefined' ? window : globalThis);
