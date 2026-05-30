# 用户准备清单

按顺序完成以下步骤后，可在开发者工具中跑通**云试戴 MVP**。

---

## 1. 微信开发者工具

1. 打开目录：`nailmirror/src/`（不是仓库根目录）
2. AppID：`wxb5ec84f31303cfde`（见 `project.config.json`）
3. **详情 → 本地设置**：开发阶段可勾选「不校验合法域名…」；**验证 2K 保存前请取消勾选**（与真机行为一致）
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

## 3. 部署云函数

1. **右键 `cloudfunctions` 文件夹** → **选择云环境** → `cloud1-d2g3df4y16873034b`（须与 `config/cloud-env.js` 的 `ENV_ID` 一致；未选环境会上传失败）
2. 右键 `cloudfunctions/login` → **上传并部署：云端安装依赖**（微信一键登录，返回真实 OPENID）
3. 右键 `cloudfunctions/tryon` → **上传并部署：云端安装依赖**（试戴 / 自定义参考图）
4. **不要**在云函数目录下本地 `npm install`（会导致上传包过大失败）
5. 云函数目录内 **不要提交** `node_modules`

### 自定义参考款式图

试戴流程 **选甲型 → 选款式** 步网格首位为「上传参考款式」：从相册选择小红书等保存的参考图 → 上传至云存储 `tryon/refs/` → 万相 2.7 双图试戴。须已部署 `tryon` 且 `USE_CLOUD_TRYON: true`。

试戴英文 prompt 与 2.7 指甲框选逻辑见 [`CHANGELOG.md`](./CHANGELOG.md)（2026-05-30 试戴修复）。

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
| `USE_MOCK_HAND_PHOTO` | `true` | 显示评测手照列表（与拍照/相册并存） |
| `SHOW_WAN_MODEL_PICKER` | `true`（对比）/ `false`（上线） | 试戴页万相模型下拉 |

---

## 6. 试戴测试步骤

1. 编译 → 首页 → **试戴** → 选款式 → **开始试戴**
2. 选手照方式（三选一）：
   - **拍照 / 从相册选择**（需隐私指引已发布，见第 4 节）
   - 或下方 **13 张评测手照 / 本地手型**
3. 上传步骤可选 **万相模型**（2.1 / 2.7），固定评测手照后各生成一次对比
4. 等待约 30–90 秒（2.7 可能更久），预览页显示「模型：xxx」
5. 预览页 → **导出 2K 高清图** → 出图页 → **保存到相册**（真机必测，见第 7 节）

---

## 7. 下载域名与 2K 保存（上线前 / 真机必配）

万相结果图存在阿里云 OSS，区域不固定。**真机**保存前必须用 `wx.downloadFile` / `wx.getImageInfo` 拉取 OSS URL，因此须在公众平台配置 **downloadFile 合法域名**（须带 `https://` 协议头）。

路径：微信公众平台 → 开发 → 开发管理 → 开发设置 → **downloadFile 合法域名**

### 建议一次性粘贴（万相 + 款式封面）

```text
https://p0.meituan.net;https://p1.meituan.net;https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com;https://dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com;https://dashscope-result-sh.oss-cn-shanghai.aliyuncs.com;https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com;https://dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com;https://dashscope-result-zjk.oss-cn-zhangjiakou.aliyuncs.com;https://dashscope-result-sz.oss-cn-shenzhen.aliyuncs.com;https://dashscope-result-hy.oss-cn-heyuan.aliyuncs.com;https://dashscope-result-cd.oss-cn-chengdu.aliyuncs.com;https://dashscope-result-gz.oss-cn-guangzhou.aliyuncs.com
```

| 域名后缀 | 区域 |
|----------|------|
| `dashscope-result-bj.oss-cn-beijing.aliyuncs.com` | 北京 |
| `dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com` | 杭州 |
| `dashscope-result-sh.oss-cn-shanghai.aliyuncs.com` | 上海 |
| `dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com` | 乌兰察布 |
| `dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com` | 乌兰察布 ACDR（2.7 常见） |
| `dashscope-result-zjk.oss-cn-zhangjiakou.aliyuncs.com` | 张家口 |
| `dashscope-result-sz.oss-cn-shenzhen.aliyuncs.com` | 深圳 |
| `dashscope-result-hy.oss-cn-heyuan.aliyuncs.com` | 河源 |
| `dashscope-result-cd.oss-cn-chengdu.aliyuncs.com` | 成都 |
| `dashscope-result-gz.oss-cn-guangzhou.aliyuncs.com` | 广州 |

> 阿里云可能新增其它 `dashscope-result-*.aliyuncs.com`；保存失败时弹窗会显示**实际 host**，按提示补加即可。  
> 错误示例：`dashscope-result-bj.oss-cn-beijing.aliyuncs.com`（缺少 `https://` 会提示「该域名协议头非法」）

### 开发者工具 vs 真机

| 环境 | 域名校验 | 写入相册 |
|------|----------|----------|
| 开发者工具（勾选「不校验合法域名」） | 跳过 | 多为模拟成功 |
| 开发者工具（取消勾选） | 与线上一致 | 仍可能模拟成功 |
| **真机预览 / 正式版** | **强制** | **强制**系统相册权限 |

真机保存失败时：① 核对 downloadFile 域名；② 完全退出微信后重新扫码；③ iOS：**设置 → 微信 → 照片 → 所有照片**。

### 2K 出图保存链路（代码）

```
试戴预览 → 导出 2K → pages/hd-output
  → utils/hd-output-nav（storage 传 hdUrl，避免 URL 过长）
  → utils/image.saveRemoteImageToAlbum（getImageInfo → downloadFile → saveToAlbum）
```

万相 OSS 链接有效期约 **24 小时**，生成后请尽快保存。

---

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| 云函数上传失败 / 包过大 | 删除 `cloudfunctions/tryon/node_modules`，用「云端安装依赖」 |
| `Model not exist` | 2.7 需在百炼开通；或下拉改回 2.1 |
| `hasDashScopeKey: false` | 在云函数环境变量配置 `DASHSCOPE_API_KEY` |
| 相册点不开 / 无隐私弹窗 | 隐私指引未审核通过；或先用评测手照 |
| 工具能保存、真机不能 | 真机必配 downloadFile 域名 + 相册权限；取消工具「不校验合法域名」自测 |
| 2K 保存失败（弹窗提示域名） | 按弹窗 host 加入 downloadFile；保存配置后杀微信重进 |
| 2K 保存失败 HTTP 403 | OSS 链接过期，重新试戴生成后再保存 |
| 首页 / 热榜封面空白（真机） | 款式 CDN 须 **https://**；配置 downloadFile 域名 |
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
