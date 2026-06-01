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
- 产品界面避免 Mock 占位图（登录、合成等待等用 `BRAND_LOGO`）；与 `feature-flags` 里开发用 Mock 手照/降级开关区分。
- `ops` 云函数与 B 端云数据库由协作者负责；优先做不阻塞主试戴链路的 C 端修复。

## 已学习的工作区事实

- **NailMirror**：美甲 AI 试戴 + 商家运营微信小程序；应用根目录为 `nailmirror/src/`（微信开发者工具打开此目录）。
- **GitHub 仓库（唯一）**：`Icarus-2001/nailmirror-v1.0.3-20260527`；`git remote` 的 `origin` 须指向该 URL；历史 `nailmirror-v1.6-*` 为旧仓名/本地目录代号，勿再向旧仓 push。`main` 已含 `ops`/`seed`；B 端 `pages-b/` 接入进度以 main 为准。
- **同步 main**：协作者 PR 合入 `main` 后先 `git fetch origin` → `git checkout main` → `git pull origin main`；若在功能分支继续开发再 `merge`/`rebase origin/main`；在功能分支上 `git pull` 只更新该分支，**不会**自动带入 `main` 新提交。
- 共享云环境 ID：`cloud1-d2g3df4y16873034b`（见 `nailmirror/src/config/cloud-env.js`）；队友部署到同一环境即可共享云函数、数据库与环境变量，无需本地同步文件。
- 生产后端方向（见 `docs/后端及运营优化方案0527.md`）：仅微信云——`tryon` 已部署；计划 `ops` + 云数据库集合；6.6 前不做 FastAPI/PostgreSQL。
- 款式与标签：25 款在 `nailmirror/src/mock/styles.real.js`（`scripts/import-styles.js`）；封闭词表 `docs/美甲标签与标准词表.md`（8 色系、设计、甲型、风格），VLM 打标经 `config/tag-vocabulary.js` + `--vlm --retag`；未 retag 时默认标签可能轮换。
- **版本号**：小程序产品版 SemVer `1.1.x`（`app.globalData.version`）；仓库目录名 `nailmirror-v1.6-*` 为里程碑代号，**不等于**小程序版本号。
- 试戴稳定策略 **`0531-stable`**：见 `docs/TRYON_0531稳定出图策略.md` 与 `config/tryon-strategy.js`；万相 2.7 默认 `wan2.7-image-pro`，可选 `wan2.7-image` 标准版（`SHOW_WAN_MODEL_PICKER` 对比；**勿改 Pro 策略**，标准版单独调参）；≥3 甲时 `mergeNailsToBboxList` 为全部指甲 **union 单紧框**；`nailsForWan27Bbox` 与 VLM/标签 prompt（`tryon-prompt.js`）分离；`ping` 返回 `tryonStrategy`。
- `tryon` 鉴权：客户端 `imageUrl`/`imageBase64` 默认拒绝，除非 `TRYON_ALLOW_URL=1`；内部调用（如 `submitTryonJob` → `analyzeNails`）须传 `_internalUrl: true`。
- **试戴流程步数**：首页试戴四步（甲型→选款→手照→预览）；商详带 `styleId` 为三步（跳过选款）；是否短流程以 URL `styleId` 为准，勿用 `tryOnStore` 误判。
- **登录与云函数**：`cloudfunctions/login` + `USE_CLOUD_LOGIN`（云失败降级 Mock）；登录页弹层 `chooseAvatar` + 昵称确认写入 `userStore`（**仅本地**，login 云函数不落库）；云函数须在开发者工具**手动上传部署**（推 Git 不更新云端）；`app.json` 首屏登录页，已登录冷启动 `app.onLaunch` 跳首页（`skipLoginAutoRedirect`）；版本 `app.globalData.version` 当前 **1.1.4**；登录页须挂载 `privacy-popup` 并在选头像/昵称前完成隐私授权。
- **C 端体验**：自定义参考款 `try-on-static` → `uploadStyleRef` → 云函数 `styleFileID`；试戴历史真实款式名/标签与国内时间；合成等待 `utils/compose-waiting.js`（约 30s、`BRAND_LOGO`）；高清额度 `quota.service.js`（调试期 `ENABLE_FREE_HD_QUOTA: false`）；保存相册优先 `outputFileID`；协作见 `docs/COLLABORATION_SOP.md` 等。
