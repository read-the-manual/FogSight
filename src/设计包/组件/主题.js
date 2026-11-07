// 设计包 · 主题切换。需要先引入 主题列表.js。
//
//   Theme.init()                     读取上次选的主题并应用（没选过就用默认主题）
//   Theme.apply("claude")            换主题；传 "system" 表示跟随系统（浅色→纸色，深色→深色）
//   Theme.current()                  当前选择，可能是 "system"
//   Theme.picker(容器, {system:true}) 在容器里生成一排主题色块
//
// 换主题时会在 document 上发出 "themechange" 事件，detail 里是 {choice, id, scheme}。
// 主题名跟着 <html lang> 走：lang 以 en 开头就显示英文名。切换语言后再调用一次 picker() 重画。
(function () {
  const KEY = "设计包.主题";
  const list = window.THEME_LIST || [];
  const media = matchMedia("(prefers-color-scheme: dark)");
  let choice = window.THEME_DEFAULT || "paper";

  const isEn = () => (document.documentElement.lang || "").toLowerCase().startsWith("en");
  const resolve = (c) => (c === "system" ? (media.matches ? "dark" : "paper") : c);

  function apply(c) {
    if (c !== "system" && !list.some((t) => t.id === c)) c = window.THEME_DEFAULT;
    choice = c;
    const id = resolve(c);
    const scheme = (list.find((t) => t.id === id) || {}).scheme || "light";
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem(KEY, c); } catch (e) { /* 隐私模式下存不了，没关系 */ }
    syncTauri(scheme);
    document.querySelectorAll(".theme-swatch").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.id === c)));
    document.dispatchEvent(new CustomEvent("themechange", { detail: { choice: c, id, scheme } }));
  }

  // 在 Tauri 里运行时，让 Windows 窗口阴影/边框也换成对应的浅色或深色
  function syncTauri(scheme) {
    try { window.__TAURI__.window.getCurrentWindow().setTheme(scheme); } catch (e) { /* 浏览器里没有 Tauri */ }
  }

  media.addEventListener("change", () => { if (choice === "system") apply("system"); });

  function init() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    apply(saved || choice);
  }

  function picker(box, opts = {}) {
    const items = list.map((t) => ({ id: t.id, name: isEn() ? t.name_en || t.name : t.name, bg: t.bg, accent: t.accent }));
    if (opts.system) {
      const p = list.find((t) => t.id === "paper"), d = list.find((t) => t.id === "dark");
      items.push({ id: "system", name: isEn() ? "System" : "跟随系统", bg: p && p.bg, accent: d && d.bg });
    }
    box.classList.add("theme-picker");
    box.replaceChildren(...items.map((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-swatch";
      b.dataset.id = t.id;
      b.setAttribute("aria-pressed", String(t.id === choice));
      b.style.setProperty("--sw-bg", t.bg);
      b.style.setProperty("--sw-accent", t.accent);
      b.append(document.createElement("i"), t.name);
      b.addEventListener("click", () => apply(t.id));
      return b;
    }));
  }

  window.Theme = { init, apply, picker, current: () => choice, list };
})();
