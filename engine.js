(function (root) {
  'use strict';
  const boards = typeof module !== 'undefined' && module.exports ? require('./boards.js') : root.SlideBoards;
  const copy = value => JSON.parse(JSON.stringify(value));
  function snapshot(state) { const value = copy(state); delete value.history; return value; }
  function next(state) { const value = snapshot(state); value.history = [...(state.history || []), snapshot(state)]; return value; }
  function createGame(boardId) {
    const source = boards.find(board => board.id === boardId) || boards[0];
    let nextId = 1;
    return {
      boardId: source.id, board: source.rows.map(row => [...row].map(letter => ({id: 't' + nextId++, letter, locked: false}))),
      definitionVersion: source.definitionVersion,
      targets: [...source.targets], moves: 0, found: [], history: [],
      finished: false, nextId, lastAction: null
    };
  }
  function invalid(state, message) { return {state, ok: false, message}; }
  function shift(state, axis, index, direction) {
    if (state.finished) return invalid(state, 'Puzzle complete. Undo or restart to keep playing.');
    const size = state.board.length;
    if (!['row', 'column'].includes(axis) || ![-1, 1].includes(direction) || !Number.isInteger(index) || index < 0 || index >= size)
      return invalid(state, 'Choose a row or column and a direction.');
    const line = axis === 'row' ? state.board[index] : state.board.map(row => row[index]);
    const slots = line.map((tile, i) => !tile.locked ? i : -1).filter(i => i >= 0);
    if (slots.length < 2) return invalid(state, 'Those letters are locked in place.');
    const movable = slots.map(i => line[i]);
    if (movable.every(tile => tile.letter === movable[0].letter)) return invalid(state, 'That shift would leave the letters unchanged.');
    const result = next(state);
    slots.forEach((slot, i) => {
      const tile = copy(movable[(i - direction + slots.length) % slots.length]);
      if (axis === 'row') result.board[index][slot] = tile;
      else result.board[slot][index] = tile;
    });
    result.moves++;
    result.lastAction = {type: 'shift', axis, index, direction};
    return {state: result, ok: true, message: 'Shifted ' + axis + ' ' + (index + 1) + '. Locked letters stayed in place.'};
  }
  function availableWords(state) {
    const accepted = new Set(state.targets.filter(word => !state.found.some(item => item.word === word)));
    const words = [], seen = new Set(), size = state.board.length;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let word = '', ids = [];
        for (let n = 0; n < size; n++) {
          const rr = r + dr * n, cc = c + dc * n;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size || !state.board[rr][cc]) break;
          const tile = state.board[rr][cc]; word += tile.letter; ids.push(tile.id);
          if (n < 2 || !accepted.has(word)) continue;
          const key = word + ':' + [...ids].sort().join(',');
          if (!seen.has(key)) { words.push({word, ids: [...ids]}); seen.add(key); }
        }
      }
    }
    return words;
  }
  function resolveTarget(state, spelled) {
    if (typeof spelled !== 'string') return null;
    const forward = spelled.toUpperCase(), reversed = [...forward].reverse().join('');
    const candidates = [...new Set([forward, reversed])].filter(word => state.targets.includes(word));
    return candidates.find(word => !state.found.some(item => item.word === word)) || candidates[0] || null;
  }
  function submit(state, ids) {
    if (state.finished) return invalid(state, 'Puzzle complete. Undo or restart to keep playing.');
    if (!Array.isArray(ids) || ids.length < 3) return invalid(state, 'Choose a listed word in a straight line.');
    if (ids.length > state.board.length || new Set(ids).size !== ids.length) return invalid(state, 'Choose one straight word without reusing tiles.');
    const positions = new Map();
    state.board.forEach((row, r) => row.forEach((tile, c) => { if (tile) positions.set(tile.id, {r, c, tile}); }));
    const chosen = ids.map(id => positions.get(id));
    if (chosen.some(tile => !tile)) return invalid(state, 'Those letters have moved. Choose them again.');
    const dr = chosen[1].r - chosen[0].r, dc = chosen[1].c - chosen[0].c;
    if (Math.abs(dr) + Math.abs(dc) !== 1 || chosen.some((pos, i) => pos.r !== chosen[0].r + dr * i || pos.c !== chosen[0].c + dc * i))
      return invalid(state, 'Words must be a straight, unbroken line.');
    const spelled = chosen.map(pos => pos.tile.letter).join('');
    const word = resolveTarget(state, spelled);
    if (!word) return invalid(state, spelled + ' is not on this puzzle’s word list.');
    if (state.found.some(item => item.word === word)) return invalid(state, word + ' is already found.');
    const result = next(state);
    chosen.forEach(({r, c}) => { result.board[r][c].locked = true; });
    const canonicalIds = word === spelled ? [...ids] : [...ids].reverse();
    result.found.push({word, ids: canonicalIds});
    result.finished = result.found.length === result.targets.length;
    result.lastAction = {type: 'find', word, lockedIds: [...ids]};
    return {state: result, ok: true, message: word + ' found. Its letters are locked in place.', word};
  }
  function undo(state) {
    if (!state.history || !state.history.length) return state;
    const result = copy(state.history[state.history.length - 1]);
    result.history = state.history.slice(0, -1);
    return result;
  }
  function restart(state) { return createGame(state.boardId); }
  const api = {createGame, shift, submit, undo, restart, availableWords, resolveTarget};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlideEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
