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
    _finishAgree() {
      const resolve = this._resolve;
      this._resolve = null;
      this.setData({ visible: false });
      if (resolve) resolve({ buttonId: 'privacy-agree-btn', event: 'agree' });
    },
    onAgree() {
      this._finishAgree();
    },
    onDisagree() {
      const resolve = this._resolve;
      this._resolve = null;
      this.setData({ visible: false });
      if (resolve) resolve({ event: 'disagree' });
    },
    onOpenContract() {
      if (wx.openPrivacyContract) wx.openPrivacyContract();
    }
  }
});
