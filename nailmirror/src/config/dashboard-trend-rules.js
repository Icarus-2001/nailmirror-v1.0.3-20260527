/** 与 cloudfunctions/ops/utils/styleHeat.js TREND_RULES 保持一致 */
module.exports = {
  hotTitle: '爆款筛选规则',
  hotBody: '满足以下任一条件，且不与冷门冲突：\n'
    + '1. 近7日热度曲线上升：后3日均值 ≥ 前4日均值 × 1.1\n'
    + '2. 近7日热度环比 ≥ 30%，且当前热度不低于本店款式中位数',
  coldTitle: '冷门筛选规则',
  coldBody: '满足以下任一条件，且不与爆款冲突：\n'
    + '1. 近7日零试戴\n'
    + '2. 热度下降：后3日均值 ≤ 前4日均值 × 0.9\n'
    + '3. 本店款式数 ≥ 3 时，热度排名处于后 20%',
};
