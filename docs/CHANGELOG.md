# 变更记录

## 1.1.8 · 2026-06-06 · 商家批量上传款式与 C 端款式库展示

**小程序版本：`1.1.8`**（`app.globalData.version`）

### 一句话（版本说明可用）

**商家身份下可批量上传款式图片，云端复用标准 VLM 打标流程写入 `styles`，并立即进入当前调试端的 C 端款式库、商详与试戴链路。**

### B 端商家上传

- **商家中心入口**：`pages-b/entry` 新增「上传款式」，仅在前端 `userStore.role === 'b'` 时展示；调试期信任前端商家身份。
- **批量上传页**：新增 `pages-b/style-upload`，一次最多选择 9 张相册图片，1 张图生成 1 个款式；页面逐条展示待上传、上传打标中、已入库、失败状态。
- **本地即时可见**：新增 `services/merchant-style.service.js`，上传成功后把云端返回款式映射为 C 端款式对象，并缓存到 `np_merchant_styles`。

### ops 云函数变更

- **新增 action：`uploadMerchantStyles`**，路由已接入 `cloudfunctions/ops/index.js`。
- **新增 handler：`cloudfunctions/ops/handlers/uploadMerchantStyles.js`**。
- 入参：`{ action: 'uploadMerchantStyles', role: 'b', merchantId?, items: [{ fileID, originalName? }] }`。
- 出参：`{ ok: true, styles: [...], failed: [...] }`；单张失败不阻塞其它图片。
- 云端流程：`fileID` → `getTempFileURL` → `tagNailImage()`（DashScope Qwen-VL + 标准词表归一化）→ 写入云数据库 `styles`。
- 写入字段：`_id, name, color, design, shape, style, image_url, image_file_id, original_name, rank_weight, is_active, merchant_id, source, created_at`。
- 部署注意：`ops` 云函数必须配置 `DASHSCOPE_API_KEY`，并在微信开发者工具里重新上传部署；推 Git 不会自动更新云端函数。

### C 端展示与试戴

- **款式库合并上传款**：`services/style.service.js` 在真实款式基础上合并本地缓存的商家上传款，并继续按 `heat` 排序。
- **商详图片修复**：上传款会生成 `previewUrls`；旧缓存读取时也会自动用 `coverUrl/sourceUrl/imageUrl` 补齐，避免商详轮播空白。
- **热度与评分**：云端生成稳定 `rank_weight`，前端映射为 `heat = Math.round(rank_weight * 1000)`；评分继续走现有虚拟评分逻辑。
- **试戴参考图**：`tryon-cloud-adapter` 对上传款优先传 `styleImageFileID`，让万相试戴继续参考原始上传图，而不是只靠文字标签。

### 涉及文件

- `pages-b/entry/index.{js,wxml}`、`pages-b/style-upload/index.{js,wxml,wxss,json}`、`app.json`
- `services/merchant-style.service.js`、`services/style.service.js`、`services/adapters/tryon-cloud-adapter.js`
- `cloudfunctions/ops/index.js`、`cloudfunctions/ops/handlers/uploadMerchantStyles.js`
- `config/constants.js`、`app.js`、`package.json`

### 验证

- `npm test -- --runInBand`：28 个测试套件、139 个测试通过。
- 回归覆盖：上传款字段映射、旧缓存 `previewUrls` 补齐、C 端款式库合并、云函数单张失败隔离。

## [未发布] · 2026-06-05 · 试戴数据云端化 & 漏斗埋点 & 品质分

### 新增云数据集合
- `style_ratings`：每次用户打星追加一条记录（不覆盖历史），字段：`style_id, user_id, rating, rated_at`
- `user_events`：试戴链路行为埋点，字段：`event_type, style_id, user_id, session_id, timestamp, extra`

### ops 云函数新增 action
- `logTryOn`：合成成功后 C 端 fire-and-forget 写入 `try_on_logs`，自动跳过 `custom-*` 自定义款
- `rateStyle`：追加写入 `style_ratings`，rating 值范围 1-5
- `logEvent`：写入 `user_events`，支持 9 个标准事件节点（见 handler 注释）

### 品质分算法（MVP）
`style_ratings` 所有历史记录参与计算，按时间衰减加权平均：
- `weight = 0.5 ^ (days_ago / 30)`（半衰期 30 天）
- `quality_score = Σ(rating × weight) / Σ(weight)`，保留 1 位小数
- `getSummary` 返回的 `hotStyles / trendingUp / coldStyles` 均附带 `qualityScore` 字段

### ops 排期逻辑优化
- `getSummary`：热款综合「近7天试戴量 + 品质分」双维度，`qualityScore` 返回给运营界面
- `generateReport` LLM prompt：热款行含品质分；boosts 策略注释说明热度+品质分双因子

### C 端改动
- `pages/try-on-static`：进入页生成 `_sessionId`，试戴各节点自动调 `ops.logEvent`（tryon_enter / shape_confirmed / style_confirmed / compose_start / compose_success / compose_fail + error / save_success / rated）；合成成功额外调 `ops.logTryOn`
- `services/rating.service.js`：打星本地保存后 fire-and-forget 上报 `ops.rateStyle`

### 涉及文件
- `cloudfunctions/ops/index.js`、`handlers/logTryOn.js`（新）、`handlers/rateStyle.js`（新）、`handlers/logEvent.js`（新）
- `cloudfunctions/ops/handlers/getSummary.js`、`cloudfunctions/ops/utils/llm.js`
- `pages/try-on-static/index.js`、`services/rating.service.js`

---

## 1.1.5 · 2026-06-03 · 选款式置底与试戴评分

**小程序版本：`1.1.5`**（`app.globalData.version`）

### 一句话（版本说明可用）

**选款式页一次展示全部真实款式并固定下一步操作，款式库新增热度旁 5 分评分，试戴完成后可为目录款打分。**

### 试戴与款式库

- **选款式置底**：试戴四步流程的选款式页固定「重新选甲型 + 下一步」，选完款式无需再滚到底部。
- **全量款式**：选款式页从 12 款改为展示全部真实目录款（当前 25 款 `isActive !== false`），上传参考款入口仍保留在首位。
- **款式评分**：`style-card` 在热度右侧展示 5 分制评分；无用户评分时按款式 ID/热度生成稳定虚拟分。
- **试戴后评分**：预览生成后可点 1-5 星评分，目录款评分本地持久化并优先展示；自定义上传参考图不参与目录款评分。
- **测试同步**：单测改为匹配当前真实款式库；修复 `fetchTrend(undefined)` 空值兜底和 AR smoke 历史 URL 误清理。

### 涉及文件

- `pages/try-on-static/index.{js,wxml,wxss}`、`components/style-card/index.{wxml,wxss}`
- `services/rating.service.js`、`services/style.service.js`、`services/hot-data.service.js`
- `config/constants.js`、`app.js`、`package.json`

---

## 1.1.4 · 2026-06-01 · 登录隐私授权与资料流程修复

**小程序版本：`1.1.4`**（`app.globalData.version`）

### 一句话（版本说明可用）

**登录页首屏隐私同意；修复头像昵称选择与首页问候语同步；从「我的」登录后返回我的页。**

### 登录与用户

- **隐私**：登录页挂载 `privacy-popup`，`onReady` / 点「微信一键登录」前 `ensurePrivacyAuthorized`，避免 `chooseAvatar` / `nickname` 因未授权降级（errno:104）
- **资料弹层**：修复头像按钮全宽导致点不到；`image` 设 `pointer-events: none`；须选头像 + 微信昵称（`bindnicknamereview` / `bindblur` 同步，去掉 `value` 双向绑定冲突）
- **流程**：「我的」进入 `?from=me`，登录成功 `navigateBack`；首页 `onShow` + `EVT_USER_LOGIN` 同步 `userName`
- **隐私文案**：补充登录头像、昵称说明

### 涉及文件

- `pages/login/*`、`pages/home/index.js`、`pages/me/index.js`
- `components/privacy-popup/index.wxml`
- `app.js`、`package.json`

### 部署注意

- 公众平台《用户隐私保护指引》须声明**用户信息（头像、昵称）**及相册/相机
- 云函数 `login` 无需为本版重传（逻辑未变）；重新编译上传小程序即可

---

## 1.1.3 · 2026-06-01 · 登录页资料确认

**小程序版本：`1.1.3`**（`app.globalData.version`）

### 一句话（版本说明可用）

**登录前确认微信头像与昵称并在「我的」展示；云/Mock 登录均写入本地资料。**

### 登录与用户

- **登录页**：点击「微信一键登录」→ 底部弹层 `chooseAvatar` + `type="nickname"`，必填昵称后「确认并登录」
- **`user.service`**：云登录与 Mock 降级均合并 `profile.nickname` / `profile.avatarUrl` 到 `userStore`
- **我的**：头像圆角裁剪（`overflow: hidden`）
- **工程**：`nailmirror/project.config.json` 补全 `miniprogramRoot` / `cloudfunctionRoot`

### 部署注意

- 登录资料写入**本地缓存**；云函数 `login` 仍回传 openid，未落云数据库
- 真机：清除小程序数据 → 登录页选头像填昵称 → 「我的」应显示对应资料

### 涉及文件

- `pages/login/index.{js,wxml,wxss}`、`services/user.service.js`、`pages/me/index.wxss`
- `app.js`、`package.json`（版本号）

---

## 1.1.2 · 2026-05-31 · 万相 2.7 标准版试戴与覆盖优化

**小程序版本：`1.1.2`**（`app.globalData.version`）

### 一句话（版本说明可用）

**试戴页可对比万相 2.7 Pro 与 2.7 标准；标准版单独加强指甲检测与 bbox，Pro 仍走 0531 稳定策略。**

### 万相模型

| 项 | 说明 |
|------|------|
| 试戴下拉 | `万相 2.7 Pro`（`wan2.7-image-pro`）、`万相 2.7 标准`（`wan2.7-image`）、可选 2.1 Mask |
| 默认模型 | 仍为 `wan2.7-image-pro`（`feature-flags.DEFAULT_WAN_MODEL`） |
| Pro | 0531-stable：≥3 甲 union 单框；1–2 甲各一框 |
| 标准 | 仅 `wan2.7-image`：VL 少甲重试、≥2 甲 union + 框外扩、略放大甲面椭圆、全覆盖 prompt |

### 云函数

- `tryon`：`submitTryonJob` 先解析 `wanModel` 再 VL；`ping` / 提交响应含 `wan27StdTuning` 标识
- 可选云 env：`WAN27_STD_BBOX_PAD`（默认 `0.08`）调节标准版 union 外扩

### 文档

- [`TRYON_0531稳定出图策略.md`](./TRYON_0531稳定出图策略.md) 增补 §7 标准版调参说明

### 涉及文件

- `config/feature-flags.js`、`cloudfunctions/tryon/wan-backends.js`、`handler.js`、`wan-backends.test.js`
- `app.js`、`package.json`（版本号）

**部署：** 上传并部署云函数 `tryon`（云端安装依赖）后，用标准版试戴验证。

---

## 1.1.1 · 2026-05-31 · 试戴流程分流修复

**小程序版本：`1.1.1`**（`app.globalData.version`）

### 一句话（版本说明可用）

**区分首页与商详试戴入口：首页四步可选款，商详三步直达；修复浏览商详后首页误走短流程的 bug。**

### 试戴流程

| 入口 | 步骤 | 说明 |
|------|------|------|
| 首页「立即试戴」 | 选甲型 → 选款式 → 上传照片 → 生成预览 | **四步**；进入前清空 `tryOnStore` 中残留款式 |
| 款式详情「立即试戴」 | 选甲型 → 上传照片 → 生成预览 | **三步**；URL 带 `styleId`，跳过选款 |
| 判定规则 | 仅看 URL `styleId` | **不再**用 `tryOnStore.currentStyleId` 缩短流程（避免先逛商详再回首页只剩三步） |

### 体验

- 四步流程：上传照片步「已选款式」可点 **更换 ›** 回到选款式（保留已选手照）
- 三步流程：预览页仍可通过「换个款式试试」横滑换款

### 涉及文件

- `pages/home/index.js`、`pages/try-on-static/index.{js,wxml,wxss}`

---

## 2026-05-31 · 云登录、参考图试戴、体验与 0531 稳定出图

### 一句话（小程序版本说明可用）

**接入微信云一键登录与上传参考款式试戴，试戴历史/收藏去 Mock，优化登录与相册保存体验，调试期关闭每日免费出图限额，默认万相 2.7 稳定出图策略。**

### 登录与用户

- 新增云函数 **`cloudfunctions/login`**：`getWXContext().OPENID` 返回真实 openid
- **`user.service`**：`USE_CLOUD_LOGIN` 走云登录，失败降级 Mock
- **`app.json`**：首屏为登录页；已登录冷启动 `app.onLaunch` 直跳首页
- 登录页：品牌 **logo** 替代 picsum；修复登录闪烁（去 `button loading` + 防重复 `switchTab`）
- **我的**：未登录显示「未登录」，点击进入登录页

### 试戴与云函数

- **上传参考款式**：试戴页首位「上传参考图」→ 云存储 `styleFileID` → `tryon` 支持自定义款式图
- **`tryon` handler**：目录款有客户端 `stylePrompt` 时跳过款式 VLM；轮询默认不转存（减轻慢/白屏）；`styleFileID` 解析
- **0531 稳定策略**：`config/tryon-strategy.js` + [`TRYON_0531稳定出图策略.md`](./TRYON_0531稳定出图策略.md)（≥3 甲 union 单 bbox）
- 合成等待 UI：`utils/compose-waiting.js`（轮播文案 + logo + 转圈）
- 首页副标题：四步流程「选甲型 → 选款式 → 上传照片 → 一键合成」

### 历史 / 收藏 / 去 Mock

- **`history.service`**：移除 mock seed；剔除 legacy（`h-100x`、`picsum`）；真实款式 enrich；自定义款 `styleSource: custom-upload`
- 时间格式：`YYYY-MM-DD hh:mm`（国内习惯）
- **`favorite.service`**：持久化收藏 ID
- 界面：去掉 picsum 占位（登录、我的头像、AR 占位、`PLACEHOLDER_IMAGE` → 本地 logo）

### 高清出片与保存

- **`quota.service`** + `ENABLE_FREE_HD_QUOTA: false`（调试期不限额，接口保留）
- **`utils/privacy.js`**：保存/选图前主动隐私授权
- 修复保存卡死：`showLoading({ mask: true })` 遮挡隐私弹窗；保存前去遮罩 loading；远程图「正在下载高清图…」
- **`privacy-popup`**：「不同意」不再误当作同意

### 配置与部署

| 项 | 说明 |
|----|------|
| 云函数 | 部署 **`login`**、**`tryon`**（`cloudfunctions` 根目录先选云环境） |
| 开关 | `feature-flags.js`；本地覆盖 `feature-flags.local.js`（已 gitignore） |
| 真机保存 | 公众平台 **downloadFile** 配置 DashScope OSS 域名（见 `SETUP_USER.md`） |
| 资源 | `nailmirror/src/assets/logo.jpg` |

### 测试

- 新增/更新：`login/handler.test.js`、`tryon/handler.test.js`、`quota.service.test.js`、`privacy.test.js`、`history` / `user` / `try-on` 相关单测

---

## 2026-05-30 · 款式库筛选抽屉编译/运行修复

### 问题

- WXML 编译：`filter-drawer` 引用外部 `./index.wxs` 报 `index.wxs not found`
- 运行时：组件内 `require('../../config/tag-vocabulary')` 报 `module is not defined`

### 修复

- **`components/filter-drawer/index.wxml`**：`includes` 逻辑内联到 `<wxs module="f">`，删除独立 `index.wxs`
- **`components/filter-drawer/index.js`**：筛选词表改从 `config/enums.js` 引入（`COLOR_FAMILIES` / `DESIGNS` / `NAIL_SHAPE_LABELS` / `NAIL_STYLE_LABELS`），不在组件内直接 require `tag-vocabulary.js`
- **`config/enums.js`**：再导出标准词表数组（与 `tag-vocabulary.js` 同源）
- **`app.js`**：启动时 `require('./config/tag-vocabulary')`，确保主包依赖图包含该模块

### 开发注意

自定义组件请优先 `require('../../config/enums')` 或经页面传入数据；**避免**在组件里直接 `require` 新建的 `config/*.js`，否则易出现微信子上下文 `not defined`。

---

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
- **款式库筛选抽屉**（真实款）：标准词表四维度多选；标签选中态用 WXML 内联 `wxs` 的 `includes`（见上方编译修复条目）
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
