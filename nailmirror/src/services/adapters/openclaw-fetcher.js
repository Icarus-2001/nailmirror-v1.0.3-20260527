// TODO: 真实服务接入点 — 替换此实现即可切换到生产环境
// OpenClawFetcher 接口：fetchKeywords() / fetchRanking(city?) / fetchTrend(keyword)
// 生产实现：云函数 + 自建爬虫服务，每日 9/14/18 点定时触发

const { mockDelay } = require('../../utils/request');
const hotKeywords = require('../../mock/hot-keywords');
const hotRanking = require('../../mock/hot-ranking');

class OpenClawFetcherInterface {
  async fetchKeywords() { throw new Error('not implemented'); }
  async fetchRanking(/* city */) { throw new Error('not implemented'); }
  async fetchTrend(/* keyword */) { throw new Error('not implemented'); }
}

class MockOpenClawFetcher extends OpenClawFetcherInterface {
  async fetchKeywords() {
    return mockDelay(() => hotKeywords.slice(0, 20), 120, 180);
  }
  async fetchRanking(city) {
    return mockDelay(() => ({
      updatedAt: hotRanking.updatedAt,
      city: city || hotRanking.city,
      items: hotRanking.items.slice()
    }), 150, 200);
  }
  async fetchTrend(keyword) {
    return mockDelay(() => {
      // 模拟 7 天趋势
      const points = [];
      const base = 50000 + (keyword ? keyword.length * 3000 : 0);
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        points.push({
          date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
          heat: base + Math.floor(Math.sin(i) * 8000 + Math.random() * 5000)
        });
      }
      return { keyword, points };
    }, 180, 220);
  }
}

module.exports = { OpenClawFetcherInterface, MockOpenClawFetcher, default: new MockOpenClawFetcher() };
