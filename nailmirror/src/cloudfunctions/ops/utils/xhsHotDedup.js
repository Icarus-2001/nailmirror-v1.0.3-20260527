/**
 * 全网热款款式库去重：同一小红书帖子（note_id）跨天导入只保留一条。
 */

function getNoteId(row) {
  return String((row && (row.note_id || row.noteId)) || '').trim();
}

function isActive(row) {
  return row && row.is_active !== false;
}

function pickPreferredXhsHotStyle(a, b) {
  const aActive = isActive(a);
  const bActive = isActive(b);
  if (aActive !== bActive) return aActive ? a : b;

  const dateCmp = String(b.scrape_date || '').localeCompare(String(a.scrape_date || ''));
  if (dateCmp !== 0) return dateCmp > 0 ? b : a;

  const scoreA = Number(a.interaction_score) || 0;
  const scoreB = Number(b.interaction_score) || 0;
  if (scoreB !== scoreA) return scoreB > scoreA ? b : a;

  const rankA = Number(a.xhs_rank) || 0;
  const rankB = Number(b.xhs_rank) || 0;
  if (rankA !== rankB) return rankA < rankB ? a : b;

  return a;
}

function dedupeXhsHotLibraryByNoteId(styles) {
  const winners = {};
  const withoutNoteId = [];

  (styles || []).forEach((row) => {
    const noteId = getNoteId(row);
    if (!noteId) {
      withoutNoteId.push(row);
      return;
    }
    if (!winners[noteId]) {
      winners[noteId] = row;
    } else {
      winners[noteId] = pickPreferredXhsHotStyle(winners[noteId], row);
    }
  });

  return withoutNoteId.concat(Object.keys(winners).map((key) => winners[key]));
}

module.exports = {
  getNoteId,
  pickPreferredXhsHotStyle,
  dedupeXhsHotLibraryByNoteId
};
