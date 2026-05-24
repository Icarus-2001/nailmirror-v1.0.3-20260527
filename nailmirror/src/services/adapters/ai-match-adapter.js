// TODO: 真实服务接入点 — 替换此实现即可切换到生产环境
// AIMatchAdapter 接口：embed(imagePath)=>vector / search(vector)=>topK
// 生产实现：CLIP / DINOv2 推理云函数

const { mockDelay } = require('../../utils/request');
const allStyles = require('../../mock/styles');

class AIMatchAdapterInterface {
  async embed(/* imagePath */) { throw new Error('not implemented'); }
  async search(/* vector, topK */) { throw new Error('not implemented'); }
  async matchBySnapshot(/* imagePath */) { throw new Error('not implemented'); }
}

class MockVectorAdapter extends AIMatchAdapterInterface {
  async embed(imagePath) {
    return mockDelay(() => {
      // 用图片路径 hash 模拟 384 维向量
      let h = 0;
      for (let i = 0; i < (imagePath || '').length; i++) h = (h * 31 + imagePath.charCodeAt(i)) >>> 0;
      const vector = new Array(16).fill(0).map((_, i) => ((h >> (i % 16)) & 0xff) / 255);
      return vector;
    }, 800, 1200);
  }
  async search(vector, topK = 5) {
    return mockDelay(() => {
      const seed = (vector && vector[0]) || 0.5;
      const offset = Math.floor(seed * allStyles.length);
      const picked = [];
      for (let i = 0; i < topK; i++) {
        picked.push(allStyles[(offset + i * 7) % allStyles.length]);
      }
      const scores = picked.map((_, i) => +(0.95 - i * 0.06).toFixed(3));
      return { top: picked, scores };
    }, 1200, 1800);
  }
  async matchBySnapshot(imagePath) {
    const v = await this.embed(imagePath);
    const r = await this.search(v, 5);
    return { top5: r.top, scores: r.scores };
  }
}

module.exports = { AIMatchAdapterInterface, MockVectorAdapter, default: new MockVectorAdapter() };
