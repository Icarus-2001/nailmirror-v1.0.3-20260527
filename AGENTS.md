## 已学习的用户偏好

- 通过功能分支和 Pull Request 合并代码；不要直接推送到 `main`（受保护：须 PR，至少一人审批）。向 GitHub 上传文档或资源时同样走分支 → PR → 合并。
- 款式标签 UX：列表/首页卡片展示「色系 + 设计」；商详展示四枚中文小标签（`displayTags`）；筛选与款式库仅用八大色系；可选 `colorDetail` 仅展示，不参与筛选。
- 试戴应融合款式参考图与手部照片（DashScope / 万相），只改指甲效果，不要仅依赖纯文字款式描述；选款式步支持从相册上传参考图（如小红书保存图），与目录款并存。
- 后端优先微信云开发，而非自建 FastAPI/PostgreSQL，以加快交付和团队协作。
- 本仓库做结构性代码问题（调用关系、流程、符号）时，优先用 CodeGraph（`codegraph_*` MCP），再考虑 grep/读文件循环。
- 开发功能开关：本地试戴时在 `feature-flags.js` 保持 `USE_MOCK_HAND_PHOTO`、`SHOW_WAN_MODEL_PICKER` 开启；个人覆盖写在已 gitignore 的 `feature-flags.local.js`；勿在生产误关导致团队无法调试。
- 小程序须用微信开发者工具编译与部署，不能仅靠 Cursor；评测手照与拍照/相册上传并存。
- 解释项目决策、walkthrough 与 `AGENTS.md` 记忆条目时使用中文。
- 登录：产品文案可为「微信一键登录」（实为 openid）；保留「先随便逛逛」，试戴/出图不强制登录。
- `ops` 云函数与 B 端云数据库由协作者负责；优先做不阻塞主试戴链路的 C 端修复。

## 已学习的工作区事实

- **NailMirror**：美甲 AI 试戴 + 商家运营微信小程序；应用根目录为 `nailmirror/src/`（微信开发者工具打开此目录）。
- 团队 GitHub 远程：`Icarus-2001/nailmirror-v1.0.3-20260527`（承接早期 `nailmirror-v1.6-*` 远程）。
- 共享云环境 ID：`cloud1-d2g3df4y16873034b`（见 `nailmirror/src/config/cloud-env.js`）；队友部署到同一环境即可共享云函数、数据库与环境变量，无需本地同步文件。
- 协作者后端在 v1.0.3 仓库分支 `backend/nail-ops`（`cloudfunctions/ops`）；未 PR/cherry-pick 进本工作区 `main` 前，B 端 `pages-b/` 仍以 Mock 为主。
- 生产后端方向（见 `docs/后端及运营优化方案0527.md`）：仅微信云——`tryon` 已部署；计划 `ops` + 云数据库集合；6.6 前不做 FastAPI/PostgreSQL。
- 真实款式库：25 款在 `nailmirror/src/mock/styles.real.js`，由 `scripts/import-styles.js` 生成；未用 `--vlm` / `--retag` 且配置 `DASHSCOPE_API_KEY` 时，默认标签可能轮换。
- 标准封闭词表：`docs/美甲标签与标准词表.md`（8 色系、设计、甲型、风格）；VLM 打标经 `config/tag-vocabulary.js` + `scripts/import-styles.js --vlm --retag`。
- 试戴稳定策略 **`0531-stable`**：见 `docs/TRYON_0531稳定出图策略.md` 与 `config/tryon-strategy.js`；万相 2.7 默认 `wan2.7-image-pro`；≥3 甲时 `mergeNailsToBboxList` 为全部指甲 **union 单紧框**（勿回退 5.30 top-2 单甲框或左右半掌大框）；`nailsForWan27Bbox` 与 VLM/标签 prompt（`tryon-prompt.js`）分离；`ping` 返回 `tryonStrategy`。
- `tryon` 鉴权：客户端 `imageUrl`/`imageBase64` 默认拒绝，除非 `TRYON_ALLOW_URL=1`；内部调用（如 `submitTryonJob` → `analyzeNails`）须传 `_internalUrl: true`。
- 登录：`cloudfunctions/login` + `USE_CLOUD_LOGIN`（`user.service` 云失败降级 Mock）；登录页弹层 `chooseAvatar` + 昵称确认后写入 `userStore`；`app.json` 首屏登录页，已登录冷启动 `app.onLaunch` 跳首页（`skipLoginAutoRedirect` 防重复 `switchTab`）。小程序版本见 `app.globalData.version`（当前 **1.1.3**）。
- 自定义参考款：`try-on-static` 上传图 → `tryon-cloud-adapter.uploadStyleRef` → 云函数 `styleFileID`（`styleSource: custom-upload`）；试戴历史 `history.service` 无 mock seed，展示真实款式名/标签与国内时间格式。
- 合成等待 UI：`pages/try-on-static` 使用 `utils/compose-waiting.js`（约 **30s** 文案、`ESTIMATE_COMPOSE_SEC`、居中 logo `BRAND_LOGO` → `/assets/logo.jpg`、外圈旋转无白底）。
- 高清出片额度：统一在 `services/quota.service.js`；调试期 `ENABLE_FREE_HD_QUOTA: false`（`feature-flags.js`）。保存相册优先 `outputFileID` 云存储路径，减少 DashScope OSS 域名白名单问题。
- 协作文档：`docs/COLLABORATION_SOP.md`、`docs/GITHUB_COLLABORATION.md`、`docs/TEAMMATE_ONBOARDING.md`。
