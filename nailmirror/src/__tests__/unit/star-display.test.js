const { buildStarDisplay } = require('../../utils/star-display');

describe('utils/star-display', () => {
  test('buildStarDisplay returns null for invalid score', () => {
    expect(buildStarDisplay(-1)).toBeNull();
    expect(buildStarDisplay(NaN)).toBeNull();
    expect(buildStarDisplay(null)).toBeNull();
  });

  test('buildStarDisplay returns 5 empty stars for score 0', () => {
    const r = buildStarDisplay(0);
    expect(r).not.toBeNull();
    expect(r.scoreText).toBe('0.0');
    expect(r.stars).toHaveLength(5);
    expect(r.stars.every((s) => s.state === 'empty')).toBe(true);
  });

  test('buildStarDisplay renders full stars and score text', () => {
    const r = buildStarDisplay(5);
    expect(r.scoreText).toBe('5.0');
    expect(r.stars).toHaveLength(5);
    expect(r.stars.every((s) => s.state === 'full')).toBe(true);
  });

  test('buildStarDisplay supports half star', () => {
    const r = buildStarDisplay(4.5);
    expect(r.scoreText).toBe('4.5');
    expect(r.stars.filter((s) => s.state === 'full')).toHaveLength(4);
    expect(r.stars[4].state).toBe('half');
  });
});
