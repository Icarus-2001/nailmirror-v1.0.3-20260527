const {
  buildTryonEnglishPrompt,
  buildTryonCloudFields,
  titlePatternHint
} = require('../../config/tryon-prompt');
const { resolveTryonFields } = require('../../services/adapters/tryon-cloud-adapter');

describe('tryon-prompt', () => {
  test('奶牛斑点：黑白灰+手绘+标题关键词', () => {
    const p = buildTryonEnglishPrompt({
      color: '黑白灰色系',
      design: '手绘',
      styleLabel: '日常百搭',
      title: '奶牛斑点'
    });
    expect(p).toMatch(/cow print/i);
    expect(p).toMatch(/black, pure white/i);
    expect(p).toMatch(/hand-painted/i);
    expect(p).not.toMatch(/雾霾蓝/);
  });

  test('titlePatternHint 识别奶牛', () => {
    expect(titlePatternHint('奶牛斑点')).toMatch(/cow print/i);
  });

  test('buildTryonCloudFields 甲型来自 shapeLabel', () => {
    const f = buildTryonCloudFields({
      id: 'real-5',
      title: '奶牛斑点',
      color: '黑白灰色系',
      design: '手绘',
      styleLabel: '日常百搭',
      shapeLabel: '短方圆',
      shapeTags: ['round']
    }, '');
    expect(f.shapePrompt).toBe('short-round');
    expect(f.color).toMatch(/black/i);
  });
});

describe('resolveTryonFields', () => {
  test('使用当前款式标签而非冻结 meta', () => {
    const r = resolveTryonFields({
      id: 'real-5',
      title: '奶牛斑点',
      color: '黑白灰色系',
      design: '手绘',
      styleLabel: '日常百搭',
      shapeLabel: '短方圆',
      shapeTags: ['round'],
      stylePrompt: 'legacy wrong'
    }, '');
    expect(r.stylePrompt).toMatch(/cow print/i);
    expect(r.shapePrompt).toBe('short-round');
  });
});
