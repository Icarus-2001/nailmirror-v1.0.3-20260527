const COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444'];

function formatTick(val, metricKey) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0';
  if (metricKey === 'conversion') {
    return (n % 1 === 0 ? String(n) : n.toFixed(1)) + '%';
  }
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function getZeroAxisMax(metricKey) {
  if (metricKey === 'conversion') return 10;
  if (metricKey === 'heat') return 5;
  return 3;
}

Component({
  properties: {
    dates: { type: Array, value: [] },
    lines: { type: Array, value: [] },
    height: { type: Number, value: 360 },
    metricKey: { type: String, value: 'heat' },
  },

  lifetimes: {
    ready() {
      this._scheduleDraw();
    },
    detached() {
      if (this._drawTimer) clearTimeout(this._drawTimer);
    },
  },

  pageLifetimes: {
    show() {
      this._scheduleDraw(120);
    },
  },

  observers: {
    'dates, lines, metricKey': function () {
      this._scheduleDraw();
    },
  },

  methods: {
    redraw() {
      this._scheduleDraw(80);
    },

    _scheduleDraw(delayMs) {
      if (this._drawTimer) clearTimeout(this._drawTimer);
      const delay = typeof delayMs === 'number' ? delayMs : 80;
      this._drawTimer = setTimeout(() => {
        this._drawTimer = null;
        wx.nextTick(() => this._draw(0));
      }, delay);
    },

    _draw(retryCount) {
      const dates = this.data.dates || [];
      const lines = (this.data.lines || []).filter((l) => l && l.values && l.values.length);
      if (!dates.length || !lines.length) return;

      const metricKey = this.data.metricKey || 'heat';
      const query = this.createSelectorQuery().in(this);
      query.select('#lcCanvas').fields({ node: true, size: true }).exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) {
          if (retryCount < 8) {
            setTimeout(() => this._draw(retryCount + 1), 120);
          }
          return;
        }

        let width = res[0].width;
        let height = res[0].height;
        if (!width || !height) {
          if (retryCount < 8) {
            setTimeout(() => this._draw(retryCount + 1), 120);
          }
          return;
        }

        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = win.pixelRatio || 2;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const padL = 44;
        const padR = 12;
        const padT = 16;
        const padB = 36;
        const chartW = width - padL - padR;
        const chartH = height - padT - padB;

        let maxVal = 0;
        let rawMax = 0;
        lines.forEach((line) => {
          (line.values || []).forEach((v) => {
            const n = Number(v) || 0;
            rawMax = Math.max(rawMax, n);
            maxVal = Math.max(maxVal, n);
          });
        });
        const allZero = maxVal <= 0;
        if (allZero) maxVal = getZeroAxisMax(metricKey);
        else if (maxVal < 1) maxVal = 1;

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';

        for (let i = 0; i <= 4; i += 1) {
          const y = padT + (chartH / 4) * i;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(padL + chartW, y);
          ctx.stroke();

          const tickVal = maxVal * (1 - i / 4);
          ctx.fillText(formatTick(tickVal, metricKey), padL - 6, y + 4);
        }

        ctx.textAlign = 'left';
        dates.forEach((label, i) => {
          const x = padL + (chartW * i) / Math.max(dates.length - 1, 1);
          ctx.fillText(label, x - 14, height - 12);
        });

        lines.forEach((line, li) => {
          const color = line.color || COLORS[li % COLORS.length];
          const values = line.values || [];
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          values.forEach((val, i) => {
            const x = padL + (chartW * i) / Math.max(values.length - 1, 1);
            const n = Number(val) || 0;
            const y = padT + chartH - (n / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          values.forEach((val, i) => {
            const x = padL + (chartW * i) / Math.max(values.length - 1, 1);
            const n = Number(val) || 0;
            const y = padT + chartH - (n / maxVal) * chartH;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, allZero && n === 0 ? 2 : 3, 0, Math.PI * 2);
            ctx.fill();
          });
        });
      });
    },
  },
});
