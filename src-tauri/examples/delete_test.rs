//! 删除函数的安全测试：只在传进来的测试文件夹里操作。
//! 用法：cargo run --release --example delete_test -- <测试场地> <外部文件夹>

#[path = "../src/win.rs"]
#[allow(dead_code)]
mod win;
#[path = "../src/clean.rs"]
#[allow(dead_code)]
mod clean;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (field, outside) = (std::path::Path::new(&a[1]), std::path::Path::new(&a[2]));
    let (freed, failed) = clean::delete_contents(field);
    let left: Vec<_> = std::fs::read_dir(field).unwrap().flatten().map(|e| e.file_name()).collect();
    println!("freed={freed} failed={failed} left_in_field={left:?}");
    println!("outside_sentinel_exists={}", outside.join("sentinel.txt").exists());
}
