# 变更记录

## 2026-05-25 · 万相 2.7 双图试戴 + 模型对比下拉

### 云函数（handler v7）

- 新增 [`wan-backends.js`](../nailmirror/src/cloudfunctions/tryon/wan-backends.js)：2.1 Mask + 2.7 双图/bbox
- `WAN_IMAGE_MODEL` env 默认；`event.wanModel` 可覆盖（试戴页下拉）
- 2.7：`wan2.7-image-pro` + 款式图/手照 + `bbox_list`（指甲合并为最多 2 框）
- `queryTryonJob` 兼容 2.7 `choices` 与 2.1 `results` 响应

### 前端

- `SHOW_WAN_MODEL_PICKER`：试戴页万相模型下拉，本地记忆选择
- 预览页展示本次 `wanModel`；2.7 轮询 `maxAttempts: 60`

### 单测

- `cloudfunctions/tryon/wan-backends.test.js`

---

## 2026-05-25 · 回退万相 v6 多模型（已 supersede）

- 云函数恢复为仅 `wanx2.1-imageedit` + Mask 局部重绘（`handler-v5-eval-stable`）
- 移除 `wan-backends.js` 及 2.5/2.7 切换逻辑

---

## 2026-05-24 · 云试戴 MVP 与真实数据

### 数据与展示

- 从 `data/美甲款式数据（初稿版）.xlsx` 导入 **25 条真实款式** → `mock/styles.real.js`
- 首页「为你推荐」、热款榜使用真实 `coverUrl`（美团 CDN），不再显示 emoji / picsum 占位
- 热款榜在 `USE_REAL_STYLES` 下按 `heat` 排序生成 TOP20

### 云试戴（DashScope）

- 云函数：`nailmirror/src/cloudfunctions/tryon/`（handler v5）
- 流程：手照上传 → Qwen-VL 定位指甲 → Jimp 生成 Mask → 万相 `wanx2.1-imageedit` 局部重绘
- 款式图参与生图：双图 Qwen-VL（款式 coverUrl + 手照）生成 inpaint prompt
- 指甲定位：中英文 VL 重试 + 竖/横拍 fallback + Mask 模糊边缘
- 万相模型名修正：`wanx2.1-imageedit`（非 `wan2.1-imageedit`）

### 前端

- `config/cloud-env.js` 已配置云环境 ID
- `config/feature-flags.js`：`USE_REAL_STYLES`、`USE_CLOUD_TRYON`、`USE_MOCK_HAND_PHOTO`
- 试戴页：13 张评测手照（`data/命题三美甲评测数据（对外版）.xlsx` → `mock/eval-hands.js`）
- 隐私弹窗组件 `components/privacy-popup` + `onNeedPrivacyAuthorization`
- 上传预览：`widthFix` 完整显示手照，不裁剪

### 已知限制（V2）

- Mask 仍为 VL 椭圆近似，复杂手姿可能不稳定
- 万相不支持款式参考图直传，仅通过 VL 转文字 prompt
- AR / AI 同款 / 爬虫仍为 Mock Adapter
