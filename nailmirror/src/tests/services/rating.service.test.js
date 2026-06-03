describe('RatingService', () => {
  let ratingService;
  let styleService;

  beforeEach(() => {
    jest.resetModules();
    ratingService = require('../../services/rating.service');
    styleService = require('../../services/style.service');
  });

  test('virtualRating is stable and within 5-point range', () => {
    const style = { id: 'real-1', heat: 1960 };
    const a = ratingService.virtualRating(style);
    const b = ratingService.virtualRating(style);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(4.1);
    expect(a).toBeLessThanOrEqual(4.9);
  });

  test('rateStyle persists user rating and withRating prefers it', () => {
    const record = ratingService.rateStyle('real-1', 5, 'try-on-static');
    expect(record.rating).toBe(5);

    const rated = ratingService.withRating({ id: 'real-1', heat: 1960 });
    expect(rated.rating).toBe(5);
    expect(rated.ratingText).toBe('5.0');
    expect(rated.ratingSource).toBe('user');
  });

  test('styleService.list injects rating fields', async () => {
    const r = await styleService.list({ page: 1, pageSize: 1 });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].ratingText).toMatch(/^\d\.\d$/);
    expect(r.items[0].rating).toBeGreaterThan(0);
  });
});
