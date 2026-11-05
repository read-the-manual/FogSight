//! 扫盘核心：多线程遍历文件夹，算出每个文件夹有多大。
//!
//! 为了省内存，小于 KEEP_FILE_MIN 的文件不单独记下来，只把大小加进所在文件夹；
//! 界面上它们合成一块“零散小文件”。

use rayon::prelude::*;
use serde::Serialize;
use std::fs;
use std::os::windows::fs::MetadataExt;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::sync::Mutex;

/// 1 MB 以下的文件不单独记
const KEEP_FILE_MIN: u64 = 1 << 20;
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;

pub struct Node {
    pub name: Box<str>,
    pub size: u64,
    /// 里面一共有多少个文件（包括子文件夹里的）
    pub files: u64,
    pub is_dir: bool,
    /// 这个文件夹没有权限读取
    pub denied: bool,
    /// 按大小从大到小排好
    pub children: Vec<Node>,
}

/// 扫描过程中的计数，界面每隔一小会儿来读一次
#[derive(Default)]
pub struct Progress {
    pub files: AtomicU64,
    pub bytes: AtomicU64,
    pub denied: AtomicU64,
    pub cancel: AtomicBool,
    pub current: Mutex<String>,
}

impl Progress {
    pub fn reset(&self) {
        self.files.store(0, Relaxed);
        self.bytes.store(0, Relaxed);
        self.denied.store(0, Relaxed);
        self.cancel.store(false, Relaxed);
        *self.current.lock().unwrap() = String::new();
    }
}

pub fn scan_dir(path: &Path, name: Box<str>, p: &Progress) -> Node {
    let mut node = Node { name, size: 0, files: 0, is_dir: true, denied: false, children: Vec::new() };
    if p.cancel.load(Relaxed) {
        return node;
    }
    let entries = match fs::read_dir(path) {
        Ok(rd) => rd,
        Err(_) => {
            node.denied = true;
            p.denied.fetch_add(1, Relaxed);
            return node;
        }
    };

    let mut subdirs = Vec::new();
    for entry in entries.flatten() {
        // Windows 上 DirEntry::metadata 直接用遍历时拿到的数据，不会再多问一次硬盘
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            // 跳过链接和挂载点，不然会重复计算，甚至绕圈子
            if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT == 0 {
                subdirs.push(entry.path());
            }
            continue;
        }
        if meta.file_type().is_symlink() {
            continue;
        }
        let len = meta.len();
        node.files += 1;
        node.size += len;
        if len >= KEEP_FILE_MIN {
            node.children.push(Node {
                name: entry.file_name().to_string_lossy().into(),
                size: len,
                files: 1,
                is_dir: false,
                denied: false,
                children: Vec::new(),
            });
        }
    }
    p.files.fetch_add(node.files, Relaxed);
    p.bytes.fetch_add(node.size, Relaxed);
    if let Ok(mut cur) = p.current.try_lock() {
        *cur = path.display().to_string();
    }

    let dirs: Vec<Node> = subdirs
        .par_iter()
        .map(|d| {
            let name = d.file_name().map(|n| n.to_string_lossy().into()).unwrap_or_default();
            scan_dir(d, name, p)
        })
        .collect();
    for d in dirs {
        node.size += d.size;
        node.files += d.files;
        node.children.push(d);
    }
    node.children.sort_unstable_by(|a, b| b.size.cmp(&a.size));
    node
}

/// 发给界面的一层（或两层）视图
#[derive(Serialize)]
pub struct ViewNode {
    pub name: String,
    pub size: u64,
    pub files: u64,
    /// dir 文件夹 / file 文件 / small 零散小文件 / other 合并起来的其余项目
    pub kind: &'static str,
    /// 在父文件夹 children 里的位置；合成出来的块是 -1
    pub idx: i64,
    pub denied: bool,
    pub count: usize,
    pub children: Vec<ViewNode>,
}

/// limits[0] 是这一层最多显示几块，limits[1] 是下一层……用完就不再往下
pub fn view(node: &Node, idx: i64, limits: &[usize]) -> ViewNode {
    let mut out = ViewNode {
        name: node.name.to_string(),
        size: node.size,
        files: node.files,
        kind: if node.is_dir { "dir" } else { "file" },
        idx,
        denied: node.denied,
        count: node.children.len(),
        children: Vec::new(),
    };
    let Some((&limit, rest)) = limits.split_first() else { return out };
    if !node.is_dir {
        return out;
    }

    let shown = node.children.len().min(limit);
    for (i, c) in node.children[..shown].iter().enumerate() {
        out.children.push(view(c, i as i64, rest));
    }
    let others = &node.children[shown..];
    if !others.is_empty() {
        out.children.push(ViewNode {
            name: format!("其余 {} 项", others.len()),
            size: others.iter().map(|c| c.size).sum(),
            files: others.iter().map(|c| c.files).sum(),
            kind: "other",
            idx: -1,
            denied: false,
            count: others.len(),
            children: Vec::new(),
        });
    }
    let listed: u64 = node.children.iter().map(|c| c.size).sum();
    let listed_files: u64 = node.children.iter().map(|c| c.files).sum();
    if node.size > listed {
        out.children.push(ViewNode {
            name: "零散小文件".into(),
            size: node.size - listed,
            files: node.files - listed_files,
            kind: "small",
            idx: -1,
            denied: false,
            count: 0,
            children: Vec::new(),
        });
    }
    out.children.sort_by(|a, b| b.size.cmp(&a.size));
    out
}
