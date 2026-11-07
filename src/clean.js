// C 盘专清的界面。真正删什么由 Rust 那边写死，这里只传项目的 id。
(function () {
  const $ = (id) => document.getElementById(id);

  // 每一项的名字、说明和删掉之后的后果在 i18n.js 的 CLEAN 表里（中英两份）。
  // severe 的后果用警告色显示
  const SEVERE = new Set(["recycle", "hibernate", "windows_old"]);
  const tr = I18n.t;
  const TEXT = (id) => {
    const c = I18n.clean(id);
    return c ? { ...c, severe: SEVERE.has(id) } : null;
  };

  let data = null;
  const picked = new Set();
  let fmtSize = (b) => b + " B";

  async function show(fmt) {
    fmtSize = fmt;
    picked.clear();
    $("cleanResult").hidden = true;
    $("cleanList").innerHTML = `<div class="dim clean-loading">${tr("clean.loading")}</div>`;
    updateBar();
    try {
      data = await Api.cleanOverview();
    } catch (e) {
      $("cleanList").innerHTML = "";
      $("cleanList").append(Object.assign(document.createElement("div"), { className: "notice", textContent: tr("clean.statFail") + I18n.err(e) }));
      return;
    }
    render();
  }

  function row(it) {
    const t = TEXT(it.id);
    const blocked = it.admin && !data.is_admin;
    const empty = it.size === 0;
    const el = document.createElement("label");
    el.className = "clean-row card" + (empty || blocked ? " off" : "");
    el.innerHTML = `
      <input type="checkbox" class="clean-check">
      <div class="clean-main">
        <div class="clean-title"><b></b><span class="tags"></span></div>
        <div class="clean-desc dim"></div>
        <div class="clean-effect"></div>
      </div>
      <div class="clean-side"><div class="clean-size num"></div><div class="clean-act"></div></div>`;
    el.querySelector("b").textContent = t.name;
    el.querySelector(".clean-desc").textContent = t.desc;
    el.querySelector(".clean-size").textContent = empty ? "—" : fmtSize(it.size);
    const tags = el.querySelector(".tags");
    const tag = (txt, cls = "") => tags.append(Object.assign(document.createElement("span"), { className: "tag " + cls, textContent: txt }));
    if (it.admin) tag(tr("clean.needAdmin"), blocked ? "" : "accent");
    if (empty) tag(it.id === "windows_old" ? tr("clean.notOnPc") : tr("clean.isClean"));

    const effect = el.querySelector(".clean-effect");
    if (t.effect) {
      effect.textContent = tr("clean.after") + t.effect;
      effect.classList.toggle("severe", !!t.severe);
    }

    const box = el.querySelector(".clean-check");
    const act = el.querySelector(".clean-act");
    if (it.kind === "settings") {
      box.remove();
      if (!empty) {
        const b = Object.assign(document.createElement("button"), { className: "btn sm", textContent: tr("clean.openStorage") });
        b.addEventListener("click", (e) => { e.preventDefault(); Api.openStorageSettings().catch((err) => alert(I18n.err(err))); });
        act.append(b);
      }
    } else {
      box.disabled = empty || blocked;
      box.checked = picked.has(it.id);
      box.addEventListener("change", () => { box.checked ? picked.add(it.id) : picked.delete(it.id); updateBar(); });
    }
    return el;
  }

  function infoRow(it) {
    const t = TEXT(it.id);
    const el = document.createElement("div");
    el.className = "clean-row card info";
    el.innerHTML = `<div class="clean-main"><div class="clean-title"><b></b></div><div class="clean-desc dim"></div></div>
      <div class="clean-side"><div class="clean-size num"></div><div class="clean-act"></div></div>`;
    el.querySelector("b").textContent = t.name;
    el.querySelector(".clean-desc").textContent = t.desc;
    el.querySelector(".clean-size").textContent = it.size ? fmtSize(it.size) : tr("clean.notFound");
    if (it.path) {
      const b = Object.assign(document.createElement("button"), { className: "btn ghost sm", textContent: tr("clean.peek") });
      b.addEventListener("click", () => Api.cleanOpen(it.id).catch((e) => alert(I18n.err(e))));
      el.querySelector(".clean-act").append(b);
    }
    return el;
  }

  function render() {
    const list = $("cleanList");
    list.replaceChildren();
    const needAdmin = data.items.some((it) => it.admin && it.size > 0);
    if (!data.is_admin && needAdmin) {
      const n = document.createElement("div");
      n.className = "notice admin-notice";
      n.innerHTML = `<div style="flex:1"><b></b><br><span class="dim"></span></div>`;
      n.querySelector("b").textContent = tr("clean.adminTitle");
      n.querySelector(".dim").textContent = tr("clean.adminBody");
      const b = Object.assign(document.createElement("button"), { className: "btn sm", textContent: tr("clean.relaunch") });
      b.addEventListener("click", () => Api.relaunchAdmin().catch((e) => alert(I18n.err(e))));
      n.append(b);
      list.append(n);
    }
    data.items.filter((it) => it.kind !== "info").forEach((it) => list.append(row(it)));
    const h = document.createElement("h3");
    h.className = "clean-sub";
    h.textContent = tr("clean.yours");
    list.append(h);
    data.items.filter((it) => it.kind === "info").forEach((it) => list.append(infoRow(it)));
    updateBar();
  }

  const pickedItems = () => data ? data.items.filter((it) => picked.has(it.id)) : [];

  function updateBar() {
    const items = pickedItems();
    const total = items.reduce((a, it) => a + it.size, 0);
    $("cleanSum").textContent = items.length ? tr("clean.sum", { n: items.length, s: fmtSize(total) }) : tr("clean.none");
    $("cleanGo").disabled = !items.length;
  }

  // 最后确认
  $("cleanGo").addEventListener("click", () => {
    const items = pickedItems();
    const ul = $("confirmList");
    ul.replaceChildren(...items.map((it) => {
      const li = document.createElement("li");
      const t = TEXT(it.id);
      li.innerHTML = `<span class="confirm-name"></span><span class="num dim"></span>`;
      li.querySelector(".confirm-name").textContent = t.name;
      li.querySelector(".dim").textContent = fmtSize(it.size);
      if (t.severe) {
        const w = Object.assign(document.createElement("div"), { className: "clean-effect severe", textContent: t.effect });
        li.append(w);
      }
      return li;
    }));
    $("confirmTotal").textContent = fmtSize(items.reduce((a, it) => a + it.size, 0));
    $("confirmClean").showModal();
  });
  $("confirmCancel").addEventListener("click", () => $("confirmClean").close());

  $("confirmOk").addEventListener("click", async () => {
    const btn = $("confirmOk");
    btn.disabled = true;
    btn.textContent = tr("clean.running");
    const items = pickedItems();
    let results = [];
    try {
      results = await Api.cleanRun(items.map((it) => it.id));
    } catch (e) {
      results = [{ id: "", freed: 0, failed: 0, error: String(e) }];
    }
    btn.disabled = false;
    btn.textContent = tr("clean.ok");
    $("confirmClean").close();
    showResult(results);
    const keep = $("cleanResult").cloneNode(true);
    await show(fmtSize);                // 重新统计一遍大小
    $("cleanResult").replaceWith(keep); // 结果卡片留着
  });

  function showResult(results) {
    const box = $("cleanResult");
    const freed = results.reduce((a, r) => a + r.freed, 0);
    box.replaceChildren();
    const h = document.createElement("h3");
    h.textContent = tr("clean.done", { s: fmtSize(freed) });
    box.append(h);
    const ul = document.createElement("ul");
    results.forEach((r) => {
      const li = document.createElement("li");
      const name = TEXT(r.id) ? TEXT(r.id).name : tr("clean.fallback");
      if (r.error) li.textContent = tr("clean.itemErr", { name, e: I18n.err(r.error) });
      else li.textContent = tr("clean.itemOk", { name, s: fmtSize(r.freed) }) + (r.failed ? tr("clean.itemSkip", { n: r.failed }) : "");
      if (r.error) li.className = "clean-effect severe";
      ul.append(li);
    });
    box.append(ul);
    box.hidden = false;
  }

  // 换语言时：列表和底栏按新语言重画，已勾选的保持不变（清理结果卡片下次清理时再换）
  function relabel() {
    if (data) render();
    else updateBar();
  }

  window.Clean = { show, relabel };
})();
