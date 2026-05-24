# 变更记录

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
