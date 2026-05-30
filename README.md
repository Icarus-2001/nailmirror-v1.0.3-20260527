# NailMirror 运营云函数 (ops)

美甲试戴小程序运营端——微信云开发范式。

## 目录结构

```
cloudfunctions/ops/       ← 部署到微信云开发的运营云函数
  index.js                  入口调度器（action 路由）
  handlers/
    getSummary.js           运营数据快照（热款/飙升/冷款/外部趋势）
    generateReport.js       每日运营日报生成（Moonshot 同时产出日报+策略）
    approveReport.js        日报审批通过/驳回
    executeReport.js        执行调权策略，写 styles.rankWeight
    tagExternal.js          外部趋势录入 + Qwen-VL 自动打标
  utils/
    db.js                   云数据库分页查询工具
    llm.js                  日报=Moonshot moonshot-v1-8k；打标=DashScope qwen-vl-max
  package.json

archive/                  ← 原 FastAPI 实现（业务逻辑参考，不部署）
  app/                      FastAPI 路由与 SQLAlchemy 模型
  crawler/                  爬虫模块（存根）
  scheduler/                定时任务模块（存根）
  requirements.txt
```

## 云函数 action 一览

| action | 说明 | 写操作 |
|--------|------|--------|
| `ping` | 健康检查 | 否 |
| `getSummary` | 运营数据快照 | 否 |
| `generateReport` | 生成今日日报（幂等，Moonshot 同时产出日报+策略） | 是 |
| `approveReport` | 日报审批通过 | 是 |
| `rejectReport` | 日报驳回 | 是 |
| `executeReport` | 执行调权，写 styles + operation_logs | 是 |
| `tagExternal` | 外部趋势录入 + VLM 打标 | 是 |

## 云数据库 Collections

| Collection | 说明 |
|------------|------|
| `styles` | 款式库，含 `rankWeight`、`isActive` |
| `try_on_logs` | 用户试戴记录（由 tryon 云函数写入） |
| `external_trends` | 外部平台趋势帖子 |
| `daily_reports` | 每日运营日报（pending/approved/rejected/executed） |
| `operation_logs` | 权重变更审计记录 |
| `users` | 用户信息与收藏 |

## 部署步骤

1. 在微信开发者工具中打开团队仓库 `nailmirror/`
2. 将 `cloudfunctions/ops/` 整个目录复制到 `nailmirror/src/cloudfunctions/ops/`
3. 右键点击 `ops` 目录 → **上传并部署：云端安装依赖**
4. 在云开发控制台 → 云函数 → ops → 配置环境变量：
   - `MOONSHOT_API_KEY`：月之暗面 Moonshot API Key（运营日报）
   - `DASHSCOPE_API_KEY`：阿里云 DashScope API Key（VLM 图片打标，与试戴功能共用）
   - `ADMIN_OPENIDS`：管理员 openid 列表（逗号分隔）
5. 测试：云开发控制台 → ops → 测试 → `{"action":"ping"}`

## 调用方式（小程序端）

```javascript
// 读操作（任意页面）
const res = await wx.cloud.callFunction({
  name: 'ops',
  data: { action: 'getSummary' }
})

// 写操作（B 端，自动携带 callerOpenid）
const res = await wx.cloud.callFunction({
  name: 'ops',
  data: { action: 'generateReport' }
})
```

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `MOONSHOT_API_KEY` | 是 | 月之暗面 Moonshot Key，运营日报使用（与原 Python 一致） |
| `MOONSHOT_BASE_URL` | 否 | 默认 `https://api.moonshot.cn/v1` |
| `MOONSHOT_MODEL` | 否 | 默认 `moonshot-v1-8k` |
| `DASHSCOPE_API_KEY` | 是 | 阿里云 DashScope Key，VLM 图片打标使用（与试戴功能共用） |
| `QWEN_VL_MODEL` | 否 | 默认 `qwen-vl-max`（与前端 tryon 一致） |
| `ADMIN_OPENIDS` | 建议配置 | 逗号分隔的管理员 openid，空则开发模式放行所有人 |
