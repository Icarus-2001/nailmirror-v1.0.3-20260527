/**
 * LLM 工具
 *  - 运营日报：月之暗面 Moonshot（与原 Python archive/app/services/llm.py 完全一致）
 *  - 图片打标：DashScope qwen-vl-max（与团队前端 tryon/handler.js 完全一致）
 *
 * 使用原生 https 模块，无额外依赖。
 */
const https = require('https')

function _post(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const data = JSON.stringify(body)
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }
    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk) => (raw += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw))
        } catch (e) {
          reject(new Error('LLM JSON parse error: ' + raw.slice(0, 200)))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(90000, () => {
      req.destroy()
      reject(new Error('LLM request timeout (90s)'))
    })
    req.write(data)
    req.end()
  })
}

// ============ 运营日报：Moonshot（还原原 Python 逻辑） ============

const SYSTEM_PROMPT = `你是美甲门店AI运营助手，具备商业分析能力。
根据提供的运营数据，生成日报和调权策略。
严格按指定格式输出，不得有任何多余文字。`

const USER_PROMPT_TEMPLATE = (p) => `当前运营数据（${p.snapshotTime}）：

【近7天热门款式TOP5】
${p.hotLines}

【近7天无人试戴的款式】
${p.coldLines}

【外部社区趋势（近14天）】
${p.externalLines}

请严格按以下格式输出：

===日报开始===
（Markdown格式日报，150-250字，包含：
  1. 热款概况：TOP3款式及试戴量
  2. 趋势简析：外部社区与店内热款是否有重叠的图案/颜色
  3. 风险提示：列出需关注的冷款
  4. 建议：2条可操作的运营建议）
===日报结束===

===策略开始===
{
  "boosts": [
    {"styleId": "str", "newWeight": 0.0, "reason": "str"}
  ],
  "demotes": [
    {"styleId": "str", "newWeight": 0.0, "reason": "str"}
  ],
  "alerts": [
    {"styleId": "str", "reason": "str"}
  ]
}
===策略结束===

策略规则：
- boosts：从热门款式中选择表现最好的款式，newWeight设在2.0~5.0之间，
  热度越高设得越高，最多选3款
- demotes：从冷款中选tryCount7d=0且lastTriedAt超过14天（或从未试戴）的款式，
  newWeight统一设为0.5，最多选3款
- alerts：冷款列表中所有款式都列入
- styleId必须是上方数据中真实存在的字符串ID，newWeight必须是数字`

function _formatHotLines(hotStyles) {
  if (!hotStyles || !hotStyles.length) return '（无）'
  return hotStyles
    .map(
      (s) =>
        `款式[${s.styleId}]「${s.name}」${s.design || ''}/${s.color || ''} 近7天试戴:${s.tryCount7d}次`
    )
    .join('\n')
}

function _formatColdLines(coldStyles) {
  if (!coldStyles || !coldStyles.length) return '（无）'
  return coldStyles
    .map(
      (s) =>
        `款式[${s.styleId}]「${s.name}」${s.design || ''}/${s.color || ''} 近7天0次 上次试戴:${s.lastTriedAt || '从未试戴'}`
    )
    .join('\n')
}

function _formatExternalLines(externalHot) {
  const lines = []
  for (const [platform, label] of [['xiaohongshu', '小红书'], ['douyin', '抖音']]) {
    for (const item of (externalHot && externalHot[platform]) || []) {
      lines.push(`${label} ${item.design || ''}/${item.color || ''} 互动量:${item.engagement || 0}`)
    }
  }
  return lines.length ? lines.join('\n') : '（无）'
}

function _parseLlmResponse(text) {
  const reportMatch = text.match(/===日报开始===\s*([\s\S]*?)\s*===日报结束===/)
  const strategyMatch = text.match(/===策略开始===\s*([\s\S]*?)\s*===策略结束===/)

  const contentMd = reportMatch ? reportMatch[1].trim() : text.trim()

  let strategyJson = { boosts: [], demotes: [], alerts: [], parseError: true }
  if (strategyMatch) {
    try {
      strategyJson = JSON.parse(strategyMatch[1].trim())
    } catch (e) {
      // 保留默认 parseError
    }
  }
  return { contentMd, strategyJson }
}

/**
 * 调用 Moonshot 生成日报与调权策略。
 * @param {object} summaryData getSummary() 的返回结果
 * @returns {Promise<{contentMd:string, strategyJson:object}>}
 */
async function generateDailyReport(summaryData) {
  const apiKey  = process.env.MOONSHOT_API_KEY
  const baseUrl = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'
  const model   = process.env.MOONSHOT_MODEL || 'moonshot-v1-8k'
  if (!apiKey) throw new Error('MOONSHOT_API_KEY 未配置')

  const userPrompt = USER_PROMPT_TEMPLATE({
    snapshotTime:  summaryData.snapshotTime || '',
    hotLines:      _formatHotLines(summaryData.hotStyles),
    coldLines:     _formatColdLines(summaryData.coldStyles),
    externalLines: _formatExternalLines(summaryData.externalHot),
  })

  const res = await _post(
    `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }
  )
  if (res.error) throw new Error(res.error.message || JSON.stringify(res.error))

  const content = res.choices[0].message.content
  return _parseLlmResponse(content)
}

// ============ 图片打标：DashScope qwen-vl-max（与前端 tryon 一致） ============

/**
 * 调用 qwen-vl-max 对图片打美甲标签。
 * 模型来源与团队前端 tryon/handler.js 一致：QWEN_VL_MODEL || 'qwen-vl-max'
 * @param {string} imageUrl  公开 HTTPS 图片 URL
 * @returns {Promise<{color:string, design:string, shape:string}>}
 */
async function tagNailImage(imageUrl) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置')
  const model = process.env.QWEN_VL_MODEL || 'qwen-vl-max'

  const PROMPT =
    '分析这张美甲图片，提取三个标签：' +
    '颜色（如"冰透粉"）、图案/工艺（如"猫眼"）、甲形（如"杏仁形"）。' +
    '只输出 JSON，格式：{"color":"","design":"","shape":""}，不要其他内容。'

  const res = await _post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }
  )
  if (res.error) throw new Error(res.error.message || JSON.stringify(res.error))

  const text = res.choices[0].message.content
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { color: '', design: '', shape: '' }
  } catch {
    return { color: '', design: '', shape: '' }
  }
}

module.exports = { generateDailyReport, tagNailImage }
