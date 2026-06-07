const { getExitMerchantNavAction } = require('../../utils/merchant-exit');

describe('merchant exit navigation', () => {
  test('uses navigateBack when stack depth > 1', () => {
    expect(getExitMerchantNavAction(2)).toBe('navigateBack');
    expect(getExitMerchantNavAction(5)).toBe('navigateBack');
  });

  test('uses switchTabMe when stack depth is 1', () => {
    expect(getExitMerchantNavAction(1)).toBe('switchTabMe');
    expect(getExitMerchantNavAction(0)).toBe('switchTabMe');
  });
});
