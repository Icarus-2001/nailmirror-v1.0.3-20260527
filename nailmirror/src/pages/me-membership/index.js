Page({
  data: {
    benefits: [
      { icon: '📸', title: '无限高清出图', desc: '移除每日 2 张限制，畅享 2K 图' },
      { icon: '💧', title: '永久去水印', desc: '无需观看广告，一键去除水印' },
      { icon: '🎨', title: '专属款式包', desc: '每月更新会员专属设计师款' },
      { icon: '⚡', title: '优先试戴队列', desc: '云端推理优先，AR 更快' },
      { icon: '🏷️', title: '合作商家折扣', desc: '部分商家 9 折优惠（陆续上线）' }
    ]
  },
  onUnlock() {
    wx.showModal({ title: '付费解锁', content: 'MVP 演示版，付费通道暂未开通。', showCancel: false });
  }
});
