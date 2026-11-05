// 发布版不弹黑色命令行窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod scan;

use scan::{Node, Progress, ViewNode};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering::Relaxed};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
struct App {
    progress: Arc<Progress>,
    /// 最近一次扫描的结果：(扫描的路径, 结果树)
    result: Mutex<Option<(PathBuf, Arc<Node>)>>,
    scanning: AtomicBool,
}

#[derive(Serialize)]
struct Drive {
    mount: String,
    label: String,
    total: u64,
    free: u64,
}

#[tauri::command]
fn drives() -> Vec<Drive> {
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut list: Vec<Drive> = disks
        .list()
        .iter()
        .map(|d| Drive {
            mount: d.mount_point().display().to_string(),
            label: d.name().to_string_lossy().into_owned(),
            total: d.total_space(),
            free: d.available_space(),
        })
        .collect();
    list.sort_by(|a, b| a.mount.cmp(&b.mount));
    list
}

#[derive(Serialize, Clone)]
struct ProgressMsg {
    files: u64,
    bytes: u64,
    denied: u64,
    current: String,
}

#[derive(Serialize)]
struct Summary {
    path: String,
    size: u64,
    files: u64,
    denied: u64,
    millis: u128,
    cancelled: bool,
}

#[tauri::command]
async fn scan(app: AppHandle, state: State<'_, App>, path: String) -> Result<Summary, String> {
    if state.scanning.swap(true, Relaxed) {
        return Err("已经在扫描了，请等它结束或先取消".into());
    }
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        state.scanning.store(false, Relaxed);
        return Err(format!("找不到这个文件夹：{path}"));
    }
    let p = state.progress.clone();
    p.reset();

    // 每 120 毫秒把进度发给界面一次
    let done = Arc::new(AtomicBool::new(false));
    {
        let (p, done, app) = (p.clone(), done.clone(), app.clone());
        std::thread::spawn(move || {
            while !done.load(Relaxed) {
                let msg = ProgressMsg {
                    files: p.files.load(Relaxed),
                    bytes: p.bytes.load(Relaxed),
                    denied: p.denied.load(Relaxed),
                    current: p.current.lock().map(|c| c.clone()).unwrap_or_default(),
                };
                let _ = app.emit("scan-progress", msg);
                std::thread::sleep(Duration::from_millis(120));
            }
        });
    }

    let start = Instant::now();
    let (p2, root2) = (p.clone(), root.clone());
    let node = tauri::async_runtime::spawn_blocking(move || {
        let name: Box<str> = root2.display().to_string().into();
        scan::scan_dir(&root2, name, &p2)
    })
    .await
    .map_err(|e| format!("扫描线程出错：{e}"));
    done.store(true, Relaxed);
    state.scanning.store(false, Relaxed);
    let node = node?;

    let summary = Summary {
        path,
        size: node.size,
        files: node.files,
        denied: p.denied.load(Relaxed),
        millis: start.elapsed().as_millis(),
        cancelled: p.cancel.load(Relaxed),
    };
    *state.result.lock().unwrap() = Some((root, Arc::new(node)));
    Ok(summary)
}

#[tauri::command]
fn cancel_scan(state: State<'_, App>) {
    state.progress.cancel.store(true, Relaxed);
}

/// 按 idx 一层层往下找。trail 是从根开始每一层的位置
fn walk<'a>(root: &'a Node, trail: &[u32]) -> Result<&'a Node, String> {
    let mut n = root;
    for &i in trail {
        n = n.children.get(i as usize).ok_or("这个位置不存在了，可能需要重新扫描")?;
    }
    Ok(n)
}

#[tauri::command]
fn view(state: State<'_, App>, trail: Vec<u32>) -> Result<ViewNode, String> {
    let guard = state.result.lock().unwrap();
    let (_, root) = guard.as_ref().ok_or("还没有扫描结果")?;
    let node = walk(root, &trail)?;
    // 这一层最多 90 块，每块里面再预览 30 块
    Ok(scan::view(node, -1, &[90, 30]))
}

/// 在文件管理器里打开它（只是打开看看，不会改动任何文件）
#[tauri::command]
fn reveal(state: State<'_, App>, trail: Vec<u32>) -> Result<(), String> {
    let guard = state.result.lock().unwrap();
    let (base, root) = guard.as_ref().ok_or("还没有扫描结果")?;
    let mut path = base.clone();
    let mut n: &Node = root;
    for &i in &trail {
        n = n.children.get(i as usize).ok_or("这个位置不存在了，可能需要重新扫描")?;
        path.push(&*n.name);
    }
    // 文件夹直接打开；文件在它所在的文件夹里被选中
    let arg = if n.is_dir { path.display().to_string() } else { format!("/select,{}", path.display()) };
    std::process::Command::new("explorer")
        .arg(arg)
        .spawn()
        .map_err(|e| format!("打不开资源管理器：{e}"))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(App::default())
        .invoke_handler(tauri::generate_handler![drives, scan, cancel_scan, view, reveal])
        .run(tauri::generate_context!())
        .expect("雾见启动失败");
}
