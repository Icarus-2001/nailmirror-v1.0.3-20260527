const assert = require('assert');
const { login } = require('./handler');

async function testLoginReturnsWxOpenid() {
  const cloud = {
    getWXContext: () => ({ OPENID: 'openid-real-001' })
  };

  const r = await login({}, { cloud });

  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.data.openid, 'openid-real-001');
  assert.strictEqual(r.data.role, 'c');
}

async function testLoginRejectsMissingOpenid() {
  const cloud = {
    getWXContext: () => ({})
  };

  const r = await login({}, { cloud });

  assert.strictEqual(r.code, 1);
  assert.match(r.message, /未授权/);
}

async function run() {
  await testLoginReturnsWxOpenid();
  await testLoginRejectsMissingOpenid();
  console.log('login handler.test.js: all passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
