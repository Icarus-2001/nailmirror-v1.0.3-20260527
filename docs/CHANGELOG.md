# 变更记录

## 2026-05-30 · 试戴修复（英文 prompt + 2.7 框选 + 部署说明）

### 问题与原因

- VLM 打标后，试戴兜底 prompt 使用 8 大色系等粗标签，与款式封面（如「奶牛斑点」）不一致，万相 2.7 效果变差。
- 万相 2.7 在检测到 3 根以上指甲时，曾将指甲合并为「左半掌 + 右半掌」两个超大 bbox，出现巨型贴纸式错位。

### 修复

- 新增 [`config/tryon-prompt.js`](../nailmirror/src/config/tryon-prompt.js)：与列表**同源**的 `color` / `design` / `styleLabel` / `title` → 英文 `stylePrompt`；标题含「奶牛」等时追加具象图案描述。
- `tryon-cloud-adapter` 提交云函数前调用 `buildTryonCloudFields`；`shapeLabel` → `mapShapeCn` 作为 `shapePrompt`（用户手选甲型仍可覆盖）。
- `cloudfunctions/tryon/wan-backends.js`：指甲 &gt;2 时取**面积最大的 2 个单甲 bbox**，不再半掌合并。
- 文档补充：上传云函数前须在 **`cloudfunctions` 根目录**选择云环境（见 `SETUP_USER.md` / `TEAMMATE_ONBOARDING.md` §7.2）。

### 部署提醒

修改云函数后须：**右键 `cloudfunctions/tryon` → 上传并部署：云端安装依赖**（且 `cloudfunctions` 已绑定 `cloud1-d2g3df4y16873034b`）。仅重编译小程序不够。

---

## 2026-05-30 · 标准词表 VLM 打标 + 款式库筛选 + 真实热词

### 数据与打标

- 标准词表移至 [`docs/美甲标签与标准词表.md`](./美甲标签与标准词表.md)
- 新增 `config/tag-vocabulary.js`：8 色系 / 8 工艺 / 8 甲型 / 5 风格 + `normalizeTag`
- 重写 `scripts/import-styles.js`：`--retag` 从现有 `styles.real.js` 读图；`--vlm` 调 DashScope **qwen-vl-max** 识图打标
- 25 款 `mock/styles.real.js` 已用 VLM 真实识图更新（`color` / `design` / `shapeLabel` / `styleLabel` / `displayTags`）
- 扩展 `config/label-maps.js` 映射新甲型、风格 → 试戴 slug

### 前端

- **列表卡片**：仅展示色系 + 工艺
- **商详**：四枚 `displayTags` 中文小标签
- **款式库筛选抽屉**（真实款）：标准词表四维度多选；修复 WXML `indexOf` 导致标签无法点选（`index.wxs`）
- **热门搜索词**：`hot-data.service` 从真实款式聚合 TOP20，替换旧 mock「法式极简」等

### 协作与安全

- 本地 Key：`nailmirror/src/.local/dashscope_api_key`（`.gitignore`，勿提交）
- 新增 `AGENTS.md` 工作区记忆（可选阅读）

---

## 2026-05-27 · 2K 出图保存相册 + 万相 OSS 域名文档

### 2K 保存（真机）

- 修复出图页「保存到相册」：真机 downloadFile 域名校验 + 相册权限 + loading 遮挡 Toast 等问题
- 新增 `utils/hd-output-nav.js`：经 `storage` / `globalData` 传递 `hdUrl`，避免 OSS 长 URL 在页面 query 中被截断
- 增强 `utils/image.js`：`saveRemoteImageToAlbum`（getImageInfo → downloadFile → 复制重试 → saveToAlbum）、失败弹窗 `showSaveError`
- `pages/hd-output` 挂载 `privacy-popup`；试戴 / AR / 历史页跳转统一走 `hd-output-nav`
- `utils/cloud.js` 新增 `downloadCloudFile`（支持 `cloud://` 路径）

### 文档

- `SETUP_USER.md`：万相全区域 downloadFile 域名清单、工具 vs 真机差异、2K 保存链路与 FAQ
- 真机须配置乌兰察布等 OSS 域名（如 `dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com`）

---

## 2026-05-27 · 真机封面 HTTPS + 试戴拍照/相册 + CodeGraph 图谱

### 数据（真机图片加载）

- 款式与评测手照 CDN URL 全部由 `http://` 改为 **`https://`**（`mock/styles.real.js`、`mock/eval-hands.js`）
- 导入脚本 `import-styles.js`、`import-eval-hands.js` 新增 `toHttpsUrl()`，重新导入 Excel 时自动 HTTPS
- 真机需在公众平台配置 **downloadFile 合法域名**：`https://p0.meituan.net`、`https://p1.meituan.net`

### 试戴页（上传照片）

- **拍照 / 从相册选择** 与 **13 张评测手照** 同时可用，不再互斥
- 取消进入「上传照片」步骤时自动加载默认评测手照
- 预览区右上角 **✕** 可清除当前手照；选用评测手照时缩略图高亮
- `USE_MOCK_HAND_PHOTO` 语义更新：控制是否显示评测手照列表（不再表示「跳过相册」）

### 文档与工具

- 新增 [`CODEGRAPH.md`](./CODEGRAPH.md)：模块依赖、试戴链路、Mock/真实分界、改动速查
- 项目根目录 `codegraph init && codegraph index` 已可用；`.codegraph/` 加入 `.gitignore`
- `.cursor/rules/codegraph.mdc`：Cursor AI 使用 CodeGraph MCP 的规则

---

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
