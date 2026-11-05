// 设计包 · 自绘标题栏。窗口去掉系统边框后用它代替，颜色跟随主题，不会有白边。
//
//   <div id="tb"></div>
//   Titlebar.mount(document.getElementById("tb"), { title: "雾见", sub: "v0.1" })
//
// 在 Tauri 2 里使用需要：
//   tauri.conf.json → app.withGlobalTauri: true；窗口设置 decorations: false, shadow: true
//   capabilities 里允许 core:window:allow-minimize / allow-toggle-maximize / allow-close /
//   allow-start-dragging / allow-set-theme
// 在普通浏览器里打开时按钮不会报错，只是什么也不做。
(function () {
  const ICONS = {
    min: '<svg viewBox="0 0 10 10"><path d="M0 5h10"/></svg>',
    max: '<svg viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" rx="1.5"/></svg>',
    close: '<svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10"/></svg>',
  };

  function win() {
    try { return window.__TAURI__.window.getCurrentWindow(); } catch (e) { return null; }
  }

  function mount(el, opts = {}) {
    el.classList.add("titlebar");
    el.innerHTML = `
      <div class="tb-title" data-tauri-drag-region>
        <b data-tauri-drag-region></b><span class="faint" data-tauri-drag-region></span>
      </div>
      <div class="tb-btns">
        <button class="tb-btn" data-act="minimize" aria-label="最小化">${ICONS.min}</button>
        <button class="tb-btn" data-act="toggleMaximize" aria-label="最大化">${ICONS.max}</button>
        <button class="tb-btn close" data-act="close" aria-label="关闭">${ICONS.close}</button>
      </div>`;
    // 标题用 textContent 填，防止标题里的字符被当成 HTML
    el.querySelector("b").textContent = opts.title || document.title;
    el.querySelector(".faint").textContent = opts.sub || "";
    el.querySelectorAll(".tb-btn").forEach((b) =>
      b.addEventListener("click", () => { const w = win(); if (w) w[b.dataset.act](); }));
  }

  window.Titlebar = { mount };
})();
