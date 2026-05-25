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
| 色系 | `color` | 映射到 `enums/color` |
| 款式类型 | `design` | 纯色 / 法式 / 渐变等 |
| 甲型 | `shape` | 映射到 `shapePrompt` |
| 价格 | `price` | 数字 |
| 热度 | `heat` | 热榜排序 |
| 标签 | `tags` | 字符串数组 |

重新导入：

```bash
cd nailmirror/src && node scripts/import-styles.js
```

可选 VLM 重打标签：`node scripts/import-styles.js --vlm`（需 `DASHSCOPE_API_KEY`）

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
