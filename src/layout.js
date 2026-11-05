// 色块图布局：先用“方形树图”(squarified treemap) 把面积按大小分好，
// 再给每块配上不规则的圆角，看起来像一块块铺开的色块。
(function () {
  // 一行里最“细长”的那块有多细长，越接近 1 越方正
  function worst(row, side) {
    let sum = 0, max = 0, min = Infinity;
    for (const a of row) { sum += a; if (a > max) max = a; if (a < min) min = a; }
    const s2 = side * side, sum2 = sum * sum;
    return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
  }

  // values 要从大到小排好；返回每个值对应的 {x, y, w, h}
  function squarify(values, x, y, w, h) {
    const total = values.reduce((a, b) => a + b, 0);
    if (!total || w <= 0 || h <= 0) return [];
    const scale = (w * h) / total;
    const areas = values.map((v) => v * scale);
    const rects = [];
    let i = 0;
    while (i < areas.length) {
      const side = Math.min(w, h);
      const row = [areas[i]];
      let j = i + 1;
      while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) row.push(areas[j++]);
      const sum = row.reduce((a, b) => a + b, 0);
      if (w >= h) {               // 竖着放一列在左边
        const cw = sum / h;
        let cy = y;
        for (const a of row) { rects.push({ x, y: cy, w: cw, h: a / cw }); cy += a / cw; }
        x += cw; w -= cw;
      } else {                    // 横着放一行在上边
        const rh = sum / w;
        let cx = x;
        for (const a of row) { rects.push({ x: cx, y, w: a / rh, h: rh }); cx += a / rh; }
        y += rh; h -= rh;
      }
      i = j;
    }
    return rects;
  }

  // 用名字算出一个固定的“随机数”，同一个文件夹每次的色块形状都一样
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };
  }

  // 四个角各不相同的圆角，像一块块小石头。
  // 左上角放文字，圆角太大会把字切掉，所以左上角最多 12px
  function pebbleRadius(w, h, name) {
    const r = hash(name);
    const base = Math.max(4, Math.min(36, Math.min(w, h) * 0.3));
    const c = () => Math.round(base * (0.65 + r() * 0.7));
    return `${Math.min(c(), 12)}px ${c()}px ${c()}px ${c()}px`;
  }

  window.Layout = { squarify, pebbleRadius };
})();
