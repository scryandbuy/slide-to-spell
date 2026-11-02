(function (root) {
  'use strict';

  let current = null;
  const SIZE = 16;
  const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function connected(run) {
    return run.dialog.isConnected !== false && run.card.isConnected !== false &&
      run.dialog.open !== false && run.dialog.contains(run.card) &&
      run.card.contains(run.stars) && run.card.contains(run.actions);
  }

  function live(run) { return current === run && connected(run); }

  function clean(run) {
    run.animations.splice(0).forEach(animation => { try { animation.cancel(); } catch (_) {} });
    run.nodes.splice(0).forEach(node => node.remove());
  }

  function resolve(run, value) {
    if (run.finished) return;
    run.finished = true;
    run.resolve(value);
  }

  function cancel() {
    const run = current;
    if (!run) return;
    current = null;
    clean(run);
    run.actions.inert = false;
    if (!run.ready) run.card.dataset.starReveal = 'cancelled';
    resolve(run, false);
  }

  function ready(run) {
    if (!live(run)) return false;
    run.card.classList.remove('is-revealing');
    run.card.classList.add('is-ready');
    run.card.dataset.starReveal = 'ready';
    run.actions.inert = false;
    if (!run.ready) {
      run.ready = true;
      // Presentation callbacks must not leave the result controls locked.
      if (typeof run.onReady === 'function') {
        try { run.onReady(); } catch (_) {}
      }
    }
    return live(run);
  }

  function complete(run) {
    if (current !== run) return;
    clean(run);
    current = null;
    resolve(run, true);
  }

  function settleRun(run) {
    if (current !== run) return;
    if (!connected(run)) { cancel(); return; }
    clean(run);
    if (ready(run)) complete(run);
  }

  function settle() { if (current) settleRun(current); }

  function watch(run, animation) {
    run.animations.push(animation);
    return Promise.resolve(animation.finished).catch(() => {});
  }

  function geometry(run, slots) {
    const dialog = run.dialog, doc = dialog.ownerDocument, view = doc.defaultView || root;
    const rect = dialog.getBoundingClientRect(), card = run.card.getBoundingClientRect();
    const sx = rect.width / number(dialog.offsetWidth, rect.width);
    const sy = rect.height / number(dialog.offsetHeight, rect.height);
    if (!(Number.isFinite(sx) && Number.isFinite(sy) && sx > 0 && sy > 0 && card.width > 0 && card.height > 0)) return null;
    let style = {};
    try { if (typeof view.getComputedStyle === 'function') style = view.getComputedStyle(dialog); } catch (_) {}
    const padding = side => Number.parseFloat(style['padding' + side]) || 0;
    const innerLeft = rect.left + number(dialog.clientLeft) * sx;
    const innerTop = rect.top + number(dialog.clientTop) * sy;
    const innerRight = innerLeft + number(dialog.clientWidth, rect.width / sx) * sx;
    const innerBottom = innerTop + number(dialog.clientHeight, rect.height / sy) * sy;
    const viewport = view.visualViewport;
    const visibleLeft = number(viewport?.offsetLeft), visibleTop = number(viewport?.offsetTop);
    const visibleRight = visibleLeft + number(viewport?.width, number(view.innerWidth, rect.right));
    const visibleBottom = visibleTop + number(viewport?.height, number(view.innerHeight, rect.bottom));
    const bounds = {
      left: Math.max(innerLeft + padding('Left') * sx, visibleLeft),
      top: Math.max(innerTop + padding('Top') * sy, visibleTop),
      right: Math.min(innerRight - padding('Right') * sx, visibleRight),
      bottom: Math.min(innerBottom - padding('Bottom') * sy, visibleBottom)
    };
    if (bounds.right - bounds.left < 64 * sx || bounds.bottom - bounds.top < 64 * sy) return null;
    const targets = slots.map(slot => slot.getBoundingClientRect());
    if (targets.some(to => !(to.width > 0 && to.height > 0) || to.left < bounds.left - 1 ||
      to.top < bounds.top - 1 || to.right > bounds.right + 1 || to.bottom > bounds.bottom + 1)) return null;
    return {
      sx, sy, card, bounds, targets,
      originX: innerLeft - number(dialog.scrollLeft) * sx,
      originY: innerTop - number(dialog.scrollTop) * sy
    };
  }

  function fly(run, slot, index, count, layout) {
    const {sx, sy, card, bounds, originX, originY} = layout, to = layout.targets[index];
    const svg = slot.querySelector('svg');
    if (!svg) throw new Error('Missing star artwork');
    const centerX = clamp((card.left + card.right) / 2 + (index - (count - 1) / 2) * 24 * sx,
      bounds.left + SIZE * sx / 2, bounds.right - SIZE * sx / 2);
    // Leave room for the initial downward bob, including scale and rotation.
    const top = clamp(card.bottom + 16 * sy, bounds.top, bounds.bottom - 52 * sy);
    const centerY = top + SIZE * sy / 2;
    const sprite = run.dialog.ownerDocument.createElement('div');
    sprite.className = 'star-flight';
    sprite.setAttribute('aria-hidden', 'true');
    sprite.style.position = 'absolute';
    sprite.style.pointerEvents = 'none';
    sprite.style.transformOrigin = 'center';
    sprite.style.width = SIZE + 'px';
    sprite.style.height = SIZE + 'px';
    sprite.style.left = (centerX - originX) / sx - SIZE / 2 + 'px';
    sprite.style.top = (centerY - originY) / sy - SIZE / 2 + 'px';
    sprite.appendChild(svg.cloneNode(true));
    run.dialog.appendChild(sprite);
    run.nodes.push(sprite);
    if (typeof sprite.animate !== 'function') throw new Error('Animation unavailable');

    const dx = (to.left + to.width / 2 - centerX) / sx;
    const dy = (to.top + to.height / 2 - centerY) / sy;
    const scale = to.width / (SIZE * sx), angle = -12 + index * 12;
    const radians = Math.abs(angle) * Math.PI / 180;
    const extent = SIZE * 1.3 * (Math.cos(radians) + Math.sin(radians)) / 2;
    const qx = (clamp(centerX + (-14 + index * 14) * sx, bounds.left + extent * sx,
      bounds.right - extent * sx) - centerX) / sx;
    const qy = (clamp(centerY + 25 * sy, bounds.top + extent * sy,
      bounds.bottom - extent * sy) - centerY) / sy;
    const halfX = to.width * 1.12 / 2, halfY = SIZE * scale * 1.12 * sy / 2;
    const ox = (clamp(to.left + to.width / 2, bounds.left + halfX, bounds.right - halfX) - centerX) / sx;
    const oy = (clamp(to.top + to.height / 2 - 14 * sy, bounds.top + halfY,
      bounds.bottom - halfY) - centerY) / sy;
    return watch(run, sprite.animate([
      {transform: 'translate(0,0) scale(1)'},
      {offset: .25, transform: `translate(${qx}px,${qy}px) scale(1.3) rotate(${angle}deg)`},
      {offset: .8, transform: `translate(${ox}px,${oy}px) scale(${scale * 1.12}) rotate(0deg)`},
      {transform: `translate(${dx}px,${dy}px) scale(${scale})`}
    ], {duration: 1050, delay: 180 + index * 210, easing: 'cubic-bezier(.22,.65,.28,1)', fill: 'both'}));
  }

  function landed(run) {
    if (current !== run) return;
    if (!connected(run)) { cancel(); return; }
    clean(run);
    if (!ready(run)) return;
    try {
      watch(run, run.stars.animate([
        {transform: 'scale(1.1)'}, {transform: 'scale(.97)'}, {transform: 'scale(1)'}
      ], {duration: 360, easing: 'ease-out'})).then(() => {
        if (live(run)) complete(run);
        else if (current === run) cancel();
      });
    } catch (_) { if (current === run) complete(run); }
  }

  // Resolves true after all motion (or immediate settle), false on cancellation.
  // onReady runs when the result becomes usable, before the final row bounce.
  function start(options = {}) {
    const {dialog, card, stars, actions, onReady} = options;
    if (!dialog || !card || !stars || !actions) return Promise.resolve(false);
    const run = {dialog, card, stars, actions, onReady, animations: [], nodes: [], ready: false, finished: false};
    // A late callback holding a removed card must not cancel a newer result.
    if (!connected(run)) return Promise.resolve(false);
    cancel();
    const promise = new Promise(resolve => { run.resolve = resolve; });
    current = run;
    card.classList.remove('is-ready');
    card.classList.add('is-revealing');
    card.dataset.starReveal = 'flying';
    actions.inert = true;
    const earned = clamp(Math.floor(Number(options.earned) || 0), 0, 3);
    let reduced = false;
    try { reduced = typeof options.reduced === 'function' ? options.reduced() : options.reduced === true; } catch (_) { reduced = true; }
    if (reduced || !earned || typeof stars.animate !== 'function') { settleRun(run); return promise; }
    try {
      const slots = Array.from(stars.querySelectorAll('.rating-star'));
      const layout = slots.length === 3 && geometry(run, slots);
      if (!layout) { settleRun(run); return promise; }
      Promise.all(slots.slice(0, earned).map((slot, i) => fly(run, slot, i, earned, layout)))
        .then(() => landed(run));
    } catch (_) { settleRun(run); }
    return promise;
  }

  const api = {start, cancel, settle};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlideStarReveal = api;
})(typeof window !== 'undefined' ? window : globalThis);
