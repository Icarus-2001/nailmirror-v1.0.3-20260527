const {
  normalizeRating,
  resolveRatingType,
  computeQualityScore,
  buildScoresByStyle,
  RATING_TYPE_TRYON,
  RATING_TYPE_QUALITY,
} = require('../../cloudfunctions/ops/utils/qualityScore');

describe('ops/utils/qualityScore', () => {
  test('normalizeRating rounds to nearest half star', () => {
    expect(normalizeRating(4.5)).toBe(4.5);
    expect(normalizeRating(3.7)).toBe(3.5);
    expect(normalizeRating(0)).toBe(0);
  });

  test('resolveRatingType treats legacy records as tryon_effect', () => {
    expect(resolveRatingType({ rating_type: 'nail_quality' })).toBe(RATING_TYPE_QUALITY);
    expect(resolveRatingType({ rating_type: 'tryon_effect' })).toBe(RATING_TYPE_TRYON);
    expect(resolveRatingType({})).toBe(RATING_TYPE_TRYON);
  });

  test('buildScoresByStyle filters by rating_type', () => {
    const nowMs = Date.now();
    const allRatings = [
      { style_id: 'real-1', rating: 5, rating_type: RATING_TYPE_QUALITY, rated_at: new Date(nowMs) },
      { style_id: 'real-1', rating: 3, rating_type: RATING_TYPE_TRYON, rated_at: new Date(nowMs) },
      { style_id: 'real-2', rating: 4.5, rated_at: new Date(nowMs) },
    ];
    const quality = buildScoresByStyle(allRatings, nowMs, RATING_TYPE_QUALITY);
    const tryon = buildScoresByStyle(allRatings, nowMs, RATING_TYPE_TRYON);
    expect(quality['real-1']).toBe(5);
    expect(quality['real-2']).toBeUndefined();
    expect(tryon['real-1']).toBe(3);
    expect(tryon['real-2']).toBe(4.5);
  });

  test('computeQualityScore supports half-star averages', () => {
    const nowMs = Date.now();
    const score = computeQualityScore([
      { rating: 4.5, rated_at: new Date(nowMs) },
      { rating: 3.5, rated_at: new Date(nowMs) },
    ], nowMs);
    expect(score).toBe(4);
  });
});
