# NailMirror 双人协作 SOP

> **适用：** 2 人及以上在同一 GitHub 仓库协作开发  
> **默认分支：** `main` · **小程序代码根：** `nailmirror/src/`  
> **相关文档：** [GITHUB_COLLABORATION.md](./GITHUB_COLLABORATION.md)（权限与回滚）、[TEAMMATE_ONBOARDING.md](./TEAMMATE_ONBOARDING.md)（环境与验收）

---

## 1. 三条原则

| 原则 | 做法 |
|------|------|
| **不动共享的 main** | 两人都不直接 `git push origin main`；一律 **功能分支 + Pull Request** |
| **先拉后改** | 开新分支前先 `git pull origin main`，减少合并冲突 |
| **小步合并** | 一个 PR 只做一件事（一个 bug、一块 UI、一篇文档），便于 review 和回滚 |

---

## 2. 一次性准备

### 2.1 负责人

1. GitHub：**Settings → Collaborators** 邀请队友并接受邀请  
2. 微信：**公众平台 → 成员管理** 添加 **开发者**（共用 AppID / 云环境）  
3. （推荐）**Settings → Branches** 保护 `main`：必须 PR 合并、禁止 force push  
4. 重要里程碑：`git tag v1.x.x` 并 `git push origin v1.x.x`

### 2.2 协作者

1. `git clone` 仓库（以 GitHub 页面显示的当前仓库地址为准）  
2. 微信开发者工具打开 **`nailmirror/src/`**（不是仓库根目录）  
3. 按 [SETUP_USER.md](./SETUP_USER.md)、[TEAMMATE_ONBOARDING.md](./TEAMMATE_ONBOARDING.md) 配置环境  
4. 本地跑通验收：编译 → 选手照 → 云试戴 → 查看结果图  

---

## 3. 日常开发 SOP（每次改代码）

```text
1. 同步 main      git checkout main && git pull origin main
2. 开功能分支     git checkout -b feature/简短描述
3. 开发 + 自测    微信开发者工具验收（见第 5 节）
4. 提交           git add … && git commit -m "类型(模块): 说明"
5. 推送           git push -u origin feature/简短描述
6. 开 PR          base: main ← compare: feature/xxx
7. 互审           对方看 diff，必要时本地检出分支试跑
8. 合并           Merge pull request
9. 双方同步       git checkout main && git pull origin main
10. 清理分支      git branch -d feature/xxx（可选）
```

### 3.1 分支命名

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feature/` | 新功能 | `feature/tryon-wan27-toggle` |
| `fix/` | 修 bug | `fix/hd-output-save-album` |
| `docs/` | 仅文档 | `docs/collaboration-sop` |
| `hotfix/` | 紧急修复 | `hotfix/tryon-timeout` |

### 3.2 Commit message

```text
feat(tryon): 支持万相 2.7 切换
fix(hd-output): 修复保存相册失败
docs: 添加双人协作 SOP
```

格式：`类型(模块): 一句话说明`。

---

## 4. 分工与减少冲突

| 场景 | 建议 |
|------|------|
| 改不同目录 | 一人 `pages/`，一人 `cloudfunctions/tryon`，冲突少 |
| 必须改同一文件 | 事先对齐；避免两人各开分支长期不合并 |
| 云函数改动 | PR 中注明 **需部署的云函数**；合并后由约定方「上传并部署」 |
| 共享配置 | `cloud-env.js`、`project.config.json`、密钥：**单人改或 PR 必审** |
| Mock 数据 | 约定谁改 `mock/`，避免同时改 `styles.real.js` |

**节奏：** 有人 merge 进 `main` 后，另一方尽快 `git pull origin main`；功能分支上可 `git merge main` 解决冲突后再 push。PR 尽量 **1～2 天内** 合并。

---

## 5. PR 与合并前检查

### 5.1 PR 描述应包含

- 改了什么（1～3 条）  
- 如何自测（步骤）  
- 风险点（云函数 / API 费用 / 数据库）  
- 是否需要部署云函数  

### 5.2 Review 清单

**仅文档（`docs/`）：**

- [ ] diff 仅涉及文档，无意外文件  

**涉及代码：**

- [ ] 微信开发者工具可编译  
- [ ] 试戴链路可跑通（若改动 tryon 相关）  
- [ ] 未提交 `.env`、密钥、`project.private.config.json`  
- [ ] 云函数改动已在 PR 中说明部署责任  

### 5.3 合并方式（团队固定一种）

| 方式 | 说明 |
|------|------|
| **Squash merge**（推荐小团队） | `main` 上每个 PR 一条清晰记录 |
| **Merge commit** | 保留分支上全部 commit 历史 |

**避免**对 `main` 使用 Rebase merge（除非全员熟悉）。**禁止**对共享分支 `git push --force`。

---

## 6. 异常处理

| 情况 | 做法 |
|------|------|
| push 被拒（落后远程） | 在**自己的功能分支**上 `git pull origin main`，解决冲突后再 push |
| 合并后线上有问题 | 在 GitHub 对已合并 PR 点 **Revert**，再开修复分支（详见 [GITHUB_COLLABORATION.md](./GITHUB_COLLABORATION.md) §3） |
| 密钥误提交 | 立即轮换密钥并联系负责人处理历史，不能仅 revert |

---

## 7. 效率习惯

1. 控制 PR 体量（理想有效改动 < 300 行），review 更快。  
2. 动核心路径（`try-on.service.js`、`tryon` 云函数）前先沟通。  
3. 合并后**双方都** `git pull origin main`，再开新分支。  
4. 重要节点打 tag；较大功能更新 [CHANGELOG.md](./CHANGELOG.md)。  

---

## 8. 角色分工简表

| 角色 | 职责 |
|------|------|
| **负责人** | 邀协作者、保护 `main`、管微信开发者/云环境、审配置与云函数 PR、打 tag |
| **协作者** | 功能分支开发、自测、开 PR、按 review 修改 |
| **共同** | 不直推 `main`、合并前互审、出问题用 Revert、不 force push 共享分支 |

---

## 9. 一句话速记

`pull main` → `checkout -b` → 开发自测 → `push` → PR → review → merge → 双方都 `pull main`。

---

## 10. 相关文档索引

| 文档 | 用途 |
|------|------|
| [GITHUB_COLLABORATION.md](./GITHUB_COLLABORATION.md) | 权限、PR 流程、回滚、分支保护 |
| [TEAMMATE_ONBOARDING.md](./TEAMMATE_ONBOARDING.md) | 环境、云函数、验收清单 |
| [SETUP_USER.md](./SETUP_USER.md) | DashScope、试戴测试 |
| [PROJECT.md](./PROJECT.md) | 目录结构与能力概览 |
