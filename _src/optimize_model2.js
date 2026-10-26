/**
 * 小熊模型精简（meshoptimizer 版）
 * 原文件 75MB：84 万顶点 / 150 万三角面 / 3 张 4096 贴图
 * 目标：几十 KB~几 MB，且贴图 UV 不错乱
 *  1) weld 焊接重复顶点
 *  2) simplify 二次误差减面（保留 UV / 法线）
 *  3) 只保留 baseColor 贴图，并缩放到 1024
 */
const fs = require('fs');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { weld, simplify, prune } = require('@gltf-transform/functions');
const { MeshoptSimplifier } = require('meshoptimizer');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const SRC = 'C:\\Users\\jxgm\\Downloads\\c818535170c3070ffc6e93acd9ed869d (1).glb';
const DST = 'C:\\Users\\jxgm\\Desktop\\rolling-sky-game\\bear.glb';
const TEX_MAX = 1024;
const TRI_RATIO = 0.020;   // 保留 2% 的三角面（约 3 万面，手机流畅）
const ERROR = 0.0015;      // 允许的形变误差

/** PNG 解码 → 缩放 → JPEG 编码（JPEG 对照片类贴图压缩率高很多） */
function resizeToJpeg(buf, max) {
  const img = PNG.sync.read(Buffer.from(buf));
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const rgba = new Uint8Array(w * h * 4);
  const bx = img.width / w, by = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * by), y1 = Math.max(y0 + 1, Math.min(img.height, Math.floor((y + 1) * by)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * bx), x1 = Math.max(x0 + 1, Math.min(img.width, Math.floor((x + 1) * bx)));
      let r = 0, g = 0, b = 0, c = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const si = (img.width * sy + sx) << 2;
        r += img.data[si]; g += img.data[si + 1]; b += img.data[si + 2]; c++;
      }
      const di = (w * y + x) << 2;
      rgba[di] = r / c; rgba[di + 1] = g / c; rgba[di + 2] = b / c; rgba[di + 3] = 255;
    }
  }
  const out = jpeg.encode({ data: rgba, width: w, height: h }, 82);
  return { data: out.data, size: `${w}x${h}` };
}

(async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(SRC);
  const root = doc.getRoot();

  /* ---- ① 只保留 baseColor 贴图，并缩放 ---- */
  for (const mat of root.listMaterials()) {
    mat.setNormalTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setOcclusionTexture(null);
    mat.setEmissiveTexture(null);
    mat.setMetallicFactor(0).setRoughnessFactor(0.72);
    const t = mat.getBaseColorTexture();
    if (t) {
      const raw = t.getImage();
      if (raw) {
        const r = resizeToJpeg(raw, TEX_MAX);
        t.setImage(r.data).setMimeType('image/jpeg');
        console.log(`贴图缩放：${r.size}  ${(r.data.length / 1024).toFixed(0)} KB`);
      }
    }
  }

  /* ---- ② 焊接 + 减面 ---- */
  let before = 0;
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    before += (prim.getIndices() ? prim.getIndices().getCount() : prim.getAttribute('POSITION').getCount()) / 3;
  }
  console.log(`原始三角面：${Math.round(before).toLocaleString()}`);

  await doc.transform(prune(), weld());
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: TRI_RATIO, error: ERROR }));
  await doc.transform(prune());

  let after = 0, verts = 0;
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    after += (prim.getIndices() ? prim.getIndices().getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    verts += prim.getAttribute('POSITION').getCount();
  }
  console.log(`减面后三角面：${Math.round(after).toLocaleString()}  顶点：${verts.toLocaleString()}`);

  /* ---- ③ 导出 ---- */
  await io.write(DST, doc);
  const size = fs.statSync(DST).size;
  console.log(`输出：${DST}  ${(size / 1024 / 1024).toFixed(2)} MB`);
})().catch(e => { console.error('失败：', e); process.exit(1); });
