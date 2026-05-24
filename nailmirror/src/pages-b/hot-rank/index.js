const hotDataService = require('../../services/hot-data.service');

Page({
  data: {
    word: '',
    points: [],
    keywords: []
  },
  async onLoad(query) {
    const word = decodeURIComponent(query.word || '法式极简');
    this.setData({ word });
    try {
      const [trend, kws] = await Promise.all([
        hotDataService.fetchTrend(word),
        hotDataService.fetchTop20()
      ]);
      this.setData({ points: trend.points, keywords: kws.slice(0, 10) });
      this._drawTrend(trend.points);
    } catch (e) {}
  },
  _drawTrend(points) {
    if (!points || !points.length) return;
    const ctx = wx.createCanvasContext('trend-canvas', this);
    const W = 686, H = 300, PAD = 30;
    const heats = points.map((p) => p.heat);
    const max = Math.max(...heats), min = Math.min(...heats);
    const span = max - min || 1;
    const xs = (W - PAD * 2) / (points.length - 1 || 1);
    ctx.setStrokeStyle('#ff5e8a');
    ctx.setLineWidth(2);
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = PAD + i * xs;
      const y = H - PAD - ((p.heat - min) / span) * (H - PAD * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setFillStyle('#999');
    ctx.setFontSize(10);
    points.forEach((p, i) => {
      const x = PAD + i * xs;
      ctx.fillText(p.date.slice(5), x - 14, H - 8);
    });
    ctx.draw();
  },
  onPickWord(e) {
    const w = e.currentTarget.dataset.word;
    wx.redirectTo({ url: '/pages-b/hot-rank/index?word=' + encodeURIComponent(w) });
  }
});
