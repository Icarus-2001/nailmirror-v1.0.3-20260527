# 用户准备清单

按顺序完成以下步骤后，可在开发者工具中跑通**云试戴 MVP**。

---

## 1. 微信开发者工具

1. 打开目录：`nailmirror/src/`（不是仓库根目录）
2. AppID：`wxb5ec84f31303cfde`（见 `project.config.json`）
3. **详情 → 本地设置**：勾选「不校验合法域名…」（开发阶段）
4. **详情 → 本地设置**：勾选「启用云开发」

---

## 2. 云开发环境

1. 工具栏 **云开发** → 开通环境（免费版即可）
2. 复制环境 ID，写入 `config/cloud-env.js`：

```javascript
module.exports = { ENV_ID: '你的环境ID' };
```

当前已配置示例：`cloud1-d2g3df4y16873034b`

3. **云开发控制台 → 存储**：默认即可，试戴手照会上传到 `tryon/hands/`

---

## 3. 部署云函数 `tryon`

1. 右键 `cloudfunctions/tryon` → **上传并部署：云端安装依赖**
2. **不要**在 `cloudfunctions/tryon` 下本地 `npm install`（会导致上传包过大失败）
3. 云函数目录内 **不要提交** `node_modules`

### 环境变量（云开发控制台 → 云函数 → tryon → 配置）

| 变量 | 必填 | 说明 |
|------|------|------|
| `DASHSCOPE_API_KEY` | ✅ | 阿里云 DashScope API Key |
| `WAN_IMAGE_MODEL` | 可选 | 云函数默认模型：`wanx2.1-imageedit`（默认）或 `wan2.7-image-pro` |
| `WANX_EDIT_MODEL` | 可选 | 未设 `WAN_IMAGE_MODEL` 时生效，默认 `wanx2.1-imageedit` |
| `WAN_IMAGE_SIZE` | 可选 | 2.7 输出尺寸，推荐 `2K` |
| `QWEN_VL_MODEL` | 可选 | 默认 `qwen-vl-max-latest` |

### 万相模型对比（小程序内一键切换）

1. `config/feature-flags.js` 保持 `SHOW_WAN_MODEL_PICKER: true`
2. 试戴页上传步骤会出现 **万相模型** 下拉（2.1 / 2.7）
3. 选择会保存到本地；**同手同款**各生成一次即可对比
4. 下拉选择会作为 `wanModel` 传给云函数，**覆盖** env 默认值（无需重新部署）

| 模型 | 路径 |
|------|------|
| `wanx2.1-imageedit` | Qwen-VL + Jimp Mask + 局部重绘 |
| `wan2.7-image-pro` | 款式图 + 手照 + bbox 框选指甲（需百炼开通 2.7） |

### 验证部署

开发者工具 **云开发 → 云函数 → tryon → 测试**，输入：

```json
{"action":"ping"}
```

期望返回含：`runtime: "handler-v7-wan27-dual"`、`supportedModels` 含两个模型名

---

## 4. 小程序隐私与相册

1. [微信公众平台](https://mp.weixin.qq.com) → 开发 → 用户隐私保护指引 → 填写并发布
2. 需声明：**相册（选图）**、**云开发相关能力**
3. 项目已集成 `components/privacy-popup`，在首页与试戴页挂载
4. `app.json` 的 `requiredPrivateInfos` **不要** 包含 `chooseMedia`（仅允许位置类 API）

相册仍失败时，可暂时保持 `USE_MOCK_HAND_PHOTO: true` 用 Mock / 评测手照测试。

---

## 5. 功能开关

`config/feature-flags.js`：

| 开关 | 建议值 | 说明 |
|------|--------|------|
| `USE_REAL_STYLES` | `true` | 25 条美团真实款式 |
| `USE_CLOUD_TRYON` | `true` | 走云函数 + DashScope |
| `USE_MOCK_HAND_PHOTO` | `true`（调试）/ `false`（正式相册） | 跳过相册，用默认或评测手照 |
| `SHOW_WAN_MODEL_PICKER` | `true`（对比）/ `false`（上线） | 试戴页万相模型下拉 |

---

## 6. 试戴测试步骤

1. 编译 → 首页 → **试戴** → 选款式 → **开始试戴**
2. 选手照方式：
   - **Mock 模式**：点「使用默认手照」或下方 **13 张评测手照**
   - **相册模式**：`USE_MOCK_HAND_PHOTO: false` 后点上传（需隐私指引生效）
3. 上传步骤可选 **万相模型**（2.1 / 2.7），固定评测手照后各生成一次对比
4. 等待约 30–90 秒（2.7 可能更久），预览页显示「模型：xxx」

---

## 7. 下载域名（上线前）

微信公众平台 → 开发 → 开发管理 → 服务器域名 → **downloadFile 合法域名**：

- `https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com`（万相结果图）
- `https://p0.meituan.net`、`https://p1.meituan.net`（款式封面，若仍用美团 CDN）

---

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| 云函数上传失败 / 包过大 | 删除 `cloudfunctions/tryon/node_modules`，用「云端安装依赖」 |
| `Model not exist` | 2.7 需在百炼开通；或下拉改回 2.1 |
| `hasDashScopeKey: false` | 在云函数环境变量配置 `DASHSCOPE_API_KEY` |
| 相册点不开 | 检查隐私指引 + `privacy-popup`；或先用 Mock 手照 |
| 试戴几乎无变化 | 换光线清晰、五指可见的手照；查看云函数日志中 VL / 万相步骤 |
| 首页 / 热榜仍是乱图 | 确认 `USE_REAL_STYLES: true` 并重新编译 |
| 依赖分析报错 `utils/privacy.js` | 已移除，改用 `components/privacy-popup` |

---

## 9. 重新导入数据

```bash
cd nailmirror/src
node scripts/import-styles.js
node scripts/import-eval-hands.js
```

Excel 源文件在仓库 `data/` 目录。

---

## 10. 费用参考

- 微信云开发：免费额度内通常够用
- DashScope：按 Qwen-VL 调用次数 + 万相生图张数计费，开发阶段建议设额度提醒
