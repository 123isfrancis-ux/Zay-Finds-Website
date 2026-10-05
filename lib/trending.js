// Pure ranking functions shared by the browser and server. Never reorder inputs.
const WINDOW_DAYS = 7;
const MIN_VIEWS = 30;
const MIN_ACTIONS = 5;
function dayKey(now = Date.now()) { return new Date(now).toISOString().slice(0, 10); }
function aggregateDays(days) {
  const totals = {};
  days.slice(0, WINDOW_DAYS).forEach((fields, age) => {
    const weight = 2 ** (-age / 3);
    for (const [field, raw] of Object.entries(fields || {})) {
      const [id, type] = field.split(':');
      const count = Number(raw);
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !['view','click','save'].includes(type) || !Number.isFinite(count) || count < 0) continue;
      const row = totals[id] ||= { view: 0, click: 0, save: 0, rawViews: 0, rawActions: 0 };
      row[type] += count * weight;
      if (type === 'view') row.rawViews += count;
      else row.rawActions += count;
    }
  });
  return totals;
}
function scoreProduct(row) {
  if (!row || row.rawViews < MIN_VIEWS || row.rawActions < MIN_ACTIONS) return null;
  // Smoothed rates resist one-click winners; saves carry twice the weight.
  const views = Math.max(0, row.view);
  return (Math.min(views, row.click) + 2 * Math.min(views, row.save) + 3) / (3 * (views + 30));
}
function makeSnapshot(days, validIds, now = Date.now()) {
  const scores = {};
  for (const [id, row] of Object.entries(aggregateDays(days))) {
    if (!validIds.has(id)) continue;
    const score = scoreProduct(row);
    if (score !== null) scores[id] = score;
  }
  return { version: 1, status: Object.keys(scores).length >= 3 ? 'ready' : 'learning', scores, seed: dayKey(now) };
}
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
function rankTrending(items, snapshot) {
  if (snapshot?.status !== 'ready') return [...items];
  const ranked = [], discovery = [];
  items.forEach((item, index) => {
    const score = snapshot.scores?.[item.id];
    if (Number.isFinite(score) && score >= 0 && item.image) ranked.push({ item, score, index });
    else discovery.push(item);
  });
  // A category with no proven trends keeps its established sheet order.
  if (!ranked.length) return [...items];
  ranked.sort((a,b) => b.score - a.score || a.index - b.index);
  discovery.sort((a,b) => Number(Boolean(b.image)) - Number(Boolean(a.image)) || hash(`${snapshot.seed}:${a.id}`) - hash(`${snapshot.seed}:${b.id}`));
  const result = [];
  let r = 0, d = 0;
  while (r < ranked.length || d < discovery.length) {
    // One in five slots offers an underexposed product a chance to be seen.
    if (d < discovery.length && (r >= ranked.length || result.length % 5 === 4)) result.push(discovery[d++]);
    else result.push(ranked[r++].item);
  }
  return result;
}
module.exports = { WINDOW_DAYS, MIN_VIEWS, MIN_ACTIONS, dayKey, aggregateDays, scoreProduct, makeSnapshot, rankTrending };
