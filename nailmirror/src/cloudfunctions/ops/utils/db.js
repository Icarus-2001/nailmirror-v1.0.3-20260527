/**
 * 云数据库工具：处理分页查询（单次最多 100 条限制）
 */
const cloud = require('wx-server-sdk')

/**
 * 获取 collection 中满足 where 条件的全部记录。
 * 自动分页，绕过云 DB 单次 100 条上限。
 */
async function getAll(collectionName, where = {}) {
  const db = cloud.database()
  const MAX_LIMIT = 100

  const countRes = await db.collection(collectionName).where(where).count()
  const total = countRes.total
  if (total === 0) return []

  const batchCount = Math.ceil(total / MAX_LIMIT)
  const tasks = []
  for (let i = 0; i < batchCount; i++) {
    tasks.push(
      db.collection(collectionName)
        .where(where)
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get()
    )
  }
  const results = await Promise.all(tasks)
  return results.reduce((acc, r) => acc.concat(r.data), [])
}

module.exports = { getAll }
