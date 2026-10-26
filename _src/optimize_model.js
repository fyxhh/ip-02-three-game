/**
 * 小熊模型精简工具（Node 版）
 * 把 75MB 的高模（84 万顶点 + 3 张 4K 贴图）压成网页能秒开的小文件：
 *   1) 顶点聚类减面 —— 保留原始顶点，所以 UV 不错乱、贴图不会糊
 *   2) 只保留 baseColor 贴图并缩放到 1024
 *   3) 重新打包成单网格单材质的 bear.glb
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require(process.env.PNGJS_PATH || 'pngjs');

const SRC = 'C:\\Users\\jxgm\\Downloads\\c818535170c3070ffc6e93acd9ed869d (1).glb';
const DST = 'C:\\Users\\jxgm\\Desktop\\rolling-sky-game\\bear.glb';
const TEX_MAX = 1024;
const TARGET_VERTS = 26000;

/* ---------------- GLB 解析 ---------------- */
function readGLB(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('不是合法的 glb');
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const start = off + 8;
    if (type === 0x4e4f534a) json = JSON.parse(buf.slice(start, start + len).toString('utf8'));
    else if (type === 0x004e4942) bin = buf.slice(start, start + len);
    off = start + len + ((4 - (len % 4)) % 4);
  }
  return { json, bin };
}

const COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const CTOR = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

function readAccessor(json, bin, idx, forceFloat) {
  const a = json.accessors[idx];
  const bv = json.bufferViews[a.bufferView];
  const n = COMP[a.type];
  const Ctor = forceFloat ? Float32Array : CTOR[a.componentType];
  const byteOffset = (bv.byteOffset || 0) + (a.byteOffset || 0);
  return new Ctor(bin.buffer, bin.byteOffset + byteOffset, a.count * n);
}

/* ---------------- 主流程 ---------------- */
function main() {
  const { json, bin } = readGLB(SRC);
  const prim = json.meshes[0].primitives[0];
  const pos = readAccessor(json, bin, prim.attributes.POSITION, true);
  const uvAttr = prim.attributes.TEXCOORD_0;
  const uv = uvAttr !== undefined ? readAccessor(json, bin, uvAttr, true) : null;
  const tri = readAccessor(json, bin, prim.indices, false);
  console.log(`原始：顶点 ${(pos.length / 3).toLocaleString()}，三角面 ${(tri.length / 3).toLocaleString()}`);

  /* ---- ① 顶点聚类减面 ---- */
  let mnX = Infinity, mnY = Infinity, mnZ = Infinity;
  let mxX = -Infinity, mxY = -Infinity, mxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i] < mnX) mnX = pos[i]; if (pos[i] > mxX) mxX = pos[i];
    if (pos[i + 1] < mnY) mnY = pos[i + 1]; if (pos[i + 1] > mxY) mxY = pos[i + 1];
    if (pos[i + 2] < mnZ) mnZ = pos[i + 2]; if (pos[i + 2] > mxZ) mxZ = pos[i + 2];
  }
  const diag = Math.hypot(mxX - mnX, mxY - mnY, mxZ - mnZ);
  const vCount = pos.length / 3;

  let N = 460, cell = 0, inv = null, uniqCount = 0;
  for (; N >= 100; N = Math.floor(N * 0.8)) {
    cell = diag / N;
    const set = new Set();
    const map = new Int32Array(vCount);
    const sX = 1 / cell, sY = 1 / cell, sZ = 1 / cell;
    const B = N + 2;
    for (let i = 0, v = 0; i < pos.length; i += 3, v++) {
      const qx = Math.floor((pos[i] - mnX) * sX);
      const qy = Math.floor((pos[i + 1] - mnY) * sY);
      const qz = Math.floor((pos[i + 2] - mnZ) * sZ);
      const key = (qx * B + qy) * B + qz;
      if (!set.has(key)) set.add(key);
      map[v] = key;
    }
    if (set.size <= TARGET_VERTS * 1.5) {
      /* 再走一遍，把 key 映射成连续索引 */
      const idOf = new Map();
      inv = new Int32Array(vCount);
      for (let v = 0; v < vCount; v++) {
        const key = map[v];
        let id = idOf.get(key);
        if (id === undefined) { id = idOf.size; idOf.set(key, id); }
        inv[v] = id;
      }
      uniqCount = idOf.size;
      break;
    }
  }
  console.log(`聚类：网格 ${N}，顶点 ${uniqCount.toLocaleString()}`);

  /* 每个聚类保留第一个顶点（沿用它的 UV） */
  const first = new Int32Array(uniqCount).fill(-1);
  for (let v = vCount - 1; v >= 0; v--) first[inv[v]] = v;
  const remap = new Int32Array(vCount).fill(-1);
  let kept = 0;
  for (let i = 0; i < uniqCount; i++) if (first[i] >= 0) remap[first[i]] = kept++;

  const tCount = tri.length / 3;
  const outTri = new Uint32Array(tCount * 3);
  let nt = 0;
  for (let f = 0; f < tCount; f++) {
    const a = remap[tri[f * 3]], b = remap[tri[f * 3 + 1]], c = remap[tri[f * 3 + 2]];
    if (a < 0 || b < 0 || c < 0) continue;
    if (a === b || b === c || a === c) continue;
    outTri[nt * 3] = a; outTri[nt * 3 + 1] = b; outTri[nt * 3 + 2] = c;
    nt++;
  }
  const tris = outTri.slice(0, nt * 3);

  const outPos = new Float32Array(kept * 3);
  const outUv = uv ? new Float32Array(kept * 2) : null;
  for (let i = 0; i < uniqCount; i++) {
    const src = first[i]; if (src < 0) continue;
    const dst = remap[src];
    outPos[dst * 3] = pos[src * 3];
    outPos[dst * 3 + 1] = pos[src * 3 + 1];
    outPos[dst * 3 + 2] = pos[src * 3 + 2];
    if (outUv) { outUv[dst * 2] = uv[src * 2]; outUv[dst * 2 + 1] = uv[src * 2 + 1]; }
  }

  /* 重新计算法线（面积加权） */
  const nrm = new Float32Array(kept * 3);
  for (let f = 0; f < nt; f++) {
    const a = tris[f * 3], b = tris[f * 3 + 1], c = tris[f * 3 + 2];
    const ax = outPos[a * 3], ay = outPos[a * 3 + 1], az = outPos[a * 3 + 2];
    const e1x = outPos[b * 3] - ax, e1y = outPos[b * 3 + 1] - ay, e1z = outPos[b * 3 + 2] - az;
    const e2x = outPos[c * 3] - ax, e2y = outPos[c * 3 + 1] - ay, e2z = outPos[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const idx of [a, b, c]) {
      nrm[idx * 3] += nx; nrm[idx * 3 + 1] += ny; nrm[idx * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < kept; i++) {
    const x = nrm[i * 3], y = nrm[i * 3 + 1], z = nrm[i * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
  }
  console.log(`减面后：顶点 ${kept.toLocaleString()}，三角面 ${nt.toLocaleString()}`);

  /* ---- ② 贴图：只留 baseColor，缩放到 1024 ---- */
  const mat = json.materials[prim.material || 0] || {};
  const texIdx = (mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture)
    ? mat.pbrMetallicRoughness.baseColorTexture.index : null;
  let pngOut = null;
  if (texIdx !== null) {
    const imgIdx = json.textures[texIdx].source !== undefined ? json.textures[texIdx].source : texIdx;
    const bv = json.bufferViews[json.images[imgIdx].bufferView];
    const raw = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const img = PNG.sync.read(Buffer.from(raw));
    console.log(`贴图：${img.width}x${img.height}  解码完成`);
    const scale = Math.min(1, TEX_MAX / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const out = new PNG({ width: w, height: h });
    const bx = img.width / w, by = img.height / h;
    for (let y = 0; y < h; y++) {
      const y0 = Math.floor(y * by), y1 = Math.min(img.height, Math.floor((y + 1) * by));
      for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * bx), x1 = Math.min(img.width, Math.floor((x + 1) * bx));
        let r = 0, g = 0, b = 0, a = 0, cnt = 0;
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            const si = (img.width * sy + sx) << 2;
            r += img.data[si]; g += img.data[si + 1]; b += img.data[si + 2]; a += img.data[si + 3];
            cnt++;
          }
        }
        const di = (w * y + x) << 2;
        out.data[di] = r / cnt; out.data[di + 1] = g / cnt;
        out.data[di + 2] = b / cnt; out.data[di + 3] = a / cnt;
      }
    }
    pngOut = PNG.sync.write(out, { colorType: 6 });
    console.log(`贴图缩放：${w}x${h}  ${(pngOut.length / 1024).toFixed(0)} KB`);
  }

  /* ---- ③ 重新打包 GLB ---- */
  const parts = [], views = [];
  let byteOff = 0;
  function push(buf, target) {
    const b = Buffer.from(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf);
    const pad = (4 - (b.length % 4)) % 4;
    const padded = pad ? Buffer.concat([b, Buffer.alloc(pad)]) : b;
    const v = { buffer: 0, byteOffset: byteOff, byteLength: b.length };
    if (target) v.target = target;
    views.push(v);
    parts.push(padded);
    byteOff += padded.length;
    return views.length - 1;
  }
  const vPos = push(outPos, 34962);
  const vNrm = push(nrm, 34962);
  const vUv = outUv ? push(outUv, 34962) : null;
  const vIdx = push(tris, 34963);
  const vImg = pngOut ? push(pngOut) : null;

  const accessors = [];
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < kept; i++) for (let k = 0; k < 3; k++) {
    const v = outPos[i * 3 + k];
    if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  accessors.push({ bufferView: vPos, componentType: 5126, count: kept, type: 'VEC3', min: mn, max: mx });
  accessors.push({ bufferView: vNrm, componentType: 5126, count: kept, type: 'VEC3' });
  let uvAccIdx = null;
  if (vUv !== null) { uvAccIdx = accessors.length; accessors.push({ bufferView: vUv, componentType: 5126, count: kept, type: 'VEC2' }); }
  const idxAccIdx = accessors.length;
  accessors.push({ bufferView: vIdx, componentType: 5125, count: nt * 3, type: 'SCALAR' });

  const attributes = { POSITION: 0, NORMAL: 1 };
  if (uvAccIdx !== null) attributes.TEXCOORD_0 = uvAccIdx;

  const material = { name: 'bear', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.72 } };
  const gltf = {
    asset: { version: '2.0', generator: 'bear-optimizer' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'bear', rotation: [0.7071068, 0, 0, 0.7071068] }],
    meshes: [{ name: 'bear', primitives: [{ attributes, indices: idxAccIdx, material: 0 }] }],
    materials: [material],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: 0 }]
  };
  if (vImg !== null) {
    material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    gltf.textures = [{ sampler: 0, source: 0 }];
    gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
    gltf.images = [{ bufferView: vImg, mimeType: 'image/png', name: 'basecolor' }];
  }

  const binData = Buffer.concat(parts);
  gltf.buffers[0].byteLength = binData.length;
  let jsBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsPad = (4 - (jsBuf.length % 4)) % 4;
  if (jsPad) jsBuf = Buffer.concat([jsBuf, Buffer.alloc(jsPad, 0x20)]);

  const total = 12 + 8 + jsBuf.length + 8 + binData.length;
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;
  out.writeUInt32LE(jsBuf.length, o); o += 4;
  out.writeUInt32LE(0x4e4f534a, o); o += 4;
  jsBuf.copy(out, o); o += jsBuf.length;
  out.writeUInt32LE(binData.length, o); o += 4;
  out.writeUInt32LE(0x004e4942, o); o += 4;
  binData.copy(out, o);

  fs.writeFileSync(DST, out);
  console.log(`输出：${DST}  ${(out.length / 1024 / 1024).toFixed(2)} MB`);
}

main();
