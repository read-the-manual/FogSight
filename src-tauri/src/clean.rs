//! C 盘专清。
//!
//! 安全规则：
//! - 能删的位置全部写死在这里，界面只能传项目的名字（id）过来，传不进任何路径；
//! - 只删这些文件夹“里面”的东西，不删文件夹本身；
//! - 遇到链接、挂载点不跟进去；正在使用、删不掉的文件跳过并计数；
//! - 要清空的文件夹至少要像 C:\Windows\Temp 这么深，防止环境变量被改成 C:\ 之类时误删整个盘。

use crate::win;
use rayon::prelude::*;
use serde::Serialize;
use std::fs;
use std::os::windows::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::process::Command;

const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;

enum Target {
    /// 删掉这个文件夹里的所有东西（文件夹本身留着）
    Contents(PathBuf),
    /// 删掉这个文件夹里名字以 prefix 开头的文件
    FilesStartingWith(PathBuf, &'static str),
    /// 删掉这一个文件
    File(PathBuf),
}

#[derive(Clone, Copy, PartialEq)]
enum Kind {
    /// 雾见直接删
    Delete,
    /// 交给系统命令或系统接口
    System,
    /// 交给 Windows 设置
    Settings,
    /// 只显示大小，不帮忙删（用户自己的东西）
    Info,
}

struct Item {
    id: &'static str,
    kind: Kind,
    admin: bool,
    targets: Vec<Target>,
}

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name).map(PathBuf::from)
}

fn items() -> Vec<Item> {
    let local = env_path("LOCALAPPDATA");
    let home = env_path("USERPROFILE");
    let win = env_path("SystemRoot").unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    let data = env_path("ProgramData").unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
    let sysdrive = PathBuf::from(format!("{}\\", std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into())));
    let l = |p: &str| local.as_ref().map(|d| d.join(p));
    let h = |p: &str| home.as_ref().map(|d| d.join(p));

    let mut browser = Vec::new();
    for root in [l(r"Google\Chrome\User Data"), l(r"Microsoft\Edge\User Data")].into_iter().flatten() {
        let Ok(rd) = fs::read_dir(&root) else { continue };
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if name == "Default" || name.starts_with("Profile ") {
                for sub in ["Cache", "Code Cache", "GPUCache"] {
                    browser.push(Target::Contents(e.path().join(sub)));
                }
            }
        }
    }

    let c = |p: Option<PathBuf>| p.map(Target::Contents);
    vec![
        Item { id: "user_temp", kind: Kind::Delete, admin: false, targets: [c(l("Temp"))].into_iter().flatten().collect() },
        Item { id: "win_temp", kind: Kind::Delete, admin: true, targets: vec![Target::Contents(win.join("Temp"))] },
        Item { id: "recycle", kind: Kind::System, admin: false, targets: vec![] },
        Item { id: "wu_cache", kind: Kind::Delete, admin: true, targets: vec![Target::Contents(win.join(r"SoftwareDistribution\Download"))] },
        Item { id: "delivery", kind: Kind::Delete, admin: true, targets: vec![Target::Contents(
            win.join(r"ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache"))] },
        Item { id: "browser", kind: Kind::Delete, admin: false, targets: browser },
        Item { id: "thumbs", kind: Kind::Delete, admin: false, targets: l(r"Microsoft\Windows\Explorer")
            .map(|d| vec![Target::FilesStartingWith(d, "thumbcache_")]).unwrap_or_default() },
        Item { id: "dumps", kind: Kind::Delete, admin: true, targets: [
            Some(Target::Contents(data.join(r"Microsoft\Windows\WER\ReportArchive"))),
            Some(Target::Contents(data.join(r"Microsoft\Windows\WER\ReportQueue"))),
            c(l(r"Microsoft\Windows\WER")),
            c(l("CrashDumps")),
            Some(Target::Contents(win.join("Minidump"))),
            Some(Target::File(win.join("MEMORY.DMP"))),
        ].into_iter().flatten().collect() },
        Item { id: "hibernate", kind: Kind::System, admin: true, targets: vec![Target::File(sysdrive.join("hiberfil.sys"))] },
        Item { id: "windows_old", kind: Kind::Settings, admin: false, targets: vec![Target::Contents(sysdrive.join("Windows.old"))] },
        Item { id: "downloads", kind: Kind::Info, admin: false, targets: [c(h("Downloads"))].into_iter().flatten().collect() },
        Item { id: "wechat", kind: Kind::Info, admin: false, targets: [c(h(r"Documents\WeChat Files")), c(h(r"Documents\xwechat_files"))]
            .into_iter().flatten().collect() },
        Item { id: "qq", kind: Kind::Info, admin: false, targets: [c(h(r"Documents\Tencent Files"))].into_iter().flatten().collect() },
    ]
}

/// 太浅的路径一律不碰：C:\Windows\Temp 拆开是 C: \ Windows Temp 四段
fn deep_enough(p: &Path) -> bool {
    p.components().count() >= 4
}

fn is_link(m: &fs::Metadata) -> bool {
    m.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

/// 用文件夹遍历拿到的信息取大小（hiberfil.sys 这类正在用的文件直接问会被拒绝）
fn file_size(p: &Path) -> Option<u64> {
    let (dir, name) = (p.parent()?, p.file_name()?);
    fs::read_dir(dir).ok()?.flatten().find(|e| e.file_name().eq_ignore_ascii_case(name))
        .and_then(|e| e.metadata().ok()).map(|m| m.len())
}

fn dir_size(p: &Path) -> (u64, u64) {
    let Ok(rd) = fs::read_dir(p) else { return (0, 0) };
    let entries: Vec<_> = rd.flatten().collect();
    entries.par_iter().map(|e| match e.metadata() {
        Ok(m) if is_link(&m) => (0, 0),
        Ok(m) if m.is_dir() => dir_size(&e.path()),
        Ok(m) => (m.len(), 1),
        Err(_) => (0, 0),
    }).reduce(|| (0, 0), |a, b| (a.0 + b.0, a.1 + b.1))
}

fn target_size(t: &Target) -> (u64, u64) {
    match t {
        Target::Contents(p) => dir_size(p),
        Target::File(p) => file_size(p).map(|s| (s, 1)).unwrap_or((0, 0)),
        Target::FilesStartingWith(d, pre) => fs::read_dir(d).map(|rd| rd.flatten()
            .filter(|e| e.file_name().to_string_lossy().to_lowercase().starts_with(pre))
            .filter_map(|e| e.metadata().ok()).fold((0, 0), |a, m| (a.0 + m.len(), a.1 + 1))).unwrap_or((0, 0)),
    }
}

/// 删除一个文件；只读的先去掉只读再删。返回删掉的字节数
fn remove_file(p: &Path, len: u64) -> Option<u64> {
    if fs::remove_file(p).is_ok() {
        return Some(len);
    }
    let mut perm = fs::metadata(p).ok()?.permissions();
    if perm.readonly() {
        #[allow(clippy::permissions_set_readonly_false)]
        perm.set_readonly(false);
        fs::set_permissions(p, perm).ok()?;
        return fs::remove_file(p).ok().map(|_| len);
    }
    None
}

/// 删掉文件夹里面的东西。返回 (删掉的字节, 删不掉的文件数)
pub(crate) fn delete_contents(p: &Path) -> (u64, u64) {
    let Ok(rd) = fs::read_dir(p) else { return (0, 0) };
    let mut freed = 0;
    let mut failed = 0;
    for e in rd.flatten() {
        let Ok(m) = e.metadata() else { failed += 1; continue };
        if is_link(&m) {
            continue; // 链接不跟进去，也不动它
        }
        let path = e.path();
        if m.is_dir() {
            let (f, x) = delete_contents(&path);
            freed += f;
            failed += x;
            let _ = fs::remove_dir(&path); // 里面还有删不掉的文件时会失败，没关系
        } else {
            match remove_file(&path, m.len()) {
                Some(n) => freed += n,
                None => failed += 1,
            }
        }
    }
    (freed, failed)
}

fn delete_target(t: &Target) -> (u64, u64) {
    let path = match t { Target::Contents(p) | Target::File(p) | Target::FilesStartingWith(p, _) => p };
    if !deep_enough(path) && !matches!(t, Target::File(_)) {
        return (0, 0);
    }
    match t {
        Target::Contents(p) => delete_contents(p),
        Target::File(p) => match file_size(p) {
            Some(len) => remove_file(p, len).map(|n| (n, 0)).unwrap_or((0, 1)),
            None => (0, 0),
        },
        Target::FilesStartingWith(d, pre) => {
            let Ok(rd) = fs::read_dir(d) else { return (0, 0) };
            rd.flatten().filter(|e| e.file_name().to_string_lossy().to_lowercase().starts_with(pre))
                .fold((0, 0), |(f, x), e| {
                    let len = e.metadata().map(|m| m.len()).unwrap_or(0);
                    match remove_file(&e.path(), len) { Some(n) => (f + n, x), None => (f, x + 1) }
                })
        }
    }
}

#[derive(Serialize)]
pub struct ItemInfo {
    id: &'static str,
    kind: &'static str,
    admin: bool,
    size: u64,
    count: u64,
    /// 第一个位置，“打开看看”用
    path: Option<String>,
}

#[derive(Serialize)]
pub struct Overview {
    is_admin: bool,
    items: Vec<ItemInfo>,
}

pub fn overview() -> Overview {
    let infos = items().into_par_iter().map(|it| {
        let (size, count) = if it.id == "recycle" {
            win::recycle_bin_size()
        } else {
            it.targets.par_iter().map(target_size).reduce(|| (0, 0), |a, b| (a.0 + b.0, a.1 + b.1))
        };
        let path = it.targets.iter().find_map(|t| match t {
            Target::Contents(p) if p.exists() => Some(p.display().to_string()),
            _ => None,
        });
        ItemInfo {
            id: it.id,
            kind: match it.kind { Kind::Delete => "delete", Kind::System => "system", Kind::Settings => "settings", Kind::Info => "info" },
            admin: it.admin,
            size,
            count,
            path,
        }
    }).collect();
    Overview { is_admin: win::is_admin(), items: infos }
}

#[derive(Serialize)]
pub struct CleanResult {
    id: String,
    freed: u64,
    failed: u64,
    error: Option<String>,
}

/// 清理勾选的项目。只认识上面写死的 id，别的一律拒绝
pub fn run(ids: &[String]) -> Vec<CleanResult> {
    let all = items();
    let admin = win::is_admin();
    ids.iter().map(|id| {
        let mut r = CleanResult { id: id.clone(), freed: 0, failed: 0, error: None };
        let Some(it) = all.iter().find(|it| it.id == id) else {
            r.error = Some("不认识的清理项目，已拒绝".into());
            return r;
        };
        if it.admin && !admin {
            r.error = Some("需要管理员权限".into());
            return r;
        }
        match (it.kind, it.id) {
            (Kind::Delete, _) => {
                for t in &it.targets {
                    let (f, x) = delete_target(t);
                    r.freed += f;
                    r.failed += x;
                }
            }
            (Kind::System, "recycle") => {
                let (before, _) = win::recycle_bin_size();
                if before > 0 && !win::empty_recycle_bin() {
                    r.error = Some("清空回收站失败".into());
                } else {
                    r.freed = before;
                }
            }
            (Kind::System, "hibernate") => {
                let before = it.targets.iter().map(target_size).map(|s| s.0).sum();
                match Command::new("powercfg").args(["/hibernate", "off"]).status() {
                    Ok(s) if s.success() => r.freed = before,
                    Ok(s) => r.error = Some(format!("关闭休眠失败（powercfg 返回 {}）", s.code().unwrap_or(-1))),
                    Err(e) => r.error = Some(format!("运行 powercfg 失败：{e}")),
                }
            }
            _ => r.error = Some("这一项雾见不直接删除".into()),
        }
        r
    }).collect()
}

/// Windows.old 交给系统：打开“设置 → 存储 → 临时文件”
pub fn open_storage_settings() -> Result<(), String> {
    Command::new("explorer").arg("ms-settings:storagepolicies").spawn()
        .map(|_| ()).map_err(|e| format!("打不开 Windows 设置：{e}"))
}

/// “打开看看”：只允许打开写死的位置
pub fn open_item(id: &str) -> Result<(), String> {
    let all = items();
    let it = all.iter().find(|it| it.id == id).ok_or("不认识的项目")?;
    let p = it.targets.iter().find_map(|t| match t {
        Target::Contents(p) if p.exists() => Some(p.clone()),
        _ => None,
    }).ok_or("这个位置不存在")?;
    Command::new("explorer").arg(p).spawn().map(|_| ()).map_err(|e| format!("打不开文件管理器：{e}"))
}
