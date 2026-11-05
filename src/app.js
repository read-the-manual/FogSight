// 雾见主程序：首页选盘 → 扫描 → 石子路浏览
(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- 小工具 ----------
  const UNITS = ["B", "KB", "MB", "GB", "TB"];
  function fmtSize(b) {
    let i = 0;
    while (b >= 1024 && i < UNITS.length - 1) { b /= 1024; i++; }
    const d = i === 0 || b >= 1000 ? 0 : b < 10 ? 2 : 1;
    return `${b.toFixed(d)} ${UNITS[i]}`;
  }
  const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
  const show = (id) => document.querySelectorAll(".screen").forEach((s) => { s.hidden = s.id !== id; });

  // ---------- 状态 ----------
  const st = {
    path: "",       // 正在看的扫描路径
    used: 0,        // 如果扫的是整个盘：已用空间，用来算进度
    summary: null,
    trail: [],      // 从根开始每一层的位置
    names: [],      // 面包屑上显示的名字
    view: null,     // 当前这一层
    picked: null,   // 点选的石子
  };

  // ---------- ① 首页 ----------
  async function renderDrives() {
    const list = await Api.drives();
    $("drives").replaceChildren(...list.map((d) => {
      const used = d.total - d.free;
      const b = document.createElement("button");
      b.className = "card click drive";
      b.innerHTML = `
        <div class="drive-top"><span class="drive-letter"></span><span class="drive-label"></span></div>
        <div class="progress" style="--p: ${(used / d.total * 100).toFixed(1)}%"></div>
        <div class="drive-nums num"><span>已用 <b>${fmtSize(used)}</b></span><span>共 ${fmtSize(d.total)}</span></div>`;
      b.querySelector(".drive-letter").textContent = d.mount.replace(/\\$/, "");
      b.querySelector(".drive-label").textContent = d.label || "本地磁盘";
      b.addEventListener("click", () => startScan(d.mount, used));
      return b;
    }));
  }

  $("pickFolder").addEventListener("click", async () => {
    try {
      const p = await Api.pickFolder();
      if (p) startScan(p, 0);
    } catch (e) { alert("打不开选择文件夹的窗口：" + e); }
  });

  // ---------- ② 扫描 ----------
  Api.onProgress((p) => {
    $("scanFiles").textContent = fmtNum(p.files);
    $("scanBytes").textContent = `已找到 ${fmtSize(p.bytes)}`;
    if (st.used) $("scanBar").style.setProperty("--p", Math.min(99, p.bytes / st.used * 100) + "%");
    if (p.current) $("scanPath").textContent = p.current;
  });

  async function startScan(path, used) {
    Object.assign(st, { path, used, trail: [], names: [], picked: null });
    $("scanTitle").textContent = `正在扫描 ${path}`;
    $("scanFiles").textContent = "0";
    $("scanBytes").textContent = "已找到 0 B";
    $("scanPath").innerHTML = "&nbsp;";
    $("scanBar").classList.toggle("busy", !used);
    $("scanBar").style.setProperty("--p", "0%");
    show("scanning");
    try {
      const s = await Api.scan(path);
      if (s.cancelled) { show("home"); return; }
      $("scanBar").style.setProperty("--p", "100%");
      st.summary = s;
      // 新的扫描从头记历史：首页 → 根目录
      hist = [{ home: true }, { trail: [], names: [path.replace(/\\$/, "")] }];
      pos = 1;
      await render();
    } catch (e) {
      alert("扫描失败：" + e);
      show("home");
    }
  }
  $("cancelScan").addEventListener("click", () => Api.cancel());

  // ---------- 浏览历史（跟 Windows 文件管理器一样的后退 / 前进）----------
  // 每一步是 {home: true}（选磁盘的首页）或 {trail, names}（某个文件夹）
  let hist = [{ home: true }], pos = 0;
  const here = () => hist[pos];

  async function render() {
    const h = here();
    updateNav();
    if (h.home) { show("home"); renderDrives(); return; }
    st.trail = [...h.trail];
    st.names = [...h.names];
    show("result");
    await loadView();
  }
  function go(entry) {
    hist = hist.slice(0, pos + 1);
    hist.push(entry);
    pos++;
    render();
  }
  function back() { if (pos > 0) { pos--; render(); } }
  function forward() { if (pos < hist.length - 1) { pos++; render(); } }
  function up() {
    const h = here();
    if (h.home || !h.trail.length) return;
    go({ trail: h.trail.slice(0, -1), names: h.names.slice(0, -1) });
  }
  function updateNav() {
    const h = here();
    $("goBack").disabled = pos === 0;
    $("goForward").disabled = pos >= hist.length - 1;
    $("goUp").disabled = !!h.home || !h.trail.length;
  }

  // ---------- ③ 石子路 ----------
  async function loadView() {
    st.view = await Api.view(st.trail);
    st.picked = null;
    drawCrumbs();
    drawMap(true);
    showCorner(null);
  }

  function drawCrumbs() {
    const box = $("crumbs");
    box.replaceChildren();
    st.names.forEach((name, i) => {
      if (i) { const s = document.createElement("span"); s.className = "crumb-sep"; s.textContent = "›"; box.append(s); }
      const b = document.createElement("button");
      b.className = "crumb";
      b.textContent = name;
      b.addEventListener("click", () => {
        if (i === st.names.length - 1) return;
        go({ trail: st.trail.slice(0, i), names: st.names.slice(0, i + 1) });
      });
      box.append(b);
    });
  }

  const KIND = { dir: "文件夹", file: "文件", small: "零散小文件（每个都小于 1 MB）", other: "太小没单独画出来的项目" };

  function drawMap(animate) {
    const box = $("stones");
    const W = box.clientWidth, H = box.clientHeight;
    const v = st.view;
    if (!v || !W || !H) return;
    const items = v.children.filter((c) => c.size > 0);
    const rects = Layout.squarify(items.map((c) => c.size), 0, 0, W, H);
    const max = items.length ? items[0].size : 1;
    const GAP = 3;

    const frag = document.createDocumentFragment();
    items.forEach((it, k) => {
      const r = rects[k];
      const x = r.x + GAP, y = r.y + GAP, w = r.w - GAP * 2, h = r.h - GAP * 2;
      if (w < 3 || h < 3) return;
      const el = document.createElement("div");
      el.className = `stone ${it.kind}` + (w > 220 && h > 130 ? " big" : "");
      Object.assign(el.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px",
        borderRadius: Layout.pebbleRadius(w, h, it.name) });
      el.style.setProperty("--tint", (2 + 9 * Math.sqrt(it.size / max)).toFixed(1) + "%");

      let labelH = 0;
      if (w > 60 && h > 28) {
        const lab = document.createElement("div");
        lab.className = "stone-label";
        const n = document.createElement("div");
        n.className = "stone-name";
        n.textContent = it.name;
        lab.append(n);
        labelH = 30;
        if (h > 46) {
          const s = document.createElement("div");
          s.className = "stone-size num";
          s.textContent = fmtSize(it.size);
          lab.append(s);
          labelH = 50;
        }
        el.append(lab);
      }

      // 大一点的文件夹，里面画上它的子项目当纹理
      if (it.kind === "dir" && it.children.length && w > 110 && h > labelH + 50) {
        const px = 8, py = labelH + 4, pw = w - 16, ph = h - labelH - 12;
        const kids = it.children.filter((c) => c.size > 0);
        Layout.squarify(kids.map((c) => c.size), 0, 0, pw, ph).forEach((q, j) => {
          if (q.w < 6 || q.h < 6) return;
          const p = document.createElement("div");
          p.className = "pebble";
          Object.assign(p.style, { left: px + q.x + 1.5 + "px", top: py + q.y + 1.5 + "px",
            width: q.w - 3 + "px", height: q.h - 3 + "px", borderRadius: Layout.pebbleRadius(q.w, q.h, kids[j].name) });
          // 只有够大的小石子才写字，小的保持干净
          if (q.w >= 90 && q.h >= 36) {
            const lab = document.createElement("div");
            lab.className = "pebble-label";
            const n = document.createElement("div");
            n.className = "pebble-name";
            n.textContent = kids[j].name;
            lab.append(n);
            if (q.h >= 52) {
              const sz = document.createElement("div");
              sz.className = "pebble-size num";
              sz.textContent = fmtSize(kids[j].size);
              lab.append(sz);
            }
            p.append(lab);
          }
          el.append(p);
        });
      }

      el.addEventListener("mouseenter", () => showCorner(it));
      el.addEventListener("mouseleave", () => showCorner(st.picked));
      // 左 / 右 / 中键各做什么，可以在设置 → 按键里改
      const act = (btn, e) => {
        e.preventDefault();
        const a = Keys.clickAction(btn);
        if (a === "explorer") return reveal(it);
        if (a !== "enter") return;
        if (it.kind === "dir") return drill(it);
        st.picked = st.picked === it ? null : it;   // 文件进不去，就选中它，左下角显示详情
        box.querySelectorAll(".picked").forEach((p) => p.classList.remove("picked"));
        if (st.picked) el.classList.add("picked");
        showCorner(st.picked);
      };
      el.addEventListener("click", (e) => act("left", e));
      el.addEventListener("contextmenu", (e) => act("right", e));
      el.addEventListener("auxclick", (e) => { if (e.button === 1) act("middle", e); });
      frag.append(el);
    });
    box.replaceChildren(frag);
    if (animate) { box.classList.remove("enter"); void box.offsetWidth; box.classList.add("enter"); }
  }

  function showCorner(it) {
    const v = st.view;
    if (!v) return;
    const s = st.summary;
    if (!it) {
      $("cKind").textContent = st.trail.length ? "当前文件夹" : `扫描完成 · 用时 ${(s.millis / 1000).toFixed(1)} 秒`;
      $("cName").textContent = st.names[st.names.length - 1];
      $("cSize").textContent = fmtSize(v.size);
      $("cPct").textContent = "";
      const parts = [`${fmtNum(v.files)} 个文件`, `${fmtNum(v.count)} 项`];
      if (!st.trail.length && s.denied) parts.push(`${fmtNum(s.denied)} 个文件夹没有权限读取，已跳过`);
      $("cMeta").textContent = parts.join(" · ");
      return;
    }
    $("cKind").textContent = KIND[it.kind];
    $("cName").textContent = it.name;
    $("cSize").textContent = fmtSize(it.size);
    $("cPct").textContent = v.size ? `${(it.size / v.size * 100).toFixed(1)}%` : "";
    const parts = [];
    if (it.kind !== "file") parts.push(`${fmtNum(it.files)} 个文件`);
    if (it.kind === "dir" && it.denied) parts.push("没有权限读取");
    if (it.kind === "other") parts.push(`共 ${fmtNum(it.count)} 项`);
    $("cMeta").textContent = parts.join(" · ");
  }

  function drill(it) {
    go({ trail: [...st.trail, it.idx], names: [...st.names, it.name] });
  }

  // 在文件管理器里打开：文件夹直接打开，文件会被选中；合成出来的块打开当前文件夹
  function reveal(it) {
    const trail = it && it.idx >= 0 ? [...st.trail, it.idx] : st.trail;
    Api.reveal(trail).catch((e) => alert("打不开文件管理器：" + e));
  }

  $("goBack").addEventListener("click", back);
  $("goForward").addEventListener("click", forward);
  $("goUp").addEventListener("click", up);
  $("goHome").addEventListener("click", () => go({ home: true }));
  $("rescan").addEventListener("click", () => startScan(st.path, st.used));
  $("reveal").addEventListener("click", () => reveal(st.picked));

  // 键盘和鼠标侧键 → 后退 / 前进 / 上一层
  const NAV = { back, forward, up };
  const navAllowed = (e) => $("scanning").hidden && !$("settings").open && !Keys.isRecording()
    && !(e.target.matches && e.target.matches("input, textarea, select"));
  document.addEventListener("keydown", (e) => {
    if (!navAllowed(e)) return;
    const a = Keys.match(e);
    if (a) { e.preventDefault(); NAV[a](); }
  });
  // 侧键在网页里默认会触发“浏览器后退”，先拦住
  ["mousedown", "auxclick"].forEach((t) => document.addEventListener(t, (e) => { if (e.button > 2) e.preventDefault(); }));
  document.addEventListener("mouseup", (e) => {
    if (e.button === 0 || e.button === 2 || !navAllowed(e)) return;
    if (e.button === 1 && e.target.closest(".stone")) return;   // 中键点石子归“点石子”设置管
    const a = Keys.match(e);
    if (a) { e.preventDefault(); NAV[a](); }
  });
  // 界面里不需要浏览器自带的右键菜单
  document.addEventListener("contextmenu", (e) => { if (!e.target.matches("input, textarea")) e.preventDefault(); });

  // ---------- 设置 ----------
  const dlg = $("settings");
  function openSettings() {
    Keys.renderSettings($("bindList"), $("clickList"));
    dlg.showModal();
  }
  $("closeSettings").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });   // 点窗口外面关掉
  dlg.querySelectorAll(".set-tab").forEach((t) => t.addEventListener("click", () => {
    dlg.querySelectorAll(".set-tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    dlg.querySelectorAll(".set-page").forEach((pg) => { pg.hidden = pg.dataset.page !== t.dataset.page; });
  }));
  $("resetKeys").addEventListener("click", () => { Keys.reset(); Keys.renderSettings($("bindList"), $("clickList")); });
  $("copyMail").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(dlg.querySelector(".about-mail").textContent);
      e.target.textContent = "已复制 ✓";
    } catch (err) {
      e.target.textContent = "复制失败，请手动选中";
    }
    setTimeout(() => { e.target.textContent = "复制"; }, 1800);
  });

  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => drawMap(false)); }).observe($("stones"));

  // ---------- 启动 ----------
  const GEAR = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>';
  Titlebar.mount($("tb"), { title: "雾见", sub: Api.real ? "" : "模拟数据",
    actions: [{ icon: GEAR, label: "设置", onClick: openSettings }] });
  Theme.picker($("picker"), { system: true });
  renderDrives();
})();
