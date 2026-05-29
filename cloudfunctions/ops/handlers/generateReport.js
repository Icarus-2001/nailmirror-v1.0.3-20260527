/**
 * generateReport — 生成每日运营日报
 * 对应 Python: app/routers/reports.py generate_report()
 *              + app/services/llm.py generate_daily_report()
 *
 * 流程：
 *   1. 幂等检查（今日已有 pending/approved/executed 则直接返回）
 *   2. computeWeights 拿到确定性调权策略（数值由 scoring 决定，非 LLM）
 *   3. 拼 LLM prompt（只叫 LLM 写 Markdown 解读，不产出数值）
 *   4. 调 DashScope qwen-plus 生成日报文本
 *   5. 写入 daily_reports（status: 'pending'）
 */
const cloud = require('wx-server-sdk')
const { getSummary }      = require('./getSummary')
const { computeWeights }  = require('./computeWeights')
const { generateText }    = require('../utils/llm')

function _buildPrompt(summary, weightResult) {
  const fmt = (items, fn) => items.length ? items.map(fn).join('\n') : '（无）'

  const hotLines = fmt(summary.hotStyles, (s) =>
    `款式「${s.name}」${s.design || ''}/${s.color || ''} 近7天试戴:${s.tryCount7d}次 增速:${s.growthRate}%`
  )
  const coldLines = fmt(summary.coldStyles, (s) =>
    `款式「${s.name}」${s.design || ''}/${s.color || ''} 近7天0次 上次:${s.lastTriedAt || '从未'}`
  )
  const externalLines = (() => {
    const lines = []
    for (const [platform, items] of [['小红书', summary.externalHot.xiaohongshu], ['抖音', summary.externalHot.douyin]]) {
      for (const t of items) {
        lines.push(`${platform} ${t.design || ''}/${t.color || ''} 互动量:${t.engagement || 0}`)
      }
    }
    return lines.length ? lines.join('\n') : '（无）'
  })()

  const boosts = weightResult.suggestions.filter((s) => s.delta > 0.3).slice(0, 3)
  const demotes = weightResult.suggestions.filter((s) => s.delta < -0.3).slice(0, 3)
  const strategyHint = [
    boosts.length  ? `建议提权：${boosts.map((s) => `「${s.name}」→${s.newWeight}`).join('、')}` : '',
    demotes.length ? `建议降权：${demotes.map((s) => `「${s.name}」→${s.newWeight}`).join('、')}` : '',
  ].filter(Boolean).join('；')

  return `当前运营数据（${summary.snapshotTime}）：

【近7天热门款式TOP5】
${hotLines}

【近7天无人试戴的款式】
${coldLines}

【外部社区趋势（近14天）】
${externalLines}

【三因子调权建议（仅供参考，你只需分析原因）】
${strategyHint || '（暂无显著变化建议）'}

请生成150-250字的运营日报（Markdown格式），包含：
1. 热款概况：TOP3款式及试戴量
2. 趋势简析：外部社区与店内热款是否有重叠的图案/颜色
3. 风险提示：列出需关注的冷款
4. 建议：2条可操作的运营建议`
}

function _buildStrategyJson(weightResult) {
  const boosts  = weightResult.suggestions.filter((s) => s.delta > 0.3).slice(0, 3)
  const demotes = weightResult.suggestions.filter((s) => s.delta < -0.3).slice(0, 3)
  const alerts  = weightResult.suggestions.filter((s) => s.factors.tryCount7d === 0)

  return {
    boosts:  boosts.map((s)  => ({ styleId: s.styleId, name: s.name, newWeight: s.newWeight, reason: `热度+动能评分${s.factors.heatScore + s.factors.momentumScore + s.factors.resonanceScore}` })),
    demotes: demotes.map((s) => ({ styleId: s.styleId, name: s.name, newWeight: s.newWeight, reason: '近7天0次试戴' })),
    alerts:  alerts.map((s)  => ({ styleId: s.styleId, name: s.name, reason: '近7天无试戴，请关注' })),
  }
}

async function generateReport() {
  const db   = cloud.database()
  const _    = db.command
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  // 幂等检查：今日已有 pending/approved/executed 日报则直接返回
  const existing = await db.collection('daily_reports')
    .where({
      reportDate: _.gte(today).and(_.lt(tomorrow)),
      status: _.neq('rejected'),
    })
    .get()

  if (existing.data.length > 0) {
    const r = existing.data[0]
    return {
      alreadyExists: true,
      reportId: r._id,
      status: r.status,
      reportDate: r.reportDate,
    }
  }

  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置')

  // 并行计算 summary 和 weights
  const [summary, weightResult] = await Promise.all([getSummary(), computeWeights()])

  const prompt = _buildPrompt(summary, weightResult)
  const contentMd = await generateText(apiKey, prompt)
  const strategyJson = _buildStrategyJson(weightResult)

  // 如果今日有 rejected，用 update；否则 add
  const rejected = await db.collection('daily_reports')
    .where({
      reportDate: _.gte(today).and(_.lt(tomorrow)),
      status: 'rejected',
    })
    .get()

  let reportId
  if (rejected.data.length > 0) {
    reportId = rejected.data[0]._id
    await db.collection('daily_reports').doc(reportId).update({
      data: {
        contentMd,
        strategyJson,
        status: 'pending',
        createdAt: db.serverDate(),
      },
    })
  } else {
    const addRes = await db.collection('daily_reports').add({
      data: {
        reportDate:  today,
        contentMd,
        strategyJson,
        status:      'pending',
        createdAt:   db.serverDate(),
      },
    })
    reportId = addRes._id
  }

  return {
    reportId,
    status: 'pending',
    contentMd,
    strategyJson,
  }
}

module.exports = { generateReport }
