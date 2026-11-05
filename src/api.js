// 和 Rust 后端说话的地方。在普通浏览器里打开（没有 Tauri）时，自动换成 mock.js 的模拟数据，方便调界面。
(function () {
  const T = window.__TAURI__;
  if (!T) { window.Api = window.MockApi; return; }
  const invoke = T.core.invoke;

  window.Api = {
    real: true,
    drives: () => invoke("drives"),
    scan: (path) => invoke("scan", { path }),
    cancel: () => invoke("cancel_scan"),
    view: (trail) => invoke("view", { trail }),
    reveal: (trail) => invoke("reveal", { trail }),
    onProgress: (fn) => T.event.listen("scan-progress", (e) => fn(e.payload)),
    pickFolder: () => T.dialog
      ? T.dialog.open({ directory: true, title: "选一个要扫描的文件夹" })
      : invoke("plugin:dialog|open", { options: { directory: true, title: "选一个要扫描的文件夹" } }),
  };
})();
