// 按键设置：导航用的键（键盘 + 鼠标侧键/中键）和“点石子”时左/右/中键分别做什么。
// 存在浏览器存储里；存不了（比如隐私模式）就每次用默认值。
(function () {
  const KEY = "雾见.按键";

  const ACTIONS = { back: "后退", forward: "前进", up: "上一层" };
  const CLICK_BUTTONS = { left: "左键", right: "右键", middle: "中键" };
  const CLICK_ACTIONS = { enter: "进入文件夹", explorer: "在文件管理器中打开", none: "什么也不做" };

  // 和 Windows 文件管理器一样：侧键后退/前进，Alt+方向键，Backspace 后退
  const DEFAULTS = {
    nav: {
      back: ["Mouse3", "Alt+ArrowLeft", "Backspace"],
      forward: ["Mouse4", "Alt+ArrowRight"],
      up: ["Alt+ArrowUp"],
    },
    click: { left: "enter", right: "explorer", middle: "none" },
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  let cfg = clone(DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.nav && saved.click) cfg = { nav: { ...cfg.nav, ...saved.nav }, click: { ...cfg.click, ...saved.click } };
  } catch (e) { /* 读不到就用默认 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

  // 把一次按键 / 鼠标按下变成 "Ctrl+Alt+K"、"Mouse3" 这样的字符串
  function codeOf(e) {
    if (e.type.startsWith("mouse") || e.type === "auxclick") return "Mouse" + e.button;
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
    const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift"].filter(Boolean);
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    return [...mods, k].join("+");
  }

  const NAMES = { Mouse1: "鼠标中键", Mouse3: "鼠标侧键（下）", Mouse4: "鼠标侧键（上）",
    ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", " ": "空格" };
  const label = (code) => code.split("+").map((p) => NAMES[p] || p).join(" + ");

  // 这个按键对应哪个导航动作
  function match(e) {
    const c = codeOf(e);
    if (!c) return null;
    return Object.keys(cfg.nav).find((a) => cfg.nav[a].includes(c)) || null;
  }

  let recording = null;   // 正在录哪个动作
  let capturing = null;   // 当前挂着的录键监听，同一时间只留一个

  function renderSettings(bindBox, clickBox) {
    bindBox.replaceChildren(...Object.entries(ACTIONS).map(([act, name]) => {
      const row = document.createElement("div");
      row.className = "bind-row";
      row.innerHTML = `<div class="bind-name"></div><div class="bind-keys"></div>`;
      row.querySelector(".bind-name").textContent = name;
      const keys = row.querySelector(".bind-keys");
      cfg.nav[act].forEach((code, i) => {
        const chip = document.createElement("span");
        chip.className = "key-chip";
        chip.append(label(code));
        const x = document.createElement("button");
        x.textContent = "×";
        x.setAttribute("aria-label", `删掉 ${label(code)}`);
        x.addEventListener("click", () => { cfg.nav[act].splice(i, 1); save(); renderSettings(bindBox, clickBox); });
        chip.append(x);
        keys.append(chip);
      });
      if (recording === act) {
        const chip = document.createElement("span");
        chip.className = "key-chip recording";
        chip.textContent = "请按下按键…";
        keys.append(chip);
      } else {
        const add = document.createElement("button");
        add.className = "btn ghost sm";
        add.textContent = "+";
        add.setAttribute("aria-label", `给“${name}”加一个按键`);
        add.addEventListener("click", (e) => { e.stopPropagation(); recording = act; renderSettings(bindBox, clickBox); });
        keys.append(add);
      }
      return row;
    }));

    clickBox.replaceChildren(...Object.entries(CLICK_BUTTONS).map(([btn, name]) => {
      const row = document.createElement("div");
      row.className = "bind-row";
      row.innerHTML = `<div class="bind-name"></div><select class="field"></select>`;
      row.querySelector(".bind-name").textContent = name;
      const sel = row.querySelector("select");
      Object.entries(CLICK_ACTIONS).forEach(([v, t]) => sel.add(new Option(t, v, false, cfg.click[btn] === v)));
      sel.addEventListener("change", () => { cfg.click[btn] = sel.value; save(); });
      return row;
    }));

    // 录键：下一次按键或鼠标键就是新绑定
    function capture(e) {
      if (!recording) return;
      if (e.type === "keydown" && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); return; }   // 只取消录键，不关掉设置窗口
      if (e.type === "mousedown" && e.button === 0) return;   // 左键是用来点界面的，不能绑
      const c = codeOf(e);
      if (!c) return;
      e.preventDefault(); e.stopPropagation();
      // 一个键只能对应一个动作：从别的动作里拿掉
      Object.values(cfg.nav).forEach((list) => { const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); });
      cfg.nav[recording].push(c);
      save();
      stop();
    }
    function stop() {
      recording = null;
      renderSettings(bindBox, clickBox);   // 重新渲染时会摘掉监听
    }
    if (capturing) {
      document.removeEventListener("keydown", capturing, true);
      document.removeEventListener("mousedown", capturing, true);
      capturing = null;
    }
    if (recording) {
      capturing = capture;
      document.addEventListener("keydown", capture, true);
      document.addEventListener("mousedown", capture, true);
    }
  }

  function reset() { cfg = clone(DEFAULTS); save(); }

  window.Keys = {
    match, reset, renderSettings,
    isRecording: () => !!recording,
    clickAction: (btn) => cfg.click[btn],
    // 哪个鼠标键被设成了“在文件管理器中打开”，给提示文字用；没有就是 null
    explorerButton: () => { const b = Object.keys(cfg.click).find((k) => cfg.click[k] === "explorer"); return b ? CLICK_BUTTONS[b] : null; },
  };
})();
