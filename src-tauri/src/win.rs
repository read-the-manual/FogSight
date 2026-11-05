//! 直接调用的几个 Windows 系统接口（不额外引入库，保持程序小巧）。

use std::ffi::c_void;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;

#[link(name = "kernel32")]
extern "system" {
    fn CreateFileW(name: *const u16, access: u32, share: u32, sa: *mut c_void, disposition: u32, flags: u32, template: *mut c_void) -> isize;
    fn DeviceIoControl(h: isize, code: u32, inbuf: *const c_void, insize: u32, outbuf: *mut c_void, outsize: u32, returned: *mut u32, overlapped: *mut c_void) -> i32;
    fn CloseHandle(h: isize) -> i32;
}

#[link(name = "shell32")]
extern "system" {
    fn IsUserAnAdmin() -> i32;
    fn SHQueryRecycleBinW(root: *const u16, info: *mut RecycleInfo) -> i32;
    fn SHEmptyRecycleBinW(hwnd: isize, root: *const u16, flags: u32) -> i32;
    fn ShellExecuteW(hwnd: isize, op: *const u16, file: *const u16, params: *const u16, dir: *const u16, show: i32) -> isize;
}

fn wide(s: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    s.as_ref().encode_wide().chain(std::iter::once(0)).collect()
}

// ---------- 机械硬盘识别 ----------

#[repr(C)]
struct PropertyQuery {
    property_id: u32,
    query_type: u32,
    extra: [u8; 4],
}

#[repr(C)]
#[derive(Default)]
struct SeekPenalty {
    version: u32,
    size: u32,
    incurs_seek_penalty: u8,
}

const IOCTL_STORAGE_QUERY_PROPERTY: u32 = 0x002D_1400;
const STORAGE_DEVICE_SEEK_PENALTY_PROPERTY: u32 = 7;

/// 这个路径所在的盘是不是机械硬盘（读不同位置要等磁头移动）。问不出来就当作不是。
pub fn is_hdd(path: &Path) -> bool {
    let s = path.to_string_lossy();
    let b = s.as_bytes();
    if b.len() < 2 || b[1] != b':' {
        return false; // 网络路径之类，不管
    }
    let volume = wide(format!(r"\\.\{}:", b[0] as char));
    unsafe {
        // 访问权限给 0：只问属性，不读数据，不需要管理员权限
        let h = CreateFileW(volume.as_ptr(), 0, 3, std::ptr::null_mut(), 3, 0, std::ptr::null_mut());
        if h == -1 {
            return false;
        }
        let q = PropertyQuery { property_id: STORAGE_DEVICE_SEEK_PENALTY_PROPERTY, query_type: 0, extra: [0; 4] };
        let mut out = SeekPenalty::default();
        let mut got = 0u32;
        let ok = DeviceIoControl(h, IOCTL_STORAGE_QUERY_PROPERTY,
            &q as *const _ as *const c_void, std::mem::size_of::<PropertyQuery>() as u32,
            &mut out as *mut _ as *mut c_void, std::mem::size_of::<SeekPenalty>() as u32,
            &mut got, std::ptr::null_mut());
        CloseHandle(h);
        ok != 0 && out.incurs_seek_penalty != 0
    }
}

// ---------- 管理员 ----------

pub fn is_admin() -> bool {
    unsafe { IsUserAnAdmin() != 0 }
}

/// 以管理员身份重新打开自己（会弹出 Windows 的授权窗口）。成功返回 true，调用方随后退出当前进程。
pub fn relaunch_as_admin() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| format!("找不到雾见自己的位置：{e}"))?;
    let (op, file) = (wide("runas"), wide(exe.as_os_str()));
    let r = unsafe { ShellExecuteW(0, op.as_ptr(), file.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
    if r > 32 { Ok(()) } else { Err("没有拿到管理员权限（可能是在授权窗口里点了“否”）".into()) }
}

// ---------- 回收站 ----------

#[repr(C)]
struct RecycleInfo {
    size_of_struct: u32,
    bytes: i64,
    items: i64,
}

/// 所有盘的回收站一共多大、多少项
pub fn recycle_bin_size() -> (u64, u64) {
    let mut info = RecycleInfo { size_of_struct: std::mem::size_of::<RecycleInfo>() as u32, bytes: 0, items: 0 };
    let hr = unsafe { SHQueryRecycleBinW(std::ptr::null(), &mut info) };
    if hr == 0 { (info.bytes.max(0) as u64, info.items.max(0) as u64) } else { (0, 0) }
}

/// 清空所有盘的回收站，不弹确认、不显示进度、不播放声音（确认已经在雾见里做过了）
pub fn empty_recycle_bin() -> bool {
    const NO_CONFIRM_NO_PROGRESS_NO_SOUND: u32 = 0x1 | 0x2 | 0x4;
    let hr = unsafe { SHEmptyRecycleBinW(0, std::ptr::null(), NO_CONFIRM_NO_PROGRESS_NO_SOUND) };
    hr == 0
}
