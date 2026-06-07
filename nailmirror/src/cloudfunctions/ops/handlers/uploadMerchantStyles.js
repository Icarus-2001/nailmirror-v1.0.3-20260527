const cloud = require('wx-server-sdk');
const { analyzeNailStyleImage } = require('../utils/llm');
const { findMerchantByOpenid } = require('../utils/merchant');
const { downloadCloudBuffer } = require('../utils/cloudImage');
const { computeFingerprint } = require('../utils/imageFingerprint');
const { assertNotDuplicate } = require('../utils/merchantDuplicate');
const { safeUploadError } = require('../utils/uploadValidation');

function assertMerchantRole(role) {
  if (role !== 'b') throw new Error('debug auth requires merchant role');
}

function sanitizeName(name) {
  const value = String(name || '').replace(/\.[^.]+$/, '').trim();
  return value || '商家上传款式';
}

function rankWeightFor(fileID, index) {
  const key = String(fileID || '') + ':' + index;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const step = Math.abs(hash) % 50;
  return Math.round((1.35 + step / 100) * 100) / 100;
}

function styleIdFor(fileID, index) {
  const key = String(fileID || '') + ':' + Date.now() + ':' + index;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return 'merchant-style-' + Date.now() + '-' + Math.abs(hash).toString(36);
}

async function getTempUrl(fileID) {
  const res = await cloud.getTempFileURL({ fileList: [fileID] });
  const item = res && res.fileList && res.fileList[0];
  if (!item || item.status !== 0 || !item.tempFileURL) {
    throw new Error('failed to resolve temp file url');
  }
  return item.tempFileURL;
}

async function createStyle(db, item, index, merchantId) {
  if (!item || !item.fileID) throw new Error('missing fileID');

  const buffer = await downloadCloudBuffer(cloud, item.fileID);
  const fingerprint = await computeFingerprint(buffer);
  await assertNotDuplicate(db, merchantId, fingerprint);

  const imageUrl = await getTempUrl(item.fileID);
  const tags = await analyzeNailStyleImage(imageUrl);
  const styleId = styleIdFor(item.fileID, index);
  const now = new Date().toISOString();
  const doc = {
    _id: styleId,
    name: tags.name || sanitizeName(item.originalName),
    color: tags.color || '',
    design: tags.design || '',
    shape: tags.shape || '',
    style: tags.style || '',
    image_url: imageUrl,
    image_file_id: item.fileID,
    image_md5: fingerprint.md5,
    image_phash: fingerprint.phash,
    original_name: item.originalName || '',
    rank_weight: rankWeightFor(item.fileID, index),
    is_active: true,
    merchant_id: merchantId,
    source: 'merchant-upload',
    created_at: now
  };
  await db.collection('styles').add({ data: doc });
  return doc;
}

async function uploadMerchantStyles(event) {
  const role = event && event.role;
  assertMerchantRole(role);
  const items = Array.isArray(event && event.items) ? event.items : [];
  const merchantOpenid = String((event && event.callerOpenid) || (event && event.merchantId) || '').trim();
  if (!merchantOpenid) throw new Error('missing merchant identity');

  const db = cloud.database();
  const merchant = await findMerchantByOpenid(db, merchantOpenid);
  if (!merchant) throw new Error('请先完成商家身份认证');

  const styles = [];
  const failed = [];

  for (let i = 0; i < items.length; i += 1) {
    try {
      styles.push(await createStyle(db, items[i], i, merchantOpenid));
    } catch (err) {
      const safe = safeUploadError(err);
      failed.push({
        fileID: items[i] && items[i].fileID,
        originalName: items[i] && items[i].originalName,
        error: safe.error,
        code: safe.code
      });
    }
  }

  return { ok: true, styles, failed };
}

module.exports = { uploadMerchantStyles };
