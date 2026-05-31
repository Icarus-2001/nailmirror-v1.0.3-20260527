# 0531 稳定出图策略

> **策略 ID：** `0531-stable`  
> **定版日期：** 2026-05-31（**2026-05-31 增补**：万相 2.7 标准版单独调参，Pro 路径不变）  
> **适用范围：** 云函数 `tryon` + C 端静态试戴（主路径 `wan2.7-image-pro`；调试可选 `wan2.7-image` 标准版）

团队实测 **Pro** 组合下五指试戴较稳定、浮空甲较少。**调整 Pro 的 bbox / prompt 前请先读本文档**，避免回退到 5.30「top-2 单甲框」或「左右半掌大框」等已知劣化方案。

**万相 2.7 标准**（`wan2.7-image`）为成本对比档位，使用 **独立调参**（见 §7），**不得**把标准版的 union/外扩/VL 阈值合并进 Pro 的 0531 逻辑。

---

## 1. 模型与输入

| 项 | 策略 |
|----|------|
| 默认模型 | `wan2.7-image-pro`（`feature-flags.DEFAULT_WAN_MODEL`；云 env `WAN_IMAGE_MODEL` 可覆盖） |
| 调试对比 | 试戴页下拉：`wan2.7-image-pro`（万相 2.7 Pro）、`wan2.7-image`（万相 2.7 标准）、可选 `wanx2.1-imageedit` |
| 手照输入 | 仅云存储 `fileID`（客户端 `imageUrl`/`imageBase64` 默认拒绝；内部链路透 `_internalUrl: true`） |
| 款式融合 | 双图：图1 = `styleImageUrl` / `styleCoverUrl`，图2 = 手照；`bbox_list` 仅作用于手照 |
| 英文 prompt | `config/tryon-prompt.js`（与列表 VLM 标签同源，**独立于 bbox 逻辑**） |
| 目录款加速 | 客户端已传 `stylePrompt` 时云函数 **跳过款式 VLM**；轮询成功默认 **不转存** 云存储（预览端下载临时文件） |

---

## 2. 万相 2.7 Pro bbox（0531 核心，仅 `wan2.7-image-pro`）

实现：`cloudfunctions/tryon/wan-backends.js` → `mergeNailsToBboxList(..., model)`，当 `model !== 'wan2.7-image'` 时走本节。

| 指甲数 | bbox 策略 |
|--------|-----------|
| 1–2 | 每甲一个框 |
| ≥3 | **所有指甲 union 成 1 个紧 bbox**（单框覆盖整排甲面，API 每图仍 ≤2 框） |

**不要改回：**

- 5.30 `top-2`：只画面积最大的 2 根手指  
- 5.29 左右半掌各 1 框：指缝空白大，易出浮空甲贴片  

**紧框半径：** `handler.js` → `nailsForWan27Bbox(nails, model)`，Pro 对 VL 结果 **不乘** `MASK_SCALE`（`MASK_SCALE` 仅留给 2.1 mask 路径）。

---

## 3. Prompt 防护（Pro 与 2.1 共用基线）

`buildWan27Prompt(prompt, hasStyle, model)` 基线约束：

- 仅编辑框内已有指甲  
- 禁止在指缝、背景生成浮空甲/图案  

标准版在基线上 **额外** 增加「框内每一根指都要覆盖」类英文句（见 §7），Pro **不** 追加该句。

---

## 4. 轮询与前端等待

| 项 | 值 |
|----|-----|
| 轮询上限 | `pollMaxAttempts`：2.7 系（Pro / 标准）均为 60 次 × 2.5s（`tryon-cloud-adapter.js`） |
| 用户等待文案 | `compose-waiting.js` → **预计约 30 秒**（`ESTIMATE_SEC = 30`） |

---

## 5. 代码锚点（改策略时必查）

```
config/tryon-prompt.js                    # 标签 → 英文 stylePrompt（勿与 bbox 混改）
cloudfunctions/tryon/wan-backends.js      # mergeNailsToBboxList, buildWan27Prompt, isWan27Standard
cloudfunctions/tryon/handler.js           # nailsForWan27Bbox, analyzeNails(VL), submitTryonJob 顺序
services/adapters/tryon-cloud-adapter.js
config/feature-flags.js                   # DEFAULT_WAN_MODEL, WAN_MODEL_OPTIONS
utils/compose-waiting.js                  # ESTIMATE_SEC
```

`ping` 可用于确认部署：

| 字段 | 说明 |
|------|------|
| `tryonStrategy` | `"0531-stable"` |
| `runtime` | 含 `wan27-std-tuning` 表示已含标准版调参 |
| `wan27StdTuning` | `"wan2.7-image-only"`（标准调参仅作用于该模型 id） |

`submitTryonJob` 响应在选用标准版时另含 `wan27StdTuning: true`。

---

## 6. 部署检查

1. 修改云函数后：**上传并部署 tryon（云端安装依赖）**  
2. 云 env：`DASHSCOPE_API_KEY`；生产建议 `WAN_IMAGE_MODEL=wan2.7-image-pro`  
3. 开发者工具 `ping` → 确认 `tryonStrategy` / `wanModel` / `runtime` / `wan27StdTuning`  
4. 百炼控制台：Pro 与 **标准**（`wan2.7-image`）需分别开通后再试戴对比  

---

## 7. 万相 2.7 标准版调参（仅 `wan2.7-image`）

**目的：** 在不动 Pro 0531 策略的前提下，缓解标准版「部分指甲无覆盖」（多因 VL 少检指甲或仅 2 个小 bbox）。

实现：`wan-backends.js` 中 `isWan27Standard(model)` 分支；`submitTryonJob` 先 `resolveWanModel` 再 `analyzeNails`，以便 VL 按模型分流。

| 环节 | 标准版（`wan2.7-image`） | Pro（`wan2.7-image-pro`） |
|------|--------------------------|---------------------------|
| VL 重试 | `confidence < 0.62` **或** `nails.length < 4`；英文 prompt 强调小指/食指 | 仍为 `< 3` 指甲或低置信度（0531 原阈值） |
| bbox 合并 | **≥2** 个指甲即 union 为 **1 框** | **≥3** union；1–2 各一框 |
| union 外扩 | 默认四周 **8%**（云 env `WAN27_STD_BBOX_PAD`，如 `0.05`～`0.08`） | 无额外外扩 |
| 甲面椭圆 | `nailsForWan27Bbox`：`rx/ry × 1.12`，上限略提高 | 0531 紧框，无放大 |
| 生图 prompt | 追加：框内每根指都要画（含 pinky/index） | 仅 §3 基线 |
| 提交失败重试 suffix | 强调全覆盖、高对比 | 原 「Strong visible nail polish…」 |

**权衡：** 标准版更易盖住外侧指，但 union + 外扩可能略增指缝浮空甲风险；若浮空甲增多，优先 **减小** `WAN27_STD_BBOX_PAD`，**不要** 为省事把上述逻辑并入 Pro。

**验证：** 同手照、同款式，Pro 与标准各生成一次；看 `nailCount` 与成片。选定成本/效果平衡的档位后，生产默认仍建议 **Pro**。
