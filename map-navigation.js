(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.SlideMapNavigation = api;
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => api.start(), {once: true});
    else api.start();
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const instances = new WeakMap();
  function start(options = {}) {
    const document = options.document || root.document;
    const map = options.map || document?.getElementById('map-screen');
    const scroll = options.scroll || document?.getElementById('map-scroll');
    if (!map || !scroll) return null;
    if (instances.has(map)) return instances.get(map);
    const doc = map.ownerDocument || document, view = doc.defaultView || root;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'map-current-level';
    button.hidden = true;
    button.setAttribute('aria-controls', scroll.id || 'map-scroll');
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 14 6-6 6 6M6 20l6-6 6 6"/></svg><span>Current Level</span>';
    map.append(button);
    let frame = null, destroyed = false, observedNode = null;
    const current = () => map.querySelector('.map-node.current');
    const paneBounds = () => {
      const rect = scroll.getBoundingClientRect(), top = rect.top + (scroll.clientTop || 0), left = rect.left + (scroll.clientLeft || 0);
      return {top, left, bottom: top + scroll.clientHeight, right: left + scroll.clientWidth};
    };
    const mapVisible = () => map.isConnected && !map.hidden && map.getAttribute('aria-hidden') !== 'true' &&
      (!doc.body?.dataset.screen || doc.body.dataset.screen === 'map') && scroll.clientWidth > 0 && scroll.clientHeight >= 64;
    const resize = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(schedule) : null;
    function update() {
      if (destroyed) return;
      const node = current();
      if (resize && node !== observedNode) {
        if (observedNode) resize.unobserve(observedNode);
        observedNode = node;
        if (node) resize.observe(node);
      }
      if (!mapVisible() || !node || !node.isConnected) { button.hidden = true; return; }
      const pane = paneBounds(), rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) { button.hidden = true; return; }
      const visible = rect.top >= pane.top && rect.bottom <= pane.bottom && rect.left >= pane.left && rect.right <= pane.right;
      button.hidden = visible;
      button.dataset.direction = rect.top + rect.height / 2 < (pane.top + pane.bottom) / 2 ? 'above' : 'below';
      const index = Number(node.dataset.levelIndex);
      const number = Number.isInteger(index) && index >= 0 ? String(index + 1) : node.querySelector('.node-number')?.textContent.trim();
      button.title = number ? 'Return To Level ' + number : 'Return To Current Level';
    }
    function schedule() {
      if (destroyed || frame !== null) return;
      frame = view.requestAnimationFrame(() => { frame = null; update(); });
    }
    function returnToCurrent() {
      const node = current();
      if (!mapVisible() || !node || !node.isConnected) { schedule(); return; }
      const pane = paneBounds(), rect = node.getBoundingClientRect();
      const top = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, scroll.scrollTop + rect.top + rect.height / 2 - (pane.top + pane.bottom) / 2));
      const reduced = doc.documentElement.classList.contains('reduce-motion') || doc.body?.dataset.motion === 'reduced' ||
        view.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      const previousBehavior = scroll.style.scrollBehavior;
      if (reduced) scroll.style.scrollBehavior = 'auto';
      // Focus the existing node without activating its level-preview click handler.
      node.focus({preventScroll: true});
      scroll.scrollTo({top, left: scroll.scrollLeft, behavior: reduced ? 'auto' : 'smooth'});
      if (reduced) scroll.style.scrollBehavior = previousBehavior;
      schedule();
    }
    const changed = records => {
      if (records.some(record => record.target !== button && !button.contains(record.target))) schedule();
    };
    const mutation = typeof view.MutationObserver === 'function' ? new view.MutationObserver(changed) : null;
    mutation?.observe(map, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden', 'style']});
    if (doc.body) mutation?.observe(doc.body, {attributes: true, attributeFilter: ['data-screen', 'class', 'hidden']});
    resize?.observe(map);
    resize?.observe(scroll);
    const journey = map.querySelector('.map-journey');
    if (journey) resize?.observe(journey);
    button.addEventListener('click', returnToCurrent);
    scroll.addEventListener('scroll', schedule, {passive: true});
    view.addEventListener('resize', schedule, {passive: true});
    view.visualViewport?.addEventListener('resize', schedule, {passive: true});
    const api = {
      button, update,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (frame !== null) view.cancelAnimationFrame(frame);
        mutation?.disconnect(); resize?.disconnect();
        button.removeEventListener('click', returnToCurrent);
        scroll.removeEventListener('scroll', schedule);
        view.removeEventListener('resize', schedule);
        view.visualViewport?.removeEventListener('resize', schedule);
        button.remove(); instances.delete(map);
      }
    };
    instances.set(map, api);
    schedule();
    return api;
  }
  return {start};
});
