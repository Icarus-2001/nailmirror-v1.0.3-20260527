# NailMirror 项目说明

**美甲 AI 试戴 + 智能款式运营** 微信小程序，面向 C 端消费者与 B 端美甲商家。

- **C 端**：参考款式图与真实手照融合试戴；50+ 真实款式（含平台特供、商家上传、小红书全网热款）；款式库筛选排序、双轨热榜、收藏与高清出图。
- **B 端**：商家身份认证、款式库三 Tab 管理（查看 / 上传 / 下架）、店铺信息配置、日更数据看板与 AI 运营策略建议。
- **后端**：微信云开发（`login` / `tryon` / `ops` 云函数 + 云数据库 + 云存储）；AI 能力由阿里云 DashScope（Qwen-VL + 万相 2.1 / 2.7）提供。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 微信小程序原生（WXML / WXSS / JS） |
| 后端 | 微信云开发（`login` / `tryon` / `ops` 云函数 + 云数据库 + 云存储） |
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
    │   ├── tag-vocabulary.js      ← 标准标签词表（与 docs/美甲标签与标准词表.md 一致）
    │   ├── enums.js               ← 甲型/风格枚举；并导出词表供 filter-drawer 等组件使用
    │   ├── tryon-prompt.js        ← 试戴英文 prompt（由 VLM 标签生成）
    │   └── mock-hand.js           ← 默认 Mock 手照
    ├── cloudfunctions/tryon/      ← 试戴云函数
    ├── components/privacy-popup/  ← 隐私授权弹窗（登录/首页/试戴/我的/B 端上传等页面须挂载）
    ├── mock/
    │   ├── styles.real.js         ← 平台基础款式（本地）；商家 / 热款由云端扩展，C 端合计 50+
    │   └── eval-hands.js          ← 13 张评测手照 URL
    ├── pages/                     ← 页面
    ├── services/                  ← 业务 + Adapter
    └── scripts/                   ← import-styles / import-eval-hands
```

## 当前能力

| 模块 | 状态 | 说明 |
|------|------|------|
| 款式库 / 详情 / 收藏 / 评分 | ✅ 真实数据 | 平台 + 商家 + 小红书热款；VLM 封闭四标签 + 筛选抽屉（色系/工艺/甲型/风格 + **来源三标签** + **热度/上传时间排序**）；试戴效果 / 美甲品质双维度半星评分（云端 `style_ratings`） |
| 站内热度 / 热款榜 | ✅ 真实聚合 | UV / 收藏 / 试戴公式计分；双轨热榜（站内平台热度 + 站外小红书 TOP10） |
| 静态试戴 | ✅ 云试戴 | 默认万相 2.7 Pro（`0531-stable` 双图+bbox）；参考图 + 英文 prompt 融合；`tryon-prompt.js` 与列表 VLM 标签同源 |
| 首页推荐 / 款式封面 | ✅ | 平台款 CDN；商家 / 热款优先 `cloud://` fileID |
| 评测手照 | ✅ | 13 张，可与拍照/相册并存 |
| 商家运营 | ✅ 核心已接入 | 身份认证、款式库三 Tab、日更看板、AI 运营策略（`ops` 云函数） |
| 预约 / 订单 / AR / AI 同款 | Mock 或未注册 | 非当前主链路 |

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

### 入口

| 入口 | 步骤 |
|------|------|
| 首页「立即试戴」 | **四步**：选甲型 → 选款式 → 选手照 → 预览评分 |
| 款式详情「立即试戴」 | **三步**：选甲型 → 选手照 → 预览（`styleId` 由 URL 带入，跳过选款） |

甲型按短款 / 中长款 / 长款 **九款三分组**；选款式支持目录款与相册参考图（`uploadStyleRef`）。

### 客户端 → 云端

```
选甲型 → 选款式（目录款 / 相册参考图 uploadStyleRef）
  → 选手照（拍照 / 相册 / 评测手照）
  → wx.cloud.uploadFile（手照 → 云存储）
  → tryon-cloud-adapter：stylePrompt + shapePrompt + styleFileID（有则传参考图）
  → 云函数 tryon（submitTryonJob，默认 wan2.7-image-pro，可切换 2.7 标准 / 2.1）
      → Qwen-VL：手照指甲定位 → bbox_list（Pro / 0531-stable：≥3 甲 union 单紧框）
      → 英文 stylePrompt（tryon-prompt.js，与列表 VLM 标签同源；目录款可跳过款式 VLM）
      → 万相 2.7（主路径）：款式参考图 + 手照双图 + bbox_list → 异步生成
      → （备选）万相 2.1：Jimp Mask → description_edit_with_mask
  → 轮询 queryTryonJob → 结果页展示 composedUrl
  → 试戴效果 / 美甲品质双维度评分；支持高清出图保存相册
```

默认出图策略见 [`TRYON_0531稳定出图策略.md`](./TRYON_0531稳定出图策略.md)；完整时序见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

### 款式来源与 B 端（摘要）

- **平台款** `styleSource: platform`：本地 `styles.real.js` + CDN 封面
- **商家款**：`ops.uploadMerchantStyles` 入库；同商家 MD5/pHash 去重 + VLM 非美甲图门禁
- **小红书热款** `styleSource: xhs-hot`：`ops.importXhsHotTop10` 日更导入；热款榜 `scope=rank` 仅最新 TOP10，款式库 `scope=library` 按 `note_id` 去重保留历史
- **C 端试戴参考图**：须 `ops.validateStyleRef` 通过，不入库
- B 端选图前须完成微信隐私授权（页面挂载 `privacy-popup`）

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
| `services/merchant-style.service.js` | 商家上传款式的图片上传、云端打标入库调用、本地缓存与 C 端款式对象映射 |
| `services/rating.service.js` | 双维度评分读取（试戴效果 / 美甲品质）、云端聚合与试戴后提交 |
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
