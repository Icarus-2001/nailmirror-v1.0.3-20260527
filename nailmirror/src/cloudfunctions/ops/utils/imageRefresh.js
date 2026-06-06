/**
 * 批量刷新 styles 记录中的 image_url（由 image_file_id 取临时链接）
 */
async function refreshImageUrls(cloud, styles) {
  const fileIDs = (styles || []).map((s) => s.image_file_id).filter(Boolean)
  if (!fileIDs.length) return styles || []

  try {
    const res = await cloud.getTempFileURL({ fileList: fileIDs })
    if (!res || !Array.isArray(res.fileList)) return styles

    const urlMap = {}
    res.fileList.forEach((item) => {
      if (item && item.status === 0 && item.tempFileURL) {
        urlMap[item.fileID] = item.tempFileURL
      }
    })

    return styles.map((s) => {
      const fresh = s.image_file_id && urlMap[s.image_file_id]
      if (!fresh) return s
      return Object.assign({}, s, { image_url: fresh })
    })
  } catch (e) {
    console.warn('[imageRefresh] failed:', e && e.message)
    return styles
  }
}

module.exports = { refreshImageUrls }
