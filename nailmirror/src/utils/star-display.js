/**
 * 将 1.0–5.0 评分格式化为美团式五星展示数据
 * @param {number} score
 * @returns {{ scoreText: string, stars: Array<{ state: 'full'|'half'|'empty' }> }|null}
 */
function buildStarDisplay(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0) return null;
  const clamped = Math.max(0, Math.min(5, n));
  const stars = [1, 2, 3, 4, 5].map((index) => {
    let state = 'empty';
    if (clamped >= index) state = 'full';
    else if (clamped >= index - 0.5) state = 'half';
    return { state };
  });
  return {
    scoreText: clamped.toFixed(1),
    stars,
  };
}

module.exports = { buildStarDisplay };
