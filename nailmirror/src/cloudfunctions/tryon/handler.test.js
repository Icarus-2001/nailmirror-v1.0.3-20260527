const assert = require('assert');
const { materializeTryonOutput } = require('./handler');

async function testMaterializeSucceededOutput() {
  const calls = [];
  const result = await materializeTryonOutput({
    jobId: 'task-abc',
    status: 'succeeded',
    outputUrl: 'https://dashscope.example.com/out.png'
  }, {
    downloadBuffer: async (url) => {
      calls.push(['download', url]);
      return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    },
    uploadBuffer: async (buf, cloudPath) => {
      calls.push(['upload', buf.length, cloudPath]);
      return { fileID: 'cloud://env.tryon/results/task-abc.png' };
    }
  });

  assert.deepStrictEqual(calls, [
    ['download', 'https://dashscope.example.com/out.png'],
    ['upload', 4, 'tryon/results/task-abc.png']
  ]);
  assert.strictEqual(result.outputFileID, 'cloud://env.tryon/results/task-abc.png');
  assert.strictEqual(result.outputUrl, 'https://dashscope.example.com/out.png');
}

async function testMaterializeSkipsProcessingOutput() {
  let called = false;
  const result = await materializeTryonOutput({
    jobId: 'task-pending',
    status: 'processing',
    outputUrl: ''
  }, {
    downloadBuffer: async () => { called = true; },
    uploadBuffer: async () => { called = true; }
  });

  assert.strictEqual(called, false);
  assert.strictEqual(result.outputFileID, '');
  assert.strictEqual(result.outputUrl, '');
}

async function testMaterializeRejectsEmptyDownload() {
  let uploadCalled = false;
  await assert.rejects(
    () => materializeTryonOutput({
      jobId: 'task-empty',
      status: 'succeeded',
      outputUrl: 'https://dashscope.example.com/empty.png'
    }, {
      downloadBuffer: async () => Buffer.alloc(0),
      uploadBuffer: async () => { uploadCalled = true; }
    }),
    /图片为空/
  );
  assert.strictEqual(uploadCalled, false);
}

async function run() {
  await testMaterializeSucceededOutput();
  await testMaterializeSkipsProcessingOutput();
  await testMaterializeRejectsEmptyDownload();
  console.log('handler.test.js: all passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
