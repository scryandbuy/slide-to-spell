(function (root) {
  'use strict';
  // Approved move thresholds for Levels 1–100; each pair is [three-star max, two-star max].
  // Scores use the completed attempt's visible counter, not shifts from prior restarts.
  const thresholdTable = Object.freeze([
    [5,8], [8,12], [5,9], [10,16], [8,14], [8,16], [10,17], [13,21], [10,17], [16,26],
    [14,24], [13,23], [13,23], [14,24], [14,25], [11,18], [11,20], [15,30], [14,24], [11,18],
    [14,24], [18,35], [11,18], [14,24], [18,35], [16,30], [23,40], [24,45], [22,40], [19,35],
    [21,40], [20,40], [26,45], [26,45], [23,40], [24,45], [25,45], [38,70], [23,40], [27,50],
    [18,35], [24,45], [21,40], [37,70], [25,45], [26,45], [19,35], [30,55], [31,55], [36,65],
    [24,40], [46,85], [25,40], [29,55], [24,40], [35,60], [29,55], [29,55], [29,50], [31,55],
    [24,45], [34,60], [26,45], [35,65], [25,40], [38,70], [28,50], [37,65], [37,65], [38,65],
    [42,70], [41,70], [37,60], [37,65], [39,65], [41,70], [36,60], [37,60], [34,60], [42,75],
    [26,45], [41,75], [25,40], [44,80], [26,45], [44,80], [26,45], [34,60], [45,80], [38,70],
    [23,40], [41,75], [26,45], [46,85], [28,45], [44,80], [26,45], [48,85], [36,60], [34,55]
  ].map(pair => Object.freeze({threeStarMax: pair[0], twoStarMax: pair[1]})));
  const gateRequirements = Object.freeze([20, 42, 64, 86, 108, 130, 152, 174, 196]);
  const validLevel = value => Number.isInteger(value) && value >= 1 && value <= thresholdTable.length;
  const validMoves = value => Number.isInteger(value) && value >= 0;
  function thresholds(levelNumber) {
    if (!validLevel(levelNumber)) return null;
    const value = thresholdTable[levelNumber - 1];
    return {threeStarMax: value.threeStarMax, twoStarMax: value.twoStarMax};
  }
  function starsForMoves(levelNumber, moves) {
    if (!validLevel(levelNumber) || !validMoves(moves)) return 0;
    const value = thresholdTable[levelNumber - 1];
    return moves <= value.threeStarMax ? 3 : moves <= value.twoStarMax ? 2 : 1;
  }
  function recordStars(levelNumber, record) {
    if (!validLevel(levelNumber) || !record || typeof record !== 'object' || Array.isArray(record) || record.completed !== true) return 0;
    const earned = Number.isInteger(record.stars) && record.stars >= 1 && record.stars <= 3 ? record.stars : 0;
    const counters = [record.bestMoves, record.lastMoves].filter(validMoves);
    const rated = counters.length ? starsForMoves(levelNumber, Math.min(...counters)) : 0;
    return Math.max(earned, rated);
  }
  function totalStars(boards, records) {
    if (!Array.isArray(boards) || !records || typeof records !== 'object') return 0;
    return boards.reduce((total, board) => {
      if (!board || typeof board.id !== 'string' || !Object.prototype.hasOwnProperty.call(records, board.id)) return total;
      return total + recordStars(board.number, records[board.id]);
    }, 0);
  }
  function gateRequirement(completedCount) {
    if (!Number.isInteger(completedCount) || completedCount < 10 || completedCount > 90 || completedCount % 10 !== 0) return 0;
    return gateRequirements[completedCount / 10 - 1];
  }
  const api = Object.freeze({thresholds, starsForMoves, recordStars, totalStars, gateRequirement, thresholdTable, policyVersion: 1});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlideRewards = api;
})(typeof window !== 'undefined' ? window : globalThis);
