# 0531 稳定出图策略

> **策略 ID：** `0531-stable`  
> **定版日期：** 2026-05-31  
> **适用范围：** 云函数 `tryon` + C 端静态试戴（`tryon-cloud-adapter` → `wan2.7-image-pro` 主路径）

团队实测该组合下五指试戴较稳定、浮空甲较少。**调整 bbox / prompt / 模型前请先读本文档**，避免回退到 5.30「top-2 单甲框」或「左右半掌大框」等已知劣化方案。

---

## 1. 模型与输入

| 项 | 策略 |
|----|------|
| 默认模型 | `wan2.7-image-pro`（`feature-flags.DEFAULT_WAN_MODEL`；云 env `WAN_IMAGE_MODEL` 可覆盖） |
| 手照输入 | 仅云存储 `fileID`（客户端 `imageUrl`/`imageBase64` 默认拒绝；内部链路透 `_internalUrl: true`） |
| 款式融合 | 双图：图1 = `styleImageUrl` / `styleCoverUrl`，图2 = 手照；`bbox_list` 仅作用于手照 |
| 英文 prompt | `config/tryon-prompt.js`（与列表 VLM 标签同源，**独立于 bbox 逻辑**） |
| 目录款加速 | 客户端已传 `stylePrompt` 时云函数 **跳过款式 VLM**；轮询成功默认 **不转存** 云存储（预览端下载临时文件） |

---

## 2. 万相 2.7 bbox（核心）

实现：`cloudfunctions/tryon/wan-backends.js` → `mergeNailsToBboxList`

| 指甲数 | bbox 策略 |
|--------|-----------|
| 1–2 | 每甲一个框 |
| ≥3 | **所有指甲 union 成 1 个紧 bbox**（单框覆盖整排甲面，API 每图仍 ≤2 框） |

**不要改回：**

- 5.30 `top-2`：只画面积最大的 2 根手指  
- 5.29 左右半掌各 1 框：指缝空白大，易出浮空甲贴片  

**紧框半径：** `handler.js` → `nailsForWan27Bbox()` 对 VL 结果 **不乘** `MASK_SCALE`（`MASK_SCALE` 仅留给 2.1 mask 路径）。

---

## 3. Prompt 防护

`buildWan27Prompt` 附加约束（中英）：

- 仅编辑框内已有指甲  
- 禁止在指缝、背景生成浮空甲/图案  

---

## 4. 轮询与前端等待

| 项 | 值 |
|----|-----|
| 轮询上限 | `pollMaxAttempts`：2.7 为 60 次 × 2.5s（`tryon-cloud-adapter.js`） |
| 用户等待文案 | `compose-waiting.js` → **预计约 30 秒**（`ESTIMATE_SEC = 30`） |

---

## 5. 代码锚点（改策略时必查）

```
config/tryon-prompt.js          # 标签 → 英文 stylePrompt（勿与 bbox 混改）
cloudfunctions/tryon/wan-backends.js   # mergeNailsToBboxList, buildWan27Prompt
cloudfunctions/tryon/handler.js        # nailsForWan27Bbox, _internalUrl
services/adapters/tryon-cloud-adapter.js
config/feature-flags.js         # DEFAULT_WAN_MODEL
utils/compose-waiting.js        # ESTIMATE_SEC
```

`ping` 返回字段 `tryonStrategy: "0531-stable"` 可用于确认已部署本策略。

---

## 6. 部署检查

1. 修改云函数后：**上传并部署 tryon（云端安装依赖）**  
2. 云 env：`DASHSCOPE_API_KEY`；建议 `WAN_IMAGE_MODEL=wan2.7-image-pro`  
3. 开发者工具 `ping` → 确认 `tryonStrategy` / `wanModel` / `runtime`
