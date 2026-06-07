Page({
  data: {
    plans: [
      { name: '免费版', price: '0', features: ['热门搜索词 TOP20', '基础热款榜', '店铺信息'], current: true },
      { name: '基础版', price: '99/月', features: ['全部免费版功能', '高级经营数据', '经营数据看板'], current: false },
      { name: '专业版', price: '299/月', features: ['全部基础版功能', 'AI 客流量预测', '专属客户经理', '数据 API 接入'], current: false }
    ]
  },
  onUnlock(e) {
    const name = e.currentTarget.dataset.name;
    wx.showModal({ title: '解锁 ' + name, content: 'MVP 演示版，付费通道暂未开通。', showCancel: false });
  }
});
