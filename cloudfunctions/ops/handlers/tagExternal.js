/**
 * tagExternal — 外部趋势录入 + VLM 自动打标
 * 对应 Python: crawler/tagger.py（原存根已通过本文件实现）
 *
 * 调用方式：
 *   action: 'tagExternal'
 *   params: {
 *     platform:    'xiaohongshu' | 'douyin'
 *     postUrl:     帖子链接（唯一键）
 *     engagement:  互动量（点赞+评论+收藏）
 *     imageUrl:    图片公开 HTTPS URL（用于 VLM 打标）
 *     postedAt:    发帖时间 ISO 字符串（可选）
 *     callerOpenid: 操作人 openid（需管理员）
 *   }
 *
 * 流程：
 *   1. 鉴权
 *   2. 调用 Qwen-VL 对图片打 color/design/shape 标签
 *   3. 写入 external_trends（postUrl 已存在则 update，否则 add）
 */
const cloud = require('wx-server-sdk')
const { tagNailImage } = require('../utils/llm')

function _isAdmin(openid) {
  const raw = process.env.ADMIN_OPENIDS || ''
  if (!raw) return true
  return raw.split(',').map((s) => s.trim()).includes(openid)
}

async function tagExternal({ platform, postUrl, engagement, imageUrl, postedAt, callerOpenid }) {
  if (!_isAdmin(callerOpenid)) throw new Error('无权限：非管理员 openid')
  if (!platform || !postUrl || !imageUrl) {
    throw new Error('platform、postUrl、imageUrl 为必填项')
  }

  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置')

  // VLM 打标
  const tags = await tagNailImage(apiKey, imageUrl)

  const db = cloud.database()

  // 检查 postUrl 是否已存在
  const existing = await db.collection('external_trends')
    .where({ postUrl })
    .get()

  const data = {
    platform,
    postUrl,
    engagement:  parseInt(engagement) || 0,
    imageUrl,
    color:       tags.color  || '',
    design:      tags.design || '',
    shape:       tags.shape  || '',
    postedAt:    postedAt ? new Date(postedAt) : null,
    scrapedAt:   db.serverDate(),
  }

  let trendId
  if (existing.data.length > 0) {
    trendId = existing.data[0]._id
    await db.collection('external_trends').doc(trendId).update({ data })
  } else {
    const res = await db.collection('external_trends').add({ data })
    trendId = res._id
  }

  return { trendId, tags, platform, postUrl }
}

module.exports = { tagExternal }
