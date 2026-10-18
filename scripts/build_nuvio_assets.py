import os
import re
import pymupdf
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_LOGO = r'C:\Users\gebel\Downloads\logo nuvio.ai'
AI_TEXTO = r'C:\Users\gebel\Downloads\texto nuvio.ai'

WEB_ICONS = os.path.join(ROOT, 'packages', 'web', 'public', 'icons')
WEB_PUBLIC = os.path.join(ROOT, 'packages', 'web', 'public')
DESKTOP_BUILD = os.path.join(ROOT, 'packages', 'desktop', 'build')
DESKTOP_RES = os.path.join(ROOT, 'packages', 'desktop', 'resources')
BRAND = os.path.join(ROOT, 'assets', 'brand')

os.makedirs(WEB_ICONS, exist_ok=True)
os.makedirs(DESKTOP_BUILD, exist_ok=True)
os.makedirs(DESKTOP_RES, exist_ok=True)
os.makedirs(BRAND, exist_ok=True)

# 1. Extract raw SVGs from .ai files
doc_logo = pymupdf.open(AI_LOGO)
raw_svg_logo = doc_logo[0].get_svg_image()

doc_texto = pymupdf.open(AI_TEXTO)
raw_svg_texto = doc_texto[0].get_svg_image()

# Extract paths
def extract_clean_paths(svg_str, fill_color='#FFFFFF'):
    paths = re.findall(r'<path[^>]+/>', svg_str)
    cleaned = []
    for p in paths:
        if 'clip' in p or '1080H1080' in p or '0 1080H1080' in p:
            continue
        if 'fill=' in p:
            p_out = re.sub(r'fill="[^"]*"', f'fill="{fill_color}"', p)
        else:
            p_out = p.replace('<path ', f'<path fill="{fill_color}" ')
        cleaned.append(p_out)
    return cleaned

paths_logo_white = extract_clean_paths(raw_svg_logo, '#FFFFFF')
paths_texto_white = extract_clean_paths(raw_svg_texto, '#FFFFFF')

# 2. Standalone Cloud Mark (square viewBox="60 60 960 960")
svg_cloud_mark = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 60 960 960" width="100%" height="100%">
  <g>
    {''.join(paths_logo_white)}
  </g>
</svg>'''

# 3. Standalone Wordmark (viewBox="40 380 1000 320")
svg_wordmark = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 380 1000 320" width="100%" height="100%">
  <g>
    {''.join(paths_texto_white)}
  </g>
</svg>'''

# 4. Full Horizontal Logo: Icon on left, "nuvio" text on right
# Cloud bbox: (117.5, 243.5, 965.1, 834.0) -> center (541.3, 538.8), size 847.7 x 590.4
# Text bbox: (56.0, 396.4, 1025.7, 684.3) -> center (540.9, 540.3), size 969.6 x 287.9
# In combined viewBox "0 0 1600 500":
# Scale cloud to height 340 (scale ~0.5758, width ~488) -> place at x=50, y=80 (center y=250)
# Scale text to height 260 (scale ~0.903, width ~875) -> place at x=600, y=120 (center y=250)
scale_icon = 0.5758
scale_text = 0.9031
tx_icon = 50 - 117.47 * scale_icon
ty_icon = 80 - 243.55 * scale_icon
tx_text = 620 - 56.03 * scale_text
ty_text = 120 - 396.42 * scale_text

svg_full_horizontal = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 320 585 152" width="100%" height="100%">
  <g transform="matrix({scale_icon},0,0,{scale_icon},{tx_icon},{ty_icon})">
    {''.join(paths_logo_white)}
  </g>
  <g transform="matrix({scale_text},0,0,{scale_text},{tx_text},{ty_text})">
    {''.join(paths_texto_white)}
  </g>
</svg>'''

# 5. App Icon with sleek squircle background (for PWA, favicon, desktop icons)
svg_app_icon = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1B2030"/>
      <stop offset="100%" stop-color="#0E1015"/>
    </linearGradient>
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(124, 121, 255, 0.4)"/>
      <stop offset="100%" stop-color="rgba(103, 224, 193, 0.2)"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="rgba(0,0,0,0.6)"/>
    </filter>
  </defs>
  <!-- Background squircle -->
  <rect x="32" y="32" width="960" height="960" rx="220" ry="220" fill="url(#bg)" stroke="url(#border)" stroke-width="8" filter="url(#shadow)"/>
  <!-- Centered Cloud Mark -->
  <g transform="matrix(0.68,0,0,0.68,144,144)">
    {''.join(paths_logo_white)}
  </g>
</svg>'''

# Save vector files
# 1. logo-mark.svg (home button)
with open(os.path.join(WEB_ICONS, 'logo-mark.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_cloud_mark)

# 2. concord_logo.svg (backwards compatibility) & nuvio_logo.svg
with open(os.path.join(WEB_ICONS, 'concord_logo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_cloud_mark)
with open(os.path.join(WEB_ICONS, 'nuvio_logo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_cloud_mark)

# 3. nuvio_wordmark.svg
with open(os.path.join(WEB_ICONS, 'nuvio_wordmark.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_wordmark)

# 4. nuvio_full.svg
with open(os.path.join(WEB_ICONS, 'nuvio_full.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_full_horizontal)

# 5. favicon.svg
with open(os.path.join(WEB_PUBLIC, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_cloud_mark)

# 6. Brand assets
with open(os.path.join(BRAND, 'nuvio_logo.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_cloud_mark)
with open(os.path.join(BRAND, 'nuvio_wordmark.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_wordmark)
with open(os.path.join(BRAND, 'nuvio_full.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_full_horizontal)

print('Vector SVGs generated successfully!')

# 6. Render raster icons using PyMuPDF and Pillow
# We render from svg_app_icon via PyMuPDF SVG support
svg_doc = pymupdf.open('svg', svg_app_icon.encode('utf-8'))
page = svg_doc[0]
pix_1024 = page.get_pixmap(dpi=int(72 * (1024 / page.rect.width)))
img_1024 = Image.frombytes("RGB" if pix_1024.n == 3 else "RGBA", [pix_1024.width, pix_1024.height], pix_1024.samples)

# Save reference 1024 PNG
img_1024.save(os.path.join(BRAND, 'nuvio_logo_1024.png'))

# Generate standard icon sizes
sizes = {
    os.path.join(WEB_ICONS, 'icon-512.png'): 512,
    os.path.join(WEB_ICONS, 'icon-maskable-512.png'): 512,
    os.path.join(WEB_ICONS, 'logo.png'): 512,
    os.path.join(WEB_ICONS, 'icon-192.png'): 192,
    os.path.join(WEB_ICONS, 'apple-touch-icon.png'): 180,
    os.path.join(WEB_ICONS, 'favicon-32.png'): 32,
    os.path.join(WEB_ICONS, 'favicon-16.png'): 16,
    os.path.join(DESKTOP_RES, 'icon.png'): 512,
    os.path.join(DESKTOP_BUILD, 'icon.png'): 512,
}

for path, size in sizes.items():
    resized = img_1024.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(path)
    print(f'Saved {os.path.basename(path)} ({size}x{size})')

# Generate Windows multi-resolution .ico for desktop build
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img_1024.save(os.path.join(DESKTOP_BUILD, 'icon.ico'), sizes=ico_sizes)
print('Saved icon.ico with multi-resolution frames')
