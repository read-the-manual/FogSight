//! 只读测试：统计 C 盘专清各项的大小、检查是不是机械盘。不删除任何东西。
//! 用法：cargo run --release --example clean_overview

#[path = "../src/win.rs"]
#[allow(dead_code)]
mod win;
#[path = "../src/clean.rs"]
#[allow(dead_code)]
mod clean;

fn main() {
    for d in ["C:\\", "D:\\", "E:\\"] {
        println!("{d} 机械盘: {}", win::is_hdd(std::path::Path::new(d)));
    }
    let t = std::time::Instant::now();
    let o = clean::overview();
    println!("{}", serde_json::to_string_pretty(&o).unwrap());
    println!("统计用时 {:.1}s", t.elapsed().as_secs_f64());
}
