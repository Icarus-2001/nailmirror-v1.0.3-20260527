# 数据结构与 API

## 1. 款式 Excel → 小程序字段

源文件：`data/美甲款式数据（初稿版）.xlsx`  
生成：`nailmirror/src/mock/styles.real.js`

| Excel 列 | JS 字段 | 说明 |
|----------|---------|------|
| 款式ID | `id` | 如 `real-1` |
| 款式名称 | `name` | |
| 封面图 | `coverUrl` | 美团 CDN |
| 详情图 | `imageUrl` | 可多图，取第一张为主图 |
| 色系 | `color` | **8 大色系**（见 `docs/美甲标签与标准词表.md`），供筛选 |
| 款式类型 | `design` | 封闭工艺词表（纯色、法式、猫眼等） |
| 甲型 | `shapeLabel` | 封闭甲型词表；`shapeTags[0]` 供试戴英文甲型 |
| 风格 | `styleLabel` | 5 类风格；商详 `displayTags` 第四项 |
| 商详标签 | `displayTags` | `[color, design, shapeLabel, styleLabel]` |
| 价格 | `price` | 数字 |
| 热度 | `heat` | 热榜排序 |
| 标签 | `tags` | 字符串数组 |

运行时展示字段（不来自 Excel）：

| 字段 | 来源 | 说明 |
|------|------|------|
| `rating` | `rating.service.js` | 5 分制数字；用户本地评分优先，无评分时生成稳定虚拟分 |
| `ratingText` | `rating.service.js` | 一位小数字符串，供 `style-card` 展示 |
| `userRating` | `rating.service.js` | 用户试戴后保存的本地评分；无则为空 |
| `ratingSource` | `rating.service.js` | `user` 或 `virtual` |

重新导入 / 重打标：

```bash
cd nailmirror/src
node scripts/import-styles.js --retag
DASHSCOPE_API_KEY=sk-xxx node scripts/import-styles.js --vlm --retag
```

词表：[`docs/美甲标签与标准词表.md`](./美甲标签与标准词表.md) → `config/tag-vocabulary.js`。

**本地 API Key（勿提交 Git）**：可复制云函数同款 Key 到 `nailmirror/src/.local/dashscope_api_key`（一行），或设置环境变量 `DASHSCOPE_API_KEY`。目录已加入 `.gitignore`。

### 1.1 标准词表封闭集合

| 维度 | 字段 | 允许值（各 1） |
|------|------|----------------|
| 色系 | `color` | 红粉色系、黄绿色系、蓝紫色系、黑白灰色系、金属色系、美拉德色系、莫兰蒂色系、多巴胺色系 |
| 工艺 | `design` | 纯色、法式、猫眼、魔镜粉、手绘、镶钻/珍珠、碎钻、微雕 |
| 甲型 | `shapeLabel` | 短方圆、短椭圆、中长方、中长圆、中长杏仁、长梯形、长尖形、加长杏仁 |
| 风格 | `styleLabel` | 日常百搭、酷飒个性、甜美少女、中式典雅、创意小众 |

VLM 提示词要求从上述词表逐字匹配；`normalizeTag()` 做归一化兜底。

### 1.2 前端展示约定

| 页面 | 展示 |
|------|------|
| 列表卡片 `style-card` | `color` + `design` 两枚标签；热度右侧展示 `ratingText` |
| 商详 `style-detail` | `displayTags` 四枚（色系 / 工艺 / 甲型 / 风格） |
| 款式库顶部 Tab | 风格、色系（来自 `styleService.getCategories()`） |
| 款式库筛选抽屉 `filter-drawer`（`useReal`） | 颜色（色系）、工艺、甲型、风格；多选 OR |

内部仍保留 `styleTags` / `shapeTags`（slug）供列表筛选，**不用于试戴**。

### 1.3 款式评分（本地）

本期评分先保存在本地 storage，不接云数据库；后续可迁移到 `ops` 云函数或用户评价集合。

| 项 | 说明 |
|----|------|
| Storage Key | `np_style_ratings`（`STORAGE_KEYS.STORAGE_STYLE_RATINGS`） |
| 保存时机 | `try-on-static` 预览生成后，用户点击 1-5 星 |
| 适用范围 | 仅目录款 `styleId`，自定义上传参考图不参与款式库评分 |
| 展示优先级 | 用户本地评分 > 稳定虚拟评分 |

单条结构：

```json
{
  "styleId": "real-1",
  "rating": 5,
  "ratedAt": "2026-06-03T12:00:00.000Z",
  "source": "try-on-static"
}
```

### 1.4 热门搜索词（真实款式）

`USE_REAL_STYLES === true` 时，`hot-data.service.fetchTop20()` 从 `styles.real.js` 聚合：

- 词条：色系、工艺、风格、以及 `色系·工艺` 组合
- 热度：对应款式 `heat` 求和
- 返回 20 条，字段仍为 `word` / `platform` / `heat` / `fetchedAt` / `relatedStyleIds`

适用：B 端看板 `pages-b/dashboard`、C 端 `pages/hot-rank`、首页异步热词。点击热词跳转款式库并带 `?keyword=` 搜索。

### 1.5 试戴英文 prompt（与展示标签同源）

| 来源 | 用途 |
|------|------|
| `styles.real.js` 的 `color` / `design` / `styleLabel` / `shapeLabel` / `title` | 与列表、商详相同的 VLM 标准标签 |
| `config/tryon-prompt.js` | 将上述中文标签映射为英文 `stylePrompt` + 英文 `color`/`design` 兜底 |
| `tryon-cloud-adapter.resolveTryonFields` | 提交云函数前即时生成，**随 `--retag` 自动对齐** |
| 用户手选甲型 | 覆盖 `shapePrompt`；否则用 `mapShapeCn(shapeLabel)` |

展示名含「奶牛」「法式」等时，`titlePatternHint` 会追加具象英文图案描述。

---

## 2. 评测手照 Excel

源文件：`data/命题三美甲评测数据（对外版）.xlsx`  
生成：`nailmirror/src/mock/eval-hands.js`（13 条 `{ id, name, url }`）

```bash
cd nailmirror/src && node scripts/import-eval-hands.js
```

---

## 3. 云函数 `tryon` API

### ping

```json
{ "action": "ping" }
```

### analyzeNails

入参：`fileID` 或 `imageUrl`

出参示例：

```json
{
  "code": 0,
  "data": {
    "handDetected": true,
    "nailCount": 5,
    "nails": [{ "cx": 0.32, "cy": 0.45, "rx": 0.035, "ry": 0.055 }],
    "confidence": 0.9
  }
}
```

坐标为相对值 0–1（相对宽高）。

### submitTryonJob

入参：

```json
{
  "action": "submitTryonJob",
  "fileID": "cloud://...",
  "styleId": "real-1",
  "styleCoverUrl": "https://p0.meituan.net/...",
  "styleImageUrl": "https://...",
  "stylePrompt": "solid cherry red gel polish",
  "shapePrompt": "almond",
  "color": "酒红",
  "design": "纯色"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `fileID` | ✅ | 云存储手照 |
| `styleCoverUrl` | 推荐 | 供 Qwen-VL 双图分析 |
| `stylePrompt` / `color` / `design` | 备选 | 无封面图时用文字描述 |
| `shapePrompt` | 可选 | 甲型英文关键词 |

出参：

```json
{
  "code": 0,
  "data": { "jobId": "task-xxx", "status": "processing" }
}
```

### queryTryonJob

入参：`{ "action": "queryTryonJob", "jobId": "task-xxx" }`

出参：

```json
{
  "code": 0,
  "data": {
    "jobId": "task-xxx",
    "status": "succeeded",
    "outputUrl": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/..."
  }
}
```

`status`：`processing` | `succeeded` | `failed`

---

## 4. 万相模型

| 来源 | 说明 |
|------|------|
| `event.wanModel` | 试戴页下拉，优先级最高 |
| `WAN_IMAGE_MODEL` | 云函数 env 默认 |
| `WANX_EDIT_MODEL` | 兼容旧配置 |

| 模型 | 后端 | API |
|------|------|-----|
| `wanx2.1-imageedit` | Mask 局部重绘 | `image2image/image-synthesis` |
| `wan2.7-image-pro` | 双图 + bbox | `image-generation/generation` |

`submitTryonJob` 响应含 `wanModel`、`wanBackend`。

---

## 5. 试戴历史（Mock）

`try_on_logs` 结构（本地 storage，非云数据库）：

| 字段 | 说明 |
|------|------|
| `styleId` | 款式 ID |
| `createdAt` | 试戴时间 |
| `composedUrl` | 结果图 URL |
| `userOpenid` | 用户 openid（云试戴成功后写入） |
| `rating` | 可选；目录款试戴完成后的用户评分 |

---

## 6. 商家上传款式（1.1.8）

### 6.1 前端入口与缓存

商家身份下通过 `pages-b/entry` 进入 `pages-b/style-upload`。调试期身份判断信任前端 `userStore.role === 'b'`。

上传成功后，`services/merchant-style.service.js` 会把云端返回的 `styles` 记录映射为 C 端款式对象，并缓存到本地 storage：

| Storage Key | 说明 |
|----|----|
| `np_merchant_styles` | 当前调试端已上传成功的商家款式；`style.service.getAllStyles()` 会与 `styles.real.js` 合并后供款式库、商详、试戴使用 |

前端款式对象关键字段：

```json
{
  "id": "merchant-style-...",
  "title": "渐变幻彩美甲",
  "coverUrl": "https://...",
  "sourceUrl": "https://...",
  "previewUrls": ["https://..."],
  "styleImageFileID": "cloud://...",
  "color": "红粉色系",
  "design": "纯色",
  "shapeLabel": "中长圆",
  "styleLabel": "日常百搭",
  "displayTags": ["红粉色系", "纯色", "中长圆", "日常百搭"],
  "heat": 1550,
  "styleSource": "merchant-upload"
}
```

`previewUrls` 是商详轮播必需字段；1.1.8 起旧缓存读取时也会自动用 `coverUrl/sourceUrl/imageUrl` 补齐。

### 6.2 `ops.uploadMerchantStyles`

新增 `ops` 云函数 action，用于商家上传款式的 VLM 打标与入库。

入参：

```json
{
  "action": "uploadMerchantStyles",
  "role": "b",
  "merchantId": "merchant-debug",
  "items": [
    { "fileID": "cloud://...", "originalName": "style-1.jpg" }
  ]
}
```

出参：

```json
{
  "ok": true,
  "styles": [
    {
      "_id": "merchant-style-...",
      "name": "渐变幻彩美甲",
      "color": "红粉色系",
      "design": "纯色",
      "shape": "中长圆",
      "style": "日常百搭",
      "image_url": "https://...",
      "image_file_id": "cloud://...",
      "original_name": "style-1.jpg",
      "rank_weight": 1.55,
      "is_active": true,
      "merchant_id": "merchant-debug",
      "source": "merchant-upload",
      "created_at": "2026-06-06T00:00:00.000Z"
    }
  ],
  "failed": []
}
```

云端流程：`fileID` → `cloud.getTempFileURL` → `tagNailImage()`（DashScope Qwen-VL + 标准词表）→ 写入云数据库 `styles`。单张失败进入 `failed`，不阻塞其它图片。

部署要求：`ops` 云函数环境变量必须配置 `DASHSCOPE_API_KEY`，修改后需在微信开发者工具中重新上传部署 `ops`。
