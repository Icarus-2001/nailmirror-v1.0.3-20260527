jest.mock('mobx-miniprogram', () => ({ observable: (o) => o, action: (fn) => fn }), { virtual: true });

describe('HistoryService', () => {
  let historyService;
  beforeEach(() => {
    jest.resetModules();
    historyService = require('../../services/history.service');
  });

  test('list 默认有种子', async () => {
    const list = await historyService.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  test('append 后 list 长度 +1', async () => {
    const before = await historyService.list();
    const r = await historyService.append({
      userOpenid: 'u', styleId: 'french-01', nailShape: 'almond', mode: 'ar',
      thumbUrl: 'x', hdUrl: 'y'
    });
    expect(r.ok).toBe(true);
    const after = await historyService.list();
    expect(after.length).toBe(before.length + 1);
  });

  test('reGenerate 返回 hdUrl', async () => {
    const list = await historyService.list();
    const id = list[0].id;
    const r = await historyService.reGenerate(id);
    expect(r.hdUrl).toMatch(/^https?:\/\//);
  });
});
