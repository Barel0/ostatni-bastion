# Składa i renderuje 4 bramy frakcji (droga pionowa 'v' i pozioma 'h', Korona także z opuszczoną kratą)
# i dopisuje je do katalogu ze sprite'ami z render_sprites.py.
# Użycie: blender --background --factory-startup --python render_gates.py -- <katalog z modelami> <katalog sprite'ów> <katalog ze skryptami makiet>
# Potem: python pack_atlas.py <katalog sprite'ów> ../assets.js
import os, sys, math

# wspólna scena, kamera i zapis sprite'ów z render_sprites.py
_here = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('--python') + 1]))
_head = open(os.path.join(_here, 'render_sprites.py'), encoding='utf-8').read().split('# ---------- wieże i zamki')[0]
exec(_head)

CELLBU = 1.875
PX = CELLBU                                  # odległość filara od środka drogi w bok
PY = CELLBU / math.sin(EL)                   # to samo w głąb: na ekranie też ma wyjść jedna kratka


def put(tpl, x, y, z, sx, sy, sz, rot=0.0, tint=None):
    """model postawiony podstawą w (x,y,z), rozciągnięty niezależnie w osiach i obrócony wokół pionu"""
    parts, lo, hi = tpl
    c = (lo + hi) / 2
    mw = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Diagonal((sx, sy, sz, 1)) @ Matrix.Translation((-c.x, -c.y, -lo.z))
    for me in parts:
        m = me
        if tint:
            m = me.copy()
            for i, mat in enumerate(m.materials):
                m.materials[i] = tinted(mat, tint)
        o = link(bpy.data.objects.new('i', m))
        o.matrix_world = mw


def model(pack, name, w, d, h, x, y, z=0.0, rot=0.0, tint=None):
    """model dopasowany do pudełka w x d x h"""
    t = load(find(pack, name))
    dim = t[2] - t[1]
    put(t, x, y, z, w / dim.x, d / dim.y, h / dim.z, rot, tint)


def pillar(name, x, y, wmax=1.45, hmax=2.5, rot=-25):
    t = load(find('hex', name))
    dim = t[2] - t[1]
    s = min(wmax / max(dim.x, dim.y), hmax / dim.z)
    put(t, x, y, 0, s, s, s, math.radians(rot))
    return dim.z * s


def prism(cx, cy, cz, r, depth, n, col, axis='y', emit=0.0, phase=0.0):
    """graniastosłup (moneta, kryształ) o osi poziomej wzdłuż y albo x"""
    vs = []
    for side in (-depth / 2, depth / 2):
        for i in range(n):
            a = phase + 2 * math.pi * i / n
            u, v = r * math.cos(a), r * math.sin(a)
            vs.append((cx + u, cy + side, cz + v) if axis == 'y' else (cx + side, cy + u, cz + v))
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))] + [[i, i + n, (i + 1) % n + n, (i + 1) % n] for i in range(n)]
    me = bpy.data.meshes.new('p')
    me.from_pydata(vs, [], faces)
    me.materials.append(flat(col, emit))
    return link(bpy.data.objects.new('p', me))


def cube(cx, cy, cz, wx, wy, wz, col, emit=0.0):
    x0, x1, y0, y1, z0, z1 = cx - wx / 2, cx + wx / 2, cy - wy / 2, cy + wy / 2, cz - wz / 2, cz + wz / 2
    vs = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    fs = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    me = bpy.data.meshes.new('c')
    me.from_pydata(vs, [], fs)
    me.materials.append(flat(col, emit))
    return link(bpy.data.objects.new('c', me))


def gate(fac, vert, dropped=False):
    """vert: droga pionowa (filary z lewej i prawej); inaczej droga pozioma (filary nad i pod)"""
    D = PX if vert else PY
    pos = [(-D, 0), (D, 0)] if vert else [(0, D), (0, -D)]
    rot = 0.0 if vert else math.pi / 2
    span = 2 * D - 1.0                                   # długość przęsła między filarami

    def along(u, v=0.0):                                 # u wzdłuż przęsła, v w poprzek
        return (u, v) if vert else (v, u)

    if fac == 'crown':
        for x, y in pos:
            pillar('building_tower_B_blue', x, y)
        model('hal', 'arch_gate' if dropped else 'arch', span + .25, .55, 2.25, 0, 0, 0, rot)
    elif fac == 'forest':
        for x, y in pos:
            pillar('building_tower_B_green', x, y, 1.45, 2.3)
        model('hal', 'wooden_gate', span + .2, .4, 2.05, 0, 0, 0, rot, 'ffd2a0')
        # pomost dla łuczników i dwóch łuczników na belce
        cube(*along(0), 2.08, *((span - .3, .75) if vert else (.75, span - .3)), .16, '7a4a24')
        for u in (-.5, .5):
            t = load(ADV + 'Ranger.glb', pose='Idle_A')
            dim = t[2] - t[1]
            s = .95 / dim.z
            put(t, *along(u), 2.16, s, s, s, math.radians(0 if u < 0 else 12))
    elif fac == 'guild':
        for x, y in pos:                                   # dwa domki celników
            pillar('building_home_A_yellow', x, y, 1.6, 2.3)
        # szlaban w pasy nad drogą i moneta na szczycie
        n = 8
        step = span / n
        for i in range(n):
            u = -span / 2 + step * (i + .5)
            cube(*along(u), 1.86, *((step, .26) if vert else (.26, step)), .26, 'e8b020' if i % 2 else '2b2420')
        cube(*along(0), 2.2, .14, .14, .46, '5a3a1c')
        prism(*along(0), 2.72, .46, .16, 18, 'ffc61a', 'y' if vert else 'x')
        prism(*along(0, -.1 if vert else .1), 2.72, .3, .18, 18, 'ffe680', 'y' if vert else 'x')
        for x, y in pos:
            model('dun', 'barrel_small', .5, .5, .55, x + (.62 if x < 0 else -.62) if vert else x + .72, y - .72 if vert else y)
    else:
        for x, y in pos:
            h = pillar('building_tower_B_red', x, y)
            prism(x, y, h + .3, .22, .2, 4, 'ffe23f', 'y', 1.6)
        model('hal', 'arch', span + .25, .6, 2.35, 0, 0, 0, rot, '8d7aa6')
        prism(*along(0), 2.55, .3, .3, 4, 'ffe23f', 'y' if vert else 'x', 1.8)


fresh()
for fac in ('crown', 'forest', 'guild', 'order'):
    for vert in (True, False):
        clear_meshes()
        gate(fac, vert)
        shoot('gate_%s_%s' % (fac, 'v' if vert else 'h'))
        print('BRAMA', fac, vert, flush=True)
for vert in (True, False):
    clear_meshes()
    gate('crown', vert, True)
    shoot('gate_crown_%s_down' % ('v' if vert else 'h'))
_idx = os.path.join(OUT_DIR, 'index.json')
_all = json.load(open(_idx)) if os.path.exists(_idx) else {}
_all.update(INDEX)
json.dump(_all, open(_idx, 'w'))
print('KONIEC', len(INDEX), flush=True)
