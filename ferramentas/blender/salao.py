# Salão de jogos da Chácara (Bofete/SP) — modelo para o site, montado e "assado" no Blender.
#
# Uso (sem interface):
#   Blender -b --python ferramentas/blender/salao.py -- <salao.json> <pasta-site> [--amostras 64] [--res 4096] [--sem-bake]
#
# Coordenadas: X = (px - cx) * esc, Y = -(py - cy) * esc (px da planta 15), Z para cima.
# O glTF exportado (Y para cima) cai direto no grupo da edificação do site: local X = X, local Z = -Y.
# A luz (sol + céu HDRI, luz rebatida, sombras) é assada nas texturas; no site os materiais viram "sem luz".
import bpy, bmesh, json, math, sys, os
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
DADOS, SITE = args[0], args[1]
opt = {args[i][2:]: (args[i + 1] if i + 1 < len(args) and not args[i + 1].startswith('--') else True) for i in range(2, len(args)) if args[i].startswith('--')}
AMOSTRAS = int(opt.get('amostras', 64))
RES = int(opt.get('res', 4096))
ASSAR = not opt.get('sem-bake')
TEX = os.path.join(SITE, 'img')
d = json.load(open(DADOS))
CX, CY = d['planta']['centro']
ESC = d['planta']['esc'][0]
H = d['altura']
PISO = 0.12
CAIXILHO = d.get('caixilho', 0x2b2f31)

def P(px, py):
    return Vector(((px - CX) * ESC, -(py - CY) * ESC))

# ------------------------------------------------------------ cena
bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene
grupos = {}

def colecao(nome):
    if nome not in grupos:
        c = bpy.data.collections.new(nome); cena.collection.children.link(c); grupos[nome] = c
    return grupos[nome]

def hexrgb(h, a=1.0):
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)

# ------------------------------------------------------------ materiais
MATS = {}
def material(nome, cor=0xffffff, rugo=0.6, metal=0.0, img=None, escala=1.0, ruido=0.0, tinta=None, vidro=False):
    if nome in MATS: return MATS[nome]
    m = bpy.data.materials.new(nome); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rugo
    bsdf.inputs['Metallic'].default_value = metal
    if vidro:
        bsdf.inputs['Base Color'].default_value = hexrgb(cor)
        bsdf.inputs['Alpha'].default_value = 0.18
        m['vidro'] = True
    elif img:
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / escala, 1 / escala, 1 / escala)
        it = nt.nodes.new('ShaderNodeTexImage'); it.image = bpy.data.images.load(img, check_existing=True)
        it.projection = 'BOX'; it.projection_blend = 0.2
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], it.inputs['Vector'])
        saida = it.outputs['Color']
        if tinta is not None:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
            mx.inputs['Factor'].default_value = 1.0
            nt.links.new(saida, mx.inputs[6]); mx.inputs[7].default_value = hexrgb(tinta)
            saida = mx.outputs[2]
        nt.links.new(saida, bsdf.inputs['Base Color'])
    else:
        if ruido:
            nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6
            cr = nt.nodes.new('ShaderNodeValToRGB')
            c0 = hexrgb(cor); k = 1 - ruido
            cr.color_ramp.elements[0].color = (c0[0] * k, c0[1] * k, c0[2] * k, 1)
            cr.color_ramp.elements[1].color = c0
            nt.links.new(nz.outputs['Fac'], cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])
        else:
            bsdf.inputs['Base Color'].default_value = hexrgb(cor)
    MATS[nome] = m
    return m

def textura_piso(n=2048, tile=1.8):
    import numpy as np
    rng = np.random.default_rng(3)
    y, x = np.mgrid[0:n, 0:n] / n * tile  # metros
    larg, comp = 0.15, 0.90
    col = (x // larg).astype(int); desl = (col % 2) * comp / 2
    lin = ((y + desl) // comp).astype(int)
    base = np.array([0x54, 0x41, 0x2F]) / 255.0
    var = rng.uniform(-0.08, 0.08, (64, 64))[col % 64, lin % 64]
    veio = np.sin((x - col * larg) * 260 + np.sin((y + col * 1.7) * 9) * 3) * 0.04 + rng.normal(0, 0.02, (n, n))
    c = base[None, None, :] * (1 + var + veio)[..., None]
    gx = (x % larg) < 0.002; gy = ((y + desl) % comp) < 0.002
    c[gx | gy] = np.array([0x8F, 0x83, 0x77]) / 255.0
    c = np.clip(c, 0, 1) ** 2.2  # sRGB -> linear
    img = bpy.data.images.new('piso_proc', n, n, alpha=False)
    px = np.ones((n, n, 4), np.float32); px[..., :3] = c[::-1]
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = '/tmp/piso_proc.png'; img.file_format = 'PNG'; img.save()
    return '/tmp/piso_proc.png'

M = dict(
    piso=material('piso', img=textura_piso(), escala=1.8, rugo=0.25),
    paredeInt=material('paredeInt', 0xEDE6D8, 0.9, ruido=0.04),
    quadro=material('quadro', 0xd9a441, 0.6, ruido=0.5),
    paredeExt=material('paredeExt', d.get('paredeExterna', 0xb9d0df), 0.9, ruido=0.05),
    caixilho=material('caixilho', CAIXILHO, 0.5, 0.4),
    vidro=material('vidro', 0xa9c9d2, 0.05, vidro=True),
    branco=material('branco', 0xE9E6DF, 0.7, ruido=0.03),
    forro=material('forro', img=f'{TEX}/pbr/forro.jpg', escala=1.2, rugo=0.7, tinta=0x3a2a1e),
    viga=material('viga', 0x3A2A1C, 0.7, ruido=0.2),
    telha=material('telha', d['telhado'].get('cor', 0x8e999f), 0.45, 0.5),
    testeira=material('testeira', d['telhado'].get('testeira', 0x4a3426), 0.6),
    rodape=material('rodape', d.get('rodape', 0x4a3426), 0.6),
    madeiraEsc=material('madeiraEsc', 0x4e3020, 0.55, ruido=0.2),
    madeiraMel=material('madeiraMel', 0xc49a62, 0.5, ruido=0.18),
    madeiraRustica=material('madeiraRustica', 0x6e4a2c, 0.8, ruido=0.35),
    deck=material('deck', img=f'{TEX}/pbr/deck.jpg', escala=2.0, rugo=0.5, tinta=0xc88a68),
    tampoVidro=material('tampoVidro', 0xa9c9d2, 0.05, vidro=True),
    feltro=material('feltro', 0x2E6B3F, 0.95),
    madeiraSinuca=material('madeiraSinuca', 0x4A2E18, 0.5, ruido=0.2),
    pingpong=material('pingpong', 0x1E5F6E, 0.45),
    cadeira=material('cadeira', 0x8A5A2B, 0.5, ruido=0.15),
    estofado=material('estofado', 0xE6DED0, 0.95),
    fliperama=material('fliperama', 0x1b2a5a, 0.4),
    linha=material('linha', 0xf3f3ee, 0.6),
    preto=material('preto', 0x161818, 0.4),
    inox=material('inox', 0xc9cdcf, 0.25, 0.9),
    cinza=material('cinza', 0x9aa0a3, 0.35, 0.5),
    granito=material('granito', 0x2f2b28, 0.25, ruido=0.3),
    tijolo=material('tijolo', 0x8b5a3c, 0.9, ruido=0.25),
    azulejo=material('azulejo', 0xeeeeea, 0.2),
    sofa=material('sofa', 0x8f877b, 0.95, ruido=0.08),
    almofada=material('almofada', 0xd9d3c4, 0.95),
    bambu=material('bambu', 0xc9a66b, 0.6, ruido=0.2),
    folhagem=material('folhagem', 0xcfe3cf, 0.95, ruido=0.25),
    azulHockey=material('azulHockey', 0x2f7fc0, 0.5),
    tela=material('tela', 0x0b0d10, 0.2),
    telaLuz=material('telaLuz', 0x3fd6ff, 0.3),
    aco=material('aco', 0x8a9090, 0.35, 0.8),
    ombrelone=material('ombrelone', 0xeae4d6, 0.85),
    borda=material('borda', 0xe9dfcc, 0.8),
)

# ------------------------------------------------------------ geometria
def _obj(nome, me, mat, col):
    o = bpy.data.objects.new(nome, me)
    colecao(col).objects.link(o)
    if mat: o.data.materials.append(mat)
    return o

def caixa(c, t, mat, col='estrutura', rz=0.0, nome='caixa', chanfro=0.0):
    me = bpy.data.meshes.new(nome); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(t), verts=bm.verts)
    if chanfro > 0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=chanfro, segments=1, affect='EDGES')
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rz, 3, 'Z'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(c), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    return _obj(nome, me, mat, col)

def cilindro(c, r, h, mat, col='moveis', seg=16, r2=None, nome='cil', eixo='Z'):
    me = bpy.data.meshes.new(nome); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if eixo == 'X': bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts)
    if eixo == 'Y': bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(c), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    return _obj(nome, me, mat, col)

def prisma(pts2d, z0, z1, mat, col='estrutura', nome='prisma'):
    """polígono (lista de (x,y)) extrudado de z0 a z1"""
    me = bpy.data.meshes.new(nome); bm = bmesh.new()
    vb = [bm.verts.new((x, y, z0)) for x, y in pts2d]
    f = bm.faces.new(vb)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    vs = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, z1 - z0), verts=vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    return _obj(nome, me, mat, col)

def poligono(pts3d, mat, col='estrutura', nome='poligono', espessura=0.0):
    me = bpy.data.meshes.new(nome); bm = bmesh.new()
    f = bm.faces.new([bm.verts.new(p) for p in pts3d])
    if espessura:
        ext = bmesh.ops.extrude_face_region(bm, geom=[f])
        vs = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=f.normal * espessura, verts=vs)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    return _obj(nome, me, mat, col)

def viga_entre(a, b, larg, alt, mat, col='telhado_int', nome='viga'):
    """viga retangular de a até b (Vector 3D)"""
    a, b = Vector(a), Vector(b); v = b - a; L = v.length
    o = caixa((0, 0, 0), (L, larg, alt), mat, col, nome=nome)
    rot = Vector((1, 0, 0)).rotation_difference(v.normalized())
    o.matrix_world = Matrix.Translation((a + b) / 2) @ rot.to_matrix().to_4x4()
    return o

# ------------------------------------------------------------ casca: piso, paredes, aberturas
paredes = d['paredes']
ext_x = [p for w in paredes if len(w) > 4 and w[4] for p in (w[0], w[2])]
ext_y = [p for w in paredes if len(w) > 4 and w[4] for p in (w[1], w[3])]
x0p, x1p, y0p, y1p = min(ext_x), max(ext_x), min(ext_y), max(ext_y)
A, B = P(x0p, y0p), P(x1p, y1p)
mx, my = (A.x + B.x) / 2, (A.y + B.y) / 2
W, Dd = abs(B.x - A.x), abs(B.y - A.y)
# laje e piso de madeira (porcelanato amadeirado nas fotos)
caixa((mx, my, PISO / 2), (W + 0.5, Dd + 0.5, PISO), M['borda'], nome='laje')
poligono([(A.x, B.y, PISO + 0.008), (B.x, B.y, PISO + 0.008), (B.x, A.y, PISO + 0.008), (A.x, A.y, PISO + 0.008)], M['piso'], 'piso', nome='piso')

TOPO_VIDRO = H - 0.25  # fotos 42/48: panos de vidro do piso até a viga
def vaos_da_parede(eixoX, fixo, a, b):
    vs = []
    for ab in d.get('aberturas', []):
        p0, p1 = P(ab['p'][0], ab['p'][1]), P(ab['p'][2], ab['p'][3])
        na = abs(p0.y - fixo) < 0.05 and abs(p1.y - fixo) < 0.05 if eixoX else abs(p0.x - fixo) < 0.05 and abs(p1.x - fixo) < 0.05
        if not na: continue
        s, e = (min(p0.x, p1.x), max(p0.x, p1.x)) if eixoX else (min(p0.y, p1.y), max(p0.y, p1.y))
        if e <= a or s >= b: continue
        vs.append(dict(s=max(s, a), e=min(e, b), tipo=ab['tipo']))
    for pt in d.get('portas', []):
        q = P(*pt)
        dist, pos = (abs(q.y - fixo), q.x) if eixoX else (abs(q.x - fixo), q.y)
        if dist < 0.08 and a < pos < b: vs.append(dict(s=pos - 0.45, e=pos + 0.45, tipo='porta', interna=True))
    return sorted(vs, key=lambda v: v['s'])

def seg(eixoX, fixo, s, e, z0, z1, esp, mat, off=0.0, col='estrutura', nome='parede'):
    if e - s < 0.01 or z1 - z0 < 0.01: return
    if eixoX: caixa(((s + e) / 2, fixo + off, (z0 + z1) / 2), (e - s, esp, z1 - z0), mat, col, nome=nome)
    else: caixa((fixo + off, (s + e) / 2, (z0 + z1) / 2), (esp, e - s, z1 - z0), mat, col, nome=nome)

for w in paredes:
    a2, b2 = P(w[0], w[1]), P(w[2], w[3])
    eixoX = abs(a2.y - b2.y) < 1e-6
    fixo = a2.y if eixoX else a2.x
    a, b = (min(a2.x, b2.x), max(a2.x, b2.x)) if eixoX else (min(a2.y, b2.y), max(a2.y, b2.y))
    ext = len(w) > 4 and w[4]
    esp = 0.24 if ext else 0.14
    sOut = (1 if fixo > my else -1) if eixoX else (1 if fixo > mx else -1)
    def parede(s, e, z0, z1):
        if ext:
            seg(eixoX, fixo, s, e, z0, z1, esp / 2, M['paredeExt'], sOut * esp / 4)
            seg(eixoX, fixo, s, e, z0, z1, esp / 2, M['paredeInt'], -sOut * esp / 4)
            if z0 <= PISO + 0.01: seg(eixoX, fixo, s, e, PISO, PISO + 0.1, 0.016, M['rodape'], -sOut * (esp / 2 + 0.008))
        else:
            seg(eixoX, fixo, s, e, z0, z1, esp, M['paredeInt'])
            if z0 <= PISO + 0.01: seg(eixoX, fixo, s, e, PISO, PISO + 0.1, esp + 0.03, M['rodape'])
    def esquadria(s, e, z0, z1, montantes=True):
        f = 0.06
        seg(eixoX, fixo, s - f, s, z0, z1, esp + 0.03, M['caixilho'])
        seg(eixoX, fixo, e, e + f, z0, z1, esp + 0.03, M['caixilho'])
        seg(eixoX, fixo, s - f, e + f, z1, z1 + f, esp + 0.03, M['caixilho'])
        if z0 > PISO + 0.05: seg(eixoX, fixo, s - f, e + f, z0 - 0.05, z0, esp + 0.08, M['branco'])
        else: seg(eixoX, fixo, s, e, PISO, PISO + 0.05, 0.08, M['caixilho'])
        if montantes:
            n = max(1, round((e - s) / 1.25))
            for k in range(1, n):
                m_ = s + (e - s) / n * k
                seg(eixoX, fixo, m_ - 0.025, m_ + 0.025, z0, z1, 0.07, M['caixilho'])
        seg(eixoX, fixo, s, e, z0, z1, 0.02, M['vidro'], col='vidro', nome='vidro')
    cur = a
    for v in vaos_da_parede(eixoX, fixo, a, b):
        if v['s'] > cur: parede(cur, v['s'], PISO, H)
        topo = TOPO_VIDRO if v['tipo'] in ('vidro', 'porta') and ext else 2.1
        parede(v['s'], v['e'], topo, H)
        if v['tipo'] == 'janela': parede(v['s'], v['e'], PISO, 1.0); esquadria(v['s'], v['e'], 1.0, topo)
        elif v['tipo'] == 'basculante': parede(v['s'], v['e'], PISO, 1.6); esquadria(v['s'], v['e'], 1.6, topo, False)
        elif v['tipo'] == 'vidro' or (v['tipo'] == 'porta' and ext): esquadria(v['s'], v['e'], PISO, topo)
        cur = max(cur, v['e'])
    if b > cur: parede(cur, b, PISO, H)

# pilares brancos de alvenaria nos cantos e entre panos de vidro (fotos 46/48)
for px, py in [(x0p, y1p), (x1p, y1p), (x1p, y0p), (205, y0p), (x1p, 260), (x1p, 330)]:
    q = P(px, py); caixa((q.x, q.y, H / 2), (0.42, 0.42, H), M['branco'], nome='pilar', chanfro=0.01)

# quadro na parede do fundo da mesa de 24 (foto 09)
q = P(272, 15)
caixa((q.x, q.y - 0.14, 1.75), (0.55, 0.03, 0.7), M['madeiraEsc'], 'moveis', nome='moldura')
caixa((q.x, q.y - 0.16, 1.75), (0.42, 0.01, 0.56), M['quadro'], 'moveis', nome='gravura')

# ------------------------------------------------------------ colunas torcidas (foto 46)
def coluna_torcida(x, y):
    # fuste quadrado de cantos chanfrados, torcido 180° a cada 3 m (foto 46)
    z0, z1 = PISO + 0.25, H - 0.2
    anel = []
    for k in range(4):
        a = k * math.pi / 2
        for t in (-0.16, 0.16):
            anel.append((math.cos(a) * 0.23 - math.sin(a) * t, math.sin(a) * 0.23 + math.cos(a) * t))
    me = bpy.data.meshes.new('torcida'); bm = bmesh.new()
    n = 40; aneis = []
    for i in range(n + 1):
        z = z0 + (z1 - z0) * i / n; rot = math.pi * (z - z0) / 3.0
        c_, s_ = math.cos(rot), math.sin(rot)
        aneis.append([bm.verts.new((x + px * c_ - py * s_, y + px * s_ + py * c_, z)) for px, py in anel])
    m_ = len(anel)
    for i in range(n):
        for j in range(m_):
            bm.faces.new((aneis[i][j], aneis[i][(j + 1) % m_], aneis[i + 1][(j + 1) % m_], aneis[i + 1][j]))
    bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    o = _obj('torcida', me, M['branco'], 'moveis')
    for f in o.data.polygons: f.use_smooth = True
    caixa((x, y, PISO + 0.125), (0.62, 0.62, 0.25), M['branco'], 'moveis', nome='base')
    caixa((x, y, H - 0.1), (0.62, 0.62, 0.2), M['branco'], 'moveis', nome='capitel')
for c in d.get('colunas', []):
    q = P(*c); coluna_torcida(q.x, q.y)

# ------------------------------------------------------------ telhado de duas águas, forro de madeira e tesouras
tel = d['telhado']; beiral = tel.get('beiral', 0.9); hT = tel.get('altura', 4.4)
rx0, rx1, ry0, ry1 = A.x - beiral, B.x + beiral, B.y - beiral, A.y + beiral  # A.y > B.y (eixo Y invertido)
cxr = (rx0 + rx1) / 2; halfW = (rx1 - rx0) / 2
for lado in (-1, 1):
    xb = rx0 if lado < 0 else rx1
    # telha metálica (lado de fora)
    poligono([(xb, ry0, H), (xb, ry1, H), (cxr, ry1, H + hT), (cxr, ry0, H + hT)][::(1 if lado < 0 else -1)], M['telha'], 'telhado_ext', nome='telha', espessura=0.04)
    # forro de madeira (por baixo)
    poligono([(xb, ry0, H - 0.03), (cxr, ry0, H + hT - 0.03), (cxr, ry1, H + hT - 0.03), (xb, ry1, H - 0.03)][::(1 if lado < 0 else -1)], M['forro'], 'telhado_int', nome='forro')
# testeiras
incl = math.atan2(hT, halfW); L = math.hypot(hT, halfW)
for yy in (ry0, ry1):
    for lado in (-1, 1):
        viga_entre((cxr + lado * halfW, yy, H - 0.05), (cxr, yy, H + hT - 0.05), 0.08, 0.32, M['testeira'], 'telhado_ext', 'testeira')
for lado in (-1, 1): caixa((cxr + lado * halfW, (ry0 + ry1) / 2, H - 0.05), (0.08, ry1 - ry0, 0.28), M['testeira'], 'telhado_ext', nome='testeira')
# oitão de vidro na frente (lado "portas", py = y1p) e oitão fechado nos fundos
ox0, ox1 = [P(v, 0).x for v in tel.get('oitao', [x0p, x1p])]
alt = lambda x: max(0.0, hT * (1 - abs(x - cxr) / halfW))
yF, yT = P(0, y1p).y, P(0, y0p).y
tri = lambda yy: [(ox0, yy, H), (ox1, yy, H), (ox1, yy, H + alt(ox1)), (cxr, yy, H + hT - 0.06), (ox0, yy, H + alt(ox0))]
poligono(tri(yF), M['vidro'], 'vidro', nome='oitao_vidro')
poligono(tri(yT), M['paredeExt'], 'estrutura', nome='oitao_fundo', espessura=0.12)
for k in range(9):
    x = ox0 + (ox1 - ox0) / 8 * k; hh = alt(x) - 0.06
    if hh > 0.1: caixa((x, yF, H + hh / 2), (0.07, 0.1, hh), M['caixilho'], 'estrutura', nome='montante_oitao')
caixa(((ox0 + ox1) / 2, yF, H + 0.05), (ox1 - ox0, 0.1, 0.1), M['caixilho'], 'estrutura', nome='travessa_oitao')
# cumeeira, terças e tesouras aparentes (fotos 42/46/48)
viga_entre((cxr, ry0, H + hT - 0.22), (cxr, ry1, H + hT - 0.22), 0.16, 0.3, M['viga'], nome='cumeeira')
for k in range(1, 6):
    t = k / 6; xx = halfW * t
    for lado in (-1, 1):
        viga_entre((cxr + lado * xx, ry0, H + hT * (1 - t) - 0.16), (cxr + lado * xx, ry1, H + hT * (1 - t) - 0.16), 0.1, 0.14, M['viga'], nome='terca')
n_tes = max(2, int((ry1 - ry0) // 3.0))
for i in range(1, n_tes):
    yy = ry0 + (ry1 - ry0) / n_tes * i
    viga_entre((cxr - halfW + beiral, yy, H + 0.02), (cxr + halfW - beiral, yy, H + 0.02), 0.15, 0.25, M['viga'], nome='linha')
    for lado in (-1, 1):
        viga_entre((cxr + lado * (halfW - beiral), yy, H + 0.05), (cxr, yy, H + hT - 0.2), 0.15, 0.25, M['viga'], nome='perna')
        viga_entre((cxr + lado * (halfW - beiral) * 0.5, yy, H + 0.05), (cxr + lado * (halfW - beiral) * 0.25, yy, H + hT * 0.72), 0.12, 0.16, M['viga'], nome='escora')
    viga_entre((cxr, yy, H), (cxr, yy, H + hT - 0.2), 0.14, 0.18, M['viga'], nome='pendural')

# ------------------------------------------------------------ deck de madeira com guarda-corpo de cabos (foto 03)
if d.get('deck'):
    r = d['deck']['r']; a, b = P(r[0], r[1]), P(r[2], r[3])
    dx0, dx1, dy0, dy1 = min(a.x, b.x), max(a.x, b.x), min(a.y, b.y), max(a.y, b.y)
    caixa(((dx0 + dx1) / 2, (dy0 + dy1) / 2, 0.15), (dx1 - dx0, dy1 - dy0, 0.3), M['deck'], 'deck', nome='deck')
    def guarda(p, q):
        viga_entre((p[0], p[1], 1.3), (q[0], q[1], 1.3), 0.1, 0.07, M['madeiraEsc'], 'deck', 'corrimao')
        for zc in (0.55, 0.75, 0.95, 1.15): viga_entre((p[0], p[1], zc), (q[0], q[1], zc), 0.012, 0.012, M['aco'], 'deck', 'cabo')
        Lg = (Vector(q) - Vector(p)).length; n = max(1, round(Lg / 1.5))
        for k in range(n + 1):
            t = k / n; caixa((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, 0.8), (0.09, 0.09, 1.0), M['madeiraEsc'], 'deck', nome='poste')
    guarda((dx0, dy0), (dx1, dy0)); guarda((dx0, dy0), (dx0, dy1)); guarda((dx0, dy1), (dx1, dy1))
    # ombrelone e mesa redonda com cadeiras
    cxd, cyd = dx0 + (dx1 - dx0) * 0.45, (dy0 + dy1) / 2
    cilindro((cxd, cyd, 0.3 + 1.25), 0.03, 2.5, M['aco'], 'deck')
    cilindro((cxd, cyd, 0.3 + 2.35), 1.5, 0.45, M['ombrelone'], 'deck', seg=8, r2=0.05)
    cilindro((cxd + 1.2, cyd, 0.3 + 0.74), 0.55, 0.04, M['linha'], 'deck', seg=24)
    cilindro((cxd + 1.2, cyd, 0.3 + 0.37), 0.03, 0.72, M['aco'], 'deck')
    for i in range(6):
        ang = i / 6 * math.tau; px, py = cxd + 1.2 + math.cos(ang) * 0.85, cyd + math.sin(ang) * 0.85
        caixa((px, py, 0.3 + 0.45), (0.45, 0.45, 0.04), M['preto'], 'deck', rz=ang)
        caixa((px + math.cos(ang) * 0.22, py + math.sin(ang) * 0.22, 0.3 + 0.75), (0.04, 0.45, 0.6), M['preto'], 'deck', rz=ang)

# ------------------------------------------------------------ móveis (comprimento no eixo Y local)
def grupo_movel(fn, x, y, rz, comp=None):
    antes = set(bpy.data.objects)
    fn(comp) if comp else fn()
    novos = [o for o in bpy.data.objects if o not in antes]
    R = Matrix.Translation((x, y, PISO)) @ Matrix.Rotation(rz, 4, 'Z')
    for o in novos: o.matrix_world = R @ o.matrix_world

def mesa_de_jogo(l, c, topo, alt=0.8, pes=M['madeiraEsc']):
    caixa((0, 0, alt), (l, c, 0.08), topo, 'moveis')
    for sx in (-1, 1):
        for sy in (-1, 1): caixa((sx * (l / 2 - 0.12), sy * (c / 2 - 0.12), (alt - 0.04) / 2), (0.1, 0.1, alt - 0.04), pes, 'moveis')

def cadeira_alta(x, y, rz, mat=None):
    mat = mat or M['cadeira']
    o0 = set(bpy.data.objects)
    caixa((0, 0, 0.45), (0.46, 0.46, 0.04), mat, 'moveis'); caixa((0, 0.01, 0.5), (0.44, 0.42, 0.07), M['estofado'], 'moveis', chanfro=0.02)
    for sx in (-1, 1):
        caixa((sx * 0.2, 0.2, 0.22), (0.04, 0.04, 0.44), mat, 'moveis'); caixa((sx * 0.2, -0.2, 0.52), (0.045, 0.04, 1.04), mat, 'moveis')
    # encosto em arco (5 réguas) com almofada
    for k in range(5):
        a = (k - 2) * 0.2
        caixa((math.sin(a) * 0.5 * 0.42, -0.21 - (1 - math.cos(a)) * 0.25, 0.92), (0.09, 0.03, 0.34), mat, 'moveis', rz=-a)
    caixa((0, -0.17, 0.78), (0.38, 0.04, 0.2), M['estofado'], 'moveis', chanfro=0.015)
    for o in [o for o in bpy.data.objects if o not in o0]: o.matrix_world = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(rz, 4, 'Z') @ o.matrix_world

MOVEIS = {}
def movel(fn): MOVEIS[fn.__name__] = fn; return fn

@movel
def mesa24(comp=None):
    l, c = 1.1, 7.0
    caixa((0, 0, 0.76), (l, c, 0.02), M['tampoVidro'], 'vidro', nome='vidro_mesa')
    for yy in (-c / 2 + 0.6, 0, c / 2 - 0.6): caixa((0, yy, 0.37), (0.5, 0.25, 0.74), M['madeiraRustica'], 'moveis')
    for i in range(12):
        yy = -c / 2 + c / 12 * (i + 0.5)
        cadeira_alta(-l / 2 - 0.3, yy, -math.pi / 2); cadeira_alta(l / 2 + 0.3, yy, math.pi / 2)

@movel
def bancada(comp=2.4):
    caixa((0, 0, 0.43), (0.62, comp, 0.86), M['madeiraEsc'], 'moveis'); caixa((0, 0, 0.88), (0.66, comp + 0.02, 0.04), M['granito'], 'moveis')

@movel
def balcao(comp=4):
    caixa((0, 0, 0.52), (0.45, comp, 1.05), M['tijolo'], 'moveis'); caixa((0, 0, 1.07), (0.62, comp + 0.1, 0.05), M['granito'], 'moveis')
    for k in range(int(comp / 0.7)):
        cilindro((0.6, -comp / 2 + 0.35 + k * 0.7, 0.38), 0.18, 0.04, M['madeiraMel'], seg=12); cilindro((0.6, -comp / 2 + 0.35 + k * 0.7, 0.19), 0.03, 0.38, M['madeiraMel'], seg=6)

@movel
def churrasqueira(comp=None):
    caixa((0, 0, 0.45), (1.0, 1.4, 0.9), M['branco'], 'moveis'); caixa((-0.1, 0, 1.5), (0.8, 1.2, 1.2), M['branco'], 'moveis')
    caixa((-0.1, 0, 2.6), (0.55, 0.6, 1.0), M['branco'], 'moveis'); caixa((0.31, 0, 1.35), (0.02, 0.8, 0.6), M['preto'], 'moveis')

@movel
def fornoPizza(comp=None):
    caixa((0, 0, 0.45), (1.4, 1.4, 0.9), M['branco'], 'moveis')
    cilindro((0, 0, 1.2), 0.7, 0.6, M['branco'], seg=24, r2=0.25)
    caixa((0.62, 0, 1.05), (0.06, 0.45, 0.35), M['preto'], 'moveis')

@movel
def geladeira(comp=None): caixa((0, 0, 0.925), (0.75, 0.7, 1.85), M['cinza'], 'moveis', chanfro=0.02)

@movel
def bilhar(comp=None):
    mesa_de_jogo(1.4, 2.6, M['feltro'], 0.8, M['madeiraSinuca'])
    caixa((0, 0, 0.62), (1.3, 2.5, 0.3), M['madeiraSinuca'], 'moveis')
    for sx in (-1, 1): caixa((sx * 0.72, 0, 0.86), (0.12, 2.7, 0.14), M['madeiraSinuca'], 'moveis')
    for sy in (-1, 1): caixa((0, sy * 1.32, 0.86), (1.56, 0.12, 0.14), M['madeiraSinuca'], 'moveis')

@movel
def pebolim(comp=None):
    caixa((0, 0, 0.85), (0.8, 1.45, 0.25), M['madeiraMel'], 'moveis'); caixa((0, 0, 0.75), (0.72, 1.35, 0.02), M['feltro'], 'moveis')
    for sx in (-1, 1):
        for sy in (-1, 1): caixa((sx * 0.3, sy * 0.6, 0.37), (0.1, 0.1, 0.74), M['madeiraMel'], 'moveis')
    for i in range(8): cilindro((0, -0.63 + i * 0.18, 0.92), 0.012, 1.3, M['inox'], seg=6, eixo='X')

@movel
def pingpong(comp=None):
    caixa((0, 0, 0.765), (1.52, 2.74, 0.02), M['pingpong'], 'moveis')
    caixa((0, 0, 0.74), (1.4, 2.6, 0.03), M['preto'], 'moveis')
    caixa((0, 0, 0.778), (0.02, 2.7, 0.002), M['linha'], 'moveis')
    for sy in (-1, 1): caixa((0, sy * 1.36, 0.778), (1.5, 0.02, 0.002), M['linha'], 'moveis')
    caixa((0, 0, 0.85), (1.7, 0.01, 0.15), M['linha'], 'moveis')
    for sx in (-1, 1):
        for sy in (-1, 1): caixa((sx * 0.6, sy * 1.1, 0.37), (0.05, 0.05, 0.74), M['preto'], 'moveis')

@movel
def futmesa(comp=None):  # mesa de air hockey (foto 46, azul)
    caixa((0, 0, 0.6), (1.2, 2.2, 0.35), M['preto'], 'moveis'); caixa((0, 0, 0.78), (1.1, 2.1, 0.02), M['azulHockey'], 'moveis')
    caixa((0, 0, 0.79), (1.1, 0.02, 0.002), M['linha'], 'moveis')

@movel
def sofa(comp=2.2):
    caixa((0, 0, 0.22), (0.92, comp, 0.44), M['sofa'], 'moveis', chanfro=0.03)
    caixa((-0.33, 0, 0.45), (0.26, comp, 0.86), M['sofa'], 'moveis', chanfro=0.03)
    for sy in (-1, 1): caixa((0, sy * (comp / 2 - 0.11), 0.31), (0.92, 0.22, 0.62), M['sofa'], 'moveis', chanfro=0.03)
    n = max(1, round((comp - 0.44) / 0.75)); w = (comp - 0.44) / n
    for i in range(n):
        caixa((0.08, -comp / 2 + 0.22 + w * (i + 0.5), 0.5), (0.62, w - 0.04, 0.14), M['sofa'], 'moveis', chanfro=0.04)
        caixa((-0.12, -comp / 2 + 0.22 + w * (i + 0.5), 0.68), (0.18, w - 0.08, 0.4), M['almofada'], 'moveis', chanfro=0.05)

@movel
def tv(comp=None):
    caixa((0, 0, 0.3), (0.45, 2.2, 0.6), M['madeiraEsc'], 'moveis')
    caixa((-0.18, 0, 1.55), (0.05, 1.45, 0.82), M['tela'], 'moveis')

@movel
def mesaRedonda(comp=None):  # mesa de carteado com feltro verde (foto 17)
    caixa((0, 0, 0.76), (1.0, 1.0, 0.05), M['madeiraMel'], 'moveis'); caixa((0, 0, 0.787), (0.86, 0.86, 0.01), M['feltro'], 'moveis')
    cilindro((0, 0, 0.37), 0.08, 0.74, M['madeiraMel'], seg=10)
    for i in range(4): a = i * math.pi / 2; cadeira_alta(math.cos(a) * 0.75, math.sin(a) * 0.75, a + math.pi / 2)

@movel
def poltrona(comp=None):  # bambu com almofada estampada (foto 47)
    for sx in (-1, 1):
        for sy in (-1, 1): cilindro((sx * 0.3, sy * 0.3, 0.32), 0.025, 0.64, M['bambu'], seg=8)
        cilindro((sx * 0.32, 0, 0.6), 0.025, 0.7, M['bambu'], seg=8, eixo='Y')
    caixa((0, 0, 0.4), (0.62, 0.62, 0.12), M['folhagem'], 'moveis', chanfro=0.04)
    caixa((-0.26, 0, 0.75), (0.12, 0.6, 0.62), M['folhagem'], 'moveis', chanfro=0.04, rz=0)

@movel
def fliperama(comp=None):
    caixa((0, 0, 0.85), (0.62, 0.72, 1.7), M['fliperama'], 'moveis')
    caixa((0.32, 0, 1.3), (0.02, 0.5, 0.4), M['telaLuz'], 'moveis'); caixa((0.36, 0, 0.95), (0.2, 0.55, 0.05), M['preto'], 'moveis')

for mv in d.get('moveis', []):
    fn = MOVEIS.get(mv['t'])
    if not fn: continue
    q = P(*mv['c'])
    grupo_movel(fn, q.x, q.y, math.radians(mv.get('r', 0)), mv.get('comp'))

# ------------------------------------------------------------ entorno (só para a luz: gramado rebate verde pelos vidros; não é exportado)
gram = material('gramado', img=f'{TEX}/pbr/grama.jpg', escala=3.0, rugo=1.0, tinta=0x5C7A3A)
caixa((mx, my, -0.05), (220, 220, 0.1), gram, 'entorno', nome='gramado')

# ------------------------------------------------------------ luz: céu HDRI + sol
w = bpy.data.worlds.new('ceu'); cena.world = w; w.use_nodes = True
nt = w.node_tree; bg = nt.nodes['Background']
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(opt.get('hdr', ''), check_existing=True) if opt.get('hdr') else None
if env.image: nt.links.new(env.outputs['Color'], bg.inputs['Color'])
EXPO = float(opt.get('exposicao', 4.0))  # celular em HDR: interiores bem claros
bg.inputs['Strength'].default_value = 2.0 * EXPO  # céu forte + sol moderado: sombras menos fundas, como as fotos de celular
sol = bpy.data.lights.new('sol', 'SUN'); sol.energy = 1.6 * EXPO; sol.angle = math.radians(1.5); sol.color = (1.0, 0.93, 0.84)
so = bpy.data.objects.new('sol', sol); cena.collection.objects.link(so)
so.rotation_euler = (math.radians(40), 0, math.radians(float(opt.get('sol-azimute', 215))))

# ------------------------------------------------------------ prévia: renderiza dos pontos de vista das fotos e sai
if opt.get('previa'):
    vistas = {v['n']: v for v in json.load(open(opt['vistas']))}
    fovs = json.load(open(os.path.join(SITE, 'img', 'prof', 'indice.json')))
    cena.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for dv in prefs.devices: dv.use = True
    cena.cycles.device = 'GPU'; cena.cycles.samples = int(opt.get('amostras', 32)); cena.cycles.use_denoising = True
    cena.view_settings.view_transform = 'AgX'
    cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); cena.collection.objects.link(co); cena.camera = co
    for n in map(int, str(opt['previa']).split(',')):
        v = vistas[n]; info = fovs[str(n)]
        p0, p1 = P(*v['pos']), P(*v['olha'])
        dx, dy = p1.x - p0.x, p1.y - p0.y
        co.location = (p0.x, p0.y, PISO + v.get('alt', 1.5))
        co.rotation_euler = (math.radians(90 + v.get('incl', 0)), 0, math.atan2(-dx, dy))
        cam.sensor_fit = 'HORIZONTAL'; cam.angle = math.radians(v.get('fov', info['fov']))
        cena.render.resolution_x = 640; cena.render.resolution_y = round(640 * info['h'] / info['w'])
        cena.render.filepath = os.path.join(opt['saida'], f'previa_{n:02d}.jpg'); cena.render.image_settings.file_format = 'JPEG'
        bpy.ops.render.render(write_still=True)
        print('prévia', n, flush=True)
    sys.exit(0)

# ------------------------------------------------------------ assar e exportar
cena.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.get_devices()
for dv in prefs.devices: dv.use = True
cena.cycles.device = 'GPU'; cena.cycles.samples = AMOSTRAS
cena.cycles.max_bounces = 6

def juntar(nome):
    objs = list(colecao(nome).objects)
    if not objs: return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = nome
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o

ATLAS = {'piso': RES, 'estrutura': RES, 'telhado_int': RES // 2, 'moveis': RES, 'deck': RES // 4, 'telhado_ext': RES // 4}
pasta = os.path.join(SITE, 'modelos', 'salao'); os.makedirs(pasta, exist_ok=True)
for nome in ATLAS: juntar(nome)
vid = juntar('vidro')
if vid: vid.hide_render = True  # o vidro não bloqueia a luz no cálculo

def limpa_faces_escondidas(o):
    # fundos de caixas (normal para baixo) e faces abaixo do piso nunca aparecem: não gastam espaço na textura
    bm = bmesh.new(); bm.from_mesh(o.data)
    fora = [f for f in bm.faces if f.normal.z < -0.9 or f.calc_center_median().z < PISO - 0.02]
    bmesh.ops.delete(bm, geom=fora, context='FACES'); bm.to_mesh(o.data); bm.free()

for nome, res in ATLAS.items():
    o = bpy.data.objects.get(nome)
    if not o: continue
    if nome in ('estrutura', 'moveis', 'deck'): limpa_faces_escondidas(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'{nome}_luz', res, res, alpha=False)
    for slot in o.material_slots:
        nt_ = slot.material.node_tree
        n_ = nt_.nodes.new('ShaderNodeTexImage'); n_.image = img; n_.select = True; nt_.nodes.active = n_
    if ASSAR:
        print(f'assando {nome} ({res}px, {AMOSTRAS} amostras)…', flush=True)
        bpy.ops.object.bake(type='COMBINED', pass_filter={'EMIT', 'DIRECT', 'INDIRECT', 'DIFFUSE'}, margin=6, use_clear=True)
    img.filepath_raw = os.path.join(pasta, f'{nome}.jpg'); img.file_format = 'JPEG'
    cena.render.image_settings.quality = 88
    img.save()
    # material final: só a textura assada
    m = bpy.data.materials.new(f'{nome}_assado'); m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']; it = m.node_tree.nodes.new('ShaderNodeTexImage'); it.image = img
    m.node_tree.links.new(it.outputs['Color'], bs.inputs['Base Color'])
    o.data.materials.clear(); o.data.materials.append(m)

bpy.ops.object.select_all(action='DESELECT')
for nome in list(ATLAS) + ['vidro']:
    o = bpy.data.objects.get(nome)
    if o: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(pasta, 'salao.glb'), export_format='GLB', use_selection=True,
                          export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=True)
if opt.get('blend'): bpy.ops.wm.save_as_mainfile(filepath=opt['blend'])
print('ok', pasta)
