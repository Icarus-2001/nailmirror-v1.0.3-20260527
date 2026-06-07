const {
  getNoteId,
  pickPreferredXhsHotStyle,
  dedupeXhsHotLibraryByNoteId
} = require('../../cloudfunctions/ops/utils/xhsHotDedup');

describe('xhsHotDedup', () => {
  test('getNoteId reads note_id and noteId', () => {
    expect(getNoteId({ note_id: ' abc ' })).toBe('abc');
    expect(getNoteId({ noteId: 'def' })).toBe('def');
    expect(getNoteId({})).toBe('');
  });

  test('pickPreferred prefers active batch', () => {
    const older = { _id: 'old', is_active: false, scrape_date: '2026-06-07', interaction_score: 999 };
    const newer = { _id: 'new', is_active: true, scrape_date: '2026-06-06', interaction_score: 1 };
    expect(pickPreferredXhsHotStyle(older, newer)._id).toBe('new');
  });

  test('pickPreferred prefers newer scrape_date when both inactive', () => {
    const a = { _id: 'a', is_active: false, scrape_date: '2026-06-06', interaction_score: 100 };
    const b = { _id: 'b', is_active: false, scrape_date: '2026-06-07', interaction_score: 50 };
    expect(pickPreferredXhsHotStyle(a, b)._id).toBe('b');
  });

  test('dedupe keeps one row per note_id', () => {
    const rows = [
      { _id: 'xhs-hot-2026-06-06-01', note_id: 'note-1', is_active: false, scrape_date: '2026-06-06', interaction_score: 146885, xhs_rank: 1 },
      { _id: 'xhs-hot-2026-06-07-02', note_id: 'note-1', is_active: true, scrape_date: '2026-06-07', interaction_score: 147158, xhs_rank: 2 },
      { _id: 'xhs-hot-2026-06-07-01', note_id: 'note-2', is_active: true, scrape_date: '2026-06-07', interaction_score: 358728, xhs_rank: 1 }
    ];
    const result = dedupeXhsHotLibraryByNoteId(rows);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r._id).sort()).toEqual([
      'xhs-hot-2026-06-07-01',
      'xhs-hot-2026-06-07-02'
    ]);
  });

  test('dedupe keeps rows without note_id', () => {
    const rows = [
      { _id: 'legacy-1', scrape_date: '2026-06-05' },
      { _id: 'legacy-2', scrape_date: '2026-06-06' }
    ];
    expect(dedupeXhsHotLibraryByNoteId(rows)).toHaveLength(2);
  });
});
