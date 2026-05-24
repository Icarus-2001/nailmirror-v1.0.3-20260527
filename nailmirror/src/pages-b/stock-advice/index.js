Page({
  data: {
    gels: [
      { name: '裸粉色甲油胶', spec: '15ml', qty: 5, brand: '推荐 A 牌' },
      { name: '法式珠光白', spec: '15ml', qty: 4, brand: '推荐 A 牌' },
      { name: '猫眼磁力黑', spec: '15ml', qty: 3, brand: '推荐 B 牌' },
      { name: '镜面银粉', spec: '8g', qty: 2, brand: '推荐 C 牌' },
      { name: '酒红磨砂', spec: '15ml', qty: 3, brand: '推荐 A 牌' }
    ],
    accessories: [
      { name: '水钻贴片', spec: '混合装 100 颗', qty: 2 },
      { name: '蝴蝶结金属饰', spec: '20 颗', qty: 1 },
      { name: '彩色亮片', spec: '6 色', qty: 2 },
      { name: '法式贴纸', spec: '50 片', qty: 3 }
    ]
  },
  onCopy() {
    const text = [
      '【NailMirror 备货建议】',
      '甲油胶：',
      ...this.data.gels.map((g) => `· ${g.name} ${g.spec} × ${g.qty}（${g.brand}）`),
      '饰品：',
      ...this.data.accessories.map((a) => `· ${a.name} ${a.spec} × ${a.qty}`)
    ].join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制清单' })
    });
  }
});
