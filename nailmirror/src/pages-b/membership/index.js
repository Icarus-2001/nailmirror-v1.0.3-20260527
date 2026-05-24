Page({
  data: {
    plans: [
      { name: '免费版', price: '0', features: ['热门搜索词 TOP20', '基础热款榜', '轻预约配置'], current: true },
      { name: '基础版', price: '99/月', features: ['全部免费版功能', '完整进货清单', '本城热款榜', '热度趋势分析'], current: false },
      { name: '专业版', price: '299/月', features: ['全部基础版功能', 'AI 客流量预测', '专属客户经理', '数据 API 接入'], current: false }
    ]
  },
  onUnlock(e) {
    const name = e.currentTarget.dataset.name;
    wx.showModal({ title: '解锁 ' + name, content: 'MVP 演示版，付费通道暂未开通。', showCancel: false });
  }
});
