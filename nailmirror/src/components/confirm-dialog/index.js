Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '提示' },
    content: { type: String, value: '' },
    cancelText: { type: String, value: '取消' },
    confirmText: { type: String, value: '确定' }
  },
  methods: {
    onCancel() { this.triggerEvent('cancel'); this.setData({ visible: false }); },
    onConfirm() { this.triggerEvent('confirm'); this.setData({ visible: false }); }
  }
});
