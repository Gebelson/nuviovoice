import pymupdf
import re
import os

# Read logo SVG
with open('logo_nuvio.svg', 'r', encoding='utf-8') as f:
    svg_logo = f.read()

# Extract inner paths
paths_logo = re.findall(r'<path[^>]+/>', svg_logo)
paths_logo = [p for p in paths_logo if 'clip' not in p and '1080H1080' not in p]

# Replace or add fill="currentColor" or "#FFFFFF"
paths_logo_white = []
for p in paths_logo:
    if 'fill=' in p:
        p_w = re.sub(r'fill="[^"]*"', 'fill="#FFFFFF"', p)
    else:
        p_w = p.replace('<path ', '<path fill="#FFFFFF" ')
    paths_logo_white.append(p_w)

# Centered square icon SVG (viewBox="60 60 960 960")
icon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 60 960 960" width="100%" height="100%">
  <g>
    {''.join(paths_logo_white)}
  </g>
</svg>'''

with open('nuvio_icon.svg', 'w', encoding='utf-8') as f:
    f.write(icon_svg)

# Read texto SVG
with open('texto_nuvio.svg', 'r', encoding='utf-8') as f:
    svg_texto = f.read()

paths_texto = re.findall(r'<path[^>]+/>', svg_texto)
paths_texto = [p for p in paths_texto if 'clip' not in p and '1080H1080' not in p]

paths_texto_white = []
for p in paths_texto:
    if 'fill=' in p:
        p_w = re.sub(r'fill="[^"]*"', 'fill="#FFFFFF"', p)
    else:
        p_w = p.replace('<path ', '<path fill="#FFFFFF" ')
    paths_texto_white.append(p_w)

# Wordmark SVG (viewBox="40 380 1000 320")
wordmark_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 380 1000 320" width="100%" height="100%">
  <g>
    {''.join(paths_texto_white)}
  </g>
</svg>'''

with open('nuvio_wordmark.svg', 'w', encoding='utf-8') as f:
    f.write(wordmark_svg)

print('Successfully generated nuvio_icon.svg and nuvio_wordmark.svg')
