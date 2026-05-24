// favoriteStore — 收藏集合
const { observable, action } = require('mobx-miniprogram');
const { safeGet, safeSet } = require('../utils/storage');
const { STORAGE_FAVORITES } = require('../config/constants');

const favoriteStore = observable({
  ids: [], // styleId[]

  setIds: action(function (list) {
    this.ids = Array.isArray(list) ? list.slice() : [];
    safeSet(STORAGE_FAVORITES, this.ids);
  }),
  add: action(function (id) {
    if (this.ids.indexOf(id) === -1) {
      this.ids = this.ids.concat([id]);
      safeSet(STORAGE_FAVORITES, this.ids);
    }
  }),
  remove: action(function (id) {
    this.ids = this.ids.filter((x) => x !== id);
    safeSet(STORAGE_FAVORITES, this.ids);
  }),
  has: function (id) { return this.ids.indexOf(id) > -1; },

  init: action(function () {
    const cached = safeGet(STORAGE_FAVORITES, null);
    if (cached && Array.isArray(cached)) {
      this.ids = cached.slice();
    } else {
      // 读取种子数据
      try {
        const seed = require('../mock/favorites');
        this.ids = seed.map((f) => f.styleId);
        safeSet(STORAGE_FAVORITES, this.ids);
      } catch (e) {
        this.ids = [];
      }
    }
  })
});

module.exports = { favoriteStore };
