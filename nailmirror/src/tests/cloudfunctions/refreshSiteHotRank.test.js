jest.mock('wx-server-sdk', () => ({
  init: jest.fn(),
  database: jest.fn(() => ({ collection: jest.fn() })),
}), { virtual: true })

jest.mock('../../cloudfunctions/ops/utils/db', () => ({
  getAll: jest.fn(),
}))

jest.mock('../../cloudfunctions/ops/utils/collections', () => ({
  ensureCollection: jest.fn(),
}))

jest.mock('../../cloudfunctions/ops/handlers/getStyleHeatScores', () => ({
  getStyleHeatScores: jest.fn(),
}))

const {
  buildCandidatePool,
  sortTop10,
} = require('../../cloudfunctions/ops/handlers/refreshSiteHotRank')

describe('refreshSiteHotRank helpers', () => {
  test('buildCandidatePool merges platform ids and merchant styles', () => {
    const pool = buildCandidatePool(['real-1', 'real-2'], [
      { _id: 'merchant-a' },
      { _id: 'xhs-hot-2026-06-06-01' },
      { _id: 'custom-upload-1' },
    ])
    expect(pool).toContain('real-1')
    expect(pool).toContain('real-2')
    expect(pool).toContain('merchant-a')
    expect(pool).not.toContain('xhs-hot-2026-06-06-01')
    expect(pool).not.toContain('custom-upload-1')
  })

  test('sortTop10 orders by heat desc and caps at 10', () => {
    const ids = Array.from({ length: 12 }, (_, i) => 'real-' + (i + 1))
    const heatScores = {
      'real-1': 10,
      'real-2': 50,
      'real-3': 30,
      'real-4': 50,
      'real-5': 5,
    }
    const top = sortTop10(ids, heatScores)
    expect(top).toHaveLength(10)
    expect(top[0]).toEqual({ styleId: 'real-2', rank: 1, heat: 50 })
    expect(top[1]).toEqual({ styleId: 'real-4', rank: 2, heat: 50 })
    expect(top[2]).toEqual({ styleId: 'real-3', rank: 3, heat: 30 })
    expect(top[top.length - 1].rank).toBe(10)
  })

  test('sortTop10 treats missing heat as zero', () => {
    const top = sortTop10(['real-9', 'real-1'], { 'real-1': 8 })
    expect(top[0]).toEqual({ styleId: 'real-1', rank: 1, heat: 8 })
    expect(top[1]).toEqual({ styleId: 'real-9', rank: 2, heat: 0 })
  })
})
