const COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444'];

Component({
  properties: {
    dates: { type: Array, value: [] },
    lines: { type: Array, value: [] },
    height: { type: Number, value: 360 },
  },

  observers: {
    'dates, lines': function () {
      this._draw();
    },
  },

  lifetimes: {
    ready() {
      this._draw();
    },
  },

  methods: {
    _draw() {
      const dates = this.data.dates || [];
      const lines = (this.data.lines || []).filter((l) => l && l.values && l.values.length);
      if (!dates.length || !lines.length) return;

      const query = this.createSelectorQuery();
      query.select('#lcCanvas').fields({ node: true, size: true }).exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) return;
        const width = res[0].width;
        const height = res[0].height;
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
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
        lines.forEach((line) => {
          (line.values || []).forEach((v) => {
            maxVal = Math.max(maxVal, Number(v) || 0);
          });
        });
        if (maxVal <= 0) maxVal = 1;

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i += 1) {
          const y = padT + (chartH / 4) * i;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(padL + chartW, y);
          ctx.stroke();
        }

        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
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
            const y = padT + chartH - (Number(val) / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          values.forEach((val, i) => {
            const x = padL + (chartW * i) / Math.max(values.length - 1, 1);
            const y = padT + chartH - (Number(val) / maxVal) * chartH;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          });
        });
      });
    },
  },
});
