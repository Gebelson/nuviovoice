import os
import sys
from PIL import Image

def generate_all_icons():
    src_path = r"C:\Users\gebel\Downloads\Icone Nuvio 2.png"
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source icon not found at {src_path}")

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"[generate-icons] Loading source from: {src_path}")
    src = Image.open(src_path).convert("RGBA")
    print(f"[generate-icons] Source dimensions: {src.size}, mode: {src.mode}")

    def resize(size):
        return src.resize((size, size), Image.Resampling.LANCZOS)

    def save_multi_ico(path, sizes):
        frames = [resize(s) for s in sorted(sizes)]
        frames[-1].save(
            path,
            format="ICO",
            sizes=[(s, s) for s in sizes],
            append_images=frames[:-1]
        )

    # ─── 1. Desktop Build Icons (Windows .ico, macOS .icns, Linux PNGs) ───────
    desktop_build_dir = os.path.join(root_dir, "packages", "desktop", "build")
    desktop_build_icons_dir = os.path.join(desktop_build_dir, "icons")
    os.makedirs(desktop_build_icons_dir, exist_ok=True)

    # icon.png (1024x1024)
    icon_1024 = resize(1024)
    icon_1024.save(os.path.join(desktop_build_dir, "icon.png"), "PNG")
    print("  -> packages/desktop/build/icon.png (1024x1024)")

    # icon.ico (16, 24, 32, 48, 64, 128, 256)
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    save_multi_ico(os.path.join(desktop_build_dir, "icon.ico"), ico_sizes)
    print("  -> packages/desktop/build/icon.ico (multi-resolution 16-256)")

    # icon.icns (macOS multi-res)
    try:
        icns_frames = [resize(s) for s in [32, 64, 128, 256, 512]]
        icon_1024.save(
            os.path.join(desktop_build_dir, "icon.icns"),
            format="ICNS",
            append_images=icns_frames
        )
        print("  -> packages/desktop/build/icon.icns (multi-resolution macOS)")
    except Exception as e:
        print(f"  [warn] Could not save icon.icns: {e}")

    # packages/desktop/build/icons/ (16, 24, 32, 48, 64, 128, 256, 512, 1024)
    linux_sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    for s in linux_sizes:
        res = resize(s)
        res.save(os.path.join(desktop_build_icons_dir, f"{s}x{s}.png"), "PNG")
        print(f"  -> packages/desktop/build/icons/{s}x{s}.png")

    # ─── 2. Desktop Resources Icons (Runtime Electron window & tray) ─────────
    desktop_res_dir = os.path.join(root_dir, "packages", "desktop", "resources")
    os.makedirs(desktop_res_dir, exist_ok=True)

    # icon.png (512x512)
    icon_512 = resize(512)
    icon_512.save(os.path.join(desktop_res_dir, "icon.png"), "PNG")
    print("  -> packages/desktop/resources/icon.png (512x512)")

    # icon.ico (16-256)
    save_multi_ico(os.path.join(desktop_res_dir, "icon.ico"), ico_sizes)
    print("  -> packages/desktop/resources/icon.ico (multi-resolution 16-256)")

    # tray-icon.png (32x32)
    tray_32 = resize(32)
    tray_32.save(os.path.join(desktop_res_dir, "tray-icon.png"), "PNG")
    print("  -> packages/desktop/resources/tray-icon.png (32x32)")

    # tray-icon.ico (16, 20, 24, 32, 48)
    tray_ico_sizes = [16, 20, 24, 32, 48]
    save_multi_ico(os.path.join(desktop_res_dir, "tray-icon.ico"), tray_ico_sizes)
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

    # Maskable icons (512x512 and 192x192) - full edge-to-edge lilac background
    # The holographic symbol is centered inside the safe zone (within the 80% circle)
    icon_512.save(os.path.join(web_icons_dir, "icon-maskable-512.png"), "PNG")
    icon_192 = resize(192)
    icon_192.save(os.path.join(web_icons_dir, "icon-maskable-192.png"), "PNG")
    print("  -> packages/web/public/icons/icon-maskable-512.png (512x512)")
    print("  -> packages/web/public/icons/icon-maskable-192.png (192x192)")

    # logo.png (512x512)
    icon_512.save(os.path.join(web_icons_dir, "logo.png"), "PNG")
    print("  -> packages/web/public/icons/logo.png (512x512)")

    # apple-touch-icon (180x180, and secondary iOS variants 167, 152, 120)
    # Keeping clean square image without pre-baked rounded corners so iOS applies native mask
    apple_180 = resize(180)
    apple_180.save(os.path.join(web_icons_dir, "apple-touch-icon.png"), "PNG")
    apple_180.save(os.path.join(web_icons_dir, "apple-touch-icon-180x180.png"), "PNG")
    resize(167).save(os.path.join(web_icons_dir, "apple-touch-icon-167x167.png"), "PNG")
    resize(152).save(os.path.join(web_icons_dir, "apple-touch-icon-152x152.png"), "PNG")
    resize(120).save(os.path.join(web_icons_dir, "apple-touch-icon-120x120.png"), "PNG")
    print("  -> packages/web/public/icons/apple-touch-icon.png (180x180 square, native iOS squircle)")

    # Favicons (16x16, 32x32)
    fav_16 = resize(16)
    fav_32 = resize(32)
    fav_16.save(os.path.join(web_icons_dir, "favicon-16.png"), "PNG")
    fav_32.save(os.path.join(web_icons_dir, "favicon-32.png"), "PNG")
    print("  -> packages/web/public/icons/favicon-16.png (16x16)")
    print("  -> packages/web/public/icons/favicon-32.png (32x32)")

    # public/favicon.ico (16, 32, 48)
    web_public_dir = os.path.join(root_dir, "packages", "web", "public")
    save_multi_ico(os.path.join(web_public_dir, "favicon.ico"), [16, 32, 48])
    print("  -> packages/web/public/favicon.ico (multi-resolution 16, 32, 48)")

    # ─── 4. Brand assets ──────────────────────────────────────────────────────
    brand_dir = os.path.join(root_dir, "assets", "brand")
    os.makedirs(brand_dir, exist_ok=True)
    icon_1024.save(os.path.join(brand_dir, "nuvio_logo_1024.png"), "PNG")
    print("  -> assets/brand/nuvio_logo_1024.png (1024x1024)")

    # ─── 5. Sync to build output directories if they exist ────────────────────
    dist_dirs = [
        os.path.join(root_dir, "packages", "web", "dist"),
        os.path.join(root_dir, "packages", "desktop", "web-dist"),
    ]
    for d in dist_dirs:
        if os.path.exists(d):
            print(f"  -> Syncing generated icons to: {d}")
            # favicon.ico
            save_multi_ico(os.path.join(d, "favicon.ico"), [16, 32, 48])
            # icons
            d_icons = os.path.join(d, "icons")
            os.makedirs(d_icons, exist_ok=True)
            for s in pwa_sizes:
                resize(s).save(os.path.join(d_icons, f"icon-{s}.png"), "PNG")
            icon_512.save(os.path.join(d_icons, "icon-maskable-512.png"), "PNG")
            icon_192.save(os.path.join(d_icons, "icon-maskable-192.png"), "PNG")
            icon_512.save(os.path.join(d_icons, "logo.png"), "PNG")
            apple_180.save(os.path.join(d_icons, "apple-touch-icon.png"), "PNG")
            apple_180.save(os.path.join(d_icons, "apple-touch-icon-180x180.png"), "PNG")
            resize(167).save(os.path.join(d_icons, "apple-touch-icon-167x167.png"), "PNG")
            resize(152).save(os.path.join(d_icons, "apple-touch-icon-152x152.png"), "PNG")
            resize(120).save(os.path.join(d_icons, "apple-touch-icon-120x120.png"), "PNG")
            fav_16.save(os.path.join(d_icons, "favicon-16.png"), "PNG")
            fav_32.save(os.path.join(d_icons, "favicon-32.png"), "PNG")

    print("[generate-icons] All Nuvio official icons generated successfully from Icone Nuvio 2.png!")

if __name__ == "__main__":
    generate_all_icons()
