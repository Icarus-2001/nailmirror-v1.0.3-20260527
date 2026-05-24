// TODO: 真实服务接入点 — 替换此实现即可切换到生产环境
// ARRenderer 接口：start(opts) => Promise<{sessionId, firstFrameUrl, fallback}>
//                  stop() / switchStyle(styleId)
// 生产实现（后续）：接入真实 WebGL 渲染管线 / TCB 云函数签发 sessionId

const { mockDelay } = require('../../utils/request');
const { getDeviceLevel } = require('../../utils/device');
const featureFlags = require('../../config/feature-flags');

class ARRendererInterface {
  async start(/* opts */) { throw new Error('not implemented'); }
  async stop() { throw new Error('not implemented'); }
  async switchStyle(/* styleId */) { throw new Error('not implemented'); }
}

class MockARRenderer extends ARRendererInterface {
  constructor() {
    super();
    this._sessionId = '';
    this._currentStyle = '';
  }
  /**
   * 模拟 AR 启动；低端机 / 强制降级 → fallback=true
   * @param {{styleId:string, shape:string}} opts
   */
  async start(opts) {
    return mockDelay(() => {
      const level = getDeviceLevel();
      const fallback = featureFlags.AR_FORCE_FALLBACK || level === 'low';
      this._sessionId = 'mock-ar-' + Date.now();
      this._currentStyle = opts.styleId;
      return {
        sessionId: this._sessionId,
        firstFrameUrl: 'https://picsum.photos/seed/' + opts.styleId + '-ar/800/1066',
        fallback
      };
    }, 1200, 1500);
  }
  async stop() {
    return mockDelay(() => { this._sessionId = ''; return { ok: true }; }, 80, 150);
  }
  async switchStyle(styleId) {
    return mockDelay(() => {
      this._currentStyle = styleId;
      return { ok: true, frameUrl: 'https://picsum.photos/seed/' + styleId + '-ar/800/1066' };
    }, 200, 350);
  }
}

module.exports = { ARRendererInterface, MockARRenderer, default: new MockARRenderer() };
