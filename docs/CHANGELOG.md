# 变更记录

## 1.2.8 · 2026-06-07 · 款式库来源筛选排序与商家入口修复

**小程序版本：`1.2.8`**（`app.globalData.version`）

### 一句话（版本说明可用）

**款式库筛选新增「来源」三标签与「热度/上传时间」排序；修复商家经营入口编译报错与登录跳转；优化商家款封面 URL 归一化。**

### 款式库来源筛选与排序

- **`filter-drawer`**：真实款式模式下新增「来源」（平台特供 / 来自商家 / 全网热款，多选 OR）与「排序」（热度优先 / 最新上传 / 最早上传，三选一）。
- **`style.service`**：`matchFilters` 支持 `styleSources`；新增 `sortStyles()`，`list` / `search` 在过滤后按 `sortBy` + `sortOrder` 排序（默认热度降序，与改前一致）。
- **`pages/style-library`**：`drawerFilters` 扩展 `styleSources`、`sortBy`、`sortOrder` 初始字段。

### 商家经营入口与 B 端路由兼容

- **问题**：开发者工具缓存旧分包路由时，编译报 `pages-b/stock-advice/index.wxml` ENOENT，无法进入商家中心。
- **`pages-b/stock-advice`**：补全兼容桩页面，打开后跳转商家看板（1.2.4 已下线功能，不重新注册到 `app.json`）。
- **`pages-b/hot-rank`**：补全跳转桩，重定向至 C 端 `pages/hot-rank`；`app.json` 分包保留路由以免旧缓存缺页。
- **`pages/me`**：未登录点「商家经营入口」→ 登录页 `from=merchant`；已登录直达 `pages-b/entry`；头像 `binderror` 降级 `BRAND_LOGO`。
- **`pages/login`**：`from=merchant` 登录成功后 `redirectTo` 商家中心，不自动跳首页。
- **`pages-b/entry`**：未登录先跳登录；已设 `role=b` 时跳过云端校验；校验失败留在入口页提示而非误跳验证页。

### 商家款封面 URL

- **`merchant-style.service`**：`pickCoverUrl` / `normalizeClientStyle` 与热款策略对齐，过滤 `cloud://` 误入 HTTPS 字段，减少真机封面空白。

### 涉及文件

- `components/filter-drawer/index.{js,wxml,wxss}`
- `services/style.service.js`
- `pages/style-library/index.js`
- `pages/me/index.{js,wxml}`、`pages/login/index.js`
- `pages-b/entry/index.js`、`pages-b/stock-advice/*`、`pages-b/hot-rank/*`
- `services/merchant-style.service.js`
- `app.json`、`app.js`、`package.json`
- `__tests__/unit/service-style.test.js`

### 部署注意

1. **本轮无云函数改动**，无需重新部署 `ops` / `login` / `tryon`。
2. 微信开发者工具 → 打开 `nailmirror/src/` → **清缓存（文件 + 编译）** → 重新编译。
3. 若仍报 `stock-advice` 相关错误，确认 `app.json` B 端分包无多余旧路由后再次编译。

### 验证

- 款式库 → 筛选 → 仅选「来自商家」→ 卡片均为「来自商家」徽章。
- 选「最新上传」→ 商家新上传款排在平台款之前。
- 「我的」→ 商家经营入口 → 进入商家中心（不再 WXML ENOENT）。
- 未登录点商家入口 → 登录后进入商家中心。
- `npm test -- --testPathPattern=service-style.test` 通过。

---

## 1.2.7 · 2026-06-07 · B 端商家上传身份修复与本地款式隔离

**小程序版本：`1.2.7`**（`app.globalData.version`）

### 一句话（版本说明可用）

**修复商家上传款式时 `merchantId` 缺失导致入库失败；B 端「上传款式」页「本地款式」按商家 openid 隔离统计，互不可见对方数量；须部署 `ops` 云函数。**

### 商家上传身份修复

- **问题**：1.1.12 起客户端 `uploadMerchantStyles` 未传 `merchantId`，`ops` 又单独依赖不可靠的 `context.FROM_OPENID`，真机上传报 `missing merchant identity`。
- **`merchant-style.service.js`**：恢复 `merchantId: userStore.openid` 传参。
- **`cloudfunctions/ops/index.js`**：B/C 端写库类 action 统一用 `resolveOpenid`（`getWXContext().OPENID`），不再单独信任 `FROM_OPENID`。

### B 端本地款式数商家隔离

- **问题**：「上传款式」页「本地款式」读取全局 `np_merchant_styles` 缓存总数，商家 A 能看到含其他商家在内的数量（如 19）。
- **`getCachedMerchantStylesForMerchant(merchantId)`**：按 `merchantId`（openid）过滤本地缓存款式，专供 B 端统计。
- **`pages-b/style-upload`**：`onShow` 与上传成功后改用 `userStore.openid` 过滤计数。
- **C 端不变**：款式库仍通过 `getCachedMerchantStyles()` 展示全平台商家款。

### 涉及文件

- `cloudfunctions/ops/index.js`
- `services/merchant-style.service.js`
- `pages-b/style-upload/index.js`
- `tests/services/merchant-style.service.test.js`
- `AGENTS.md`
- `app.js`、`package.json`

### 部署注意

1. 微信开发者工具 → `nailmirror/src/` → 右键 **`cloudfunctions/ops`** → **上传并部署：云端安装依赖**
2. **`login` / `tryon` 本轮无改动**
3. 小程序清除缓存 → 重新编译 → B 端验收

### 验证

- 商家身份登录 B 端 →「上传款式」→ 选图上传 → 入库成功（不再报 `missing merchant identity`）
- 商家 A「本地款式」仅显示 A 自己缓存数量；切换商家 B 后显示 B 自己的数量
- C 端款式库仍能看到各商家上传的款式
- `npm test -- --testPathPattern=merchant-style.service.test` 通过（含商家隔离用例）

---

## 1.2.6 · 2026-06-07 · 热度榜单站外/站内双 Tab 与每日 10 点更新

**小程序版本：`1.2.6`**（`app.globalData.version`）

### 一句话（版本说明可用）

**热度榜单增加「站外榜单 / 站内榜单」子 Tab；站内 Top10 每日 10:00 云端快照更新；须部署 `ops` 并上传定时触发器。**

### 热度榜单双 Tab

- **`pages/hot-rank`**：顶部横向子 Tab「站外榜单 | 站内榜单」，默认站外（与现入口一致）；切换时内存缓存，不重复请求。
- **站外榜单**：沿用 xhs-hot TOP10（`hot-data.service` → `fetchRanking`）。
- **站内榜单**：读取云端 `site_hot_rank` 快照 Top10；小字说明「每日 10 点更新，主要按【平台特供】和【来自商家】两类美甲款式的热度 Top10 排序」。
- **`hot-rank-card`**：站外 📈 +「全网热款」；站内 🔥 +「平台特供」/「来自商家」徽章。

### 云端站内榜单快照

- **`refreshSiteHotRank`**：候选池 = 平台款 `real-1`…`25` + 云库 `merchant-upload` 激活款；按 `getStyleHeatScores` 降序取 Top10，写入集合 **`site_hot_rank`** 文档 `_id: latest`。
- **`listSiteHotRank`**：C 端读取快照；无快照时冷启动同步刷新一次。
- **定时触发器**：`ops/config.json` 配置 `0 0 10 * * * *`（北京时间每天 10:00）。

### 涉及文件

- `cloudfunctions/ops/handlers/refreshSiteHotRank.js`、`listSiteHotRank.js`、`data/platform-style-ids.js`
- `cloudfunctions/ops/index.js`、`config.json`
- `services/hot-data.service.js`
- `pages/hot-rank/index.{js,wxml,wxss,json}`
- `components/hot-rank-card/index.{wxml,wxss}`
- `tests/cloudfunctions/refreshSiteHotRank.test.js`、`tests/services/hot-data.service.test.js`
- `app.js`、`package.json`

### 部署注意

1. 微信开发者工具 → `nailmirror/src/` → 右键 **`cloudfunctions/ops`** → **上传并部署：云端安装依赖**
2. **上传定时触发器（重要，网页控制台无此菜单）**：
   - 展开 `cloudfunctions/ops/`
   - 右键 **`config.json`** → **上传触发器**（若菜单无此项，先对 `config.json` 执行「云函数增量上传：更新文件」再上传触发器）
   - 预期：每天 **10:00** 自动执行 `refreshSiteHotRank`
3. **首次验证**：云函数测试 `{ "action": "refreshSiteHotRank" }` → 数据库 `site_hot_rank.latest` 有 Top10
4. **`login` / `tryon` 本轮无改动**
5. 小程序清除缓存 → 编译 → 「热度榜单」切换两 Tab 验收

### 验证

- 默认「站外榜单」与现网一致；「站内榜单」见说明小字 + Top10 + 更新时间
- 云端测试 `listSiteHotRank` 返回 `items`；真机两 Tab 卡片可跳商详
- 次日 10:00 后 `site_hot_rank.latest.updated_at` 刷新

---

## 1.2.5 · 2026-06-07 · 收藏云端化、站内热度算法与试戴历史增强

**小程序版本：`1.2.5`**（`app.globalData.version`）

### 一句话（版本说明可用）

**收藏写入云库 `user_favorites` 多端同步；站内热度按 UV/收藏/试戴公式实时计算；试戴成功自动记历史；我的收藏首屏加速并修复商家款封面 403。须部署 `ops` 与 `login` 云函数。**

### 收藏云端化

- **`ops` 新增 action**：`addFavorite` / `removeFavorite` / `listFavorites`，写入云库集合 **`user_favorites`**（`user_id` + `style_id` + `created_at`）。
- **`resolveOpenid.js`**：优先使用云函数上下文 `OPENID`，修复云端测试/真机 openid 不一致导致收藏不落库。
- **`favorite.service.js`**：`add`/`remove` 本地即时响应并异步同步云端；`mergeFromCloud` 拉取云端 id 合并本地；`syncPendingToCloud` 冷启动一次性回填。
- **`app.js`**：冷启动静默 `login` 换 openid 后触发 `syncPendingToCloud`，避免每次进收藏页逐条回填。
- **`me-favorite`**：先 `list({ skipRefresh: true })` 本地快显，再后台 `mergeFromCloud` + 刷新款式目录；封面图 `lazy-load`。

### 我的收藏性能与商家款封面 403

- **`merchant-style.service.js`**：商家款封面优先 `cloud://` fileID（与全网热款一致），避免 HTTPS 临时链过期导致渲染层 403。
- 收藏列表刷新时并行 `ensureMerchantStyles` + `ensureXhsHotStyles`，映射完整款式对象（含最新封面）。

### 站内热度算法

云函数 **`ops` → `getStyleHeatScores`** 每次请求时全量扫描三张云表，按下列口径聚合后输出 `{ styleId: 热度整数 }`；C 端 `style.service` 拉取并覆盖展示（10 分钟内存缓存）。

#### 适用范围

| 款式类型 | `styleSource` | 是否参与本算法 | 列表展示的 `heat` 来源 |
|---|---|---|---|
| 平台特供 | `platform`（或未标，默认平台） | ✅ | 本算法计算值 |
| 商家上传 | `merchant-upload` | ✅ | 本算法计算值 |
| 全网热款 | `xhs-hot` | ❌ 跳过 | 导入时的站外 `interaction_score`，原样保留 |

自定义参考图（`custom-` 开头 id）不计入试戴完成数（`logTryOn` 直接 skip）。

#### 三个输入指标（行为窗口均为「近 30 天」）

统计窗口：`now - 30×24h` 至 `now`。无 `user_id` 时记为 `guest`。

| 指标 | 符号 | 云表 / 字段 | 计数口径 |
|---|---|---|---|
| **曝光 UV** | `UV` | `user_events`，`event_type = style_detail_view` | 同一 `style_id` 下，近 30 天内 **`user_id` 去重**后的用户数。触发场景：商详 `onLoad`（`extra.source: style_detail`）、试戴选款步点击卡片（`extra.source: tryon_style_step`）。同一用户多次曝光只计 1。 |
| **收藏数** | `F` | `user_favorites`，`style_id` + `created_at` | 当前**仍存在于集合**的收藏记录，且 `created_at` 落在近 30 天内。取消收藏 = 文档删除，不再计入。 |
| **试戴完成数** | `T` | `try_on_logs`，`style_id` + `tried_at` | 近 30 天内该款式的记录条数，**不去重**——每成功合成 1 次（`compose_success` 后 `logTryOn`）计 1。同一用户多次试戴同一款，每条日志各计 1。 |

> 说明：UV / F / T 三个指标只统计近 30 天行为；但「最近触达时间」用于衰减时，会参考**全量历史**中该款式的最后一次曝光、试戴或收藏时间（见下文「天数」）。

#### 计算公式（按款式逐条计算）

```
基础分     base      = UV × 3  +  F × 30  +  T × 50
转化率加成 convBonus = UV > 0 ? (T / UV) × 200 : 0
天数       days      = floor( min( 距今天数, 30 ) )
时间衰减   decay     = e^( -0.023 × days )
最终热度   heat      = round( (base + convBonus) × decay )
```

**「天数」怎么取：**

1. 取该款式在以下三类行为中的**最近一次时间戳**（不限是否在近 30 天内）：
   - `user_events.style_detail_view` 的 `timestamp`
   - `try_on_logs` 的 `tried_at`
   - `user_favorites` 的 `created_at`（当前仍有效的收藏）
2. 若以上均无记录 → 用 `styles` 表中该款的 `created_at` / `createdAt`。
3. `天数 = (now - 最近时间) / 1 天`，向下取整，**上限 30**。

**权重含义（便于调参对齐）：** 单次试戴完成 ≈ 16.7 次曝光（50÷3）；单次收藏 ≈ 10 次曝光（30÷3）。转化率加成奖励「曝光后能转化为试戴」的款式；UV=0 时加成恒为 0，避免无曝光款靠试戴刷分。

**算例：** 某平台款近 30 天 UV=10、F=2、T=5，最近触达为 3 天前：

```
base      = 10×3 + 2×30 + 5×50 = 340
convBonus = (5/10)×200 = 100
decay     = e^(-0.023×3) ≈ 0.935
heat      = round((340+100)×0.935) = 411
```

#### C 端消费

- **`style.service.js`**：`ensureStyleHeatScores()` 调 `ops`，结果缓存 **10 分钟**；`list` / `get` / `search` 将返回的 `heatScores[styleId]` 写入对应款式的 `heat` 字段，并按 `heat` 降序排序。
- 云端不可用或请求失败时**静默降级**：保留款式对象上原有的 `heat` 字段，不报错、不阻塞列表。
- `xhs-hot` 款在 `_applyHeatScores` 中被跳过，不参与覆盖。

### 热度展示区分

- **平台/商家款**：🔥 橙红色站内热度（`style-card` / 首页推荐 / 商详）。
- **全网热款**：📈 琥珀色站外互动分，与站内算法分离。

### 款式曝光 UV 埋点

- **`logEvent`** 新增事件类型 `style_detail_view`。
- **商详** `style-detail/onLoad`：进入即上报，`extra.source: style_detail`。
- **试戴选款** `try-on-static/onPickStyle`：点击款式卡片上报，`extra.source: tryon_style_step`。

### 试戴历史增强

- **`try-on-static`**：`compose_success` 后调用 `historyService.append`（缩略图用合成图 `composedUrl`）。
- **`history.service.js`**：`list()` 仅保留近 30 天记录。
- **`me-history`**：顶部「仅保留近 30 天」提示；点击卡片跳转商详（自定义上传款除外）。

### 涉及文件

- `services/favorite.service.js`、`services/merchant-style.service.js`、`services/style.service.js`、`services/history.service.js`
- `pages/me-favorite/index.{js,wxml}`、`pages/me-history/index.{js,wxml,wxss}`
- `pages/style-detail/index.{js,wxml,wxss}`、`pages/try-on-static/index.{js,wxml,wxss}`
- `pages/home/index.{wxml,wxss}`、`components/style-card/index.{wxml,wxss}`
- `cloudfunctions/ops/index.js`、`handlers/addFavorite.js`、`handlers/removeFavorite.js`、`handlers/listFavorites.js`、`handlers/getStyleHeatScores.js`、`handlers/logEvent.js`、`utils/resolveOpenid.js`
- `app.js`、`package.json`

### 部署注意

- **须重新部署 `ops` 云函数**（新增收藏与热度 action；`logEvent` 扩充 `style_detail_view`）：
  1. 微信开发者工具 → 打开 `nailmirror/src/` 项目
  2. 左侧 `cloudfunctions/ops` → 右键 → **上传并部署：云端安装依赖**
  3. 等待控制台提示部署成功
- **须重新部署 `login` 云函数**（收藏依赖真实 `openid` 身份）：
  1. 同上，对 `cloudfunctions/login` 右键上传部署
- **`tryon` 云函数本轮无改动**，无需重新部署。
- **云数据库**：确认存在集合 **`user_favorites`**（首次 `addFavorite` 会自动创建）；收藏数据查此集合，非 `favorite`。
- **云端测试面板**：`listFavorites`/`addFavorite` 无真实用户 `OPENID`，**收藏写入建议真机验证**；`getStyleHeatScores` 可在面板直接测 `action: getStyleHeatScores`。
- **小程序侧**：清除缓存 → 重新编译；真机：收藏一款 → 云库 `user_favorites` 应有记录；打开「我的收藏」无 403、首屏更快。

### 验证

- 商详/试戴选款点击后，`user_events` 有 `style_detail_view` 记录。
- 收藏/取消收藏后，本地与云库 `user_favorites` 同步；换设备登录后收藏列表一致。
- 款式库/首页平台款显示 🔥 算法热度，全网热款显示 📈 站外分。
- 试戴成功后「试戴历史」有新记录；仅显示 30 天内；点击可跳商详。
- 「我的收藏」快速出列表，商家款封面无 403。

---

## 1.2.4 · 2026-06-07 · 简约 UI 精修与甲型三分组重构

**小程序版本：`1.2.4`**（`app.globalData.version`）

### 一句话（版本说明可用）

**C/B 端删繁就简、苹果风 UI 精修；甲型改为短款/中长款/长款九款三分组并贯通试戴生图；款式库搜索栏独立三段式布局；仅须部署 `tryon` 云函数。**

### C 端 UI 精简（首页 / 我的 / 款式库）

- **首页 slogan**：`既是魔镜，也是先知` → `魔镜魔镜，快快显灵~`。
- **首页「立即试戴」大卡**：移除「选甲型 → 选款式 → ……」副文案；加入品牌 logo 底纹 + 淡紫渐变蒙版，提升品质感。
- **首页「为你推荐」**：移除右侧「去款式库 ›」链接，标题区更简洁。
- **我的页**：移除中部「试戴 / 收藏 / 卸甲倒计时」统计条；移除「卸甲倒计时」菜单项及 `pages/countdown` 页面注册。
- **款式库搜索栏**：拆为独立三段式——白底搜索框 + 🔍 搜索按钮 + 淡紫「筛选」胶囊按钮（与搜索框分离，更易发现）。
- **款式库 Tab**：移除搜索栏下方两行色系/风格 Tab（筛选抽屉已覆盖同等能力）。
- **「全网热款」徽章**：`style-card` 改为琥珀金配色，与「平台特供」紫色区分。

### 甲型选择三分组重构（C 端 + 试戴链路）

- **`config/enums.js`**：`NAIL_SHAPES` 替换为 9 款新 id（短款 2 + 中长款 3 + 长款 3），新增 `NAIL_SHAPE_GROUPS` 分组导出。
- **`pages/nail-shape`**：按「短款 / 中长款 / 长款」三组卡片展示，每组淡紫圆角标签 + 风格描述句。
- **`pages/try-on-static`**：选甲型步同步分组 UI；`_labelOfShape` 兼容新 id 与历史旧 id。
- **`config/label-maps.js`**：`SHAPE_CN_TO_ID` / `SHAPE_ID_TO_LABEL` 扩充新 id，旧 6 个 id 保留降级映射（试戴历史可读）。
- **`cloudfunctions/tryon/handler.js`**：`SHAPE_EN` 扩充 8 个新英文 prompt，旧 id 保留（用户所选甲型正确传导至 AI 生图）。

| 分组 | 甲型 |
|---|---|
| 短款 | 短方圆、短椭圆 |
| 中长款 | 中长方、中长圆、中长杏仁 |
| 长款 | 长梯形、长尖形、加长杏仁 |

### B 端 UI 精简

- **移除功能**：`pages-b/stock-advice`（备货建议）、`pages-b/hot-rank`（热度详情）页面及入口。
- **重命名**：「轻预约配置」→「店铺信息」（entry 菜单、contact-config 页标题、membership 权益文案）。
- **经营看板**：移除「查看本周备货建议」CTA；热款条目不再跳转已删除的热度详情页。
- **`app.json`**：B 端分包注销 `stock-advice`、`hot-rank` 路由。

### 涉及文件

- `pages/home/index.{wxml,wxss,js}`
- `pages/me/index.{js,wxml,wxss}`、`pages/countdown/*`（删）
- `pages/style-library/index.{js,wxml,wxss}`
- `pages/nail-shape/index.{js,wxml,wxss}`
- `pages/try-on-static/index.{js,wxml,wxss}`
- `components/style-card/index.wxss`
- `pages-b/entry/index.{js,wxml,wxss}`、`pages-b/dashboard/index.{js,wxml}`
- `pages-b/contact-config/index.{json,wxml}`、`pages-b/membership/index.{js,wxml}`
- `pages-b/stock-advice/*`、`pages-b/hot-rank/*`（删）
- `config/enums.js`、`config/label-maps.js`
- `cloudfunctions/tryon/handler.js`
- `app.json`、`app.js`、`package.json`
- `services/merchant.service.js`、`tests/e2e-smoke.md`

### 部署注意

- **须重新部署 `tryon` 云函数**（`SHAPE_EN` 字典扩充；推 Git 不会自动更新云端）：
  1. 微信开发者工具 → 打开 `nailmirror/src/` 项目
  2. 左侧文件树找到 `cloudfunctions/tryon` 文件夹
  3. 右键 → **上传并部署：云端安装依赖**
  4. 等待控制台提示部署成功
- **`ops` / `login` 云函数本轮无改动**，无需重新部署。
- **云端测试面板**：非必须（字典扩充，无新 action）；建议部署后在小程序走一遍试戴，选一个新甲型（如「短方圆」）验证生图甲型效果。
- **小程序侧**：工具 → 清除缓存 → 全部清除 → 重新编译；真机预览验收 UI 与甲型分组。

### 验证

- 首页 slogan、立即试戴底纹、为你推荐无「去款式库」链接。
- 我的页无统计条与卸甲倒计时入口；B 端无备货建议/热度详情入口，「店铺信息」文案正确。
- 款式库搜索栏为搜索框 + 🔍 + 淡紫筛选；无下方 Tab 行；全网热款徽章为金色系。
- 试戴选甲型分三组九款；选「加长杏仁」等新款后合成，云端日志 `shapePrompt` 为新 id，生图甲型与选择一致。
- 历史试戴记录中旧甲型 id（如 `almond`）仍可显示中文标签。

---

## 1.2.3 · 2026-06-06 · 商家身份拦截、联系商家直拨与首页响应式

**小程序版本：`1.2.3`**（`app.globalData.version`）

### 一句话（版本说明可用）

**普通用户点击「商家经营入口」须先经云端 merchants 验证；商详「联系商家」对入驻商家款直接调起拨号盘；首页「为你推荐」改用 CSS Grid 适配多机型；修复 xhs-hot 服务模块依赖图缺失。**

### 商家身份拦截加固（C 端 + ops）

- **问题**：此前仅依赖本地 `userStore.role` 缓存，普通用户可绕过验证直接进入 B 端菜单。
- **新增 action：`checkMerchantStatus`**：按 `openid` 查询 `merchants` 集合，以云端 `status` 为准判定是否已入驻（不依赖本地 role）。
- **`services/merchant-auth.service.js`**：封装 `isMerchantVerified(openid)`，供入口页复用。
- **`pages/me/index.js`**：`onGoMerchant` 先调云端验证；已入驻 → 设 `role=b` 进 `pages-b/entry`；未入驻 → 设 `role=c` 跳 `pages-b/merchant-verify`。
- **`pages-b/entry/index.js`**：`onShow` 同样做云端验证；未通过则 `wx.redirectTo` 验证页，防止深链直达绕过。
- **`pages-b/merchant-verify/index.js`**：认证成功后 `wx.redirectTo` 至 entry（不再 `navigateBack`）。

### 联系商家直拨（C 端）

- **`pages/style-detail/index.js`**：新增 `normalizePhone`、`dialPhone`；`onContact` 与 `onDialPhone` 对商家款直接调用 `wx.makePhoneCall`，失败时降级展示门店与电话信息。
- **`pages/style-detail/index.wxml`**：商家联系电话行绑定 `bindtap="onDialPhone"`，可点击拨号。
- **`pages/style-detail/index.wxss`**：`.sd__phone` 可点击样式（主色 + 下划线）。

### 首页响应式布局（C 端）

- **问题**：原 `flex + calc(50% - 10rpx)` 在部分机型上「为你推荐」仅显示左半栏。
- **`pages/home/index.wxml`**：「为你推荐」改用 `np-grid` + `home__grid-item` 双列网格。
- **`pages/home/index.wxss`**：副入口与推荐区统一 `display: grid; grid-template-columns: repeat(2, 1fr)`；卡片封面 `aspect-ratio: 3/4` 替代固定高度；`min-width: 0` 防止 flex/grid 子项溢出；`.home` 加 `overflow-x: hidden`。

### 依赖图修复

- **`app.js`**：显式 `require('./services/xhs-hot.service')`，避免款式库等页面间接引用时报 `module is not defined`。

### 涉及文件

- `cloudfunctions/ops/handlers/checkMerchantStatus.js`（新）、`index.js`
- `services/merchant-auth.service.js`（新）
- `pages/me/index.js`、`pages-b/entry/index.{js,wxml}`、`pages-b/merchant-verify/index.js`
- `pages/style-detail/index.{js,wxml,wxss}`
- `pages/home/index.{wxml,wxss}`
- `app.js`、`package.json`
- `tests/cloudfunctions/checkMerchantStatus.test.js`（新）

### 部署注意

- **须重新部署 `ops` 云函数**（新增 `checkMerchantStatus` action；推 Git 不会自动更新云端）：
  1. 微信开发者工具 → 打开 `nailmirror/src/` 项目
  2. 左侧文件树找到 `cloudfunctions/ops` 文件夹
  3. 右键 → **上传并部署：云端安装依赖**
  4. 等待控制台提示部署成功
- **云端测试**（云开发控制台 → 云函数 → ops → 云端测试）：
  - 参数：`{"action":"checkMerchantStatus","openid":"你的openid"}`
  - 预期：`{"ok":true,"verified":true}`（已入驻）或 `{"ok":true,"verified":false}`（未入驻）
- **小程序侧**：工具 → 清除缓存 → 全部清除 → 重新编译；真机验收拨号须在手机上测试（模拟器仅显示「仅为模拟」）。

### 验证

- `npm test -- --runInBand`：`checkMerchantStatus` 单测通过。
- 普通用户（未入驻）点击「商家经营入口」→ 跳转商家身份认证页，不可直接进入 B 端菜单。
- 已入驻商家认证通过 → 正常进入 B 端 entry 菜单。
- 商详「来自商家」款点击「联系商家」或联系电话 → 真机调起拨号盘；平台特供款提示「该款式不来源于任何入驻商家」。
- 首页「为你推荐」在多种机型上双列完整显示，无左半栏裁切。

---

## 1.2.2 · 2026-06-06 · 试戴预览换款二次确认

**小程序版本：`1.2.2`**（`app.globalData.version`）

### 一句话（版本说明可用）

**试戴预览页「换个款式试试」点击备选款时先弹窗确认，避免误触直接触发换款合成。**

### 换款确认（C 端）

- **`pages/try-on-static`**：`onSwitchStyle` 点击非当前款式时弹出 `wx.showModal`（「确定换用「{款式名}」重新合成试戴效果？」）；取消不合成，确定后走原有 `tryOnService.startStatic` 换款链路。
- 当前已选款式（高亮边框）点击仍直接忽略，不弹窗。

### 涉及文件

- `pages/try-on-static/index.js`
- `app.js`、`package.json`

### 部署注意

- 仅 C 端小程序变更，无需部署云函数。
- 上传体验版后重新编译验收即可。

### 验证

- 试戴预览页点击其他备选款 → 出现确认弹窗；取消无合成；确定后出现「换款合成中」并更新预览图。

---

## 1.2.1 · 2026-06-06 · 热款榜真机封面与页面精简

**小程序版本：`1.2.1`**（`app.globalData.version`）

### 一句话（版本说明可用）

**xhs-hot 封面改用云存储 `cloud://` fileID，修复体验版热款榜无图；热款榜移除目录聚合的「热门搜索词」mock 区块，仅保留全网热款 TOP10。**

### 真机封面修复

- **`xhs-hot.service`**：`coverUrl` / `previewUrls` 优先使用 `image_file_id`（`cloud://`），不再依赖 HTTPS 临时链（体验版须配 downloadFile 合法域名，易白屏）。
- **本地缓存**：读取 `np_xhs_hot_styles` 时若已有 `styleImageFileID`，自动 remap 封面为 `cloud://`。

### 热款榜精简

- **`pages/hot-rank`**：移除「热门搜索词」列表（原 `fetchTop20` / `buildRealHotKeywords` 聚合 mock）；页面仅展示「全网热款 TOP10」。
- 首页与 B 端看板仍保留 `fetchTop20` 热词能力（未改动）。

### 涉及文件

- `services/xhs-hot.service.js`
- `pages/hot-rank/index.{js,wxml,json}`
- `tests/cloudfunctions/importXhsHotTop10.test.js`
- `app.js`、`package.json`

### 部署注意

- **仅 C 端小程序变更**，无需重新部署 `ops` 云函数或重新导入热款数据。
- 上传体验版后，建议手机删除小程序重新扫码；若仍见旧封面可清缓存或等待 10 分钟缓存过期。

### 验证

- `npm test -- --runInBand`：含 `cloud fileID` 封面映射单测通过。
- 体验版热款榜 / 款式库 / 商详：xhs-hot 封面正常显示。
- 热款榜底部不再出现「甜美少女」等目录聚合热词。

---

## 1.2.0 · 2026-06-06 · 小红书全网热款导入与 C 端展示

**小程序版本：`1.2.0`**（`app.globalData.version`）

### 一句话（版本说明可用）

**管理员可将小红书爬虫 Top10 一键导入云库（VLM 打标 + 封面上传）；C 端热款榜展示「全网热款 TOP10」，款式库与商详同步可见并标注「全网热款」徽章。**

### 云端导入（ops）

- **新增 action：`importXhsHotTop10`**：读取爬虫 JSON（`cover_url`、`title`、`rank`、`interaction_score`、`note_id` 等）→ 下载封面 → 上传云存储 → VLM 打标 → 写入 `styles`（`source=xhs-hot`，`_id` 形如 `xhs-hot-{scrape_date}-{rank}`）；新批次导入时自动将旧 `scrape_date` 批次设为 `is_active=false`。
- **新增 action：`listXhsHotStyles`**：返回最新 `scrape_date` 批次 Top10，按 `xhs_rank` 排序；返回前按 `image_file_id` 批量刷新 `image_url` 临时链接。
- **权限**：`ADMIN_OPENIDS` 环境变量限制导入 openid；未配置时内测默认放行。
- **脚本**：`scripts/import-xhs-hot.js` 从 `data/小红书爬虫/top10_nail_art.json` 生成 `data/xhs-hot-import-payload.json`，供 `ops` 云端测试粘贴执行。

### C 端展示

- **`xhs-hot.service`**：10 分钟内存缓存 + 本地 `np_xhs_hot_styles`；`styleSource: 'xhs-hot'`，热度取 `interaction_score`。
- **热款榜**（`pages/hot-rank`）：优先展示 `{scrape_date} 全网热款 TOP10`；热款卡右上角「全网热款」徽章。
- **款式库 / 商详**：与平台特供、商家款合并展示；款式卡与商详标题旁标注「全网热款」；联系商家仍走平台分流（非入驻商家提示）。
- **`app.js`**：显式 `require('./utils/star-display')` 纳入主包依赖图，避免子页面报 `module is not defined`。

### 涉及文件

- `cloudfunctions/ops/handlers/importXhsHotTop10.js`（新）、`handlers/listXhsHotStyles.js`（新）、`utils/imageRefresh.js`（新）、`index.js`
- `services/xhs-hot.service.js`（新）、`services/hot-data.service.js`、`services/style.service.js`
- `components/hot-rank-card/index.{wxml,wxss}`、`components/style-card/index.{wxml,wxss}`
- `pages/hot-rank/index.wxml`、`pages/style-detail/index.{wxml,wxss}`
- `config/constants.js`、`app.js`、`package.json`
- `scripts/import-xhs-hot.js`（新）、`tests/cloudfunctions/importXhsHotTop10.test.js`（新）
- `AGENTS.md`、`DATA_SCHEMA.md`

### 部署注意

- 微信开发者工具重新上传部署 **`ops`** 云函数；推 Git 不会自动更新云端。
- **`ops` 环境变量**：`DASHSCOPE_API_KEY`（导入 VLM 打标必需）；可选 `ADMIN_OPENIDS` 限制导入权限。
- **导入**：`node scripts/import-xhs-hot.js` 生成 payload → `ops` 云端测试粘贴执行（可附 `callerOpenid`）；预期 `{ ok: true, styles: [...] }`。
- **验收 list**：云端测试 `{ "action": "listXhsHotStyles" }` 返回 10 条且封面 URL 有效。
- 小程序须**清缓存后重新编译**。

### 验证

- `npm test -- --runInBand`：32 套件、160 测试通过（含 `importXhsHotTop10`、`listXhsHotStyles`、`xhs-hot.service`）。
- 热款榜：副标题为批次日期 +「全网热款 TOP10」，卡片带徽章与互动热度。
- 款式库 / 商详：xhs-hot 款可见且标注「全网热款」；试戴链路正常。

---

## 1.1.12 · 2026-06-06 · 商详联系商家与商家款真实归属

**小程序版本：`1.1.12`**（`app.globalData.version`）

### 一句话（版本说明可用）

**商详「联系商家」按款式来源分流：平台特供提示无入驻商家；来自商家款从云端 `merchants` 拉取真实门店与电话。历史商家款统一归属指定入驻商家，新上传款与认证商家 openid 真实对应。**

### 商详联系商家（C 端）

- **平台特供 / 非商家款**：点击「联系商家」弹窗「该款式不来源于任何入驻商家」。
- **来自商家款**：调用 `ops.getMerchantContact`，展示门店名称、地区、电话；支持一键拨打。
- **商详正文**：仅商家款展示云端商家信息卡片（取代原 Mock `merchant.service.getConfig`）。
- **新服务**：`services/merchant-contact.service.js` 独立封装云端查询，避免与 B 端本地配置服务混用。

### ops 云函数：商家款归属与联系查询

- **新增 action：`getMerchantContact`**：按 `styleId` 查 `styles`；仅 `source=merchant-upload` 时按 `merchant_id`（openid）查 `merchants` 返回真实联系方式。
- **新增 action：`backfillMerchantStyleOwners`**（一次性迁移）：历史商家款 `merchant_id` 统一为 `0f8f1fb66a2408810038a63b137a2ed3`，并确保 `merchants` 档案手机号为 `17312270775`。
- **`uploadMerchantStyles` 加固**：不再信任客户端 `merchantId`；使用云函数 `callerOpenid`，且须在 `merchants` 已有档案（须先完成身份认证）；移除 `merchant-debug` 兜底。
- **新增工具**：`ops/utils/merchant.js`（`normalizeMerchantOpenid`、`findMerchantByOpenid` 等）。

### 涉及文件

- `pages/style-detail/index.{js,wxml}`
- `services/merchant-contact.service.js`（新）、`services/merchant-style.service.js`、`services/merchant.service.js`
- `cloudfunctions/ops/handlers/getMerchantContact.js`（新）、`handlers/backfillMerchantStyleOwners.js`（新）、`handlers/uploadMerchantStyles.js`、`utils/merchant.js`（新）、`index.js`
- `tests/cloudfunctions/getMerchantContact.test.js`（新）、`tests/cloudfunctions/uploadMerchantStyles.test.js`
- `app.js`、`package.json`

### 部署注意

- 微信开发者工具重新上传部署 **`ops`** 云函数；推 Git 不会自动更新云端。
- **历史迁移（仅需一次）**：`ops` 云端测试 `{ "action": "backfillMerchantStyleOwners" }`，确认 `styles` 中商家款 `merchant_id` 已统一、`merchants` 有对应档案。
- **联系商家验收**：云端测试 `{ "action": "getMerchantContact", "styleId": "商家款ID" }`，返回 `{ ok: true, contact: { storeName, phone, ... } }`。
- 小程序须**清缓存后重新编译**（工具 → 清缓存 → 全部清除 → 编译），否则可能仍加载旧版 `merchant.service` 模块。

### 验证

- `npm test -- --runInBand`：`getMerchantContact`、`uploadMerchantStyles` 单测通过。
- 平台款商详：联系商家 →「该款式不来源于任何入驻商家」。
- 商家款商详：联系商家 → 显示真实门店名 + `17312270775`（回填商家）或上传者认证档案；可拨打电话。

---

## 1.1.11 · 2026-06-06 · 商家经营入口与身份验证

**小程序版本：`1.1.11`**（`app.globalData.version`）

### 一句话（版本说明可用）

**「我的」页入口改为商家经营入口；未验证用户须填写内测口令与门店信息完成认证，云端写入 `merchants` 并回写 `users.role`，通过后方可进入 B 端经营功能。**

### 商家经营入口（C 端 / B 端入口页）

- **文案**：`pages/me`「商家入口（B 端）」→「商家经营入口」。
- **入口逻辑**：`pages-b/entry` 不再本地一键 `setRole('b')`；未验证用户点击「商家身份认证」跳转验证页；已验证（`role === 'b'`）直接展示 B 端菜单，头部提示「已验证商家身份」，可「退出商家模式」。

### 商家身份认证页（新）

- **页面**：`pages-b/merchant-verify`（分包注册于 `app.json`）。
- **必填**：内测口令、商家手机号、门店名称、所在省市（`picker mode="region"` 二级选择）。
- **选填**：美团 / 大众点评门店链接（内测仅留档，不做 OCR 强制校验）。
- **交互**：提交前前端校验；口令错误 Toast「口令错误，无法切换为商家经营模式」；成功 Toast 后 `userStore.setRole('b')` 并返回商家中心。
- **底部说明**：「内测阶段，OCR 审核能力有待后续接入」；「成为入驻商家」预留申请入口。

### ops 云函数：verifyMerchant

- **新增 action：`verifyMerchant`**：校验 `MERCHANT_TOKEN` 环境变量（兜底 `nailmirror2026`）→ `ensureCollection('merchants')` 建表 → 幂等写入/更新 `merchants`（`openid`、`store_name`、`province`、`city`、`phone`、`review_url`、`status: approved`）→ 若 `users` 存在则回写 `role: 'b'`。
- **返回**：`{ ok, merchantId, merchantAction, userRoleUpdated }`，便于云端测试核对写库结果。

### 涉及文件

- `pages/me/index.wxml`
- `pages-b/entry/index.{js,wxml,wxss}`
- `pages-b/merchant-verify/index.{js,wxml,wxss,json}`（新）
- `cloudfunctions/ops/handlers/verifyMerchant.js`（新）、`cloudfunctions/ops/index.js`
- `app.json`、`app.js`、`package.json`
- `AGENTS.md`（云开发操作说明偏好）

### 部署注意

- 微信开发者工具重新上传部署 **`ops`** 云函数；推 Git 不会自动更新云端。
- 可选：云函数环境变量 **`MERCHANT_TOKEN`** 覆盖默认内测口令；修改后须重新部署 `ops`。
- **云端测试**：`ops` 云端测试参数须含 `"action": "verifyMerchant"`（勿用 `ping` 误判成功）；返回含 `merchantId` 后，在云开发控制台数据库（环境 `cloud1-d2g3df4y16873034b`）刷新即可见 `merchants` 集合。
- 小程序端须**重新编译**后，走「我的 → 商家经营入口 → 商家身份认证 → 提交验证」验收。

### 验证

- 云端测试 `verifyMerchant`：口令正确返回 `{ ok: true, merchantAction: 'created' }`，数据库出现 `merchants` 记录。
- 口令错误返回 `{ ok: false, error: '口令错误，无法切换为商家经营模式' }`。
- 小程序：验证成功后商家中心展示 B 端菜单；未验证仅见认证按钮。

---

## 1.1.10 · 2026-06-06 · 评分清零展示、商家款全局可见与来源标签

**小程序版本：`1.1.10`**（`app.globalData.version`）

### 一句话（版本说明可用）

**未评分款式统一展示 0.0 与灰星；商家上传款从云端拉取全员可见，款式卡右上角标注「平台特供」/「来自商家」，并修复商家款封面图 403。**

### 评分展示（0.0 / 灰星）

- **无评分默认态**：`formatScoreText(0)` 返回 `'0.0'`；`buildStarDisplay(0)` 返回 5 颗空星 + `0.0`，首页推荐卡与款式库双分均可见。
- **清空历史 Mock 分**：`seed` 新增 `clearStyleRatings`，仅删除 `style_ratings` 集合记录，不影响 `styles` / `users` / `try_on_logs` 等其它表；后续分数由真实试戴评分累积。

### 商家款全局可见

- **新增 ops action：`listMerchantStyles`**，读取云库 `styles` 中 `source='merchant-upload'` 且 `is_active=true` 的记录。
- **`merchant-style.service.ensureMerchantStyles`**：10 分钟内存缓存 + 同步 `np_merchant_styles` 本地缓存；`style.service` 的 `list` / `get` / `search` 与 `ensureStyleScores` 并行拉取。
- **来源标签**：平台目录款前端注入 `styleSource: 'platform'` → 徽章「平台特供」；商家款云库字段 `source: 'merchant-upload'` 映射为 `styleSource: 'merchant-upload'` → 徽章「来自商家」。`styleSource` 为 C 端展示字段，云库仍以 `source` 区分。

### 商家款封面图 403 修复

- 上传时写入的 `image_url` 为云存储临时链接（约 2 小时有效），过期后款式库封面 403。
- **`listMerchantStyles` 返回前**按 `image_file_id` 批量 `cloud.getTempFileURL` 刷新 `image_url`，所有用户拉取时拿到有效封面。

### 涉及文件

- `cloudfunctions/ops/handlers/listMerchantStyles.js`（新）、`cloudfunctions/ops/index.js`
- `cloudfunctions/seed/index.js`
- `services/merchant-style.service.js`、`services/style.service.js`、`services/rating.service.js`
- `utils/star-display.js`
- `components/style-card/index.{wxml,wxss}`
- `__tests__/unit/star-display.test.js`、`__tests__/unit/service-style.test.js`、`tests/services/rating.service.test.js`
- `app.js`、`package.json`

### 部署注意

- 微信开发者工具重新上传部署 **`ops`**、**`seed`** 云函数；推 Git 不会自动更新云端。
- 需清空历史 Mock 评分时，在 seed 测试面板调用 `{ "action": "clearStyleRatings" }`。
- 商家款封面依赖 `listMerchantStyles` 刷新临时 URL，**必须部署 ops 后重新编译小程序** 才能在款式库看到修复效果。

### 验证

- `npm test -- --runInBand`：30 套件、151 测试通过。
- 款式库：平台款「平台特供」+ 商家款「来自商家」徽章；未评分显示 `试戴 0.0` / `品质 0.0` 与灰星。
- 商家款：非上传者设备打开款式库可见同款；封面不再 403。

---

## 1.1.9 · 2026-06-06 · 双维度半星评分与云端品质分展示

**小程序版本：`1.1.9`**（`app.globalData.version`）

### 一句话（版本说明可用）

**试戴后可对「试戴效果」与「美甲品质」分别半星评分并提交锁定；C 端从云端聚合双维度分数，首页展示品质星标，商详与款式库展示双分。**

### 评分与提交锁定

- **双维度**：`tryon_effect`（试戴效果，仅 C 端展示）、`nail_quality`（美甲品质，B 端 `getSummary` 品质分同源）；半星步进 1.0–5.0。
- **草稿与提交**：点星仅更新页面草稿；点「提交评分」后 `commitRating` 才写入本地 `STORAGE_STYLE_RATINGS` 并 fire-and-forget 上报 `ops.rateStyle`。
- **提交锁定**：双维度均提交后 `ratingsLocked`，不可重复修改，避免无限点星污染云端。
- **自定义款**：`custom-*` 前缀款式跳过评分写入。

### ops / seed 云函数

- **新增 action：`getQualityScores`**，按 `rating_type` 返回 `qualityScores`（美甲品质）与 `tryonEffectScores`（试戴效果）；兼容旧字段 `scores`。
- **`rateStyle` 升级**：支持 `ratingType`（`tryon_effect` / `nail_quality`）与半星 `normalizeRating`；写入前 `ensureCollection('style_ratings')` 自动建表。
- **`getSummary` 品质分**：仅聚合 `nail_quality` 类型记录；时间衰减加权逻辑抽取至 `utils/qualityScore.js`。
- **`logEvent`**：写入前 `ensureCollection('user_events')` 自动建表。
- **新增工具**：`utils/collections.js`（`ensureCollection`）、`utils/qualityScore.js`（半星归一化、`computeQualityScore`、`buildScoresByStyle`）。
- **seed 扩展**：新增 `initCollections`、`seedStyleRatings`（含半星双维度样本）、`seedUserEvents`；`clearAll` 覆盖 `style_ratings` / `user_events`。

### C 端展示

- **半星组件**：新增 `components/half-star-rating`，支持 0.5 步进点选与只读锁定态。
- **试戴页**：`pages/try-on-static` 预览区双行评分（试戴效果 + 美甲品质）+「提交评分」按钮 + 已提交提示。
- **首页推荐卡**：仅展示美甲品质星标，美团式 `★★★★☆ 4.5`（`utils/star-display.js` → `qualityStarDisplay`）。
- **商详 / 款式库**：`style-detail` 与 `style-card` 展示双维度分数文本。
- **云端拉分**：`rating.service.ensureStyleScores` 调 `ops.getQualityScores`，5 分钟内存缓存；`style.service` 列表/详情/搜索前注入 `withRating` / `withRatings`。
- **商家上传款兼容**：`style.service` 继续合并 `merchant-style.service` 缓存款，与云端评分展示并存。

### 涉及文件

- `cloudfunctions/ops/index.js`、`handlers/getQualityScores.js`（新）、`handlers/rateStyle.js`、`handlers/getSummary.js`、`handlers/logEvent.js`、`utils/qualityScore.js`（新）、`utils/collections.js`（新）
- `cloudfunctions/seed/index.js`、`seed/utils/collections.js`（新）
- `services/rating.service.js`、`services/style.service.js`
- `components/half-star-rating/index.{js,wxml,wxss,json}`（新）、`components/style-card/index.wxml`
- `utils/star-display.js`（新）
- `pages/try-on-static/index.{js,wxml,wxss,json}`、`pages/home/index.{wxml,wxss}`、`pages/style-detail/index.{wxml,wxss}`
- `__tests__/unit/quality-score.test.js`（新）、`__tests__/unit/star-display.test.js`（新）、`tests/services/rating.service.test.js`
- `app.js`、`package.json`

### 部署注意

- 微信开发者工具重新上传部署 **`ops`**、**`seed`** 云函数；推 Git 不会自动更新云端。
- 新环境或控制台看不到 `style_ratings` / `user_events` 时，先调 `seed` 的 `initCollections`，或执行 `seedStyleRatings` / `seedUserEvents`。
- `ops` 须配置 `DASHSCOPE_API_KEY`（商家上传款 VLM 打标，继承 1.1.8）。

### 验证

- `npm test -- --runInBand`：覆盖半星归一化、星标展示、`commitRating` 双维度独立提交、`ensureStyleScores` 云端注入。
- 真机：试戴完成 → 双行半星点选 → 提交锁定 → 首页/商详/款式库分数展示；重复点星不重复上报云端。

---

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
