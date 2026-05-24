// 全局事件总线
const handlers = {};

function on(evt, fn) {
  if (!handlers[evt]) handlers[evt] = [];
  handlers[evt].push(fn);
  return () => off(evt, fn);
}
function off(evt, fn) {
  if (!handlers[evt]) return;
  handlers[evt] = handlers[evt].filter((h) => h !== fn);
}
function once(evt, fn) {
  const wrap = (...args) => { off(evt, wrap); fn(...args); };
  on(evt, wrap);
}
function emit(evt, ...args) {
  if (!handlers[evt]) return;
  handlers[evt].slice().forEach((h) => {
    try { h(...args); } catch (e) { /* swallow */ }
  });
}

module.exports = { on, off, once, emit };
