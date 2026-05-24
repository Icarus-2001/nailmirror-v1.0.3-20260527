# NailMirror 小程序

微信开发者工具打开 **本目录**（`nailmirror/src/`）。

## 快速启动

1. AppID 见 `project.config.json`，开通云开发
2. 配置 `config/cloud-env.js` 环境 ID
3. 部署 `cloudfunctions/tryon`（云端安装依赖）+ 环境变量 `DASHSCOPE_API_KEY`
4. 编译运行

完整步骤：**[../../docs/SETUP_USER.md](../../docs/SETUP_USER.md)**

## 功能开关

`config/feature-flags.js`：

| 开关 | 当前建议 |
|------|----------|
| `USE_REAL_STYLES` | `true` — 25 条真实款式 |
| `USE_CLOUD_TRYON` | `true` — 云试戴 |
| `USE_MOCK_HAND_PHOTO` | `true` — 调试时可跳过相册 |

## 数据脚本

```bash
node scripts/import-styles.js
node scripts/import-eval-hands.js
```

## 文档

所有文档在仓库 **`docs/`** 目录：[../../docs/README.md](../../docs/README.md)
