// 设计包 · 让 .slider 已拖过的部分显示主色。引入即可，之后动态加入的滑块也会生效。
(function () {
  function paint(s) {
    const min = +s.min || 0, max = s.max === "" ? 100 : +s.max;
    s.style.setProperty("--val", ((s.value - min) / (max - min)) * 100 + "%");
  }
  document.addEventListener("input", (e) => { if (e.target.matches(".slider")) paint(e.target); });
  const all = () => document.querySelectorAll(".slider").forEach(paint);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", all);
  else all();
  window.Slider = { paint, refresh: all };
})();
