// jest 配置
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.wx.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/__tests__/**/*.test.js'],
  testTimeout: 15000
};
