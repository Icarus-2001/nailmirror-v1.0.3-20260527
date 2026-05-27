# GitHub 协作与回滚指南

> 仓库地址：`https://github.com/Icarus-2001/nailmirror-v1.6-20260524`  
> 默认分支：`main` · 小程序代码根：`nailmirror/src/`

本文说明队友如何获得上传权限、日常协作流程，以及合并后出问题时如何安全回滚。

---

## 1. 只发链接够吗？

**不够。** GitHub 链接只是仓库地址，**不会自动赋予写权限**。

| 仓库可见性 | 队友能看到代码吗 | 能直接 push 吗 |
|-----------|----------------|---------------|
| 私有（Private） | 需被邀请为协作者 | 需被加为 Collaborator |
| 公开（Public） | 任何人可浏览 / fork | 不能直接 push 到你的仓库 |

### 负责人需要做的（一次性）

1. 打开仓库 → **Settings** → **Collaborators**（或 **Manage access**）
2. 点击 **Add people**，输入队友的 **GitHub 用户名或邮箱**
3. 队友在邮箱 / GitHub 通知里 **Accept invitation**

完成后队友才能 `git push` 到本仓库（若未启用分支保护）。

---

## 2. 推荐协作流程

**不要两人直接改 `main`。** 使用「功能分支 + Pull Request」：

```text
main ──●──●──●──●──●
          \      /
feature ───●──●──●  →  PR  →  review → merge
```

### 队友首次克隆

```bash
git clone https://github.com/Icarus-2001/nailmirror-v1.6-20260524.git
cd nailmirror-v1.6-20260524
```

### 日常开发（每次改功能）

```bash
git pull origin main                    # 先同步最新 main
git checkout -b feature/简短描述         # 新建功能分支，例如 feature/tryon-ui-fix

# … 在 nailmirror/src/ 或 docs/ 中修改 …

git add .
git commit -m "feat(tryon): 描述本次改动"
git push -u origin feature/简短描述
```

### 在 GitHub 上合并

1. 打开仓库 → **Pull requests** → **New pull request**
2. `base: main` ← `compare: feature/xxx`
3. 填写改动说明，指定 reviewer（可选）
4. **合并前**：在微信开发者工具中本地验证试戴链路（见 [TEAMMATE_ONBOARDING.md](./TEAMMATE_ONBOARDING.md) 验收清单）
5. 确认无误后 **Merge pull request**

### 合并后同步本地

```bash
git checkout main
git pull origin main
git branch -d feature/简短描述          # 可选：删除已合并的本地分支
```

---

## 3. 合并后有问题，如何回滚？

Git 保留完整历史，**合并不会删除旧版本**。优先使用「反向提交」，避免改写远程历史。

### 方法一：GitHub 上 Revert（最推荐）

适用于通过 PR 合并的改动：

1. 打开出问题的 **已合并 PR** 页面
2. 点击 **Revert** 按钮
3. GitHub 会生成一个撤销该 PR 的新 PR
4. Review 后 merge 这个 Revert PR

优点：不改写历史、不需要 force push，多人协作最安全。

### 方法二：命令行 `git revert`

针对某次 merge commit：

```bash
git pull origin main
git log --oneline -10                   # 找到有问题的 merge commit hash
git revert -m 1 <merge-commit-hash>     # -m 1 保留 main 主线
git push origin main
```

### 方法三：回到某个稳定 commit（慎用）

```bash
git log --oneline                       # 找到合并前的稳定 commit
git checkout <good-commit-hash>         # 仅查看旧版本
# 或从稳定点开修复分支：
git checkout -b hotfix/rollback main
git revert -m 1 <bad-merge-hash>
git push -u origin hotfix/rollback
```

**避免**在多人协作时对 `main` 使用 `git push --force`，会导致队友本地仓库冲突。

### 方法四：打 Tag 标记稳定版

重要里程碑合并前，由负责人打 tag：

```bash
git tag v1.6.0
git push origin v1.6.0
```

出问题时可在 GitHub **Releases / Tags** 中查看该版本对应的代码快照。

---

## 4. 可选：保护 main 分支

仓库 **Settings → Branches → Add branch protection rule**：

| 规则 | 建议 |
|------|------|
| Branch name pattern | `main` |
| Require a pull request before merging | 开启 |
| Do not allow bypassing the above settings | 开启（含管理员） |

效果：所有人（含协作者）都必须通过 PR 才能改 `main`，不能直接 push。

---

## 5. 常见问题

**Q：队友 push 时提示 403 / Permission denied？**  
A：尚未接受 Collaborator 邀请，或未被添加。请负责人检查 Settings → Collaborators。

**Q：队友本地和远程冲突怎么办？**  
A：在功能分支上执行 `git pull origin main`（或 rebase），解决冲突后再 push，不要 force push 到共享分支。

**Q：不小心把密钥 commit 了？**  
A：立即在对应云平台轮换密钥，并联系负责人从历史中移除敏感文件（需额外处理，单纯 revert 不够）。

**Q：合并前要测什么？**  
A：至少在微信开发者工具中跑通：编译 → 选手照 → 云试戴 → 查看结果图。云函数改动需重新「上传并部署」。详见 [SETUP_USER.md](./SETUP_USER.md) 与 [TEAMMATE_ONBOARDING.md](./TEAMMATE_ONBOARDING.md)。

---

## 6. 相关文档

| 文档 | 用途 |
|------|------|
| [TEAMMATE_ONBOARDING.md](./TEAMMATE_ONBOARDING.md) | 环境配置、云函数、验收清单 |
| [SETUP_USER.md](./SETUP_USER.md) | DashScope、云开发、试戴测试 |
| [PROJECT.md](./PROJECT.md) | 目录结构与能力概览 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本迭代记录 |
