(function (root) {
  'use strict';
  const points = [[32, 8], [69, 17], [78, 28], [46, 39], [22, 48], [48, 59], [76, 69], [58, 80], [25, 88], [49, 96]];
  const count = value => Number.isInteger(value) && value > 0 ? value : 1;
  function levelPoint(localIndex) {
    const pair = points[((Number.isInteger(localIndex) ? localIndex : 0) % 10 + 10) % 10];
    return {x: pair[0], y: pair[1]};
  }
  function markerIndex(unlocked, total) {
    return Math.max(0, Math.min(count(total), count(unlocked)) - 1);
  }
  function advancement(beforeUnlocked, afterUnlocked, total) {
    const from = markerIndex(beforeUnlocked, total), to = markerIndex(afterUnlocked, total);
    return to > from ? {from, to} : null;
  }
  function worldFor(index, worlds) {
    return worlds[Math.max(0, Math.min(worlds.length - 1, Math.floor((Number.isInteger(index) ? index : 0) / 10)))];
  }
  function createModel(boards, worlds, progress) {
    const total = boards.length, source = progress || {}, records = source.records || {};
    const marker = markerIndex(source.unlocked, total);
    const requested = boards.findIndex(board => board.id === source.state?.boardId);
    const activeIndex = requested >= 0 ? requested : 0;
    const completed = boards.filter(board => records[board.id]?.completed === true).length;
    const areas = Array.from({length: Math.ceil(total / 10)}, (_, index) => {
      const startIndex = index * 10, endIndex = Math.min(total - 1, startIndex + 9);
      const world = worldFor(startIndex, worlds) || {id: 'area-' + (index + 1), name: 'Area ' + (index + 1), start: startIndex + 1, end: endIndex + 1};
      return {...world, index, startIndex, endIndex, nodes: boards.slice(startIndex, endIndex + 1).map((board, localIndex) => {
        const boardIndex = startIndex + localIndex;
        return {index: boardIndex, id: board.id, number: boardIndex + 1, name: board.name,
          available: boardIndex <= marker, completed: records[board.id]?.completed === true,
          current: boardIndex === marker, active: boardIndex === activeIndex, point: levelPoint(localIndex)};
      })};
    });
    const resumeIndex = source.state?.finished === true ? marker : activeIndex;
    return {total, completed, markerIndex: marker, activeIndex, resumeIndex,
      hasProgress: completed > 0 || marker > 0 || source.state?.history?.length > 0, areas};
  }
  const api = {levelPoint, markerIndex, advancement, worldFor, createModel};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlideJourney = api;
})(typeof window !== 'undefined' ? window : globalThis);
