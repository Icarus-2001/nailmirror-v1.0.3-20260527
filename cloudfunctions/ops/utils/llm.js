/**
 * DashScope API 工具（qwen-plus 文本 / qwen-vl-plus 视觉）
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
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) },
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

/**
 * 调用 qwen-plus 文本接口生成日报 Markdown。
 * @param {string} apiKey  DASHSCOPE_API_KEY
 * @param {string} userPrompt
 * @returns {Promise<string>} LLM 输出文本
 */
async function generateText(apiKey, userPrompt) {
  const SYSTEM = `你是美甲门店AI运营助手，具备商业分析能力。
根据提供的运营数据，生成简洁的运营日报。
只输出Markdown格式的报告正文，不要输出任何额外内容。`

  const res = await _post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    {
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }
  )
  if (res.error) throw new Error(res.error.message || JSON.stringify(res.error))
  return res.choices[0].message.content
}

/**
 * 调用 qwen-vl-plus 对图片打美甲标签。
 * @param {string} apiKey
 * @param {string} imageUrl  公开 HTTPS 图片 URL
 * @returns {Promise<{color:string, design:string, shape:string}>}
 */
async function tagNailImage(apiKey, imageUrl) {
  const PROMPT =
    '分析这张美甲图片，提取三个标签：' +
    '颜色（如"冰透粉"）、图案/工艺（如"猫眼"）、甲形（如"杏仁形"）。' +
    '只输出 JSON，格式：{"color":"","design":"","shape":""}，不要其他内容。'

  const res = await _post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    {
      model: 'qwen-vl-plus',
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

module.exports = { generateText, tagNailImage }
