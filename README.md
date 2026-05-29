# 美甲AI智能运营系统（运营端）

黑客松 Demo：采集 UGC 趋势、AI 生成运营日报、自动调整款式推荐权重。

## 快速启动

```powershell
cd nail-ops
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- 健康检查：<http://127.0.0.1:8000/>
- API 文档：<http://127.0.0.1:8000/docs>
- 数据库表验收：<http://127.0.0.1:8000/api/dashboard/tables>

## 目录结构

- `app/` — FastAPI 应用、ORM 模型、路由与服务
- `crawler/` — 小红书 / 抖音爬虫与打标
- `scheduler/` — APScheduler 定时任务
- `frontend/` — 运营后台静态页

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./nail_ops.db` | SQLite 连接串 |
