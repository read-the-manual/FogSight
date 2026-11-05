// C 盘专清的界面。真正删什么由 Rust 那边写死，这里只传项目的 id。
(function () {
  const $ = (id) => document.getElementById(id);

  // 每一项的说明和删掉之后的后果；severe 的后果用警告色显示
  const TEXT = {
    user_temp: { name: "临时文件", desc: "程序运行时留下的临时文件（你自己的 Temp 文件夹）", effect: "基本没影响；正在使用的文件会自动跳过" },
    win_temp: { name: "系统临时文件", desc: "Windows\\Temp 里的临时文件", effect: "基本没影响；正在使用的文件会自动跳过" },
    recycle: { name: "回收站", desc: "所有磁盘回收站里的东西", effect: "永久删除，再也找不回来", severe: true },
    wu_cache: { name: "Windows 更新下载缓存", desc: "已经下载过的系统更新安装包", effect: "下载了但还没安装的更新，需要重新下载" },
    delivery: { name: "更新分享缓存", desc: "“传递优化”用来和别的电脑互相分享更新的缓存", effect: "没影响" },
    browser: { name: "浏览器缓存", desc: "Chrome、Edge 存下来的网页图片和脚本", effect: "网页第一次打开会慢一点；登录状态和保存的密码不受影响。浏览器开着时有些文件删不掉，先关掉浏览器效果更好" },
    thumbs: { name: "缩略图缓存", desc: "文件管理器里图片、视频的预览小图", effect: "预览图要重新生成；文件管理器开着时有些删不掉" },
    dumps: { name: "错误报告和蓝屏转储", desc: "程序崩溃、电脑蓝屏时留下的记录", effect: "以后没法用它们排查蓝屏和崩溃的原因" },
    hibernate: { name: "休眠文件 hiberfil.sys", desc: "电脑休眠时用来保存内存里的内容", effect: "会关闭休眠，“快速启动”也会失效。以后想恢复，用管理员身份运行 powercfg /h on 就能重新打开", severe: true },
    windows_old: { name: "旧系统 Windows.old", desc: "升级系统后留下的旧版本", effect: "清理后再也不能退回升级前的系统。雾见不直接删它，交给 Windows 自己清理更稳妥", severe: true },
    downloads: { name: "下载文件夹", desc: "浏览器和各种软件下载的东西" },
    wechat: { name: "微信聊天文件", desc: "聊天里收到的图片、视频、文件" },
    qq: { name: "QQ 聊天文件", desc: "聊天里收到的图片、视频、文件" },
  };

  let data = null;
  const picked = new Set();
  let fmtSize = (b) => b + " B";

  async function show(fmt) {
    fmtSize = fmt;
    picked.clear();
    $("cleanResult").hidden = true;
    $("cleanList").innerHTML = `<div class="dim clean-loading">正在统计各个位置有多大…</div>`;
    updateBar();
    try {
      data = await Api.cleanOverview();
    } catch (e) {
      $("cleanList").innerHTML = "";
      $("cleanList").append(Object.assign(document.createElement("div"), { className: "notice", textContent: "统计失败：" + e }));
      return;
    }
    render();
  }

  function row(it) {
    const t = TEXT[it.id];
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
    if (it.admin) tag("需要管理员", blocked ? "" : "accent");
    if (empty) tag(it.id === "windows_old" ? "你的电脑上没有" : "很干净，不用清理");

    const effect = el.querySelector(".clean-effect");
    if (t.effect) {
      effect.textContent = "删掉之后：" + t.effect;
      effect.classList.toggle("severe", !!t.severe);
    }

    const box = el.querySelector(".clean-check");
    const act = el.querySelector(".clean-act");
    if (it.kind === "settings") {
      box.remove();
      if (!empty) {
        const b = Object.assign(document.createElement("button"), { className: "btn sm", textContent: "打开 Windows 存储设置" });
        b.addEventListener("click", (e) => { e.preventDefault(); Api.openStorageSettings().catch((err) => alert(err)); });
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
    const t = TEXT[it.id];
    const el = document.createElement("div");
    el.className = "clean-row card info";
    el.innerHTML = `<div class="clean-main"><div class="clean-title"><b></b></div><div class="clean-desc dim"></div></div>
      <div class="clean-side"><div class="clean-size num"></div><div class="clean-act"></div></div>`;
    el.querySelector("b").textContent = t.name;
    el.querySelector(".clean-desc").textContent = t.desc;
    el.querySelector(".clean-size").textContent = it.size ? fmtSize(it.size) : "没找到";
    if (it.path) {
      const b = Object.assign(document.createElement("button"), { className: "btn ghost sm", textContent: "打开看看" });
      b.addEventListener("click", () => Api.cleanOpen(it.id).catch((e) => alert(e)));
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
      n.innerHTML = `<div style="flex:1"><b>有几项需要管理员权限</b><br><span class="dim">现在是普通权限，这几项先灰着。以管理员身份重新打开雾见就能清理它们（Windows 会弹窗问你同不同意）。</span></div>`;
      const b = Object.assign(document.createElement("button"), { className: "btn sm", textContent: "以管理员身份重新打开" });
      b.addEventListener("click", () => Api.relaunchAdmin().catch((e) => alert(e)));
      n.append(b);
      list.append(n);
    }
    data.items.filter((it) => it.kind !== "info").forEach((it) => list.append(row(it)));
    const h = document.createElement("h3");
    h.className = "clean-sub";
    h.textContent = "这些是你自己的东西，雾见只告诉你有多大，不帮你删";
    list.append(h);
    data.items.filter((it) => it.kind === "info").forEach((it) => list.append(infoRow(it)));
    updateBar();
  }

  const pickedItems = () => data ? data.items.filter((it) => picked.has(it.id)) : [];

  function updateBar() {
    const items = pickedItems();
    const total = items.reduce((a, it) => a + it.size, 0);
    $("cleanSum").textContent = items.length ? `已选 ${items.length} 项 · 大约 ${fmtSize(total)}` : "还没有勾选";
    $("cleanGo").disabled = !items.length;
  }

  // 最后确认
  $("cleanGo").addEventListener("click", () => {
    const items = pickedItems();
    const ul = $("confirmList");
    ul.replaceChildren(...items.map((it) => {
      const li = document.createElement("li");
      const t = TEXT[it.id];
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
    btn.textContent = "正在清理…";
    const items = pickedItems();
    let results = [];
    try {
      results = await Api.cleanRun(items.map((it) => it.id));
    } catch (e) {
      results = [{ id: "", freed: 0, failed: 0, error: String(e) }];
    }
    btn.disabled = false;
    btn.textContent = "确认清理";
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
    h.textContent = `清理完成，释放了 ${fmtSize(freed)} ✨`;
    box.append(h);
    const ul = document.createElement("ul");
    results.forEach((r) => {
      const li = document.createElement("li");
      const name = TEXT[r.id] ? TEXT[r.id].name : "清理";
      if (r.error) li.textContent = `${name}：没有清理，${r.error}`;
      else li.textContent = `${name}：释放 ${fmtSize(r.freed)}` + (r.failed ? `，${r.failed} 个文件正在使用，已跳过` : "");
      if (r.error) li.className = "clean-effect severe";
      ul.append(li);
    });
    box.append(ul);
    box.hidden = false;
  }

  window.Clean = { show };
})();
