# 架构说明（当前 MVP）

## 1. 分层

```
Pages → Services → Adapters → 云函数 / Mock
                ↘ style.service → mock/styles.real.js
```

- **Pages**：UI 与页面状态
- **Services**：业务编排（`try-on.service.js`、`style.service.js`）
- **Adapters**：可替换实现（`tryon-cloud-adapter` / `tryon-mock-adapter`）
- **云函数**：敏感逻辑与 DashScope 调用

## 2. 试戴数据流

```mermaid
sequenceDiagram
  participant P as try-on-static
  participant S as try-on.service
  participant A as tryon-cloud-adapter
  participant CF as cloudfunctions/tryon
  participant DS as DashScope

  P->>S: startTryOn(style, handPath)
  S->>A: submitJob
  A->>A: wx.cloud.uploadFile
  A->>CF: submitTryonJob(fileID, styleMeta)
  CF->>DS: Qwen-VL 款式+手照 → prompt
  CF->>DS: Qwen-VL 指甲位置
  CF->>CF: Jimp 椭圆 Mask
  CF->>DS: 万相 description_edit_with_mask
  CF-->>A: jobId
  loop 轮询
    A->>CF: queryTryonJob
    CF-->>A: status / outputUrl
  end
  A-->>P: composedUrl
```

## 3. 云函数 `tryon` 动作

| action | 用途 |
|--------|------|
| `ping` | 健康检查（Key、模型名、runtime） |
| `analyzeNails` | 仅 VL 定位指甲（调试） |
| `submitTryonJob` | 提交试戴任务 |
| `queryTryonJob` | 查询万相任务状态 |

Handler 标识：`handler-v5-eval-stable`（见 `handler.js` 内 `RUNTIME_TAG`）

### submitTryonJob 处理步骤

1. 从云存储取手照 URL
2. **Inpaint Prompt**：若传 `styleCoverUrl`，Qwen-VL 双图分析；否则用 `stylePrompt` / `color` / `design`
3. **指甲 Mask**：Qwen-VL 返回归一化椭圆 → Jimp 绘制白底指甲区 → 上传 Mask
4. **万相**：`description_edit_with_mask`，轮询至 `SUCCEEDED`
5. 返回 `outputUrl`（OSS 临时链接）

## 4. 前端 Adapter 切换

`services/try-on.service.js` 读取 `feature-flags.js`：

- `USE_CLOUD_TRYON === true` → `tryon-cloud-adapter.js`
- 否则 → `tryon-mock-adapter.js`（本地占位图）

## 5. 款式数据

- 源：`data/美甲款式数据（初稿版）.xlsx`
- 生成：`mock/styles.real.js`（25 条）
- 消费：`style.service.js` → 款式库、详情、首页、热榜

字段映射见 [DATA_SCHEMA.md](./DATA_SCHEMA.md)。

## 6. Mock 手照

| 来源 | 文件 |
|------|------|
| 默认单张 | `config/mock-hand.js` + `data/手型.jpg` |
| 13 张评测集 | `mock/eval-hands.js`（由 `scripts/import-eval-hands.js` 生成） |

试戴页 `USE_MOCK_HAND_PHOTO` 为 true 时展示选择器，无需相册权限。

## 7. 隐私授权

- `app.js`：`wx.onNeedPrivacyAuthorization` → `registerPrivacyPopup`
- 组件：`components/privacy-popup`
- 挂载页：`pages/home`、`pages/try-on-static`

## 8. 仍为 Mock 的模块

| 模块 | Adapter / 数据 |
|------|----------------|
| 商家入驻 / 套餐 | `merchant-mock-adapter` |
| 预约 / 订单 | `booking-mock-adapter` |
| 爬虫监控 | `crawler-mock-adapter` |
| AI 同款 | `ai-match-mock-adapter` |

## 9. 云函数依赖

`cloudfunctions/tryon/package.json`：

- `wx-server-sdk`
- `jimp`（Mask 绘制）

部署时使用微信开发者工具 **云端安装依赖**，勿本地打包 `node_modules`。

## 10. 扩展方向（未实现）

- 更精准指甲分割（SAM / 专用模型）
- 万相或 ComfyUI 款式 reference img2img
- 真实商家 / 预约后端
- AR 试戴页面接入 app.json
