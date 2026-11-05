"""画雾见的图标：纸色圆角方块上三个色块（墨色、Claude 橙、海青），输出 src-tauri/icons/icon.ico 和 icon.png。
只用 Python 自带的库：逐像素超采样画圆角形状，再手写 PNG / ICO 编码。
"""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src-tauri" / "icons"

PAPER = (244, 239, 230)
LINE = (217, 207, 191)
# (圆心x, 圆心y, 半宽, 半高, 圆角程度, 颜色)，坐标以 0~1 表示
STONES = [
    (0.37, 0.39, 0.20, 0.17, 0.75, (61, 53, 46)),
    (0.73, 0.34, 0.11, 0.11, 0.85, (217, 119, 87)),
    (0.62, 0.72, 0.20, 0.11, 0.80, (169, 211, 197)),
]


def in_superellipse(x, y, cx, cy, rx, ry, k):
    # k 越大越方，越小越圆；这里用指数 2~4 之间的“方圆”形，像色块
    n = 2 + 2 * k
    return (abs(x - cx) / rx) ** n + (abs(y - cy) / ry) ** n <= 1


def in_rounded_square(x, y, inset, r):
    lo, hi = inset, 1 - inset
    if not (lo <= x <= hi and lo <= y <= hi):
        return False
    dx = max(lo + r - x, 0, x - (hi - r))
    dy = max(lo + r - y, 0, y - (hi - r))
    return dx * dx + dy * dy <= r * r


def render(size, ss=4):
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + .5) / ss) / size
                    y = (py + (sy + .5) / ss) / size
                    col = None
                    if in_rounded_square(x, y, 0.04, 0.22):
                        col = PAPER
                        if not in_rounded_square(x, y, 0.055, 0.205):
                            col = LINE
                        for cx, cy, rx, ry, k, c in STONES:
                            if in_superellipse(x, y, cx, cy, rx, ry, k):
                                col = c
                    if col:
                        acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255
            n = ss * ss
            a = acc[3] // n
            if a:
                cov = acc[3] / 255
                row += bytes((int(acc[0] / cov), int(acc[1] / cov), int(acc[2] / cov), a))
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    return rows


def png(size):
    rows = render(size)
    raw = b"".join(b"\0" + r for r in rows)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = [256, 64, 48, 32, 16]
    pngs = [png(s) for s in sizes]
    (OUT / "icon.png").write_bytes(pngs[0])
    head = struct.pack("<HHH", 0, 1, len(sizes))
    offset = 6 + 16 * len(sizes)
    entries, data = b"", b""
    for s, p in zip(sizes, pngs):
        entries += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(p), offset + len(data))
        data += p
    (OUT / "icon.ico").write_bytes(head + entries + data)
    print("done", OUT)


if __name__ == "__main__":
    main()
