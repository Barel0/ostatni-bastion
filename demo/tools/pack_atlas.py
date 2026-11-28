# Pakuje sprite'y z render_sprites.py w kilka arkuszy WebP i zapisuje demo/assets.js.
# Użycie: python pack_atlas.py <katalog ze sprite'ami> <demo/assets.js>
import sys, os, json, io, base64
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
index = json.load(open(os.path.join(SRC, 'index.json')))
SIZE = 2048
items = sorted(((n, Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')) for n in index), key=lambda t: (-t[1].height, t[0]))
pages, sprites = [], {}
x = y = shelf = 0
page = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
used = 0
for name, im in items:
    w, h = im.size
    if x + w + 2 > SIZE:
        x, y, shelf = 0, y + shelf + 2, 0
    if y + h + 2 > SIZE:
        pages.append(page.crop((0, 0, SIZE, used + 2)))
        page = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        x = y = shelf = used = 0
    page.paste(im, (x, y))
    sprites[name] = [len(pages), x, y, w, h, index[name][0], index[name][1]]
    x += w + 2
    shelf = max(shelf, h)
    used = max(used, y + h)
pages.append(page.crop((0, 0, SIZE, used + 2)))
uris = []
for p in pages:
    b = io.BytesIO()
    p.save(b, 'WEBP', quality=84, method=5)
    uris.append('data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode())
    print('arkusz', p.size, round(len(b.getvalue()) / 1024), 'KB')
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('/* Wygenerowane przez demo/tools/pack_atlas.py. Modele: KayKit (Kay Lousberg, www.kaylousberg.com), licencja CC0. */\n')
    f.write('var ASSETS=' + json.dumps({'pages': uris, 's': sprites}, separators=(',', ':')) + ';\n')
print('sprite', len(sprites), 'plik', round(os.path.getsize(OUT) / 1024 / 1024, 2), 'MB')
