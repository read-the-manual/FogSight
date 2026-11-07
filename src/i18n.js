// 雾见的中英双语。
//
//   I18n.t("key", {n: 3})   取当前语言的文字，{n} 这样的占位符会被替换
//   I18n.set("en")          切换语言（会记住），并发出 "langchange" 事件
//   I18n.apply()            把页面上带 data-i18n / data-i18n-tip 的元素换成当前语言
//   I18n.err(e)             把 Rust 那边传来的中文报错翻译成当前语言
//
// 长段落（使用说明、关于）不走这里：直接在 index.html 里写两份，用 data-only="zh" / "en" 标记，
// CSS 按 <html lang> 只显示其中一份。
(function () {
  const KEY = "雾见.语言";

  const D = {
    // 首页
    "app.name": ["雾见", "FogSight"],
    "home.tagline": ["拨开雾，看看磁盘空间都去哪了", "Clear the fog, see where your disk space went"],
    "home.pickFolder": ["扫描某个文件夹…", "Scan a folder…"],
    "home.clean": ["🧹 C 盘专清", "🧹 C: Drive Cleanup"],
    "home.readonly": ["只看不删：雾见不会改动你的任何文件", "Look, don't touch: FogSight never changes your files"],
    "home.settings": ["设置", "Settings"],
    "home.langHint": ["Psst — English lives in Settings ⚙️", "想看中文？设置里可以切换 ⚙️"],
    "drive.local": ["本地磁盘", "Local Disk"],
    "drive.used": ["已用 {s}", "{s} used"],
    "drive.total": ["共 {s}", "of {s}"],
    "err.picker": ["打不开选择文件夹的窗口：", "Couldn't open the folder picker: "],
    "pick.title": ["选一个要扫描的文件夹", "Choose a folder to scan"],
    "mock": ["模拟数据", "Demo data"],

    // 扫描中
    "scan.title": ["正在扫描", "Scanning"],
    "scan.titlePath": ["正在扫描 {p}", "Scanning {p}"],
    "scan.files": ["个文件", "files"],
    "scan.found": ["已找到 {s}", "{s} found"],
    "scan.hdd": ["这是机械硬盘：已改成 2 个线程顺着读，减少磁头来回跳", "This is a hard disk drive: reading in order with 2 threads so the head doesn't jump around"],
    "scan.cancel": ["取消", "Cancel"],
    "scan.failed": ["扫描失败：", "Scan failed: "],

    // 色块图
    "nav.back": ["后退", "Back"],
    "nav.forward": ["前进", "Forward"],
    "nav.up": ["上一层", "Up one level"],
    "res.reveal": ["在资源管理器中显示", "Show in File Explorer"],
    "res.rescan": ["重新扫描", "Rescan"],
    "res.home": ["换一个", "Change"],
    "res.homeTip": ["回到选磁盘的首页", "Back to the drive list"],
    "kind.dir": ["文件夹", "Folder"],
    "kind.file": ["文件", "File"],
    "kind.small": ["零散小文件（每个都小于 1 MB）", "Small files (each under 1 MB)"],
    "kind.other": ["太小没单独画出来的项目", "Items too small to draw separately"],
    "name.small": ["零散小文件", "Small files"],
    "name.other": ["其余 {n} 项", "{n} more items"],
    "corner.hint.left": ["左键色块，可以直接在文件管理器中打开", "Left-click a block to open it in File Explorer"],
    "corner.hint.right": ["右键色块，可以直接在文件管理器中打开", "Right-click a block to open it in File Explorer"],
    "corner.hint.middle": ["中键色块，可以直接在文件管理器中打开", "Middle-click a block to open it in File Explorer"],
    "corner.current": ["当前文件夹", "Current folder"],
    "corner.done": ["扫描完成 · 用时 {s} 秒", "Scan complete · took {s} s"],
    "corner.files": ["{n} 个文件", "{n} files"],
    "corner.items": ["{n} 项", "{n} items"],
    "corner.denied": ["{n} 个文件夹没有权限读取，已跳过", "{n} folders skipped (no permission to read)"],
    "corner.noPerm": ["没有权限读取", "No permission to read"],
    "corner.total": ["共 {n} 项", "{n} items in total"],
    "err.explorer": ["打不开文件管理器：", "Couldn't open File Explorer: "],

    // 设置
    "set.title": ["设置", "Settings"],
    "set.close": ["关闭设置", "Close settings"],
    "set.look": ["外观", "Appearance"],
    "set.keys": ["按键", "Controls"],
    "set.help": ["使用说明", "Help"],
    "set.about": ["关于", "About"],
    "set.theme": ["主题", "Theme"],
    "keys.nav": ["导航", "Navigation"],
    "keys.navHelp": ["点“+”之后按下想用的键或鼠标按键（侧键、中键都可以），按 Esc 取消。", "Click “+”, then press a key or mouse button (side and middle buttons work too). Press Esc to cancel."],
    "keys.click": ["点色块", "Clicking a block"],
    "keys.reset": ["恢复默认按键", "Restore default controls"],
    "keys.remove": ["删掉 {k}", "Remove {k}"],
    "keys.press": ["请按下按键…", "Press a key…"],
    "keys.add": ["给“{a}”加一个按键", "Add a key for “{a}”"],
    "btn.left": ["左键", "Left button"],
    "btn.right": ["右键", "Right button"],
    "btn.middle": ["中键", "Middle button"],
    "act.enter": ["进入文件夹", "Open the folder"],
    "act.explorer": ["在文件管理器中打开", "Open in File Explorer"],
    "act.none": ["什么也不做", "Do nothing"],
    "key.Mouse1": ["鼠标中键", "Middle mouse button"],
    "key.Mouse3": ["鼠标侧键（下）", "Mouse side button (back)"],
    "key.Mouse4": ["鼠标侧键（上）", "Mouse side button (forward)"],
    "key.Space": ["空格", "Space"],
    "copy": ["复制", "Copy"],
    "copy.ok": ["已复制 ✓", "Copied ✓"],
    "copy.fail": ["复制失败，请手动选中", "Copy failed, please select it manually"],

    // C 盘专清
    "clean.title": ["C 盘专清", "C: Drive Cleanup"],
    "clean.none": ["还没有勾选", "Nothing selected"],
    "clean.go": ["清理…", "Clean up…"],
    "clean.loading": ["正在统计各个位置有多大…", "Measuring each location…"],
    "clean.statFail": ["统计失败：", "Couldn't measure: "],
    "clean.needAdmin": ["需要管理员", "Admin required"],
    "clean.notOnPc": ["你的电脑上没有", "Not on this PC"],
    "clean.isClean": ["很干净，不用清理", "Already clean"],
    "clean.after": ["删掉之后：", "After deleting: "],
    "clean.openStorage": ["打开 Windows 存储设置", "Open Windows Storage settings"],
    "clean.notFound": ["没找到", "Not found"],
    "clean.peek": ["打开看看", "Take a look"],
    "clean.adminTitle": ["有几项需要管理员权限", "Some items need administrator rights"],
    "clean.adminBody": ["现在是普通权限，这几项先灰着。以管理员身份重新打开雾见就能清理它们（Windows 会弹窗问你同不同意）。", "FogSight is running without administrator rights, so these are grayed out. Reopen it as administrator to clean them (Windows will ask you to confirm)."],
    "clean.relaunch": ["以管理员身份重新打开", "Reopen as administrator"],
    "clean.yours": ["这些是你自己的东西，雾见只告诉你有多大，不帮你删", "These are your own files. FogSight only shows their size and won't delete them"],
    "clean.sum": ["已选 {n} 项 · 大约 {s}", "{n} selected · about {s}"],
    "clean.confirm": ["确认清理", "Confirm cleanup"],
    "clean.total": ["一共大约", "Total: about"],
    "clean.cancel": ["取消", "Cancel"],
    "clean.ok": ["确认清理", "Delete now"],
    "clean.running": ["正在清理…", "Cleaning…"],
    "clean.done": ["清理完成，释放了 {s} ✨", "All done, freed {s} ✨"],
    "clean.itemErr": ["{name}：没有清理，{e}", "{name}: not cleaned. {e}"],
    "clean.itemOk": ["{name}：释放 {s}", "{name}: freed {s}"],
    "clean.itemSkip": ["，{n} 个文件正在使用，已跳过", ", {n} files in use were skipped"],
    "clean.fallback": ["清理", "Cleanup"],
  };

  // C 盘专清每一项：[名字, 说明, 删掉之后]
  const CLEAN = {
    user_temp: [["临时文件", "程序运行时留下的临时文件（你自己的 Temp 文件夹）", "基本没影响；正在使用的文件会自动跳过"],
      ["Temporary files", "Temporary files left behind by programs (your own Temp folder)", "Basically no impact; files in use are skipped automatically"]],
    win_temp: [["系统临时文件", "Windows\\Temp 里的临时文件", "基本没影响；正在使用的文件会自动跳过"],
      ["System temporary files", "Temporary files in Windows\\Temp", "Basically no impact; files in use are skipped automatically"]],
    recycle: [["回收站", "所有磁盘回收站里的东西", "永久删除，再也找不回来"],
      ["Recycle Bin", "Everything in the Recycle Bins of all drives", "Permanently deleted and cannot be recovered"]],
    wu_cache: [["Windows 更新下载缓存", "已经下载过的系统更新安装包", "下载了但还没安装的更新，需要重新下载"],
      ["Windows Update download cache", "Update packages that were already downloaded", "Updates that were downloaded but not installed yet will need to be downloaded again"]],
    delivery: [["更新分享缓存", "“传递优化”用来和别的电脑互相分享更新的缓存", "没影响"],
      ["Update sharing cache", "Cache that “Delivery Optimization” uses to share updates with other PCs", "No impact"]],
    browser: [["浏览器缓存", "Chrome、Edge 存下来的网页图片和脚本", "网页第一次打开会慢一点；登录状态和保存的密码不受影响。浏览器开着时有些文件删不掉，先关掉浏览器效果更好"],
      ["Browser cache", "Website images and scripts saved by Chrome and Edge", "Websites load a little slower the first time; sign-ins and saved passwords are not affected. Some files can't be deleted while the browser is open, so close it first"]],
    thumbs: [["缩略图缓存", "文件管理器里图片、视频的预览小图", "预览图要重新生成；文件管理器开着时有些删不掉"],
      ["Thumbnail cache", "Preview images of pictures and videos in File Explorer", "Previews will be regenerated; some can't be deleted while File Explorer is open"]],
    dumps: [["错误报告和蓝屏转储", "程序崩溃、电脑蓝屏时留下的记录", "以后没法用它们排查蓝屏和崩溃的原因"],
      ["Error reports and crash dumps", "Records left behind when programs crash or the PC blue-screens", "You can no longer use them to find the cause of blue screens and crashes"]],
    hibernate: [["休眠文件 hiberfil.sys", "电脑休眠时用来保存内存里的内容", "会关闭休眠，“快速启动”也会失效。以后想恢复，用管理员身份运行 powercfg /h on 就能重新打开"],
      ["Hibernation file hiberfil.sys", "Stores the contents of memory when the PC hibernates", "Hibernation will be turned off, and “Fast startup” will stop working too. To turn it back on later, run powercfg /h on as administrator"]],
    windows_old: [["旧系统 Windows.old", "升级系统后留下的旧版本", "清理后再也不能退回升级前的系统。雾见不直接删它，交给 Windows 自己清理更稳妥"],
      ["Old system Windows.old", "The previous version of Windows left after an upgrade", "After cleaning, you can never go back to the system before the upgrade. FogSight doesn't delete it directly; letting Windows clean it is safer"]],
    downloads: [["下载文件夹", "浏览器和各种软件下载的东西"], ["Downloads folder", "Things downloaded by browsers and other apps"]],
    wechat: [["微信聊天文件", "聊天里收到的图片、视频、文件"], ["WeChat chat files", "Images, videos and files received in chats"]],
    qq: [["QQ 聊天文件", "聊天里收到的图片、视频、文件"], ["QQ chat files", "Images, videos and files received in chats"]],
  };

  // Rust 那边的报错（中文）→ 英文。越具体的写在越前面。
  const ERRORS = [
    [/^已经在扫描了，请等它结束或先取消$/, "A scan is already running. Wait for it to finish or cancel it first"],
    [/^找不到这个文件夹：(.*)$/s, "Folder not found: $1"],
    [/^扫描线程出错：(.*)$/s, "Scan thread error: $1"],
    [/^这个位置不存在了，可能需要重新扫描$/, "This location no longer exists. You may need to rescan"],
    [/^这个位置不存在$/, "This location doesn't exist"],
    [/^还没有扫描结果$/, "No scan results yet"],
    [/^打不开(?:资源|文件)管理器：(.*)$/s, "Couldn't open File Explorer: $1"],
    [/^统计失败：(.*)$/s, "Measuring failed: $1"],
    [/^清理线程出错：(.*)$/s, "Cleanup thread error: $1"],
    [/^不认识的清理项目，已拒绝$/, "Unknown cleanup item, refused"],
    [/^不认识的项目$/, "Unknown item"],
    [/^需要管理员权限$/, "Administrator rights required"],
    [/^清空回收站失败$/, "Failed to empty the Recycle Bin"],
    [/^关闭休眠失败（powercfg 返回 (-?\d+)）$/, "Failed to turn off hibernation (powercfg returned $1)"],
    [/^运行 powercfg 失败：(.*)$/s, "Failed to run powercfg: $1"],
    [/^这一项雾见不直接删除$/, "FogSight doesn't delete this item directly"],
    [/^打不开 Windows 设置：(.*)$/s, "Couldn't open Windows Settings: $1"],
    [/^找不到雾见自己的位置：(.*)$/s, "Couldn't find FogSight's own location: $1"],
    [/^没有拿到管理员权限（可能是在授权窗口里点了“否”）$/, "Didn't get administrator rights (maybe “No” was clicked in the Windows prompt)"],
  ];

  let lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) { /* 存不了就每次自动判断 */ }
  if (lang !== "zh" && lang !== "en") {
    // 没选过：系统是中文就用中文，其他语言一律用英文
    lang = (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
  }
  const idx = () => (lang === "en" ? 1 : 0);
  const setHtmlLang = () => { document.documentElement.lang = lang === "en" ? "en" : "zh-CN"; };
  setHtmlLang();

  function t(key, vars) {
    const pair = D[key];
    let s = pair ? pair[idx()] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  }

  function clean(id) {
    const pair = CLEAN[id];
    if (!pair) return null;
    const [name, desc, effect] = pair[idx()];
    return { name, desc, effect };
  }

  function err(e) {
    const s = String(e);
    if (lang !== "en") return s;
    for (const [re, en] of ERRORS) if (re.test(s)) return s.replace(re, en);
    return s;
  }

  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    // 带提示气泡的图标按钮：气泡文字和读屏文字一起换
    root.querySelectorAll("[data-i18n-tip]").forEach((el) => {
      const s = t(el.dataset.i18nTip);
      el.dataset.tip = s;
      el.setAttribute("aria-label", s);
    });
    root.querySelectorAll("[data-i18n-tiponly]").forEach((el) => { el.dataset.tip = t(el.dataset.i18nTiponly); });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    document.title = t("app.name");
    // 任务栏上显示的窗口标题也跟着换（浏览器里没有 Tauri，跳过）
    try { window.__TAURI__.window.getCurrentWindow().setTitle(t("app.name")).catch(() => {}); } catch (e) {}
  }

  function set(l) {
    if (l !== "zh" && l !== "en") return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    setHtmlLang();
    apply();
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }

  window.I18n = { t, set, apply, err, clean, lang: () => lang };
})();
