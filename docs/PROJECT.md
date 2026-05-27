# NailMirror 项目说明

美甲试戴 + 商家运营微信小程序。**当前版本以「云试戴 MVP + 真实款式数据」为主。**

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 微信小程序原生（WXML / WXSS / JS） |
| 后端 | 微信云开发（云函数 + 云存储） |
| AI | 阿里云 DashScope：Qwen-VL + 万相（2.1 / 2.7，试戴页可切换） |

## 目录结构

```
nailmirror-v1.6-20260519-r3/
├── docs/                          ← 文档（本目录）
├── data/                          ← 原始 Excel（款式、评测手照）
└── nailmirror/src/                ← 小程序根目录（微信开发者工具打开此目录）
    ├── app.js / app.json
    ├── config/
    │   ├── cloud-env.js           ← 云环境 ID
    │   ├── feature-flags.js       ← 功能开关
    │   └── mock-hand.js           ← 默认 Mock 手照
    ├── cloudfunctions/tryon/      ← 试戴云函数
    ├── components/privacy-popup/  ← 隐私授权弹窗
    ├── mock/
    │   ├── styles.real.js         ← 25 条真实款式
    │   └── eval-hands.js          ← 13 张评测手照 URL
    ├── pages/                     ← 页面
    ├── services/                  ← 业务 + Adapter
    └── scripts/                   ← import-styles / import-eval-hands
```

## 当前能力

| 模块 | 状态 | 说明 |
|------|------|------|
| 款式库 / 详情 / 收藏 | ✅ 真实数据 | `USE_REAL_STYLES: true` |
| 静态试戴 | ✅ 云试戴 | Qwen-VL + 万相 2.1/2.7（试戴页可切换对比） |
| 首页推荐 / 热款榜 | ✅ 真实封面 | `coverUrl` 来自美团 CDN |
| 评测手照 | ✅ | 13 张，可与拍照/相册并存 |
| 商家 / 预约 / 订单 | Mock | 演示流程 |
| AR / AI 同款 / 爬虫 | Mock | 页面未全部接入 app.json |

## 关键配置

**`config/feature-flags.js`**

```javascript
USE_REAL_STYLES: true,      // 真实款式
USE_CLOUD_TRYON: true,      // 云试戴（false 则本地 Mock）
  USE_MOCK_HAND_PHOTO: true,  // true：试戴页显示评测手照列表（与拍照/相册并存）
```

**`config/cloud-env.js`**

```javascript
module.exports = { ENV_ID: 'cloud1-d2g3df4y16873034b' };
```

**AppID**（`project.config.json`）：`wxb5ec84f31303cfde`

## 试戴链路（概要）

```
选款式 → 选手照（相册 / Mock / 评测手照）
  → wx.cloud.uploadFile
  → 云函数 tryon（submitTryonJob + 可选 wanModel）
      → Qwen-VL：款式图+手照 → inpaint prompt
      → Qwen-VL：指甲位置
      → 万相 2.1 Mask 或 2.7 双图+bbox → 轮询结果
  → 结果页展示 composedUrl 与所用模型
  → 导出 2K → pages/hd-output → 保存到相册（真机须配 downloadFile 域名，见 SETUP_USER.md §7）
```

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 核心文件

| 文件 | 职责 |
|------|------|
| `pages/try-on-static/index.js` | 试戴页（选款、上传、Mock 手照、万相模型下拉） |
| `pages/hd-output/index.js` | 2K 出图页（保存相册、分享） |
| `utils/hd-output-nav.js` | 出图页跳转（storage 传 hdUrl） |
| `utils/image.js` | 远程图下载 + 保存相册（`saveRemoteImageToAlbum`） |
| `services/try-on.service.js` | 试戴入口，按 flag 选 Cloud / Mock |
| `services/adapters/tryon-cloud-adapter.js` | 上传 + 提交 job + 轮询（2.7 延长超时） |
| `cloudfunctions/tryon/handler.js` | 试戴编排（handler v7） |
| `cloudfunctions/tryon/wan-backends.js` | 万相 2.1 Mask / 2.7 双图+bbox 双后端 |
| `services/style.service.js` | 款式列表 / 详情 / 筛选 |
| `services/hot-data.service.js` | 热款榜（真实数据时按 heat 排序） |

## 数据更新

```bash
cd nailmirror/src
node scripts/import-styles.js          # 从 ../../data/美甲款式数据（初稿版）.xlsx
node scripts/import-eval-hands.js      # 从 ../../data/命题三美甲评测数据（对外版）.xlsx
```

## 未接入 app.json 的页面

`try-on-ar`、`ai-match`、`nail-shape` 等仍保留代码，未在 tab / 路由中启用。

## 相关文档

- 部署与密钥：[SETUP_USER.md](./SETUP_USER.md)
- API 与字段：[DATA_SCHEMA.md](./DATA_SCHEMA.md)
- 代码图谱：[CODEGRAPH.md](./CODEGRAPH.md)
- 今日变更：[CHANGELOG.md](./CHANGELOG.md)
