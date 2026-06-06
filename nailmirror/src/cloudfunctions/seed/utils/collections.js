/**
 * 确保云数据库集合存在（新版云开发不会随 add 自动建表）
 */
function _isAlreadyExistsError(err) {
  const msg = String((err && err.message) || err || '')
  return (
    msg.indexOf('already exist') > -1
    || msg.indexOf('AlreadyExist') > -1
    || msg.indexOf('ResourceExist') > -1
    || msg.indexOf('已存在') > -1
    || msg.indexOf('DATABASE_COLLECTION_ALREADY_EXIST') > -1
  )
}

async function ensureCollection(db, collectionName) {
  try {
    await db.createCollection(collectionName)
    console.log('[seed] 已创建集合', collectionName)
    return { name: collectionName, created: true }
  } catch (err) {
    if (_isAlreadyExistsError(err)) {
      return { name: collectionName, created: false, exists: true }
    }
    throw err
  }
}

async function ensureCollections(db, names) {
  const results = []
  for (const name of names) {
    results.push(await ensureCollection(db, name))
  }
  return results
}

module.exports = { ensureCollection, ensureCollections }
