/**
 * seed/utils/llm.js — VLM 打标工具（完整复制自 ops/utils/llm.js 打标部分）
 * 云函数之间不能跨目录 require，故在 seed 目录单独维护一份。
 * 逻辑与 scripts/import-styles.js tagWithVlm 完全一致。
 */
const https = require('https')
const { buildVlmPrompt, normalizeTag, normalizeVlmName } = require('./tag-vocabulary')

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
        try { resolve(JSON.parse(raw)) }
        catch (e) { reject(new Error('JSON parse error: ' + raw.slice(0, 200))) }
      })
    })
    req.on('error', reject)
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('LLM request timeout (90s)')) })
    req.write(data)
    req.end()
  })
}

function _toHttpsUrl(url) {
  if (!url || typeof url !== 'string') return url
  return url.replace(/^http:\/\//i, 'https://')
}

function _normalizeVlmTags(raw) {
  const name4 = normalizeVlmName(raw.name)
  return {
    color:  normalizeTag('color',  raw.color),
    design: normalizeTag('design', raw.design),
    shape:  normalizeTag('shape',  raw.shape),
    style:  normalizeTag('style',  raw.style),
    name:   name4 || (raw.name || '').trim(),
  }
}

/**
 * 调用 qwen-vl-max 对图片打美甲标准四标签 + 4 字展示名。
 * @param {string} imageUrl  公开 HTTPS 图片 URL
 * @returns {Promise<{color, design, shape, style, name}>}
 */
async function tagNailImage(imageUrl) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置')
  const model = process.env.QWEN_VL_MODEL || 'qwen-vl-max'

  const res = await _post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: _toHttpsUrl(imageUrl) } },
          { type: 'text', text: buildVlmPrompt() },
        ],
      }],
    }
  )
  if (res.error) throw new Error(res.error.message || JSON.stringify(res.error))
  const text = (res.choices[0].message.content || '')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('VLM 未返回 JSON: ' + text.slice(0, 200))
  return _normalizeVlmTags(JSON.parse(match[0]))
}

module.exports = { tagNailImage }
