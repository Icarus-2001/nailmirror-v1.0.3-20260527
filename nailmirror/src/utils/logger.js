// 分级日志
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let current = LEVELS.info;

function setLevel(l) { if (l in LEVELS) current = LEVELS[l]; }
function _log(level, tag, args) {
  if (LEVELS[level] < current) return;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](tag, ...args);
}

module.exports = {
  setLevel,
  debug: (...a) => _log('debug', '[D]', a),
  info:  (...a) => _log('info',  '[I]', a),
  warn:  (...a) => _log('warn',  '[W]', a),
  error: (...a) => _log('error', '[E]', a)
};
