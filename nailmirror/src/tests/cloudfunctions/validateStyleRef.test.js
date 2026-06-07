jest.mock('wx-server-sdk', () => {
  const downloadFile = jest.fn();
  const getTempFileURL = jest.fn();
  return {
    init: jest.fn(),
    DYNAMIC_CURRENT_ENV: 'test-env',
    downloadFile,
    getTempFileURL,
    __mock: { downloadFile, getTempFileURL }
  };
}, { virtual: true });

jest.mock('../../cloudfunctions/ops/utils/llm', () => ({
  analyzeNailStyleImage: jest.fn()
}));

describe('validateStyleRef cloud handler', () => {
  let validateStyleRef;
  let cloud;
  let analyzeNailStyleImage;

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    analyzeNailStyleImage = require('../../cloudfunctions/ops/utils/llm').analyzeNailStyleImage;
    cloud.__mock.downloadFile.mockReset();
    cloud.__mock.getTempFileURL.mockReset();
    analyzeNailStyleImage.mockReset();
    validateStyleRef = require('../../cloudfunctions/ops/handlers/validateStyleRef').validateStyleRef;
  });

  test('returns ok for nail art image', async () => {
    cloud.__mock.downloadFile.mockResolvedValueOnce({ fileContent: Buffer.from('img') });
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://ref/1.jpg', status: 0, tempFileURL: 'https://temp.test/1.jpg' }]
    });
    analyzeNailStyleImage.mockResolvedValueOnce({ isNailArt: true, confidence: 0.95 });

    const result = await validateStyleRef({ fileID: 'cloud://ref/1.jpg' });
    expect(result.ok).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  test('returns NOT_NAIL_ART for rejected image', async () => {
    cloud.__mock.downloadFile.mockResolvedValueOnce({ fileContent: Buffer.from('img') });
    cloud.__mock.getTempFileURL.mockResolvedValueOnce({
      fileList: [{ fileID: 'cloud://ref/2.jpg', status: 0, tempFileURL: 'https://temp.test/2.jpg' }]
    });
    const err = new Error('风景照片');
    err.code = 'NOT_NAIL_ART';
    analyzeNailStyleImage.mockRejectedValueOnce(err);

    const result = await validateStyleRef({ fileID: 'cloud://ref/2.jpg' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_NAIL_ART');
  });

  test('missing fileID', async () => {
    const result = await validateStyleRef({});
    expect(result.ok).toBe(false);
    expect(result.code).toBe('MISSING_FILE');
  });
});
