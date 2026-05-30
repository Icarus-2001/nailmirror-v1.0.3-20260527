const { normalizeTag, COLOR_FAMILIES, buildDisplayTags } = require('../../config/tag-vocabulary');

describe('tag-vocabulary', () => {
  test('normalizeTag color 模糊匹配色系', () => {
    expect(normalizeTag('color', '偏红粉色')).toBe('红粉色系');
  });

  test('normalizeTag design 精确匹配', () => {
    expect(normalizeTag('design', '法式')).toBe('法式');
    expect(normalizeTag('design', '镶钻珍珠')).toBe('镶钻/珍珠');
  });

  test('buildDisplayTags 四元组', () => {
    expect(buildDisplayTags('红粉色系', '法式', '中长杏仁', '甜美少女')).toEqual([
      '红粉色系', '法式', '中长杏仁', '甜美少女'
    ]);
  });

  test('COLOR_FAMILIES 共 8 项', () => {
    expect(COLOR_FAMILIES).toHaveLength(8);
  });
});
