/**
 * 云存储图片下载
 */
async function downloadCloudBuffer(cloud, fileID) {
  if (!fileID) throw new Error('missing fileID');
  const res = await cloud.downloadFile({ fileID });
  if (!res || !res.fileContent) throw new Error('failed to download cloud file');
  return res.fileContent;
}

module.exports = { downloadCloudBuffer };
