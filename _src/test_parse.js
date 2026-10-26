/**
 * 冒烟测试：在 Node 里加载 three.js 内核 + 运行游戏里的 GLB 解析函数，
 * 验证 bear.glb 能被正确读出顶点 / 法线 / UV / 索引（贴图部分只做桩测试）。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = path.dirname(__dirname);
/* 去掉开头的 <script> 标签（只有浏览器需要） */
const bundle = fs.readFileSync(path.join(BASE, '_src', 'three-bundle.js'), 'utf8')
  .replace(/^\s*<script>\s*/, '');
const gameJs = fs.readFileSync(path.join(BASE, '_src', 'game.js'), 'utf8');

/* --- 极简浏览器环境桩 --- */
const sandbox = {
  console,
  TextDecoder, Uint8Array, Float32Array, Uint32Array, Int32Array, ArrayBuffer, DataView,
  Blob: class Blob { constructor(parts, opt) { this.parts = parts; this.type = opt && opt.type; } },
  URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} },
  Image: class { set src(v) { this._src = v; } },
  document: {
    createElement: () => ({ style: {}, width: 0, height: 0, getContext: () => null }),
    createElementNS: () => ({ style: {}, getContext: () => null }),
    addEventListener: () => {},
    getElementById: () => null,
    body: { appendChild: () => {}, classList: { add: () => {}, remove: () => {} } }
  },
  requestAnimationFrame: () => 0,
  performance: { now: () => 0 },
  setTimeout, clearTimeout, setInterval, clearInterval
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

/* --- 加载 three.js --- */
vm.runInContext(bundle, sandbox, { filename: 'three-bundle.js' });
const THREE = sandbox.window.__THREE;
if (!THREE) { console.error('three.js 未导出 __THREE'); process.exit(1); }
console.log('three.js 版本: r' + THREE.REVISION);

/* --- 取出游戏里的 parseGLB / fitBear 函数 --- */
const start = gameJs.indexOf('function parseGLB');
const end = gameJs.indexOf('function setBear');
const code = gameJs.slice(start, end);
vm.runInContext('const THREE = window.__THREE;\n' + code, sandbox, { filename: 'parseGLB' });

/* --- 解析真实的 bear.glb --- */
const buf = fs.readFileSync(path.join(BASE, 'bear.glb'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const result = vm.runInContext('parseGLB(__glbBuffer)', Object.assign(sandbox, { __glbBuffer: ab }));

const geo = result.geo;
const pos = geo.getAttribute('position');
const nrm = geo.getAttribute('normal');
const uv = geo.getAttribute('uv');
const idx = geo.getIndex();
console.log('顶点数:', pos ? pos.count : '无');
console.log('法线数:', nrm ? nrm.count : '无');
console.log('UV 数 :', uv ? uv.count : '无');
console.log('索引数:', idx ? idx.count : '无', '(三角面', idx ? idx.count / 3 : 0, ')');
console.log('贴图  :', result.tex ? '有' : '无');

geo.computeBoundingBox();
const b = geo.boundingBox;
const size = { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
console.log('包围盒尺寸:', Object.values(size).map(v => v.toFixed(2)).join(' x '));

if (!pos || pos.count === 0) { console.error('❌ 解析失败：没有顶点'); process.exit(1); }
if (!idx || idx.count === 0) { console.error('❌ 解析失败：没有索引'); process.exit(1); }
if (!uv) console.warn('⚠️ 没有 UV，贴图可能显示不出来');
if (size.y < 0.01) console.warn('⚠️ 模型高度异常（可能是坐标未正确转换）');
console.log('✅ GLB 解析测试通过');
