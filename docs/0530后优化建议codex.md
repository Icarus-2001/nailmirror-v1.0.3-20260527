# 0530 后续优化建议（Codex）

> 生成日期：2026-05-30  
> 范围：基于本地项目 `nailmirror/src/` 的静态审查、CodeGraph 状态检查、JS 语法检查与关键链路阅读。  
> 说明：本次未修改业务代码；`node --check` 全项目 JS 语法通过；`npm test` 因本地缺少 `node_modules` / `jest` 未能运行。

## 一、优先修复问题

### P1：tryon 云函数缺少调用鉴权、限流与输入约束

相关文件：
- `nailmirror/src/cloudfunctions/tryon/handler.js`
- `nailmirror/src/services/adapters/tryon-cloud-adapter.js`

现状：
- 云函数支持 `fileID`、`imageUrl`、`imageBase64` 三种输入。
- `submitTryonJob` 会直接触发 Qwen-VL 与万相生图任务。
- 当前未看到基于 `OPENID` 的用户校验、限流、配额或图片大小限制。

风险：
- 上线后可能被滥用，直接产生 DashScope 成本。
- `imageUrl` 直传模式存在服务端代拉外部 URL 的风险。
- 没有用户维度配额时，试戴服务难以做成本控制。

建议：
- 前端生产链路只允许上传后的 `fileID`。
- 云函数使用 `cloud.getWXContext().OPENID` 记录调用用户。
- 增加用户维度的每日/每分钟限流与失败次数限制。
- 对图片大小、图片类型、任务并发数做硬限制。
- 若保留 `imageUrl` / `imageBase64`，仅在调试模式开放，并加白名单或签名校验。

### P1：app.json 声明 getLocation，但项目未实际使用定位 API

相关文件：
- `nailmirror/src/app.json`

现状：
- `requiredPrivateInfos` 中声明了 `getLocation`。
- 全项目未搜索到 `wx.getLocation`、`chooseLocation`、`startLocationUpdate` 等实际调用。

风险：
- 会放大隐私授权弹窗和审核解释成本。
- 用户可能因为无关定位权限产生不信任。

建议：
- 在没有附近门店/城市定位功能前，删除 `requiredPrivateInfos: ["getLocation"]`。
- 若后续接附近商家，应同步补充明确使用场景、隐私文案与降级逻辑。

### P2：收藏状态依赖页面初始化，直接进入详情/收藏页可能显示错误

相关文件：
- `nailmirror/src/pages/style-detail/index.js`
- `nailmirror/src/pages/me-favorite/index.js`
- `nailmirror/src/stores/favorite.store.js`
- `nailmirror/src/services/favorite.service.js`

现状：
- `favoriteStore.init()` 目前主要在“我的”页调用。
- 款式详情页直接使用 `favoriteStore.has(id)`。
- 收藏列表页直接调用 `favoriteService.list()`，服务层没有保证 store 已初始化。

风险：
- 用户从首页/款式库直接进入详情时，已收藏款式可能显示为未收藏。
- 用户直接打开收藏页时，列表可能为空或不完整。

建议：
- 在 `favorite.service` 内做 lazy init，所有 `list/has/add/remove` 入口先确保初始化。
- 或在 `style-detail`、`me-favorite` 的 `onLoad/onShow` 中显式调用 `favoriteStore.init()`。
- 增加测试覆盖“未访问我的页，直接进入详情/收藏页”的场景。

### P2：试戴预览页“换款”失败没有用户可见错误提示

相关文件：
- `nailmirror/src/pages/try-on-static/index.js`

现状：
- `onCompose` 有 `catch`，失败会 toast。
- `onSwitchStyle` 内重新云试戴只有 `try/finally`，没有 `catch`。

风险：
- 换款合成失败时，用户看不到明确错误。
- Promise 可能冒泡到全局错误，只显示泛化“网络波动”。

建议：
- 在 `onSwitchStyle` 中补齐 `catch`。
- 失败时保留旧预览图，toast 展示云函数返回的错误信息。
- 避免切换款式后立即覆盖 `styleId` 导致 UI 与预览图含义不一致。

### P2：高清出片额度可被正常试戴导出路径绕过

相关文件：
- `nailmirror/src/pages/try-on-static/index.js`
- `nailmirror/src/pages/hd-output/index.js`
- `nailmirror/src/stores/user.store.js`

现状：
- `hd-output` 只有“直接进入并重新生成 HD”时会 `consumeFreeHD()`。
- 从静态试戴正常导出时，`try-on-static` 生成 HD 并跳转，但未看到额度扣减/校验。

风险：
- 每日免费高清额度如果是产品规则，会被正常路径绕过。
- 后续接真实高清生成成本后，额度策略难以生效。

建议：
- 把额度校验和扣减放在统一服务层，例如 `tryOnService.generateHD` 或独立 `quota.service`。
- 生成前检查额度；生成成功后扣减。
- 失败不扣减，并给出明确 toast。

### P2：package.json 存在无效 preview 脚本，本地测试依赖未就绪

相关文件：
- `nailmirror/src/package.json`

现状：
- `preview` 指向 `node scripts/preview.js`，但该文件不存在。
- 本地执行 `npm test -- --runInBand` 时，`jest` 不可用，说明 `node_modules` 未安装。

风险：
- 新同学按脚本操作会失败。
- CI/本地回归流程不稳定，影响协作效率。

建议：
- 删除无效 `preview` 脚本，或补齐 `scripts/preview.js`。
- 在 README / SETUP_USER / TEAMMATE_ONBOARDING 中明确：先在 `nailmirror/src` 执行 `npm ci`，再执行 `npm test`。
- 若团队已有 CI，补充 PR 必跑的单测命令。

## 二、上线前配置优化

### 关闭调试型功能开关

相关文件：
- `nailmirror/src/config/feature-flags.js`

建议上线前确认：
- `USE_MOCK_HAND_PHOTO`：生产环境建议关闭，仅保留拍照/相册入口。
- `SHOW_WAN_MODEL_PICKER`：生产环境建议关闭，由云函数环境变量控制默认模型。
- `MOCK_FAILURE_ENABLE`：保持关闭。

### 恢复小程序发布配置

相关文件：
- `nailmirror/src/project.config.json`

建议上线前确认：
- `urlCheck` 建议发布前恢复为 `true`，并在微信公众平台配置合法域名。
- `uploadWithSourceMap` 是否继续开启，需要按团队排障策略确认。
- `cloudfunctionRoot` 与 `miniprogramRoot` 当前配置正确，但云函数应通过微信开发者工具“云端安装依赖”部署。

## 三、后续功能接入建议

### B 端接入真实 ops 云函数

相关文件：
- `nailmirror/src/pages-b/*`
- `nailmirror/src/services/merchant.service.js`
- `nailmirror/src/services/hot-data.service.js`

现状：
- B 端入口、看板、库存建议、联系方式配置已有 UI 骨架。
- 商家身份切换和商家配置仍以本地 mock/storage 为主。

建议优先级：
1. 接入 `cloudfunctions/ops`：商家配置读写、门店信息、联系方式。
2. 趋势/热榜从真实云 DB 或 ops 聚合数据读取，替换当前本地聚合。
3. 预约/订单作为下一阶段独立集合接入。

### 试戴链路继续强化“参考图融合”

相关文件：
- `nailmirror/src/services/adapters/tryon-cloud-adapter.js`
- `nailmirror/src/cloudfunctions/tryon/handler.js`
- `nailmirror/src/cloudfunctions/tryon/wan-backends.js`
- `nailmirror/src/config/tryon-prompt.js`

现状：
- 前端已传 `styleImageUrl` / `styleCoverUrl`。
- 万相 2.7 后端走双图 + bbox，方向符合“参考图融合”的产品要求。

建议：
- 保留 2.7 双图链路作为主路径。
- 为每次试戴记录 `styleId`、`wanModel`、`wanBackend`、`nailCount`、失败原因，方便评估不同模型效果。
- 建立小样本评测集，持续记录“只改指甲、不改手部”的成功率。

## 四、测试与验证建议

短期建议补充测试：
- 收藏 store 未初始化时，详情页能正确显示收藏状态。
- 收藏页直接进入时能正确读取本地收藏。
- `onSwitchStyle` 云试戴失败时保留旧图并提示错误。
- 高清出片额度在所有入口都统一扣减。
- `app.json` 删除无用 `getLocation` 后，小程序隐私弹窗仍正常。

手工验证建议：
- 微信开发者工具打开 `nailmirror/src/`。
- 云函数 `tryon` 使用“上传并部署：云端安装依赖”。
- 运行 `ping` 检查 `hasDashScopeKey`、`wanModel`、`wanBackend`。
- 试戴页分别验证相册、相机、评测手照、换款、导出高清。

## 五、建议拆分任务

1. 修复 tryon 云函数鉴权、限流与输入限制。
2. 删除无用定位权限声明。
3. 修复收藏初始化问题并补测试。
4. 修复换款失败提示。
5. 统一高清出片额度扣减逻辑。
6. 清理 package scripts，并补充本地测试说明。
7. 上线前收敛 feature flags 和 project.config。
8. 启动 B 端 ops 云函数接入。

