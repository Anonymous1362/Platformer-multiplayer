"""Material library. Colours always come from the active look (studio/looks.py) or a character's design
sheet; roughness and wear recipes are fixed here so every asset shares one material language
(spec 9.1: one consistent roughness/specular language)."""

import bpy

from .stage import lin


class Graph:
    """Small helper over a material node tree."""

    def __init__(self, mat):
        self.nt = mat.node_tree
        self.nodes = self.nt.nodes
        self.links = self.nt.links

    def node(self, kind, **props):
        n = self.nodes.new(kind)
        for key, value in props.items():
            setattr(n, key, value)
        return n

    def link(self, out, inp):
        self.links.new(out, inp)

    def math(self, op, a, b=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        self._feed(n.inputs[0], a)
        if b is not None:
            self._feed(n.inputs[1], b)
        return n.outputs[0]

    def mad(self, a, b, c):
        """a * b + c"""
        n = self.node('ShaderNodeMath', operation='MULTIPLY_ADD')
        for socket, value in zip(n.inputs, (a, b, c)):
            self._feed(socket, value)
        return n.outputs[0]

    def gray(self, value):
        """A float as an RGB colour (for multiplying colours by a scalar map)."""
        n = self.node('ShaderNodeCombineColor')
        for s in ('Red', 'Green', 'Blue'):
            self._feed(n.inputs[s], value)
        return n.outputs[0]

    def mix(self, fac, a, b, blend='MIX'):
        """RGBA mix (ShaderNodeMix); sockets picked by type because names repeat across types."""
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        ins = [s for s in n.inputs if s.type == 'RGBA']
        self._feed(n.inputs['Factor'], fac)
        self._feed(ins[0], a)
        self._feed(ins[1], b)
        out = [s for s in n.outputs if s.type == 'RGBA'][0]
        return out

    def ramp(self, fac, stops):
        """ColorRamp from (position, hex) stops."""
        n = self.node('ShaderNodeValToRGB')
        els = n.color_ramp.elements
        while len(els) < len(stops):
            els.new(0.5)
        for el, (pos, color) in zip(els, stops):
            el.position = pos
            el.color = (*lin(color), 1.0)
        self._feed(n.inputs['Fac'], fac)
        return n.outputs['Color']

    def noise(self, scale, detail=6.0, roughness=0.55, coord=None, w=None):
        n = self.node('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = roughness
        if coord is not None:
            self.link(coord, n.inputs['Vector'])
        return n.outputs['Fac']

    def _feed(self, socket, value):
        if hasattr(value, 'is_output'):
            self.link(value, socket)
        elif isinstance(value, str):
            socket.default_value = (*lin(value), 1.0)
        else:
            socket.default_value = value


def new(name):
    mat = bpy.data.materials.new(name)
    return mat, Graph(mat), mat.node_tree.nodes['Principled BSDF']


def obj_coord(g):
    return g.node('ShaderNodeTexCoord').outputs['Object']


def cracks(g, co, scale, width, warp=0.35):
    """Crack mask (1 on a crack, 0 elsewhere): warped Voronoi cell edges, so cracks wander like real ones."""
    wn = g.node('ShaderNodeTexNoise')
    wn.inputs['Scale'].default_value = scale * 0.8
    wn.inputs['Detail'].default_value = 3.0
    g.link(co, wn.inputs['Vector'])
    offset = g.node('ShaderNodeVectorMath', operation='SCALE')
    g.link(wn.outputs['Color'], offset.inputs[0])
    offset.inputs['Scale'].default_value = warp / scale
    warped = g.node('ShaderNodeVectorMath', operation='ADD')
    g.link(co, warped.inputs[0])
    g.link(offset.outputs[0], warped.inputs[1])
    vor = g.node('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE')
    vor.inputs['Scale'].default_value = scale
    g.link(warped.outputs[0], vor.inputs['Vector'])
    edge = g.node('ShaderNodeMapRange', clamp=True)
    edge.inputs['From Min'].default_value = 0.0
    edge.inputs['From Max'].default_value = width
    edge.inputs['To Min'].default_value = 1.0
    edge.inputs['To Max'].default_value = 0.0
    g.link(vor.outputs['Distance'], edge.inputs['Value'])
    return edge.outputs['Result']


def rock(name, a, b, top, top_amount=0.8, strata=0.25, scale=0.7, bump=0.35, crack=False, lichen=None):
    """Two-tone rock with lighter walkable tops (readability: platform tops are lit) and strata bands.
    `crack` adds two scales of wandering cracks (darkened and recessed); `lichen` (hex) adds sparse dark
    growth patches on the tops that stay darker than the lit top but never hide it."""
    mat, g, bsdf = new(name)
    co = obj_coord(g)
    tone = g.ramp(g.noise(scale, 8.0, 0.62, co), [(0.3, a), (0.7, b)])
    wave = g.node('ShaderNodeTexWave', wave_type='BANDS', bands_direction='Z')
    wave.inputs['Scale'].default_value = 1.6
    wave.inputs['Distortion'].default_value = 6.0
    wave.inputs['Detail'].default_value = 3.0
    g.link(co, wave.inputs['Vector'])
    band = g.mad(wave.outputs['Fac'], strata, 1.0 - strata)
    banded = g.mix(1.0, tone, g.gray(band), 'MULTIPLY')
    normal_z = g.node('ShaderNodeSeparateXYZ')
    g.link(g.node('ShaderNodeNewGeometry').outputs['Normal'], normal_z.inputs[0])
    up = g.node('ShaderNodeMapRange')
    up.inputs['From Min'].default_value = 0.55
    up.inputs['From Max'].default_value = 0.92
    g.link(normal_z.outputs['Z'], up.inputs['Value'])
    patches = g.math('MULTIPLY_ADD', g.noise(scale * 2.2, 4.0, 0.6, co), 1.4)
    g.nodes[patches.node.name].inputs[2].default_value = -0.25
    up_fac = g.math('MULTIPLY', g.math('MULTIPLY', up.outputs['Result'], top_amount), patches, clamp=True)
    color = g.mix(up_fac, banded, top)
    height = g.noise(scale * 7, 10.0, 0.7, co)
    if lichen:
        patch = g.node('ShaderNodeMapRange', clamp=True)
        patch.inputs['From Min'].default_value = 0.56
        patch.inputs['From Max'].default_value = 0.66
        g.link(g.noise(2.2, 5.0, 0.6, co), patch.inputs['Value'])
        cover = g.math('MULTIPLY', g.math('MULTIPLY', patch.outputs['Result'], up.outputs['Result']), 0.7)
        color = g.mix(cover, color, lichen)
    if crack:
        big = cracks(g, co, 1.1, 0.035)
        fine_mask = g.node('ShaderNodeMapRange', clamp=True)
        fine_mask.inputs['From Min'].default_value = 0.45
        fine_mask.inputs['From Max'].default_value = 0.6
        g.link(g.noise(1.3, 2.0, 0.5, co), fine_mask.inputs['Value'])
        fine = g.math('MULTIPLY', cracks(g, co, 3.4, 0.022), fine_mask.outputs['Result'])
        crack_all = g.math('MAXIMUM', big, g.math('MULTIPLY', fine, 0.8))
        color = g.mix(g.math('MULTIPLY', crack_all, 0.8), color, '#050505')
        height = g.mad(crack_all, -1.6, height)
    g.link(color, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.88
    bump_n = g.node('ShaderNodeBump')
    bump_n.inputs['Strength'].default_value = bump
    bump_n.inputs['Distance'].default_value = 0.08
    g.link(height, bump_n.inputs['Height'])
    g.link(bump_n.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def hull(name, color, rough=0.5, metal=0.45, plate_scale=0.45, plate_var=0.22, scorch=None):
    """Ship hull: plating read as patchy panel tones (Voronoi cells, about 2 m) that survives distance,
    soft dirt, and optional scorch (hex) rising from the bottom."""
    mat, g, bsdf = new(name)
    co = obj_coord(g)
    cells = g.node('ShaderNodeTexVoronoi', feature='F1')
    cells.inputs['Scale'].default_value = plate_scale
    g.link(co, cells.inputs['Vector'])
    tone = g.node('ShaderNodeSeparateColor')
    g.link(cells.outputs['Color'], tone.inputs[0])
    var = g.mad(tone.outputs['Red'], plate_var * 2, 1.0 - plate_var)
    col = g.mix(1.0, color, g.gray(var), 'MULTIPLY')
    dirt = g.mad(g.noise(1.4, 6.0, 0.6, co), 0.5, 0.75)
    col = g.mix(1.0, col, g.gray(dirt), 'MULTIPLY')
    if scorch:
        burn = g.node('ShaderNodeMapRange', clamp=True)
        burn.inputs['From Min'].default_value = 0.4
        burn.inputs['From Max'].default_value = 0.75
        g.link(g.noise(0.35, 4.0, 0.6, co), burn.inputs['Value'])
        col = g.mix(g.math('MULTIPLY', burn.outputs['Result'], 0.85), col, scorch)
    g.link(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return mat


def crystal(name, base, glow, emit, edge=None, invert=False, rough=0.1, per_object=False):
    """Faceted crystal: dark-ish glassy body, light at the edges (fresnel), glow toward the tips. With
    `per_object`, emission is scaled by the object's `glow` property (see shapes.crystal_cluster)."""
    mat, g, bsdf = new(name)
    bsdf.inputs['Base Color'].default_value = (*lin(base), 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Coat Weight'].default_value = 0.7
    bsdf.inputs['Coat Roughness'].default_value = 0.05
    bsdf.inputs['Specular IOR Level'].default_value = 0.7
    bsdf.inputs['Subsurface Weight'].default_value = 0.15
    bsdf.inputs['Emission Color'].default_value = (*lin(glow), 1.0)
    gen = g.node('ShaderNodeSeparateXYZ')
    g.link(g.node('ShaderNodeTexCoord').outputs['Generated'], gen.inputs[0])
    z = gen.outputs['Z']
    if invert:
        z = g.math('SUBTRACT', 1.0, z)
    tip = g.math('POWER', z, 2.4)
    fres = g.node('ShaderNodeLayerWeight')
    fres.inputs['Blend'].default_value = 0.35
    edge_glow = g.mad(fres.outputs['Facing'], 0.6, 0.4)
    co = obj_coord(g)
    veins = g.mad(g.noise(1.6, 6.0, 0.65, co), 1.6, -0.35)
    strength = g.math('MULTIPLY', g.math('MULTIPLY', g.math('MULTIPLY', tip, edge_glow), emit), veins)
    if per_object:
        attr = g.node('ShaderNodeAttribute', attribute_type='OBJECT', attribute_name='glow')
        strength = g.math('MULTIPLY', strength, attr.outputs['Fac'])
    g.link(strength, bsdf.inputs['Emission Strength'])
    body = g.mix(g.noise(0.9, 4.0, 0.6, co), base, g.mix(0.5, base, '#000000'))
    if edge:
        body = g.mix(g.math('MULTIPLY', fres.outputs['Facing'], 0.8), body, edge)
    g.link(body, bsdf.inputs['Base Color'])
    return mat


def surface(name, color, rough=0.5, metal=0.0, coat=0.0, variation=0.08, wear=None, ao=0.0, sheen=0.0,
            scale=6.0):
    """General hard surface: colour variation, optional lighter worn edges (pointiness) and darker
    crevices (ambient occlusion). Used for suits, hulls, props."""
    mat, g, bsdf = new(name)
    co = obj_coord(g)
    var = g.mad(g.noise(scale, 4.0, 0.5, co), variation * 2, 1.0 - variation)
    col = g.mix(1.0, color, g.gray(var), 'MULTIPLY')
    if wear:
        point = g.node('ShaderNodeNewGeometry').outputs['Pointiness']
        edge = g.node('ShaderNodeMapRange')
        edge.inputs['From Min'].default_value = 0.52
        edge.inputs['From Max'].default_value = 0.62
        g.link(point, edge.inputs['Value'])
        col = g.mix(g.math('MULTIPLY', edge.outputs['Result'], 0.8, clamp=True), col, wear)
    if ao > 0:
        occ = g.node('ShaderNodeAmbientOcclusion', samples=8)
        occ.inputs['Distance'].default_value = 0.08
        col = g.mix(1.0, col, g.gray(g.mad(occ.outputs['AO'], ao, 1.0 - ao)), 'MULTIPLY')
    g.link(col, bsdf.inputs['Base Color'])
    g.link(g.mad(g.noise(scale * 2.3, 3.0, 0.5, co), 0.2, rough - 0.1), bsdf.inputs['Roughness'])
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Coat Weight'].default_value = coat
    if sheen:
        bsdf.inputs['Sheen Weight'].default_value = sheen
    return mat


def glass(name, color, glow=None, glow_strength=0.0):
    """Visors and lenses: dark, glossy, coated."""
    mat, g, bsdf = new(name)
    bsdf.inputs['Base Color'].default_value = (*lin(color), 1.0)
    bsdf.inputs['Roughness'].default_value = 0.06
    bsdf.inputs['Coat Weight'].default_value = 1.0
    bsdf.inputs['Specular IOR Level'].default_value = 0.9
    if glow:
        bsdf.inputs['Emission Color'].default_value = (*lin(glow), 1.0)
        bsdf.inputs['Emission Strength'].default_value = glow_strength
    return mat


def emissive(name, color, strength):
    """Pure light (lamps, sensor eyes, thruster ports)."""
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*lin(color), 1.0)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return mat


def holdout(name='holdout'):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    hold = nt.nodes.new('ShaderNodeHoldout')
    nt.links.new(hold.outputs[0], out.inputs['Surface'])
    return mat
