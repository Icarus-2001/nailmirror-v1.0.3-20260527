jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

const aiMatchService = require('../../services/ai-match.service');

describe('AIMatchService', () => {
  test('matchBySnapshot 缺少图片报错', async () => {
    await expect(aiMatchService.matchBySnapshot('')).rejects.toMatchObject({ code: 'UPLOAD_ERR' });
  });

  test('matchBySnapshot 返回 5 条结果', async () => {
    const r = await aiMatchService.matchBySnapshot('/tmp/test.png');
    expect(r.top5.length).toBe(5);
    expect(r.scores.length).toBe(5);
  });
});
