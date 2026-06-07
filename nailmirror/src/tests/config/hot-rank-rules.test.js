const { EXTERNAL_RANK_RULES, SITE_RANK_RULES, getRankRules } = require('../../config/hot-rank-rules');

describe('hot-rank-rules', () => {
  test('EXTERNAL_RANK_RULES has user-facing copy', () => {
    expect(EXTERNAL_RANK_RULES.title).toBe('站外榜单规则');
    expect(EXTERNAL_RANK_RULES.paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(EXTERNAL_RANK_RULES.paragraphs.join('')).toMatch(/互动热度/);
    expect(EXTERNAL_RANK_RULES.paragraphs.join('')).toMatch(/全网热款/);
  });

  test('SITE_RANK_RULES has user-facing copy', () => {
    expect(SITE_RANK_RULES.title).toBe('站内榜单规则');
    expect(SITE_RANK_RULES.paragraphs.length).toBeGreaterThanOrEqual(6);
    expect(SITE_RANK_RULES.paragraphs.join('')).toMatch(/10:00/);
    expect(SITE_RANK_RULES.paragraphs.join('')).toMatch(/30 天/);
    expect(SITE_RANK_RULES.paragraphs.join('')).toMatch(/试戴/);
  });

  test('getRankRules returns rules by tab', () => {
    expect(getRankRules('external')).toBe(EXTERNAL_RANK_RULES);
    expect(getRankRules('site')).toBe(SITE_RANK_RULES);
    expect(getRankRules('unknown')).toBe(EXTERNAL_RANK_RULES);
  });
});
