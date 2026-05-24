// DeviceDowngrade 组件：AR 页降级提示
Component({
  properties: {
    visible: { type: Boolean, value: false },
    level: { type: String, value: 'low' }
  },
  methods: {
    onGoStatic() { this.triggerEvent('goStatic'); wx.redirectTo({ url: '/pages/try-on-static/index' }); },
    onStay() { this.triggerEvent('stay'); this.setData({ visible: false }); }
  }
});
