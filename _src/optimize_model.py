# -*- coding: utf-8 -*-
"""
把 75MB 的高精度小熊模型（84 万顶点 + 3 张 4K 贴图）
精简成网页能秒开的小文件：
  1) 顶点聚类减面（保留 UV，贴图不会错乱）
  2) 只保留 baseColor 贴图，并缩放到 1024
  3) 重新打包成 bear.glb
"""
import json, struct, sys, io, os
import numpy as np
from PIL import Image

SRC = r"C:\Users\jxgm\Downloads\c818535170c3070ffc6e93acd9ed869d (1).glb"
DST = r"C:\Users\jxgm\Desktop\rolling-sky-game\bear.glb"
TEX_MAX = 1024          # 贴图最大边长
TARGET_VERTS = 45000    # 目标顶点数

def read_glb(path):
    with open(path, 'rb') as f:
        data = f.read()
    dv = memoryview(data)
    assert struct.unpack_from('<I', data, 0)[0] == 0x46546c67, '不是 glb'
    off, js, bin_off, bin_len = 12, None, None, None
    while off + 8 <= len(data):
        ln, ty = struct.unpack_from('<II', data, off)
        start = off + 8
        if ty == 0x4e4f534a:
            js = json.loads(data[start:start + ln].decode('utf-8'))
        elif ty == 0x004e4942:
            bin_off, bin_len = start, ln
        off = start + ln + ((4 - ln % 4) % 4)
    return js, data, bin_off, bin_len

def acc_array(js, data, bin_off, idx):
    a = js['accessors'][idx]
    bv = js['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    ct = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
    start = bin_off + (bv.get('byteOffset', 0)) + (a.get('byteOffset', 0))
    return np.frombuffer(data, dtype=np.dtype(ct), count=a['count'] * n, offset=start).reshape(-1, n)

def image_bytes(js, data, bin_off, img_idx):
    img = js['images'][img_idx]
    bv = js['bufferViews'][img['bufferView']]
    start = bin_off + bv.get('byteOffset', 0)
    return data[start:start + bv['byteLength']]

def compute_normals(pos, tris):
    n = np.zeros_like(pos, dtype=np.float32)
    v0 = pos[tris[:, 0]]; v1 = pos[tris[:, 1]]; v2 = pos[tris[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1.0
    return (n / ln).astype(np.float32)

def main():
    js, data, bin_off, bin_len = read_glb(SRC)
    prim = js['meshes'][0]['primitives'][0]
    pos = acc_array(js, data, bin_off, prim['attributes']['POSITION']).astype(np.float32)
    uv = acc_array(js, data, bin_off, prim['attributes']['TEXCOORD_0']).astype(np.float32) \
        if 'TEXCOORD_0' in prim['attributes'] else None
    tris = acc_array(js, data, bin_off, prim['indices']).astype(np.int64).reshape(-1, 3)
    print(f'原始：顶点 {len(pos):,}  三角面 {len(tris):,}')

    # ---------- 顶点聚类减面（保留原始顶点 => UV 不错乱） ----------
    mn = pos.min(axis=0)
    diag = float(np.linalg.norm(pos.max(axis=0) - mn))
    best = None
    N = 420
    while N >= 120:
        cell = diag / N
        q = np.floor((pos - mn) / cell).astype(np.int64)
        uniq, inv = np.unique(q, axis=0, return_inverse=True)
        if len(uniq) <= TARGET_VERTS * 1.6:
            best = (inv, len(uniq), cell)
            break
        N = int(N * 0.75)
    inv, nv, cell = best
    print(f'聚类：网格 {N}  顶点 {nv:,}')

    first = np.full(nv, -1, dtype=np.int64)
    order = np.arange(len(pos))
    first[inv[::-1]] = order[::-1]          # 每个格子保留第一个顶点
    keep = first[first >= 0]
    remap = np.full(len(pos), -1, dtype=np.int64)
    remap[keep] = np.arange(len(keep))

    t = remap[tris]
    ok = (t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2]) & (t >= 0).all(axis=1)
    t = t[ok]
    new_pos = pos[keep].astype(np.float32)
    new_uv = uv[keep].astype(np.float32) if uv is not None else None
    new_nrm = compute_normals(new_pos, t)
    print(f'减面后：顶点 {len(new_pos):,}  三角面 {len(t):,}')

    # ---------- 贴图：只保留 baseColor，并缩放 ----------
    mat = js['materials'][prim.get('material', 0)]
    tex_idx = (mat.get('pbrMetallicRoughness', {}).get('baseColorTexture') or {}).get('index')
    img_idx = js['textures'][tex_idx]['source'] if tex_idx is not None else None
    png_out = None
    if img_idx is not None:
        raw = image_bytes(js, data, bin_off, img_idx)
        im = Image.open(io.BytesIO(raw)).convert('RGBA')
        im.thumbnail((TEX_MAX, TEX_MAX), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format='PNG', optimize=True)
        png_out = buf.getvalue()
        print(f'贴图：{im.size[0]}x{im.size[1]}  {len(png_out)/1024:.0f} KB')

    # ---------- 重新打包 GLB ----------
    chunks = []
    bin_parts, byte_off, views = [], 0, []

    def push(arr, target=None):
        nonlocal byte_off
        a = np.ascontiguousarray(arr, dtype=arr.dtype)
        b = a.tobytes()
        pad = (4 - len(b) % 4) % 4
        bin_parts.append(b + b'\x00' * pad)
        views.append({'buffer': 0, 'byteOffset': byte_off, 'byteLength': len(b),
                      **({'target': target} if target else {})})
        byte_off += len(b) + pad
        return len(views) - 1

    v_pos = push(new_pos, 34962)
    v_nrm = push(new_nrm, 34962)
    v_uv = push(new_uv, 34962) if new_uv is not None else None
    v_idx = push(t.astype(np.uint32).reshape(-1), 34963)
    v_img = None
    if png_out:
        v_img = push(np.frombuffer(png_out, dtype=np.uint8))

    def acc(bv, comp_type, type_str, count, minmax=None):
        d = {'bufferView': bv, 'componentType': comp_type, 'count': count, 'type': type_str}
        if minmax: d['min'], d['max'] = minmax
        return d

    accessors = [
        acc(v_pos, 5126, 'VEC3', len(new_pos), [new_pos.min(axis=0).tolist(), new_pos.max(axis=0).tolist()]),
        acc(v_nrm, 5126, 'VEC3', len(new_nrm)),
        acc(v_uv, 5126, 'VEC2', len(new_uv)) if v_uv is not None else None,
        acc(v_idx, 5125, 'SCALAR', len(t) * 3),
    ]
    accessors = [a for a in accessors if a]
    attrs = {'POSITION': 0, 'NORMAL': 1}
    if v_uv is not None: attrs['TEXCOORD_0'] = 2
    idx_acc = len(accessors) - 1

    material = {'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.72}, 'name': 'bear'}
    images = textures = None
    if v_img is not None:
        material['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0}
        images = [{'bufferView': v_img, 'mimeType': 'image/png', 'name': 'basecolor'}]
        textures = [{'sampler': 0, 'source': 0}]

    gltf = {
        'asset': {'version': '2.0', 'generator': 'bear-optimizer'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'bear', 'rotation': [0.7071068, 0, 0, 0.7071068]}],
        'meshes': [{'name': 'bear', 'primitives': [{'attributes': attrs, 'indices': idx_acc, 'material': 0}]}],
        'materials': [material],
        'accessors': accessors,
        'bufferViews': views,
        'buffers': [{'byteLength': 0}],
    }
    if textures:
        gltf['textures'] = textures
        gltf['images'] = images
        gltf['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]

    bin_data = b''.join(bin_parts)
    gltf['buffers'][0]['byteLength'] = len(bin_data)
    js_bytes = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    js_pad = b' ' * ((4 - len(js_bytes) % 4) % 4)
    js_bytes += js_pad
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_data)
    out = bytearray()
    out += struct.pack('<III', 0x46546c67, 2, total)
    out += struct.pack('<II', len(js_bytes), 0x4e4f534a); out += js_bytes
    out += struct.pack('<II', len(bin_data), 0x004e4942); out += bin_data
    with open(DST, 'wb') as f:
        f.write(out)
    print(f'输出：{DST}  {len(out)/1024/1024:.2f} MB')

if __name__ == '__main__':
    main()
