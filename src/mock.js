// 模拟数据：只在浏览器里调界面时用，真正的程序里不会用到。
(function () {
  const GB = 1024 ** 3, MB = 1024 ** 2;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const NAMES = ["Program Files", "Users", "Windows", "游戏", "照片", "视频", "下载", "项目", "备份", "音乐",
    "AppData", "Steam", "Documents", "Adobe", "node_modules", "缓存", "素材", "录屏", "旧电脑", "安装包",
    "Microsoft", "Temp", "Logs", "壁纸", "资料", "课件", "WeChat Files", "Packages", "Library", "Data"];
  const FILES = ["pagefile.sys", "hiberfil.sys", "录屏 2026-10-31.mp4", "备份.zip", "安装包.exe", "model.bin",
    "素材合集.rar", "电影.mkv", "save.dat", "disk.vhdx"];

  function makeDir(name, size, depth) {
    const node = { name, size, files: 0, is_dir: true, denied: false, children: [] };
    if (depth > 3 || size < 200 * MB) { node.files = Math.round(size / (3 * MB)) + 1; return node; }
    let left = size * (0.85 + rand() * 0.1);
    const n = 6 + Math.floor(rand() * 22);
    for (let i = 0; i < n && left > 50 * MB; i++) {
      const part = left * (0.15 + rand() * 0.45);
      left -= part;
      if (rand() < 0.22) {
        node.children.push({ name: FILES[Math.floor(rand() * FILES.length)], size: part, files: 1, is_dir: false, children: [] });
        node.files += 1;
      } else {
        const c = makeDir(NAMES[Math.floor(rand() * NAMES.length)] + (depth ? "" : ""), part, depth + 1);
        node.children.push(c);
        node.files += c.files;
      }
    }
    node.files += Math.round((size - node.children.reduce((a, c) => a + c.size, 0)) / (0.4 * MB));
    node.children.sort((a, b) => b.size - a.size);
    return node;
  }

  // 和 Rust 里 scan::view 一样的规则
  function view(node, idx, limits) {
    const out = { name: node.name, size: node.size, files: node.files, kind: node.is_dir ? "dir" : "file",
      idx, denied: !!node.denied, count: node.children.length, children: [] };
    if (!limits.length || !node.is_dir) return out;
    const [limit, ...rest] = limits;
    node.children.slice(0, limit).forEach((c, i) => out.children.push(view(c, i, rest)));
    const others = node.children.slice(limit);
    if (others.length) out.children.push({ name: `其余 ${others.length} 项`, kind: "other", idx: -1, count: others.length,
      size: others.reduce((a, c) => a + c.size, 0), files: others.reduce((a, c) => a + c.files, 0), children: [] });
    const listed = node.children.reduce((a, c) => a + c.size, 0);
    if (node.size > listed) out.children.push({ name: "零散小文件", kind: "small", idx: -1, count: 0,
      size: node.size - listed, files: node.files - node.children.reduce((a, c) => a + c.files, 0), children: [] });
    out.children.sort((a, b) => b.size - a.size);
    return out;
  }

  let root = null, listeners = [], cancelled = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.MockApi = {
    real: false,
    drives: async () => [
      { mount: "C:\\", label: "系统", total: 301 * GB, free: 92 * GB },
      { mount: "D:\\", label: "资料", total: 931 * GB, free: 412 * GB },
      { mount: "G:\\", label: "", total: 64 * GB, free: 50 * GB },
    ],
    async scan(path) {
      seed = 7; cancelled = false;
      const total = path.startsWith("C") ? 209 * GB : 40 * GB;
      root = makeDir(path, total, 0);
      const steps = 30;
      for (let i = 1; i <= steps && !cancelled; i++) {
        await sleep(80);
        listeners.forEach((f) => f({ files: Math.round(root.files * i / steps), bytes: total * i / steps, denied: 2,
          current: path + NAMES[i % NAMES.length] + "\\" + NAMES[(i * 7) % NAMES.length] }));
      }
      return { path, size: root.size, files: root.files, denied: 2, millis: 2400, cancelled };
    },
    cancel: async () => { cancelled = true; },
    async view(trail) {
      let n = root;
      for (const i of trail) n = n.children[i];
      return view(n, -1, [90, 30]);
    },
    reveal: async (trail) => console.log("在资源管理器中显示（模拟）", trail),
    onProgress: async (fn) => { listeners.push(fn); },
    pickFolder: async () => "D:\\项目\\",
    async cleanOverview() {
      await sleep(400);
      const it = (id, kind, admin, gb, count, path) => ({ id, kind, admin, size: gb * GB, count, path });
      return { is_admin: false, items: [
        it("user_temp", "delete", false, 5.43, 9486, "C:\\Temp"), it("win_temp", "delete", true, 0.21, 203),
        it("recycle", "system", false, 36.96, 74), it("wu_cache", "delete", true, 0, 3),
        it("delivery", "delete", true, 0, 0), it("browser", "delete", false, 1.3, 13748),
        it("thumbs", "delete", false, 0.03, 15), it("dumps", "delete", true, 0.02, 20),
        it("hibernate", "system", true, 12.7, 1), it("windows_old", "settings", false, 0, 0),
        it("downloads", "info", false, 0.93, 1281, "C:\\Downloads"), it("wechat", "info", false, 0, 0), it("qq", "info", false, 0, 0),
      ] };
    },
    async cleanRun(ids) { await sleep(600); return ids.map((id) => ({ id, freed: 1.2 * GB, failed: id === "browser" ? 12 : 0, error: null })); },
    cleanOpen: async (id) => console.log("打开（模拟）", id),
    openStorageSettings: async () => console.log("打开存储设置（模拟）"),
    relaunchAdmin: async () => console.log("以管理员身份重新打开（模拟）"),
  };
})();
