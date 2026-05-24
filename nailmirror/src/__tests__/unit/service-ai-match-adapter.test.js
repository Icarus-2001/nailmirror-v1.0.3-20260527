// C2 单测：services/adapters/ai-match-adapter.js + services/ai-match.service.js
// AIMatchAdapter 是壳，内部 MockVectorAdapter 提供 mock 实现；
// 同时覆盖 ai-match.service 的兜底分支。

describe('services/adapters/ai-match-adapter', () => {
  let adapterMod;

  beforeEach(() => {
    jest.resetModules();
    adapterMod = require('../../services/adapters/ai-match-adapter');
  });

  test('MockVectorAdapter.embed 返回向量数组（长度 16，元素 0~1）', async () => {
    const ad = new adapterMod.MockVectorAdapter();
    const v = await ad.embed('/tmp/photo.jpg');
    expect(Array.isArray(v)).toBe(true);
    expect(v).toHaveLength(16);
    v.forEach((x) => {
      expect(typeof x).toBe('number');
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    });
  });

  test('MockVectorAdapter.search 返回 topK 款式 + 递减 scores', async () => {
    const ad = new adapterMod.MockVectorAdapter();
    const r = await ad.search([0.5], 5);
    expect(r.top).toHaveLength(5);
    expect(r.scores).toHaveLength(5);
    for (let i = 1; i < r.scores.length; i++) {
      expect(r.scores[i - 1]).toBeGreaterThan(r.scores[i]);
    }
  });

  test('matchBySnapshot 串联 embed+search → 返回 top5', async () => {
    const ad = new adapterMod.MockVectorAdapter();
    const r = await ad.matchBySnapshot('/tmp/x.jpg');
    expect(r.top5).toHaveLength(5);
    expect(r.scores).toHaveLength(5);
    expect(r.top5[0]).toHaveProperty('id');
  });

  test('未实现接口默认抛 not implemented', async () => {
    const i = new adapterMod.AIMatchAdapterInterface();
    await expect(i.embed('x')).rejects.toThrow('not implemented');
    await expect(i.search([])).rejects.toThrow('not implemented');
    await expect(i.matchBySnapshot('x')).rejects.toThrow('not implemented');
  });
});

describe('services/ai-match.service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('未传 imagePath → 抛 UPLOAD_ERR', async () => {
    const svc = require('../../services/ai-match.service');
    await expect(svc.matchBySnapshot('')).rejects.toMatchObject({ code: 'UPLOAD_ERR' });
  });

  test('适配器返回空 top5 → 走兜底（heat 前 5），fallback=true', async () => {
    jest.doMock('../../services/adapters/ai-match-adapter', () => ({
      default: {
        matchBySnapshot: async () => ({ top5: [], scores: [] })
      }
    }));
    const svc = require('../../services/ai-match.service');
    const r = await svc.matchBySnapshot('/tmp/a.jpg');
    expect(r.fallback).toBe(true);
    expect(r.top5).toHaveLength(5);
    // 按 heat 降序
    for (let i = 1; i < r.top5.length; i++) {
      expect(r.top5[i - 1].heat).toBeGreaterThanOrEqual(r.top5[i].heat);
    }
  });

  test('适配器抛错 → 走 catch 兜底，fallback=true 且 reason=match-error', async () => {
    jest.doMock('../../services/adapters/ai-match-adapter', () => ({
      default: {
        matchBySnapshot: async () => {
          throw new Error('boom');
        }
      }
    }));
    const svc = require('../../services/ai-match.service');
    const r = await svc.matchBySnapshot('/tmp/a.jpg');
    expect(r.fallback).toBe(true);
    expect(r.reason).toBe('match-error');
    expect(r.top5).toHaveLength(5);
  });

  test('适配器正常返回非空 top5 → fallback=false 且原样透传', async () => {
    const fakeTop = [{ id: 'x1' }, { id: 'x2' }];
    const fakeScores = [0.9, 0.8];
    jest.doMock('../../services/adapters/ai-match-adapter', () => ({
      default: {
        matchBySnapshot: async () => ({ top5: fakeTop, scores: fakeScores })
      }
    }));
    const svc = require('../../services/ai-match.service');
    const r = await svc.matchBySnapshot('/tmp/a.jpg');
    expect(r.fallback).toBe(false);
    expect(r.top5).toEqual(fakeTop);
    expect(r.scores).toEqual(fakeScores);
  });
});
