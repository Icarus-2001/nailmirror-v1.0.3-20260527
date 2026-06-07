const mockSnapshotGet = jest.fn();

jest.mock('wx-server-sdk', () => ({
  database: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: mockSnapshotGet,
      })),
    })),
  })),
}), { virtual: true });

const { buildMerchantDashboardAdvicePrompt } = require('../../cloudfunctions/ops/utils/llm');
const { getMerchantDashboardAdvice, ADVICE_MISSING_MSG } = require('../../cloudfunctions/ops/handlers/getMerchantDashboardAdvice');
const { formatSnapshotDate, getDashboardAsOfMs } = require('../../cloudfunctions/ops/utils/styleHeat');

describe('merchant dashboard AI advice', () => {
  beforeEach(() => {
    mockSnapshotGet.mockReset();
  });

  test('buildMerchantDashboardAdvicePrompt includes dataHealth and trends', () => {
    const prompt = buildMerchantDashboardAdvicePrompt({
      snapshotDate: '2026-06-06',
      dataHealth: {
        merchantStyleCount: 5,
        events7d: 42,
        tryOn7d: 18,
        favorites7d: 6,
      },
      styles: [
        { title: '幻彩魔镜甲', heatNow: 88, wowHeat: 35 },
        { title: '绿意渐变', heatNow: 55, wowHeat: 20 },
      ],
      trends: {
        hot: [{ title: '幻彩魔镜甲', heatNow: 88, wowHeat: 35, zeroTryon: false }],
        cold: [{ title: '花漾美甲', heatNow: 2, wowHeat: -10, zeroTryon: true }],
      },
      tagAnalysis: {
        color: [{ tag: '金属色系', styleCount: 2 }],
        style: [{ tag: '日常百搭', styleCount: 3 }],
        design: [{ tag: '渐变', styleCount: 1 }],
      },
    }, { storeName: '测试门店' });

    expect(prompt).toMatch(/资深的商业分析专家和美甲行业专家/);
    expect(prompt).toMatch(/商详浏览：42/);
    expect(prompt).toMatch(/试戴完成：18/);
    expect(prompt).toMatch(/幻彩魔镜甲/);
    expect(prompt).toMatch(/花漾美甲/);
    expect(prompt).toMatch(/金属色系/);
    expect(prompt).toMatch(/经营概况/);
    expect(prompt).toMatch(/测试门店/);
  });

  test('getMerchantDashboardAdvice returns cached advice for T-1 date', async () => {
    const expectedDate = formatSnapshotDate(getDashboardAsOfMs(Date.now()));
    mockSnapshotGet.mockResolvedValueOnce({
      data: {
        ai_advice: {
          snapshot_date: expectedDate,
          content: '## 经营概况\n测试建议内容',
          model: 'moonshot-v1-8k',
        },
      },
    });

    const res = await getMerchantDashboardAdvice({ openid: 'oid-1' });
    expect(res.ok).toBe(true);
    expect(res.content).toMatch(/经营概况/);
    expect(res.snapshotDate).toBe(expectedDate);
  });

  test('getMerchantDashboardAdvice returns error when cache missing', async () => {
    mockSnapshotGet.mockRejectedValueOnce(new Error('not found'));

    const res = await getMerchantDashboardAdvice({ openid: 'oid-2' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe(ADVICE_MISSING_MSG);
  });

  test('getMerchantDashboardAdvice rejects missing openid', async () => {
    const res = await getMerchantDashboardAdvice({});
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/登录/);
  });
});
