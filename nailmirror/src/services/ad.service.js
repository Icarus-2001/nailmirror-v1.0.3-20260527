// AdService: 封装激励视频 / 插屏；Mock 模式下默认 completed=true
const logger = require('../utils/logger');
const { EVT_AD_REWARD_GRANTED } = require('../config/constants');
const eventBus = require('../utils/event-bus');
const featureFlags = require('../config/feature-flags');

let _rewardedAd = null;

function showRewardedAd() {
  return new Promise((resolve) => {
    if (!featureFlags.ENABLE_REWARDED_AD) {
      resolve({ completed: false, reason: 'disabled' });
      return;
    }
    // Mock 模式：开发工具无真实广告，模拟成功
    if (!wx.createRewardedVideoAd) {
      setTimeout(() => {
        eventBus.emit(EVT_AD_REWARD_GRANTED);
        resolve({ completed: true, mock: true });
      }, 600);
      return;
    }
    try {
      if (!_rewardedAd) {
        _rewardedAd = wx.createRewardedVideoAd({ adUnitId: 'adunit-mock-reward' });
      }
      const onClose = (res) => {
        _rewardedAd.offClose(onClose);
        if (res && res.isEnded) {
          eventBus.emit(EVT_AD_REWARD_GRANTED);
          resolve({ completed: true });
        } else {
          resolve({ completed: false });
        }
      };
      _rewardedAd.onClose(onClose);
      _rewardedAd.show().catch(() => {
        _rewardedAd.load().then(() => _rewardedAd.show()).catch((err) => {
          logger.warn('[ad] show fail', err);
          // 开发工具兜底
          eventBus.emit(EVT_AD_REWARD_GRANTED);
          resolve({ completed: true, mock: true });
        });
      });
    } catch (e) {
      logger.warn('[ad] exception', e);
      resolve({ completed: true, mock: true });
    }
  });
}

function showInterstitialAd() {
  return new Promise((resolve) => {
    if (!wx.createInterstitialAd) { resolve({ ok: false }); return; }
    try {
      const ad = wx.createInterstitialAd({ adUnitId: 'adunit-mock-interstitial' });
      ad.show().then(() => resolve({ ok: true })).catch(() => resolve({ ok: false }));
    } catch (e) {
      resolve({ ok: false });
    }
  });
}

module.exports = { showRewardedAd, showInterstitialAd };
