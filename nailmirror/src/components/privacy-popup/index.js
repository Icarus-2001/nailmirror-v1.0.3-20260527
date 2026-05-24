Component({
  data: { visible: false },
  lifetimes: {
    attached() {
      const app = getApp();
      if (app && app.registerPrivacyPopup) app.registerPrivacyPopup(this);
    },
    detached() {
      const app = getApp();
      if (app && app.registerPrivacyPopup) app.registerPrivacyPopup(null);
    }
  },
  methods: {
    show(resolve) {
      this._resolve = resolve;
      this.setData({ visible: true });
    },
    _finish(event) {
      const resolve = this._resolve;
      this._resolve = null;
      this.setData({ visible: false });
      if (resolve) resolve({ buttonId: 'privacy-agree-btn', event });
    },
    onAgree() {
      this._finish('agree');
    },
    onDisagree() {
      this._finish('disagree');
    },
    onOpenContract() {
      if (wx.openPrivacyContract) wx.openPrivacyContract();
    }
  }
});
