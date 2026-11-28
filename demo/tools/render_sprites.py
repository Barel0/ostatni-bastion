# Renderuje sprite'y demo z modeli KayKit (CC0) w Blenderze, bez okna.
# Użycie: blender --background --factory-startup --python render_sprites.py -- <katalog z modelami> <katalog wyjściowy> <katalog ze skryptami makiet>
# Katalog z modelami to wypakowana "The Complete KayKit Collection" (patrz kk_scripts/extract.py z makiet).
import os, sys, math, json
import bpy
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:]
K_DIR, OUT_DIR, LIB = ARGS[0], ARGS[1], ARGS[2]
_src = open(os.path.join(LIB, 'render.py'), encoding='utf-8').read().split('FN = {')[0]
_src = _src.replace("ARGS = sys.argv[sys.argv.index('--') + 1:]", "ARGS = [K_DIR, OUT_DIR, '']").replace("SCENES = ARGS[2].split(',')", '')
_src = _src.replace("sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('--python') + 1])))", 'sys.path.insert(0, LIB)')
exec(compile(_src, 'render', 'exec'))
import spec4

PPU = 64.0  # pikseli na jednostkę Blendera; kratka gry (1,875 j.) = 120 px
EL = math.radians(54)
UP = Vector((0, math.sin(EL), math.cos(EL)))
RIGHT = Vector((1, 0, 0))
os.makedirs(OUT_DIR, exist_ok=True)
INDEX = {}


def fresh():
    setup('bfd4ee', 0.62, 'fff2dc', 2.9, (46, 0, -32))
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    sc.eevee.taa_render_samples = 16


def shoot(name):
    """Kadruje ciasno to, co jest w scenie, i zapisuje położenie punktu (0,0,0) na obrazku."""
    xs, ys = [], []
    for o in bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            xs.append(p.dot(RIGHT))
            ys.append(p.dot(UP))
    pad = 3 / PPU
    x0, x1, y0, y1 = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
    w = max(8, int(math.ceil((x1 - x0) * PPU)))
    h = max(8, int(math.ceil((y1 - y0) * PPU)))
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = w, h
    cam = sc.camera
    cam.data.ortho_scale = max(w, h) / PPU
    cx, cy = x0 + w / PPU / 2, y0 + h / PPU / 2
    target = RIGHT * cx + UP * cy
    cam.location = target + Vector((0, -math.cos(EL), math.sin(EL))) * 60
    cam.rotation_euler = (math.radians(90 - 54), 0, 0)
    sc.render.filepath = os.path.join(OUT_DIR, name + '.png')
    bpy.ops.render.render(write_still=True)
    INDEX[name] = [round(-x0 * PPU, 1), round(h + y0 * PPU, 1)]


def clear_meshes():
    for o in [o for o in bpy.context.scene.objects if o.type in ('MESH', 'ARMATURE', 'EMPTY')]:
        bpy.data.objects.remove(o)


def fit_model(path, wmax, hmax, rot=-25, tint=None, x=0.0, y=0.0):
    t = load(path)
    d = t[2] - t[1]
    place(t, x, y, 0, math.radians(rot), s=min(wmax / max(d.x, d.y), hmax / d.z), tint=tint)


def hexm(base, col):
    return find('hex', base + '_' + col)


# ---------- wieże i zamki ----------
fresh()
for f in spec4.FACTIONS:
    for tid in f['tw']:
        clear_meshes()
        fit_model(hexm(spec4.TYPES[tid][1], f['col']), 1.65, 2.3)
        shoot('t_%s_%s' % (f['id'], tid))
    # piąta wieża to brama: renderuje ją render_gates.py
    clear_meshes()
    if f['castle'] == 'building_townhall_castle':
        for base, dx, dy, w in [('building_tent', -1.15, -1.0, 1.65), ('building_home_A', 1.15, -.85, 1.55), ('building_home_B', .1, .55, 2.6)]:
            fit_model(hexm(base, f['col']), w, 4.0, -28, None, dx, dy)
    else:
        fit_model(hexm(f['castle'], f['col']), 3.5, 4.2, -28)
    shoot('castle_%s' % f['id'])
    print('WIEZE', f['id'], flush=True)

# ---------- dekoracje map ----------
NAT = 'hex/Assets/gltf/decoration/nature/%s.gltf'


def F(pack, name):
    return find(pack, name)


DECO = {
    'meadow': [(NAT % 'trees_A_medium', 1.5), (NAT % 'trees_B_small', 1.3), (NAT % 'tree_single_A', .8), (NAT % 'tree_single_B', .8), (NAT % 'rock_single_A', .8), (NAT % 'rock_single_C', .9)],
    'dungeon': [(F('dun', 'barrel_large'), .95), (F('dun', 'barrel_small_stack'), 1.2), (F('dun', 'crates_stacked'), 1.3), (F('dun', 'chest'), 1.0), (F('dun', 'torch_lit'), .4), (F('dun', 'pillar'), .8)],
    'mars': [(F('spa', 'rock_A'), 1.0), (F('spa', 'rock_B'), 1.1), (F('spa', 'rocks_A'), 1.4), (F('spa', 'rocks_B'), 1.4), (F('spa', 'solarpanel'), 1.4), (F('spa', 'containers_A'), 1.2)],
    'night': [(F('hal', 'tree_dead_medium'), 1.2), (F('hal', 'tree_pine_orange_medium'), 1.4), (F('hal', 'grave_A'), .9), (F('hal', 'gravestone'), .8), (F('hal', 'pumpkin_orange_jackolantern'), .8), (F('hal', 'post_lantern'), .5)],
    'winter': [(F('hol', 'christmas_tree'), 1.3), (F('hol', 'christmas_tree_withoutLights'), 1.15), (F('hol', 'christmas_tree_decorated'), 1.35), (F('hol', 'snowman_A'), .8), (F('hol', 'snowball_pile'), 1.1), (F('hol', 'present_C_red'), .7)],
    'city': [(F('cit', 'car_taxi'), 1.45), (F('cit', 'car_sedan'), 1.45), (F('cit', 'car_police'), 1.45), (F('cit', 'bush_A'), .9), (F('for', 'Tree_1_C_Color1'), 1.2), (F('cit', 'dumpster'), 1.2)],
}
for theme, lst in DECO.items():
    for i, (path, w) in enumerate(lst):
        clear_meshes()
        fit_model(path, w, 2.2, -25)
        shoot('d_%s_%d' % (theme, i))
    print('DEKORACJE', theme, flush=True)

# ---------- wrogowie ----------
# czwarty boss (fala 15, przywołuje wsparcie) dla każdej frakcji
BOSS4 = {'aliens': ('Matka Roju', 'Skeleton_Mage', '7bffe0', 3.4), 'night': ('Pani Cieni', 'Tiefling', None, 3.2), 'horde': ('Szaman Hordy', 'OrcRaider', None, 3.2),
         'machines': ('Kuźnik', 'Clanker', 'ffd24a', 3.4), 'circus': ('Dyrektor Cyrku', 'ToySoldier', None, 3.2)}
DIRS = {'d': 0.0, 'r': math.pi / 2 * .88, 'u': math.pi}
FRAMES = 6


def character(model, tint):
    """Import postaci z animacją chodu; zwraca funkcję pozującą (klatka) -> siatki."""
    clear_meshes()
    path = CHARS[model]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=full(path))
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    rig = 'Rig_Large' if ('Golem' in path or 'CombatMech' in path) else 'Rig_Medium'
    b2, a2 = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=full(ANIM.replace('Rig_Medium', rig) + rig + '_MovementBasic.glb'))
    extra = [o for o in bpy.data.objects if o not in b2]
    act = next(a for a in bpy.data.actions if a not in a2 and a.name.split('.')[0] == 'Walking_A')
    for o in extra:
        bpy.data.objects.remove(o)
    arm.animation_data_create()
    arm.animation_data.action = act
    if getattr(act, 'slots', None) and len(act.slots):
        arm.animation_data.action_slot = act.slots[0]
    first, last = act.frame_range
    orc_mat = None
    if 'OrcRaider' in path:
        img = bpy.data.images.load(full(path.rsplit('/', 2)[0] + '/textures/orc_texture_A.png'))
        orc_mat = bpy.data.materials.new('orc')
        orc_mat.use_nodes = True
        tx = orc_mat.node_tree.nodes.new('ShaderNodeTexImage')
        tx.image = img
        bs = next(nd for nd in orc_mat.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
        orc_mat.node_tree.links.new(tx.outputs[0], bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value = .9
    meshes = [o for o in new if o.type == 'MESH' and not o.name.startswith('Icosphere')]
    for o in new:
        if o.type == 'MESH' and o not in meshes:
            o.hide_render = True

    def pose(k):
        bpy.context.scene.frame_set(int(round(first + (last - first) * k / FRAMES)))
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        parts = []
        for o in meshes:
            ev = o.evaluated_get(dg)
            me = bpy.data.meshes.new_from_object(ev, depsgraph=dg)
            me.transform(ev.matrix_world)
            if orc_mat:
                me.materials.clear()
                me.materials.append(orc_mat)
            if tint:
                for i, mat in enumerate(me.materials):
                    me.materials[i] = tinted(mat, tint)
            parts.append(me)
        return parts
    return pose, new


for fac in spec.ENEMIES:
    units = [(u[0], u[1], u[2], u[3]) for u in fac['u']]
    # kolejność: 5 zwykłych, boss spowalniający, unikający, przywołujący (nowy), wskrzeszany
    units = units[:7] + [BOSS4[fac['id']]] + units[7:]
    for ui, (nm, model, tint, height) in enumerate(units):
        fresh()
        TINTS.clear()
        CHARS_pose, objs = character(model, tint)
        h = height * .92 * .8 if ui < 5 else height * .8
        frames = [CHARS_pose(k) for k in range(FRAMES)]
        for o in objs:
            bpy.data.objects.remove(o)
        pts = [v.co for m in frames[0] for v in m.vertices]
        zmin, zmax = min(p.z for p in pts), max(p.z for p in pts)
        s = h / (zmax - zmin)
        for k, parts in enumerate(frames):
            for dn, rot in DIRS.items():
                clear_meshes()
                mw = Matrix.Rotation(rot, 4, 'Z') @ Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation((0, 0, -zmin))
                for me in parts:
                    o = link(bpy.data.objects.new('e', me))
                    o.matrix_world = mw
                shoot('e_%s_%d_%s_%d' % (fac['id'], ui, dn, k))
    print('WROGOWIE', fac['id'], flush=True)

json.dump(INDEX, open(os.path.join(OUT_DIR, 'index.json'), 'w'))
print('KONIEC', len(INDEX))
