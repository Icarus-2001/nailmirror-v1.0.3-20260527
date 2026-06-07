jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn()
}));

const { getAll } = require('../../cloudfunctions/ops/utils/db');
const { assertNotDuplicate } = require('../../cloudfunctions/ops/utils/merchantDuplicate');
const { CODES } = require('../../cloudfunctions/ops/utils/uploadValidation');

describe('merchantDuplicate', () => {
  beforeEach(() => {
    getAll.mockReset();
  });

  test('rejects exact md5 duplicate for same merchant', async () => {
    getAll.mockResolvedValueOnce([
      { _id: 's1', image_md5: 'same-md5', image_phash: '0000000000000000' }
    ]);
    await expect(assertNotDuplicate({}, 'merchant-1', { md5: 'same-md5', phash: 'ffffffffffffffff' }))
      .rejects.toMatchObject({ code: CODES.DUPLICATE_EXACT });
  });

  test('rejects similar phash for same merchant', async () => {
    getAll.mockResolvedValueOnce([
      { _id: 's1', image_md5: 'other', image_phash: '0000000000000000' }
    ]);
    await expect(assertNotDuplicate({}, 'merchant-1', { md5: 'new-md5', phash: '0000000000000001' }))
      .rejects.toMatchObject({ code: CODES.DUPLICATE_SIMILAR });
  });

  test('allows when no fingerprint overlap', async () => {
    getAll.mockResolvedValueOnce([
      { _id: 's1', image_md5: 'aaa', image_phash: '0000000000000000' }
    ]);
    await expect(assertNotDuplicate({}, 'merchant-1', { md5: 'bbb', phash: 'ffffffffffffffff' }))
      .resolves.toBeUndefined();
  });

  test('skips rows without hash fields', async () => {
    getAll.mockResolvedValueOnce([{ _id: 'legacy' }]);
    await expect(assertNotDuplicate({}, 'merchant-1', { md5: 'bbb', phash: 'ccc' }))
      .resolves.toBeUndefined();
  });
});
