import os
import sys
from PIL import Image

def generate_all_icons():
    src_path = r"C:\Users\gebel\Downloads\Icone Nuvio.png"
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source icon not found at {src_path}")

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"[generate-icons] Loading source from: {src_path}")
    src = Image.open(src_path).convert("RGBA")
    print(f"[generate-icons] Source dimensions: {src.size}")

    def resize(size):
        return src.resize((size, size), Image.Resampling.LANCZOS)

    # ─── 1. Desktop Build Icons ───────────────────────────────────────────────
    desktop_build_dir = os.path.join(root_dir, "packages", "desktop", "build")
    desktop_build_icons_dir = os.path.join(desktop_build_dir, "icons")
    os.makedirs(desktop_build_icons_dir, exist_ok=True)

    # icon.png (1024x1024)
    icon_1024 = resize(1024)
    icon_1024.save(os.path.join(desktop_build_dir, "icon.png"), "PNG")
    print("  -> packages/desktop/build/icon.png (1024x1024)")

    # icon.ico (16, 24, 32, 48, 64, 128, 256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    base_256 = resize(256)
    base_256.save(os.path.join(desktop_build_dir, "icon.ico"), format="ICO", sizes=ico_sizes)
    print("  -> packages/desktop/build/icon.ico (multi-resolution 16-256)")

    # icon.icns (macOS)
    try:
        icon_1024.save(os.path.join(desktop_build_dir, "icon.icns"), format="ICNS")
        print("  -> packages/desktop/build/icon.icns")
    except Exception as e:
        print(f"  [warn] Could not save icon.icns: {e}")

    # packages/desktop/build/icons/ (16, 24, 32, 48, 64, 128, 256, 512, 1024)
    linux_sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    for s in linux_sizes:
        res = resize(s)
        res.save(os.path.join(desktop_build_icons_dir, f"{s}x{s}.png"), "PNG")
        print(f"  -> packages/desktop/build/icons/{s}x{s}.png")

    # ─── 2. Desktop Resources Icons ───────────────────────────────────────────
    desktop_res_dir = os.path.join(root_dir, "packages", "desktop", "resources")
    os.makedirs(desktop_res_dir, exist_ok=True)

    # icon.png (512x512)
    icon_512 = resize(512)
    icon_512.save(os.path.join(desktop_res_dir, "icon.png"), "PNG")
    print("  -> packages/desktop/resources/icon.png (512x512)")

    # icon.ico (16-256)
    base_256.save(os.path.join(desktop_res_dir, "icon.ico"), format="ICO", sizes=ico_sizes)
    print("  -> packages/desktop/resources/icon.ico (multi-resolution 16-256)")

    # tray-icon.png (32x32)
    tray_32 = resize(32)
    tray_32.save(os.path.join(desktop_res_dir, "tray-icon.png"), "PNG")
    print("  -> packages/desktop/resources/tray-icon.png (32x32)")

    # tray-icon.ico (16, 20, 24, 32, 48)
    tray_ico_sizes = [(16, 16), (20, 20), (24, 24), (32, 32), (48, 48)]
    base_48 = resize(48)
    base_48.save(os.path.join(desktop_res_dir, "tray-icon.ico"), format="ICO", sizes=tray_ico_sizes)
    print("  -> packages/desktop/resources/tray-icon.ico (multi-resolution 16-48)")

    # ─── 3. Web Public Icons (PWA, Android, iOS, Favicons) ────────────────────
    web_icons_dir = os.path.join(root_dir, "packages", "web", "public", "icons")
    os.makedirs(web_icons_dir, exist_ok=True)

    # Standard PWA and Android sizes: 48, 72, 96, 128, 144, 192, 256, 384, 512
    pwa_sizes = [48, 72, 96, 128, 144, 192, 256, 384, 512]
    for s in pwa_sizes:
        res = resize(s)
        res.save(os.path.join(web_icons_dir, f"icon-{s}.png"), "PNG")
        print(f"  -> packages/web/public/icons/icon-{s}.png ({s}x{s})")

    # Maskable icons (512x512 and 192x192) - full lilac gradient edge-to-edge
    # (The holographic symbol is centered and within the 80% safe zone circle)
    icon_512.save(os.path.join(web_icons_dir, "icon-maskable-512.png"), "PNG")
    icon_192 = resize(192)
    icon_192.save(os.path.join(web_icons_dir, "icon-maskable-192.png"), "PNG")
    print("  -> packages/web/public/icons/icon-maskable-512.png (512x512)")
    print("  -> packages/web/public/icons/icon-maskable-192.png (192x192)")

    # logo.png (512x512)
    icon_512.save(os.path.join(web_icons_dir, "logo.png"), "PNG")
    print("  -> packages/web/public/icons/logo.png (512x512)")

    # apple-touch-icon (180x180, and secondary iOS variants 152, 167, 120)
    apple_180 = resize(180)
    apple_180.save(os.path.join(web_icons_dir, "apple-touch-icon.png"), "PNG")
    apple_180.save(os.path.join(web_icons_dir, "apple-touch-icon-180x180.png"), "PNG")
    resize(167).save(os.path.join(web_icons_dir, "apple-touch-icon-167x167.png"), "PNG")
    resize(152).save(os.path.join(web_icons_dir, "apple-touch-icon-152x152.png"), "PNG")
    resize(120).save(os.path.join(web_icons_dir, "apple-touch-icon-120x120.png"), "PNG")
    print("  -> packages/web/public/icons/apple-touch-icon.png (180x180 square, no destructive crop)")

    # Favicons (16x16, 32x32)
    fav_16 = resize(16)
    fav_32 = resize(32)
    fav_16.save(os.path.join(web_icons_dir, "favicon-16.png"), "PNG")
    fav_32.save(os.path.join(web_icons_dir, "favicon-32.png"), "PNG")
    print("  -> packages/web/public/icons/favicon-16.png (16x16)")
    print("  -> packages/web/public/icons/favicon-32.png (32x32)")

    # public/favicon.ico
    web_public_dir = os.path.join(root_dir, "packages", "web", "public")
    base_48.save(os.path.join(web_public_dir, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  -> packages/web/public/favicon.ico (16, 32, 48)")

    print("[generate-icons] All icons generated successfully from the official Nuvio icon!")

if __name__ == "__main__":
    generate_all_icons()
