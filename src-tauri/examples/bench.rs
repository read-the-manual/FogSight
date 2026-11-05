//! 测速：直接用雾见的扫盘核心扫一个路径，打印用时和最大的几个文件夹。只读，不改动任何文件。
//! 用法：cargo run --release --example bench -- C:\

#[path = "../src/scan.rs"]
#[allow(dead_code)]
mod scan;

use std::path::PathBuf;
use std::time::Instant;

fn main() {
    let path = PathBuf::from(std::env::args().nth(1).unwrap_or_else(|| "C:\\".into()));
    let p = scan::Progress::default();
    let t = Instant::now();
    let root = scan::scan_dir(&path, path.display().to_string().into(), &p);
    let secs = t.elapsed().as_secs_f64();
    let gb = |b: u64| b as f64 / (1u64 << 30) as f64;
    println!("path={} time={:.1}s files={} size={:.1}GB denied={}",
        path.display(), secs, root.files, gb(root.size), p.denied.load(std::sync::atomic::Ordering::Relaxed));
    for c in root.children.iter().take(8) {
        println!("  {:>8.1}GB  {}", gb(c.size), c.name);
    }
}
