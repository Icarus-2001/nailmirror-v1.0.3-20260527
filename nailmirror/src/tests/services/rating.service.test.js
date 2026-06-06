describe('RatingService', () => {
  let ratingService;
  let styleService;

  beforeEach(() => {
    jest.resetModules();
    ratingService = require('../../services/rating.service');
    styleService = require('../../services/style.service');
  });

  test('normalizeRating supports half stars', () => {
    expect(ratingService.normalizeRating(3.5)).toBe(3.5);
    expect(ratingService.normalizeRating(4.5)).toBe(4.5);
    expect(ratingService.normalizeRating(3.7)).toBe(3.5);
    expect(ratingService.normalizeRating(4.2)).toBe(4);
  });

  test('getUserRating empty until commitRating is called', () => {
    expect(ratingService.getUserRating('real-9', ratingService.RATING_TYPE_TRYON)).toBeNull();
    expect(ratingService.hasCommittedRating('real-9', ratingService.RATING_TYPE_TRYON)).toBe(false);
  });

  test('commitRating persists dual ratings independently', () => {
    const tryon = ratingService.commitRating('real-1', 4.5, 'try-on-static', ratingService.RATING_TYPE_TRYON);
    const quality = ratingService.commitRating('real-1', 3.5, 'try-on-static', ratingService.RATING_TYPE_QUALITY);
    expect(tryon.rating).toBe(4.5);
    expect(quality.rating).toBe(3.5);
    expect(ratingService.getUserRating('real-1', ratingService.RATING_TYPE_TRYON).rating).toBe(4.5);
    expect(ratingService.getUserRating('real-1', ratingService.RATING_TYPE_QUALITY).rating).toBe(3.5);
    expect(ratingService.hasAllCommittedRatings('real-1')).toBe(true);
  });

  test('withRating injects dual cloud scores', () => {
    const cache = {
      quality: { 'real-1': 4.3 },
      tryonEffect: { 'real-1': 4.6 },
    };
    const rated = ratingService.withRating({ id: 'real-1', heat: 1960 }, cache);
    expect(rated.qualityText).toBe('4.3');
    expect(rated.tryonEffectText).toBe('4.6');
    expect(rated.qualityStarDisplay.scoreText).toBe('4.3');
    expect(rated.qualityStarDisplay.stars).toHaveLength(5);
    expect(rated.ratingSource).toBe('quality');
  });

  test('withRating hides scores when cloud has no data', () => {
    const unrated = ratingService.withRating({ id: 'real-2', heat: 1200 }, { quality: {}, tryonEffect: {} });
    expect(unrated.qualityText).toBe('');
    expect(unrated.tryonEffectText).toBe('');
    expect(unrated.qualityStarDisplay).toBeNull();
    expect(unrated.ratingSource).toBe('none');
  });

  test('styleService.list injects dual score fields when cache is provided', async () => {
    const originalEnsure = ratingService.ensureStyleScores;
    ratingService.ensureStyleScores = jest.fn().mockResolvedValue({
      quality: { 'real-1': 4.8 },
      tryonEffect: { 'real-1': 4.2 },
      fetchedAt: Date.now(),
    });
    const r = await styleService.list({ page: 1, pageSize: 1 });
    ratingService.ensureStyleScores = originalEnsure;
    expect(r.items).toHaveLength(1);
    expect(r.items[0].qualityText).toBe('4.8');
    expect(r.items[0].tryonEffectText).toBe('4.2');
  });
});
