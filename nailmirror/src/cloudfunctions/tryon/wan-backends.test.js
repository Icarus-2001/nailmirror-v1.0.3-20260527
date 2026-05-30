const assert = require('assert');
const {
  mergeNailsToBboxList,
  bboxListForImages,
  parseTaskOutput,
  resolveWanModel,
  SUPPORTED_MODELS
} = require('./wan-backends');

function testMergeFiveNails() {
  const nails = [
    { cx: 0.2, cy: 0.3, rx: 0.04, ry: 0.05 },
    { cx: 0.35, cy: 0.28, rx: 0.04, ry: 0.05 },
    { cx: 0.5, cy: 0.27, rx: 0.04, ry: 0.05 },
    { cx: 0.65, cy: 0.28, rx: 0.04, ry: 0.05 },
    { cx: 0.8, cy: 0.3, rx: 0.04, ry: 0.05 }
  ];
  const boxes = mergeNailsToBboxList(nails, 1000, 800);
  assert.strictEqual(boxes.length, 1);
}

function testMergeTwoNails() {
  const nails = [
    { cx: 0.3, cy: 0.3, rx: 0.04, ry: 0.05 },
    { cx: 0.7, cy: 0.3, rx: 0.04, ry: 0.05 }
  ];
  const boxes = mergeNailsToBboxList(nails, 1000, 800);
  assert.strictEqual(boxes.length, 2);
}

function testBboxListDualImage() {
  const nails = [{ cx: 0.5, cy: 0.3, rx: 0.04, ry: 0.05 }];
  const list = bboxListForImages(true, nails, 1000, 800);
  assert.deepStrictEqual(list[0], []);
  assert.strictEqual(list[1].length, 1);
}

function testParseResults() {
  const url = parseTaskOutput({ results: [{ url: 'https://example.com/a.png' }] });
  assert.strictEqual(url, 'https://example.com/a.png');
}

function testParseChoices() {
  const url = parseTaskOutput({
    choices: [{ message: { content: [{ image: 'https://example.com/b.png' }] } }]
  });
  assert.strictEqual(url, 'https://example.com/b.png');
}

function testResolveOverride() {
  const prev = process.env.WAN_IMAGE_MODEL;
  delete process.env.WAN_IMAGE_MODEL;
  const r = resolveWanModel('wan2.7-image-pro');
  assert.strictEqual(r.backend, 'multimodal_edit');
  assert.strictEqual(SUPPORTED_MODELS.length, 2);
  if (prev !== undefined) process.env.WAN_IMAGE_MODEL = prev;
}

function run() {
  testMergeFiveNails();
  testMergeTwoNails();
  testBboxListDualImage();
  testParseResults();
  testParseChoices();
  testResolveOverride();
  console.log('wan-backends.test.js: all passed');
}

run();
