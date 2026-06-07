/**
 * 图片指纹：MD5（完全相同）+ pHash（感知相似）
 */
const crypto = require('crypto');
const Jimp = require('jimp');

function md5Hex(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function getPhashThreshold() {
  const raw = process.env.PHASH_SIMILAR_THRESHOLD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

async function phashHex(buffer) {
  const image = await Jimp.read(buffer);
  image.resize(8, 8).greyscale();
  const pixels = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      pixels.push(Jimp.intToRGBA(image.getPixelColor(x, y)).r);
    }
  }
  const avg = pixels.reduce((sum, v) => sum + v, 0) / pixels.length;
  let bits = '';
  for (let i = 0; i < pixels.length; i += 1) {
    bits += pixels[i] >= avg ? '1' : '0';
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

function hammingDistanceHex(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) return 64;
  let dist = 0;
  for (let i = 0; i < hexA.length; i += 1) {
    let n = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    dist += (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);
  }
  return dist;
}

async function computeFingerprint(buffer) {
  const md5 = md5Hex(buffer);
  const phash = await phashHex(buffer);
  return { md5, phash };
}

module.exports = {
  md5Hex,
  phashHex,
  hammingDistanceHex,
  computeFingerprint,
  getPhashThreshold,
};
