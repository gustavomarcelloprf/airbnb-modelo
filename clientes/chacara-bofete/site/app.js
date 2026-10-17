import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as D from './dados.js';

const MOBILE = matchMedia('(pointer: coarse)').matches;
const $ = (id) => document.getElementById(id);
const deg = THREE.MathUtils.degToRad;

// ============================================================
// Coordenadas
// ============================================================
const MPP = D.MAPA.metrosPorPixel;
const aerea = ([px, py]) => new THREE.Vector2((px - D.MAPA.largura / 2) * MPP, (py - D.MAPA.altura / 2) * MPP);
const mundoParaAerea = (x, z) => [x / MPP + D.MAPA.largura / 2, z / MPP + D.MAPA.altura / 2];
// rotação.y para que o eixo Z local aponte para (dx, dz)
const rotEixoZ = ([dx, dz]) => Math.atan2(dx, dz);
// rotação.y para que o eixo X local aponte para (dx, dz)
const rotEixoX = ([dx, dz]) => Math.atan2(-dz, dx);

// ============================================================
// Ruído
// ============================================================
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function ruido(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * ruido(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
let semente = 7;
const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };

// ============================================================
// Renderer, cena, câmera
// ============================================================
const palco = $('palco');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, MOBILE ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
palco.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;

const cena = new THREE.Scene();
const NEBLINA = new THREE.Color(0xb3bfcc);
cena.fog = new THREE.Fog(NEBLINA, 260, 2300);
cena.background = NEBLINA.clone();

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 30000);
camera.position.set(-68, 38, 110);

const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.maxPolarAngle = deg(84);
controles.minDistance = 6;
controles.maxDistance = 260;
controles.target.set(6, 0, 14);
controles.autoRotate = true;
controles.autoRotateSpeed = 0.35;
controles.addEventListener('start', () => { controles.autoRotate = false; });

// ---- carregamento ----
const gerente = new THREE.LoadingManager();
gerente.onProgress = (_u, feitos, total) => { $('carregando').textContent = `carregando materiais · ${Math.round((feitos / total) * 100)}%`; };
gerente.onLoad = () => {
  renderer.shadowMap.needsUpdate = true;
  $('abertura').style.opacity = '0';
  setTimeout(() => ($('abertura').hidden = true), 700);
};
const carregador = new THREE.TextureLoader(gerente);
const ANISO = renderer.capabilities.getMaxAnisotropy();
const cacheTex = new Map();
// carrega uma textura; `metros` é quantos metros uma repetição cobre (para UV em metros)
function tx(url, { cor = true, rep = [1, 1] } = {}) {
  let base = cacheTex.get(url);
  if (!base) {
    base = carregador.load(url);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = ANISO;
    base.userData.url = url;
    if (cor) base.colorSpace = THREE.SRGBColorSpace;
    cacheTex.set(url, base);
  }
  const t = base.clone();
  t.repeat.set(rep[0], rep[1]);
  return t;
}

// ---- céu fotográfico (HDRI) e sol ----
const luzSol = new THREE.DirectionalLight(0xfff2df, 3.0);
luzSol.castShadow = true;
luzSol.shadow.mapSize.setScalar(MOBILE ? 2048 : 4096);
Object.assign(luzSol.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 10, far: 450 });
luzSol.shadow.bias = -0.0003;
luzSol.shadow.normalBias = 0.04;
luzSol.position.set(-60, 120, -80);
cena.add(luzSol);
const luzCeu = new THREE.HemisphereLight(0xdde8f5, 0x5d6a3c, 0.25);
cena.add(luzCeu);
cena.environmentIntensity = 0.85;

const pmrem = new THREE.PMREMGenerator(renderer);
// HDRI publicado como base64 em .txt (o host não serve .hdr)
gerente.itemStart('img/ceu_hdr.txt');
fetch('img/ceu_hdr.txt').then((r) => r.text()).then((b64) => {
  const bin = Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));
  const rgbe = new HDRLoader().setDataType(THREE.FloatType).parse(bin.buffer);
  const hdr = new THREE.DataTexture(rgbe.data, rgbe.width, rgbe.height, THREE.RGBAFormat, THREE.FloatType);
  Object.assign(hdr, { flipY: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, colorSpace: THREE.LinearSRGBColorSpace, needsUpdate: true });
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  cena.environment = pmrem.fromEquirectangular(hdr).texture;
  // posição do sol = pixel mais brilhante do HDRI
  const { data, width: W, height: H } = hdr.image;
  let max = 0, mi = 0;
  for (let i = 0; i < W * H; i++) { const l = data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]; if (l > max) { max = l; mi = i; } }
  const col = mi % W, lin = Math.floor(mi / W);
  const u = (col + 0.5) / W, v = 1 - (lin + 0.5) / H;
  const phi = (u - 0.5) * Math.PI * 2, theta = (v - 0.5) * Math.PI;
  const dir = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
  if (dir.y < 0.25) dir.y = 0.25;
  luzSol.position.copy(dir.normalize()).multiplyScalar(220);
  renderer.shadowMap.needsUpdate = true;
}).catch((e) => console.warn('céu HDR indisponível', e)).finally(() => gerente.itemEnd('img/ceu_hdr.txt'));
const fundoCeu = carregador.load('img/ceu.jpg', (t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; cena.background = t; });

// ============================================================
// Texturas
// ============================================================
// texturas de fotos/paletas da chácara (img/tex) e PBR CC0 (img/pbr)
const T = {
  grama: (r) => tx('img/pbr/grama.jpg', { rep: r }),
  gramaN: (r) => tx('img/pbr/grama_n.jpg', { cor: false, rep: r }),
  gramaR: (r) => tx('img/pbr/grama_r.jpg', { cor: false, rep: r }),
  deck: (r) => tx('img/pbr/deck.jpg', { rep: r }), deckN: (r) => tx('img/pbr/deck_n.jpg', { cor: false, rep: r }),
  forro: (r) => tx('img/pbr/forro.jpg', { rep: r }), forroN: (r) => tx('img/pbr/forro_n.jpg', { cor: false, rep: r }),
  telhaN: (r) => tx('img/pbr/telha_n.jpg', { cor: false, rep: r }), telhaR: (r) => tx('img/pbr/telha_r.jpg', { cor: false, rep: r }),
  rebocoN: (r) => tx('img/pbr/reboco_n.jpg', { cor: false, rep: r }),
  areia: (r) => tx('img/pbr/areia.jpg', { rep: r }), areiaN: (r) => tx('img/pbr/areia_n.jpg', { cor: false, rep: r }),
  tecidoN: (r) => tx('img/pbr/tecido_n.jpg', { cor: false, rep: r }),
  solario: (r) => tx('img/tex/solario.jpg', { rep: r }), solarioN: (r) => tx('img/tex/solario_n.jpg', { cor: false, rep: r }),
  porcelanato: (r) => tx('img/tex/porcelanato.jpg', { rep: r }),
  ardosia: (r) => tx('img/tex/ardosia.jpg', { rep: r }),
  pisoSalao: (r) => tx('img/tex/piso_salao.jpg', { rep: r }),
  pedra: (r) => tx('img/tex/pedra.jpg', { rep: r }), pedraN: (r) => tx('img/tex/pedra_n.jpg', { cor: false, rep: r }),
  pastilha: (r) => tx('img/tex/pastilha.jpg', { rep: r }),
  saoTome: (r) => tx('img/tex/sao_tome.jpg', { rep: r }),
  sape: (r) => tx('img/tex/sape.jpg', { rep: r }),
  sapeFranja: (r) => tx('img/tex/sape_franja.png', { rep: r }),
  copa: () => tx('img/tex/copa.png'),
  jeriva: () => tx('img/tex/jeriva.png'),
  leque: () => tx('img/tex/leque.png'),
  cica: () => tx('img/tex/cica.png'),
};

function texCanvas(tam, desenha, repete = [1, 1], cor = true) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  desenha(c.getContext('2d'), tam);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repete);
  t.anisotropy = ANISO;
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ceramicaBanho = texCanvas(256, (g, s) => {
  g.fillStyle = '#eceae6'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#cfcac2'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke(); }
});
const redeTex = texCanvas(128, (g, s) => {
  g.clearRect(0, 0, s, s);
  g.strokeStyle = 'rgba(40,46,44,1)'; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * s / 8, 0); g.lineTo(i * s / 8 + s / 8, s); g.stroke();
    g.beginPath(); g.moveTo(i * s / 8, 0); g.lineTo(i * s / 8 - s / 8, s); g.stroke();
  }
});
// textura de cerca-viva: folhas da copa sobre fundo verde-escuro
const sebeCanvas = document.createElement('canvas');
sebeCanvas.width = sebeCanvas.height = 512;
const sebeTex = new THREE.CanvasTexture(sebeCanvas);
sebeTex.wrapS = sebeTex.wrapT = THREE.RepeatWrapping; sebeTex.colorSpace = THREE.SRGBColorSpace; sebeTex.anisotropy = ANISO;
{
  const g = sebeCanvas.getContext('2d');
  g.fillStyle = '#2c4519'; g.fillRect(0, 0, 512, 512);
  const img = new Image();
  img.onload = () => {
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 512 - 128, y = rnd() * 512 - 128, s = 180 + rnd() * 120;
      for (const ox of [0, 512]) for (const oy of [0, 512]) g.drawImage(img, x - ox + (x < 0 ? 512 : 0), y - oy + (y < 0 ? 512 : 0), s, s);
    }
    sebeTex.needsUpdate = true;
  };
  img.src = 'img/tex/copa.png';
}

// normal map da água (ondulações)
const aguaNormal = (() => {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), img = g.createImageData(s, s);
  const h = (x, y) => fbm(x / 22, y / 22, 3) * 2 + Math.sin((x + y) / 9) * 0.15;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = h((x + 1) % s, y) - h((x - 1 + s) % s, y), dy = h(x, (y + 1) % s) - h(x, (y - 1 + s) % s);
    const v = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize(), i = (y * s + x) * 4;
    img.data[i] = (v.x * 0.5 + 0.5) * 255; img.data[i + 1] = (v.y * 0.5 + 0.5) * 255; img.data[i + 2] = (v.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

// ============================================================
// Materiais
// ============================================================
const std = (o) => new THREE.MeshStandardMaterial(o);
const tecido = (cor) => std({ color: cor, roughness: 0.95, normalMap: T.tecidoN([3, 3]), normalScale: new THREE.Vector2(0.6, 0.6) });
const M = {
  paredeInt: std({ color: 0xf2efe9, roughness: 0.92, normalMap: T.rebocoN([0.5, 0.5]), normalScale: new THREE.Vector2(0.25, 0.25) }),
  topo: std({ color: 0x3a4541, roughness: 0.8 }),
  vidro: new THREE.MeshPhysicalMaterial({ color: 0x9fc4cf, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.8 }),
  forroMadeira: std({ map: T.forro([0.5, 0.5]), normalMap: T.forroN([0.5, 0.5]), color: 0xa0705a, roughness: 0.7, side: THREE.BackSide }),
  vigas: std({ map: T.forro([0.3, 0.3]), color: 0x6b4430, roughness: 0.7 }),
  madeiraEsc: std({ color: 0x4e3020, roughness: 0.6 }),
  madeiraClara: std({ color: 0xc69c6d, roughness: 0.6 }),
  painelMadeira: std({ map: T.forro([1, 1]), color: 0x8a5a3a, roughness: 0.6 }),
  roupaCama: (() => { const m = tecido(0xe6dfd0); m.envMapIntensity = 0.35; return m; })(),
  tapete: tecido(0xb4a48a),
  manta: std({ color: 0x8b8782, roughness: 1, normalMap: T.tecidoN([6, 6]), normalScale: new THREE.Vector2(1.5, 1.5) }),
  sofa: { bege: tecido(0xd9cdb8), vermelho: tecido(0xd65a48), cinza: tecido(0xa49d90) },
  metal: std({ color: 0x9aa2a2, roughness: 0.35, metalness: 0.8 }),
  ferro: std({ color: 0x1f1f1d, roughness: 0.5, metalness: 0.6 }),
  preto: std({ color: 0x161818, roughness: 0.35 }),
  feltro: std({ color: 0x1f6f4a, roughness: 0.9 }),
  azulMesa: std({ color: 0x1d5966, roughness: 0.5 }),
  louca: std({ color: 0xf6f6f3, roughness: 0.15 }),
  inox: std({ color: 0xc9cdcf, roughness: 0.25, metalness: 0.9 }),
  geladeira: std({ color: 0x9aa0a3, roughness: 0.3, metalness: 0.6 }),
  tijolo: std({ color: 0xa65a3a, roughness: 0.9 }),
  tijoloForno: std({ color: 0x8b5a3c, roughness: 0.9 }),
  granito: std({ color: 0x2f2b28, roughness: 0.25 }),
  colunaBranca: std({ color: 0xf2f1ec, roughness: 0.75 }),
  pedraFilete: std({ map: T.pedra([1, 1]), normalMap: T.pedraN([1, 1]), roughness: 0.9 }),
  areia: std({ map: T.areia([3, 3]), normalMap: T.areiaN([3, 3]), roughness: 1, color: 0xf2e6cf }),
  sape: std({ map: T.sape([3, 2]), roughness: 1, side: THREE.DoubleSide }),
  sapeFranja: std({ map: T.sapeFranja([7, 1]), roughness: 1, side: THREE.DoubleSide, alphaTest: 0.4 }),
  ombrelone: std({ color: 0xf7f7f4, roughness: 0.85, side: THREE.DoubleSide }),
  agua: std({ color: 0x2fc6e0, roughness: 0.02, metalness: 0.05, transparent: true, opacity: 0.38, normalMap: aguaNormal, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.4, depthWrite: false }),
  lago: std({ color: 0x2a4436, roughness: 0.03, metalness: 0.25, normalMap: aguaNormal, normalScale: new THREE.Vector2(0.18, 0.18), envMapIntensity: 1.2 }),
  borda: std({ color: 0xe9dfcc, roughness: 0.8 }),
  rocha: std({ color: 0x8e8a80, roughness: 0.95, flatShading: true }),
  tronco: std({ color: 0x5e4b3b, roughness: 1 }),
  palmeiraTronco: std({ color: 0x8a8070, roughness: 1 }),
  folha: std({ map: T.copa(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: new THREE.Color(1.55, 1.6, 1.3) }),
  jeriva: std({ map: T.jeriva(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, color: new THREE.Color(1.35, 1.4, 1.2) }),
  leque: std({ map: T.leque(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.75, color: new THREE.Color(1.3, 1.35, 1.15) }),
  cica: std({ map: T.cica(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }),
  sebe: std({ map: sebeTex, roughness: 1 }),
  pedraCaminho: std({ map: T.saoTome([1, 1]), roughness: 0.85 }),
  linhaQuadra: std({ color: 0xf6f6f2, roughness: 0.6 }),
  gramaQuadra: std({ map: T.grama([5, 6]), normalMap: T.gramaN([5, 6]), color: 0x8fb071, roughness: 1 }),
  alambrado: std({ map: (() => { const t = redeTex.clone(); t.repeat.set(18, 4); return t; })(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }),
  redeVolei: std({ map: (() => { const t = redeTex.clone(); t.repeat.set(12, 1); return t; })(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
  fogo: new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 }),
  jato: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
  redeTecido: std({ color: 0x2f8a5c, roughness: 0.9, side: THREE.DoubleSide }),
  brinquedoA: std({ color: 0xd8483b, roughness: 0.6 }),
  brinquedoB: std({ color: 0x2f7fc0, roughness: 0.6 }),
  brinquedoC: std({ color: 0xf2c230, roughness: 0.6 }),
  galpao: std({ color: 0xe1ddd3, roughness: 0.9, normalMap: T.rebocoN([1, 1]) }),
  lampiao: std({ color: 0xfff1c8, emissive: 0xffe2a0, emissiveIntensity: 0.25, roughness: 0.4 }),
};
// folhagem: os dois lados da folha recebem a mesma normal (evita copas escuras vistas de cima)
for (const m of [M.folha, M.jeriva, M.leque, M.cica]) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
}
// pisos desenhados em canvas a partir das cores das fotos (módulo em metros = 1 repetição)
function pisoCanvas(base, rejunte, diagonal, var_) {
  return texCanvas(512, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const n = 2, m = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = (rnd() - 0.5) * var_;
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      g.fillRect(i * m, j * m, m, m);
      for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(i * m + rnd() * m, j * m + rnd() * m, 2 + rnd() * 9, 1 + rnd() * 3); }
    }
    g.strokeStyle = rejunte; g.lineWidth = 5;
    if (diagonal) {
      g.save(); g.translate(s / 2, s / 2); g.rotate(Math.PI / 4); g.translate(-s, -s);
      for (let i = 0; i <= 2 * s; i += s / Math.SQRT2 / 1) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 2 * s); g.moveTo(0, i); g.lineTo(2 * s, i); g.stroke(); }
      g.restore();
    } else for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * m, 0); g.lineTo(i * m, s); g.moveTo(0, i * m); g.lineTo(s, i * m); g.stroke(); }
  });
}
const texArdosiaEscura = pisoCanvas('#3d4044', '#25282a', false, 0.12);
const texPorcelanatoBege = pisoCanvas('#c9b48c', '#7f7058', true, 0.06);
const repete = (t, r) => { const c = t.clone(); c.repeat.set(...r); return c; };
const PISOS = {
  ardosiaEscura: (w, d) => std({ map: repete(texArdosiaEscura, [w / 1.2, d / 1.2]), roughness: 0.45, envMapIntensity: 0.35 }),
  // piso claro + reflexo do céu = branco: reflexo baixo e fosco
  porcelanatoBege: (w, d) => std({ map: repete(texPorcelanatoBege, [w / 1.2, d / 1.2]), roughness: 1, envMapIntensity: 0.3 }),
  madeira: (w, d) => std({ map: T.pisoSalao([w / 2.6, d / 2.6]), roughness: 0.35 }),
  ceramica: (w, d) => std({ map: (() => { const t = ceramicaBanho.clone(); t.repeat.set(w / 1.2, d / 1.2); return t; })(), roughness: 0.2 }),
  porcelanato: (w, d) => std({ map: T.porcelanato([w / 1.7, d / 1.7]), roughness: 0.22 }),
  ardosia: (w, d) => std({ map: T.ardosia([w / 1.6, d / 1.6]), roughness: 0.3 }),
};

// ============================================================
// Colisão 2D (caixas orientadas, círculos, elipses)
// ============================================================
const obstaculos = [];
function obstCaixa(cx, cz, hx, hz, ang) {
  obstaculos.push({ t: 'c', cx, cz, hx, hz, cos: Math.cos(ang), sin: Math.sin(ang) });
}
function obstCirculo(cx, cz, r) { obstaculos.push({ t: 'r', cx, cz, r }); }
function obstElipse(cx, cz, rx, rz, ang) { obstaculos.push({ t: 'e', cx, cz, rx, rz, cos: Math.cos(ang), sin: Math.sin(ang) }); }

function resolveColisao(p, raio) {
  for (let it = 0; it < 3; it++) {
    for (const o of obstaculos) {
      const dx = p.x - o.cx, dz = p.z - o.cz;
      if (o.t === 'r') {
        const d = Math.hypot(dx, dz), m = o.r + raio;
        if (d < m && d > 1e-6) { p.x = o.cx + (dx / d) * m; p.z = o.cz + (dz / d) * m; }
        continue;
      }
      if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue;
      const lx = o.cos * dx - o.sin * dz, lz = o.sin * dx + o.cos * dz;
      if (o.t === 'e') {
        const k = (lx / (o.rx + raio)) ** 2 + (lz / (o.rz + raio)) ** 2;
        if (k < 1) {
          const s = 1 / Math.sqrt(k), nx = lx * s, nz = lz * s;
          p.x = o.cx + o.cos * nx + o.sin * nz; p.z = o.cz - o.sin * nx + o.cos * nz;
        }
        continue;
      }
      const qx = Math.max(-o.hx, Math.min(o.hx, lx)), qz = Math.max(-o.hz, Math.min(o.hz, lz));
      let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
      if (d >= raio) continue;
      let px, pz;
      if (d > 1e-6) { px = (ex / d) * (raio - d); pz = (ez / d) * (raio - d); }
      else {
        const sx = o.hx - Math.abs(lx), sz = o.hz - Math.abs(lz);
        if (sx < sz) { px = Math.sign(lx || 1) * (sx + raio); pz = 0; } else { px = 0; pz = Math.sign(lz || 1) * (sz + raio); }
      }
      p.x += o.cos * px + o.sin * pz; p.z += -o.sin * px + o.cos * pz;
    }
  }
}

// ============================================================
// Utilidades de geometria
// ============================================================
function caixa(w, h, d, mat, x = 0, y = 0, z = 0, sombra = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = sombra; m.receiveShadow = true;
  return m;
}
function cilindro(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// Junta as malhas de um grupo por material (menos draw calls)
function fundir(grupo) {
  grupo.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(grupo.matrixWorld).invert();
  const porMat = new Map();
  grupo.traverse((o) => {
    if (!o.isMesh || o.userData.manter) return;
    const g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const chave = o.material.uuid + (g.index ? 'i' : 'n') + (o.castShadow ? 's' : '');
    if (!porMat.has(chave)) porMat.set(chave, { mat: o.material, geos: [], sombra: o.castShadow });
    porMat.get(chave).geos.push(g);
  });
  const novo = new THREE.Group();
  for (const { mat, geos, sombra } of porMat.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = sombra; m.receiveShadow = true;
    novo.add(m);
  }
  grupo.traverse((o) => { if (o.userData.manter) novo.add(o.clone()); });
  return novo;
}
function comUV(g, esc = 0.6) {
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) * esc; uv[i * 2 + 1] = pos.getZ(i) * esc; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
function deTriangulos(tris) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  comUV(g);
  g.computeVertexNormals();
  return g;
}
// Telhado de quatro águas (cumeeira no eixo maior)
function telhadoQuatroAguas(w, d, h) {
  const gira = d > w;
  if (gira) [w, d] = [d, w];
  const W = w / 2, Dd = d / 2, r = Math.max(W - Dd, 0);
  const A = [-W, 0, Dd], B = [W, 0, Dd], C = [W, 0, -Dd], E = [-W, 0, -Dd], R1 = [-r, h, 0], R2 = [r, h, 0];
  const g = deTriangulos([A, B, R2, A, R2, R1, C, E, R1, C, R1, R2, E, A, R1, B, C, R2]);
  if (gira) g.rotateY(Math.PI / 2);
  return g;
}
// Telhado de duas águas com cumeeira ao longo de Z
function telhadoDuasAguas(w, d, h) {
  const W = w / 2, Dd = d / 2;
  return deTriangulos([
    [-W, 0, Dd], [0, h, Dd], [0, h, -Dd], [-W, 0, Dd], [0, h, -Dd], [-W, 0, -Dd],
    [W, 0, -Dd], [0, h, -Dd], [0, h, Dd], [W, 0, -Dd], [0, h, Dd], [W, 0, Dd],
  ]);
}

// ============================================================
// Terreno com a serra ao fundo
// ============================================================
function alturaTerreno(x, z) {
  const r = Math.hypot(x * 0.9, z);
  const t = THREE.MathUtils.smoothstep(r, 110, 300);
  let h = t * (fbm(x / 140 + 3, z / 140 + 7) * 34 - 6);
  const s = THREE.MathUtils.smoothstep(r, 380, 900);
  const serra = Math.min(fbm(x / 420, z / 420 + 11, 5) * 1.6, 1.0);
  h += s * (serra * 170 + 20);
  return h;
}
const furosTerreno = { uPisc: { value: new THREE.Vector4(1e5, 1e5, 1, 0) }, uPiscH: { value: new THREE.Vector2(0, 0) }, uInf: { value: new THREE.Vector4(1e5, 1e5, 1, 0) }, uInfR: { value: new THREE.Vector2(1, 1) } };
function criaTerreno() {
  const tam = 2600, seg = 220;
  const g = new THREE.PlaneGeometry(tam, tam, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cores = new Float32Array(p.count * 3);
  const c = new THREE.Color(), gramado = new THREE.Color(0xc4e3a2), pasto = new THREE.Color(0xd4d496), mata = new THREE.Color(0x6f8a58), longe = new THREE.Color(0x93a79b);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = alturaTerreno(x, z);
    p.setY(i, h);
    const r = Math.hypot(x, z), n = fbm(x / 30, z / 30, 3);
    c.copy(gramado).lerp(pasto, THREE.MathUtils.smoothstep(r, 80, 160) * 0.55 + (n - 0.5) * 0.25);
    c.lerp(mata, THREE.MathUtils.smoothstep(fbm(x / 90 + 5, z / 90, 3), 0.55, 0.7) * THREE.MathUtils.smoothstep(r, 90, 140));
    c.lerp(longe, THREE.MathUtils.smoothstep(r, 500, 1100));
    c.multiplyScalar(0.94 + n * 0.12);
    cores.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  g.computeVertexNormals();
  const rep = [tam / 3.5, tam / 3.5];
  const mat = std({ map: T.grama(rep), normalMap: T.gramaN(rep), normalScale: new THREE.Vector2(0.7, 0.7), vertexColors: true, roughness: 1, envMapIntensity: 0.55 });
  // abre buracos no gramado onde ficam as piscinas
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, furosTerreno);
    sh.vertexShader = 'varying vec3 vMundo;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform vec4 uPisc; uniform vec2 uPiscH; uniform vec4 uInf; uniform vec2 uInfR;
varying vec3 vMundo;
bool furo(vec2 p) {
  vec2 d = p - uPisc.xy; vec2 l = vec2(uPisc.z * d.x - uPisc.w * d.y, uPisc.w * d.x + uPisc.z * d.y);
  if (abs(l.x) < uPiscH.x && abs(l.y) < uPiscH.y) return true;
  d = p - uInf.xy; l = vec2(uInf.z * d.x - uInf.w * d.y, uInf.w * d.x + uInf.z * d.y);
  return (l.x * l.x) / (uInfR.x * uInfR.x) + (l.y * l.y) / (uInfR.y * uInfR.y) < 1.0;
}
` + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (furo(vMundo.xz)) discard;');
  };
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  cena.add(m);
  // anel distante na cor da neblina, para emendar com o horizonte do céu
  const anel = new THREE.Mesh(new THREE.RingGeometry(1200, 20000, 64, 1), new THREE.MeshBasicMaterial({ color: NEBLINA }));
  anel.rotation.x = -Math.PI / 2; anel.position.y = 30;
  cena.add(anel);
  terreno = { mat };
}
let terreno = null;

// ============================================================
// Móveis (comprimento no eixo Z)
// ============================================================
let sofaAtual = M.sofa.cinza, madeiraMesa = M.madeiraClara, madeiraCadeira = M.madeiraClara, tampoMesa = null;
const MOVEIS = {
  cama(l, c) {
    const g = new THREE.Group();
    g.add(caixa(l, 0.3, c, M.madeiraClara, 0, 0.15, 0));
    g.add(caixa(l - 0.04, 0.24, c - 0.04, M.roupaCama, 0, 0.42, 0.02));
    g.add(caixa(l + 0.02, 0.05, c * 0.32, M.manta, 0, 0.56, c * 0.3));
    for (const s of l > 1.2 ? [-l / 4, l / 4] : [0]) g.add(caixa(Math.min(l / 2.4, 0.62), 0.16, 0.4, M.roupaCama, s, 0.6, -c / 2 + 0.3));
    g.add(caixa(l + 0.5, 1.1, 0.06, M.painelMadeira, 0, 0.55, -c / 2 - 0.03));
    return { g, pe: [l, c] };
  },
  solteiro() { return MOVEIS.cama(0.9, 1.9); },
  casal() { return MOVEIS.cama(1.4, 1.9); },
  queen() { return MOVEIS.cama(1.6, 2.0); },
  sofa(c = 2.2) {
    const g = new THREE.Group(), mat = sofaAtual;
    g.add(caixa(0.92, 0.44, c, mat, 0, 0.22, 0));
    g.add(caixa(0.26, 0.86, c, mat, -0.33, 0.43, 0));
    g.add(caixa(0.92, 0.62, 0.22, mat, 0, 0.31, -c / 2 + 0.11), caixa(0.92, 0.62, 0.22, mat, 0, 0.31, c / 2 - 0.11));
    for (let i = 0; i < Math.max(1, Math.round((c - 0.44) / 0.75)); i++) {
      const n = Math.max(1, Math.round((c - 0.44) / 0.75)), w = (c - 0.44) / n;
      g.add(caixa(0.62, 0.12, w - 0.04, mat, 0.08, 0.5, -c / 2 + 0.22 + w * (i + 0.5)));
    }
    return { g, pe: [0.92, c] };
  },
  sofaL() {
    const g = new THREE.Group(), a = MOVEIS.sofa(2.8).g, b = MOVEIS.sofa(1.9).g;
    b.rotation.y = Math.PI / 2; b.position.set(0.5, 0, 1.85);
    g.add(a, b);
    return { g, pe: [1.0, 2.8] };
  },
  poltrona() { const { g } = MOVEIS.sofa(1.0); return { g, pe: [0.92, 1.0] }; },
  tv() {
    const g = new THREE.Group();
    g.add(caixa(0.45, 0.55, 1.9, M.madeiraEsc, 0, 0.275, 0));
    g.add(caixa(0.05, 0.72, 1.3, M.preto, 0.05, 1.3, 0));
    return { g, pe: [0.45, 1.9] };
  },
  rackTv() { return MOVEIS.tv(); },
  mesa(l, c, cadeiras) {
    const g = new THREE.Group();
    g.add(caixa(l, 0.06, c, tampoMesa || madeiraMesa, 0, 0.76, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(caixa(0.07, 0.74, 0.07, M.madeiraEsc, x * (l / 2 - 0.08), 0.37, z * (c / 2 - 0.08)));
    const n = cadeiras / 2;
    for (let i = 0; i < n; i++) {
      const z = -c / 2 + (c / n) * (i + 0.5);
      for (const s of [-1, 1]) {
        g.add(caixa(0.44, 0.06, 0.44, madeiraCadeira, s * (l / 2 + 0.2), 0.46, z));
        g.add(caixa(0.05, 0.6, 0.44, madeiraCadeira, s * (l / 2 + 0.42), 0.76, z));
      }
    }
    return { g, pe: [l + 0.9, c] };
  },
  mesa24() { return MOVEIS.mesa(1.1, 7.0, 24); },
  mesa6() { return MOVEIS.mesa(0.95, 1.8, 6); },
  mesaRedonda() {
    const g = new THREE.Group();
    g.add(cilindro(0.6, 0.6, 0.05, M.madeiraClara, 0, 0.76, 0, 24), cilindro(0.06, 0.2, 0.74, M.madeiraEsc, 0, 0.37, 0));
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; g.add(cilindro(0.22, 0.22, 0.45, M.madeiraClara, Math.cos(a) * 0.95, 0.22, Math.sin(a) * 0.95, 12)); }
    return { g, pe: [1.3, 1.3] };
  },
  jogo(l, c, topo, alt = 0.8) {
    const g = new THREE.Group();
    g.add(caixa(l, 0.1, c, topo, 0, alt, 0));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(caixa(0.1, alt - 0.05, 0.1, M.madeiraEsc, x * (l / 2 - 0.12), (alt - 0.05) / 2, z * (c / 2 - 0.12)));
    return { g, pe: [l, c] };
  },
  bilhar() {
    const r = MOVEIS.jogo(1.4, 2.6, M.feltro);
    r.g.add(caixa(1.6, 0.12, 0.1, M.madeiraEsc, 0, 0.88, 1.3), caixa(1.6, 0.12, 0.1, M.madeiraEsc, 0, 0.88, -1.3), caixa(0.1, 0.12, 2.6, M.madeiraEsc, 0.75, 0.88, 0), caixa(0.1, 0.12, 2.6, M.madeiraEsc, -0.75, 0.88, 0));
    return r;
  },
  pebolim() {
    const r = MOVEIS.jogo(0.75, 1.4, M.feltro, 0.9);
    r.g.add(caixa(0.8, 0.2, 1.45, M.madeiraClara, 0, 0.95, 0));
    for (let i = 0; i < 6; i++) r.g.add(cilindro(0.012, 0.012, 1.3, M.inox, 0, 1.0, -0.6 + i * 0.24, 6).rotateZ(Math.PI / 2));
    return r;
  },
  pingpong() {
    const r = MOVEIS.jogo(1.52, 2.74, M.azulMesa, 0.76);
    r.g.add(caixa(1.7, 0.15, 0.02, M.roupaCama, 0, 0.88, 0));
    return r;
  },
  futmesa() { return MOVEIS.jogo(1.2, 2.2, M.brinquedoB, 0.76); },
  fliperama() {
    const g = new THREE.Group();
    g.add(caixa(0.7, 1.8, 0.8, M.preto, 0, 0.9, 0));
    g.add(caixa(0.55, 0.45, 0.02, new THREE.MeshBasicMaterial({ color: 0x3fd6ff }), 0, 1.35, 0.41));
    return { g, pe: [0.7, 0.8] };
  },
  bancada(comp = 2.4) {
    const g = new THREE.Group();
    g.add(caixa(0.62, 0.86, comp, M.madeiraEsc, 0, 0.43, 0), caixa(0.66, 0.04, comp + 0.02, M.granito, 0, 0.88, 0));
    return { g, pe: [0.66, comp] };
  },
  balcao(comp = 4) {
    const g = new THREE.Group();
    g.add(caixa(0.45, 1.05, comp, M.tijolo, 0, 0.52, 0), caixa(0.6, 0.05, comp + 0.1, M.granito, 0, 1.07, 0));
    return { g, pe: [0.6, comp] };
  },
  churrasqueira() {
    const g = new THREE.Group();
    g.add(caixa(1.0, 0.9, 1.2, M.colunaBranca, 0, 0.45, 0), caixa(1.0, 1.2, 0.9, M.colunaBranca, -0.1, 1.5, 0), caixa(0.5, 1.6, 0.5, M.colunaBranca, -0.1, 2.9, 0));
    g.add(caixa(0.05, 0.5, 0.7, M.preto, 0.5, 1.4, 0));
    return { g, pe: [1.0, 1.2] };
  },
  fornoPizza() {
    const g = new THREE.Group();
    g.add(caixa(1.4, 0.9, 1.4, M.colunaBranca, 0, 0.45, 0));
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.tijoloForno);
    cup.position.y = 0.9; cup.castShadow = true; g.add(cup);
    return { g, pe: [1.4, 1.4] };
  },
  geladeira() { const g = new THREE.Group(); g.add(caixa(0.75, 1.85, 0.7, M.geladeira, 0, 0.925, 0)); return { g, pe: [0.75, 0.7] }; },
  sanitario() {
    const g = new THREE.Group();
    g.add(cilindro(0.2, 0.17, 0.4, M.louca, 0, 0.2, 0.05, 14), caixa(0.4, 0.4, 0.18, M.louca, 0, 0.55, -0.22));
    return { g, pe: [0.45, 0.65] };
  },
  pia() {
    const g = new THREE.Group();
    g.add(caixa(0.9, 0.82, 0.5, M.madeiraClara, 0, 0.41, 0), caixa(0.92, 0.04, 0.52, M.granito, 0, 0.84, 0));
    return { g, pe: [0.9, 0.5] };
  },
  arCond() { const g = new THREE.Group(); g.add(caixa(0.25, 0.32, 0.9, M.louca, 0, 2.3, 0)); return { g, pe: null }; },
  lareira() {
    const g = new THREE.Group();
    g.add(caixa(0.6, 1.1, 1.5, M.pedraFilete, 0, 0.55, 0), caixa(0.4, 1.8, 0.9, M.pedraFilete, -0.08, 1.95, 0));
    g.add(caixa(0.05, 0.55, 0.8, M.preto, 0.29, 0.5, 0));
    return { g, pe: [0.6, 1.5] };
  },
  tapete(comp = 2.4) {
    const g = new THREE.Group();
    g.add(caixa(1.7, 0.012, comp, M.tapete, 0, 0.006, 0, false));
    return { g, pe: null };
  },
  // parede de pedra filete e pilar (foto 04)
  paredePedra(comp = 3) {
    const g = new THREE.Group();
    const m = M.pedraFilete.clone(); m.map = T.pedra([comp / 1.4, 2]); m.normalMap = T.pedraN([comp / 1.4, 2]);
    g.add(caixa(0.05, 2.85, comp, m, 0, 1.43, 0));
    return { g, pe: null };
  },
  pilarPedra() {
    const g = new THREE.Group();
    const m = M.pedraFilete.clone(); m.map = T.pedra([0.35, 2]); m.normalMap = T.pedraN([0.35, 2]);
    g.add(caixa(0.45, 2.85, 0.45, m, 0, 1.43, 0));
    return { g, pe: [0.45, 0.45] };
  },
  // coluna branca torcida (foto 46)
  colunaTorcida() {
    const g = new THREE.Group();
    for (let i = 0; i < 16; i++) { const b = caixa(0.5, 0.25, 0.5, M.colunaBranca, 0, 0.125 + i * 0.25, 0); b.rotation.y = i * 0.22; g.add(b); }
    return { g, pe: [0.5, 0.5] };
  },
  // lustre de ferro tipo roda de carroça (foto 20)
  lustre() {
    const g = new THREE.Group();
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 24), M.ferro);
    aro.rotation.x = Math.PI / 2; aro.position.y = 2.15; g.add(aro);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(cilindro(0.04, 0.03, 0.12, M.lampiao, Math.cos(a) * 0.45, 2.25, Math.sin(a) * 0.45, 8)); }
    g.add(cilindro(0.01, 0.01, 0.8, M.ferro, 0, 2.55, 0, 4));
    return { g, pe: null };
  },
};

// ============================================================
// Edificações
// ============================================================
// textura de borda escura com largura fixa em metros (desenhada por cômodo, cacheada pelo tamanho)
const cacheAO = new Map();
function materialAO(w, h) {
  const chave = `${w.toFixed(1)}x${h.toFixed(1)}`;
  if (cacheAO.has(chave)) return cacheAO.get(chave);
  const px = 48, c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(w * px / 2)); c.height = Math.max(8, Math.round(h * px / 2));
  const g = c.getContext('2d'), borda = 0.3 * px / 2;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [0, 0, borda, 0, 0, 0, borda, c.height], [c.width, 0, c.width - borda, 0, c.width - borda, 0, borda, c.height],
    [0, 0, 0, borda, 0, 0, c.width, borda], [0, c.height, 0, c.height - borda, 0, c.height - borda, c.width, borda]]) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
  }
  const t = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  cacheAO.set(chave, mat);
  return mat;
}
const edificacoes = {};
const telhados = [];
const pisosCaminhaveis = []; // {cx,cz,cos,sin,hx,hz,y}

function criaEdificacao(def) {
  const centro = aerea(def.centroAerea);
  const ang = rotEixoX(def.eixoX);
  const grupo = new THREE.Group();
  grupo.position.set(centro.x, 0, centro.y);
  grupo.rotation.y = ang;
  cena.add(grupo);
  const [pcx, pcy] = def.planta.centro, [sx, sz] = def.planta.esc;
  const L = (px, py) => [(px - pcx) * sx, (py - pcy) * sz];
  const H = def.altura, PISO = 0.12;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const paraMundo = (lx, lz) => [centro.x + cos * lx + sin * lz, centro.y - sin * lx + cos * lz];
  const matExt = std({ color: def.paredeExterna, roughness: 0.9, normalMap: T.rebocoN([0.5, 0.5]), normalScale: new THREE.Vector2(0.35, 0.35) });
  const matCaixilho = std({ color: def.caixilho, roughness: 0.55, metalness: def.caixilho < 0x333333 ? 0.5 : 0 });
  const matFolha = std({ color: 0x5a3a26, roughness: 0.6 });
  // acabamento interno tirado das fotos: cor da parede, rodapé e cortinas
  const matInt = def.paredeInterna ? std({ color: def.paredeInterna, roughness: 0.92, envMapIntensity: 0.35, normalMap: T.rebocoN([0.5, 0.5]), normalScale: new THREE.Vector2(0.25, 0.25) }) : M.paredeInt;
  const matRodape = std({ color: def.rodape ?? 0x8a8378, roughness: 0.6 });
  const matCortina = tecido(def.cortinas ?? 0xe9dcc0);
  matCortina.side = THREE.DoubleSide;
  sofaAtual = M.sofa[def.sofa] || M.sofa.cinza;
  madeiraMesa = def.mesa ? std({ color: def.mesa, roughness: 0.5 }) : M.madeiraClara;
  madeiraCadeira = def.cadeira ? std({ color: def.cadeira, roughness: 0.6 }) : madeiraMesa;
  tampoMesa = def.tampoVidro ? std({ color: def.tampoVidro, roughness: 0.08, metalness: 0.1 }) : null;
  const matTopo = def.topoParede ? std({ color: def.topoParede, roughness: 0.7 }) : M.topo;

  // limites
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const w of def.paredes) if (w[4]) {
    const [a, b] = L(w[0], w[1]), [c, d] = L(w[2], w[3]);
    x0 = Math.min(x0, a, c); x1 = Math.max(x1, a, c); z0 = Math.min(z0, b, d); z1 = Math.max(z1, b, d);
  }
  const W = x1 - x0, Dd = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;

  const estatico = new THREE.Group();
  estatico.add(caixa(W + 0.5, PISO, Dd + 0.5, M.borda, mx, PISO / 2, mz, false));
  const pisoBase = new THREE.Mesh(new THREE.PlaneGeometry(W, Dd), PISOS[def.pisoPadrao](W, Dd));
  pisoBase.rotation.x = -Math.PI / 2; pisoBase.position.set(mx, PISO + 0.003, mz); pisoBase.receiveShadow = true;
  grupo.add(pisoBase);
  for (const p of def.pisos || []) {
    const [a, b] = L(p.r[0], p.r[1]), [c, d] = L(p.r[2], p.r[3]);
    const w = c - a, h = d - b;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), PISOS[p.piso](w, h));
    m.rotation.x = -Math.PI / 2; m.position.set(a + w / 2, PISO + 0.006, b + h / 2); m.receiveShadow = true;
    grupo.add(m);
  }
  pisosCaminhaveis.push({ cx: centro.x, cz: centro.y, cos, sin, ox: mx, oz: mz, hx: W / 2 + 0.2, hz: Dd / 2 + 0.2, y: PISO });

  // ---- paredes ----
  const gInt = [], gExt = [], gTopo = [], gVidro = [], gCaix = [], gFolha = [], gRodape = [], gCortina = [];
  const box = (eixoX, a, b, fixo, y0, y1, esp, lista) => {
    const len = b - a, h = y1 - y0;
    if (len <= 0.01 || h <= 0.01) return;
    const g = eixoX ? new THREE.BoxGeometry(len, h, esp) : new THREE.BoxGeometry(esp, h, len);
    if (eixoX) g.translate((a + b) / 2, y0 + h / 2, fixo); else g.translate(fixo, y0 + h / 2, (a + b) / 2);
    lista.push(g);
  };
  const colide = (eixoX, a, b, fixo, esp) => {
    const meio = (a + b) / 2, [wx, wz] = eixoX ? paraMundo(meio, fixo) : paraMundo(fixo, meio);
    obstCaixa(wx, wz, eixoX ? (b - a) / 2 : esp / 2, eixoX ? esp / 2 : (b - a) / 2, ang);
  };
  for (const w of def.paredes) {
    const [ax, az] = L(w[0], w[1]), [bx, bz] = L(w[2], w[3]);
    const eixoX = Math.abs(az - bz) < 1e-6;
    const fixo = eixoX ? az : ax;
    const a = eixoX ? Math.min(ax, bx) : Math.min(az, bz), b = eixoX ? Math.max(ax, bx) : Math.max(az, bz);
    const ext = !!w[4], esp = ext ? 0.24 : 0.14;
    const sOut = eixoX ? Math.sign(fixo - mz) || 1 : Math.sign(fixo - mx) || 1;
    // parede: metade externa colorida, metade interna branca
    const parede = (s, e, y0, y1) => {
      if (ext) { box(eixoX, s, e, fixo + sOut * esp / 4, y0, y1, esp / 2, gExt); box(eixoX, s, e, fixo - sOut * esp / 4, y0, y1, esp / 2, gInt); }
      else box(eixoX, s, e, fixo, y0, y1, esp, gInt);
      // rodapé (só do lado de dentro nas fachadas)
      if (y0 <= PISO + 0.01) {
        if (ext) box(eixoX, s, e, fixo - sOut * (esp / 2 + 0.006), PISO, PISO + 0.09, 0.016, gRodape);
        else box(eixoX, s, e, fixo, PISO, PISO + 0.09, esp + 0.024, gRodape);
      }
    };
    // cortinas recolhidas dos dois lados do vão, por dentro
    const cortina = (s, e, y1) => {
      if (!def.cortinas || !ext) return;
      const off = fixo - sOut * (esp / 2 + 0.07), topo = Math.min(y1 + 0.15, H - 0.05);
      for (const [a0, a1] of [[s - 0.18, s + 0.16], [e - 0.16, e + 0.18]]) box(eixoX, a0, a1, off, PISO + 0.04, topo, 0.07, gCortina);
      box(eixoX, s - 0.25, e + 0.25, off - sOut * 0.02, topo, topo + 0.03, 0.03, gCaix);
    };
    const moldura = (s, e, y0, y1) => {
      const f = 0.07, p = esp + 0.04;
      box(eixoX, s - f, s, fixo, y0, y1, p, gCaix); box(eixoX, e, e + f, fixo, y0, y1, p, gCaix);
      box(eixoX, s - f, e + f, fixo, y1, y1 + f, p, gCaix);
      if (y0 > 0.3) box(eixoX, s - f - 0.03, e + f + 0.03, fixo + sOut * 0.04, y0 - 0.05, y0, p + 0.06, gCaix);
      if (e - s > 1.3) { const m = (s + e) / 2; box(eixoX, m - 0.025, m + 0.025, fixo, y0, y1, 0.05, gCaix); }
    };
    const folha = (s, e) => {
      if (!def.folhas) return;
      const larg = Math.min(e - s, 1.0) - 0.04, hF = 2.05;
      const g = eixoX ? new THREE.BoxGeometry(larg, hF, 0.045) : new THREE.BoxGeometry(0.045, hF, larg);
      if (eixoX) g.translate(larg / 2, hF / 2, 0); else g.translate(0, hF / 2, larg / 2);
      g.rotateY(eixoX ? sOut * 1.45 : -sOut * 1.45);
      if (eixoX) g.translate(s + 0.02, PISO, fixo); else g.translate(fixo, PISO, s + 0.02);
      gFolha.push(g);
    };
    const vaos = [];
    for (const ab of def.aberturas || []) {
      const [p0x, p0z] = L(ab.p[0], ab.p[1]), [p1x, p1z] = L(ab.p[2], ab.p[3]);
      const naLinha = eixoX ? Math.abs(p0z - fixo) < 0.05 && Math.abs(p1z - fixo) < 0.05 : Math.abs(p0x - fixo) < 0.05 && Math.abs(p1x - fixo) < 0.05;
      if (!naLinha) continue;
      const s = eixoX ? Math.min(p0x, p1x) : Math.min(p0z, p1z), e = eixoX ? Math.max(p0x, p1x) : Math.max(p0z, p1z);
      if (e <= a || s >= b) continue;
      vaos.push({ s: Math.max(s, a), e: Math.min(e, b), tipo: ab.tipo });
    }
    for (const pt of def.portas || []) {
      const [px, pz] = L(pt[0], pt[1]);
      const dist = eixoX ? Math.abs(pz - fixo) : Math.abs(px - fixo), pos = eixoX ? px : pz;
      if (dist < 0.08 && pos > a && pos < b) vaos.push({ s: pos - 0.45, e: pos + 0.45, tipo: 'porta', interna: true });
    }
    vaos.sort((p, q) => p.s - q.s);
    let cur = a;
    for (const v of vaos) {
      if (v.s > cur) { parede(cur, v.s, PISO, H); colide(eixoX, cur, v.s, fixo, esp); }
      const topoVao = v.tipo === 'vidro' ? Math.min(H - 0.3, 2.6) : 2.1;
      parede(v.s, v.e, topoVao, H);
      if (v.tipo === 'janela' || v.tipo === 'basculante') {
        const peit = v.tipo === 'janela' ? 1.0 : 1.6;
        parede(v.s, v.e, PISO, peit); colide(eixoX, v.s, v.e, fixo, esp);
        box(eixoX, v.s, v.e, fixo, peit, topoVao, 0.02, gVidro);
        moldura(v.s, v.e, peit, topoVao);
        if (v.tipo === 'janela') cortina(v.s, v.e, topoVao);
      } else if (v.tipo === 'vidro') {
        box(eixoX, v.s, v.e, fixo, PISO, topoVao, 0.02, gVidro); colide(eixoX, v.s, v.e, fixo, esp);
        cortina(v.s, v.e, topoVao);
        const n = Math.max(1, Math.round((v.e - v.s) / 1.3));
        for (let k = 0; k <= n; k++) { const m = v.s + ((v.e - v.s) / n) * k; box(eixoX, m - 0.03, m + 0.03, fixo, PISO, topoVao, 0.08, gCaix); }
        box(eixoX, v.s, v.e, fixo, topoVao - 0.03, topoVao + 0.03, 0.08, gCaix);
      } else if (v.tipo === 'porta') {
        if (ext || def.folhas) moldura(v.s, v.e, PISO, topoVao);
        if (def.folhas) folha(v.s, v.e);
      }
      cur = Math.max(cur, v.e);
    }
    if (b > cur) { parede(cur, b, PISO, H); colide(eixoX, cur, b, fixo, esp); }
    const capa = eixoX ? new THREE.BoxGeometry(b - a + esp, 0.03, esp + 0.01) : new THREE.BoxGeometry(esp + 0.01, 0.03, b - a + esp);
    if (eixoX) capa.translate((a + b) / 2, H + 0.015, fixo); else capa.translate(fixo, H + 0.015, (a + b) / 2);
    gTopo.push(capa);
  }
  const malha = (lista, mat, sombra = true) => {
    if (!lista.length) return;
    const m = new THREE.Mesh(mergeGeometries(lista), mat);
    m.castShadow = sombra; m.receiveShadow = true;
    grupo.add(m);
    return m;
  };
  malha(gInt, matInt); malha(gRodape, matRodape, false); malha(gCortina, matCortina); malha(gExt, matExt); malha(gTopo, matTopo); malha(gCaix, matCaixilho); malha(gFolha, matFolha);
  const vidro = malha(gVidro, M.vidro, false); if (vidro) vidro.renderOrder = 2;

  // ---- varanda com colunas ----
  let rx0 = x0, rx1 = x1, rz0 = z0, rz1 = z1;
  if (def.varanda) {
    const { lado, prof } = def.varanda;
    const vg = new THREE.Group();
    if (lado === 'x+') rx1 += prof; if (lado === 'x-') rx0 -= prof; if (lado === 'z+') rz1 += prof; if (lado === 'z-') rz0 -= prof;
    const eixoX = lado[0] === 'z';
    const comp = eixoX ? W : Dd;
    const fixo = lado === 'x+' ? x1 + prof / 2 : lado === 'x-' ? x0 - prof / 2 : lado === 'z+' ? z1 + prof / 2 : z0 - prof / 2;
    const pisoV = new THREE.Mesh(eixoX ? new THREE.PlaneGeometry(W, prof) : new THREE.PlaneGeometry(prof, Dd), PISOS.ardosia(eixoX ? W : prof, eixoX ? prof : Dd));
    pisoV.rotation.x = -Math.PI / 2; pisoV.position.set(eixoX ? mx : fixo, PISO + 0.004, eixoX ? fixo : mz); pisoV.receiveShadow = true;
    grupo.add(pisoV);
    vg.add(eixoX ? caixa(W, PISO, prof, M.borda, mx, PISO / 2, fixo, false) : caixa(prof, PISO, Dd, M.borda, fixo, PISO / 2, mz, false));
    const n = Math.max(2, Math.round(comp / 3.2));
    const borda = fixo + (lado.endsWith('+') ? prof / 2 - 0.2 : -prof / 2 + 0.2);
    for (let i = 0; i <= n; i++) {
      const t = -comp / 2 + (comp / n) * i;
      const [lx, lz] = eixoX ? [mx + t, borda] : [borda, mz + t];
      vg.add(caixa(0.28, H, 0.28, M.colunaBranca, lx, H / 2, lz));
      const [wx, wz] = paraMundo(lx, lz); obstCirculo(wx, wz, 0.2);
    }
    grupo.add(fundir(vg));
    const [wx, wz] = paraMundo(eixoX ? mx : fixo, eixoX ? fixo : mz);
    pisosCaminhaveis.push({ cx: wx, cz: wz, cos, sin, ox: 0, oz: 0, hx: eixoX ? W / 2 : prof / 2, hz: eixoX ? prof / 2 : Dd / 2, y: PISO });
  }

  // ---- deck de madeira ----
  if (def.deck) {
    const [a, b] = L(def.deck.r[0], def.deck.r[1]), [c, d] = L(def.deck.r[2], def.deck.r[3]);
    const w = c - a, h = d - b, dg = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, h), std({ map: T.deck([w / 2, h / 2]), normalMap: T.deckN([w / 2, h / 2]), color: 0xc88a68, roughness: 0.55 }));
    piso.position.set(a + w / 2, 0.15, b + h / 2); piso.receiveShadow = true; piso.castShadow = true; piso.userData.manter = true;
    dg.add(piso);
    const guarda = (x, z, len, eixoX) => {
      dg.add(eixoX ? caixa(len, 0.06, 0.1, M.madeiraEsc, x, 1.3, z) : caixa(0.1, 0.06, len, M.madeiraEsc, x, 1.3, z));
      dg.add(eixoX ? caixa(len, 0.05, 0.05, M.madeiraEsc, x, 0.8, z) : caixa(0.05, 0.05, len, M.madeiraEsc, x, 0.8, z));
      const n = Math.round(len / 1.2);
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + (len / n) * i;
        dg.add(eixoX ? caixa(0.09, 1.0, 0.09, M.madeiraEsc, x + t, 0.8, z) : caixa(0.09, 1.0, 0.09, M.madeiraEsc, x, 0.8, z + t));
      }
      const [wx, wz] = paraMundo(x, z);
      obstCaixa(wx, wz, eixoX ? len / 2 : 0.06, eixoX ? 0.06 : len / 2, ang);
    };
    guarda(a + w / 2, b, w, true); guarda(a, b + h / 2, h, false); guarda(a + w / 2, d, w, true);
    const om = ombrelone(); om.position.set(a + w * 0.45, 0.3, b + h * 0.5); dg.add(om);
    grupo.add(fundir(dg));
    const [wx, wz] = paraMundo(a + w / 2, b + h / 2);
    pisosCaminhaveis.push({ cx: wx, cz: wz, cos, sin, ox: 0, oz: 0, hx: w / 2, hz: h / 2, y: 0.3 });
  }

  // ---- móveis ----
  const mg = new THREE.Group();
  const moveis = [...(def.moveis || []), ...(def.colunas || []).map((c) => ({ t: 'colunaTorcida', c }))];
  for (const m of moveis) {
    const fab = MOVEIS[m.t];
    if (!fab) continue;
    const { g, pe } = fab(m.comp);
    const [lx, lz] = L(m.c[0], m.c[1]);
    const r = deg(m.r || 0);
    g.position.set(lx, PISO, lz); g.rotation.y = r;
    mg.add(g);
    if (pe) { const [wx, wz] = paraMundo(lx, lz); obstCaixa(wx, wz, pe[0] / 2, pe[1] / 2, ang + r); }
  }
  grupo.add(fundir(mg));
  grupo.add(fundir(estatico));
  // AO falso: escurece 25–30 cm junto às paredes de cada cômodo (sem pós-processamento)
  for (const c of [...(def.comodos || []), ...(def.ambientes || [])]) {
    const [a, b] = L(c.r[0], c.r[1]), [cc, d] = L(c.r[2], c.r[3]);
    const w = cc - a, h = d - b;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), materialAO(w, h));
    m.rotation.x = -Math.PI / 2; m.position.set(a + w / 2, PISO + 0.012, b + h / 2); m.renderOrder = 1;
    grupo.add(m);
  }

  // ---- telhado (externo em telha metálica, interno em forro de madeira) ----
  const tg = new THREE.Group();
  const tel = def.telhado, beiral = tel.beiral;
  const bw = rx1 - rx0 + beiral * 2, bd = rz1 - rz0 + beiral * 2, tcx = (rx0 + rx1) / 2, tcz = (rz0 + rz1) / 2;
  const duas = tel.tipo === 'duas';
  const geo = duas ? telhadoDuasAguas(bw, bd, tel.altura) : telhadoQuatroAguas(bw, bd, tel.altura);
  const matTelha = std({ color: tel.cor, normalMap: T.telhaN([1, 1]), roughnessMap: T.telhaR([1, 1]), roughness: 0.6, metalness: 0.45 });
  matTelha.shadowSide = THREE.DoubleSide;
  const externo = new THREE.Mesh(geo, matTelha);
  externo.position.set(tcx, H + 0.02, tcz); externo.castShadow = true; externo.receiveShadow = true;
  const interno = new THREE.Mesh(geo, M.forroMadeira);
  interno.position.copy(externo.position);
  tg.add(externo, interno);
  // testeira ao redor do beiral
  const test = std({ color: tel.testeira, roughness: 0.6 });
  const tb = new THREE.Group();
  if (duas) {
    const incl = Math.atan2(tel.altura, bw / 2), comp = Math.hypot(tel.altura, bw / 2);
    for (const zz of [-bd / 2, bd / 2]) for (const s of [-1, 1]) {
      const r = caixa(comp, 0.3, 0.08, test, tcx + s * bw / 4, H + tel.altura / 2, tcz + zz);
      r.rotation.z = -s * incl; tb.add(r);
    }
    for (const s of [-1, 1]) tb.add(caixa(0.08, 0.25, bd, test, tcx + s * bw / 2, H, tcz));
  } else {
    tb.add(caixa(bw, 0.25, 0.06, test, tcx, H, tcz - bd / 2), caixa(bw, 0.25, 0.06, test, tcx, H, tcz + bd / 2));
    tb.add(caixa(0.06, 0.25, bd, test, tcx - bw / 2, H, tcz), caixa(0.06, 0.25, bd, test, tcx + bw / 2, H, tcz));
  }
  tg.add(fundir(tb));
  // oitões (empena) do telhado de duas águas: vidro na frente, parede atrás
  if (duas) {
    const Wr = bw / 2, alturaEm = (x) => Math.max(0, tel.altura * (1 - Math.abs(x - tcx) / Wr));
    const [ox0, ox1] = tel.oitao ? [L(tel.oitao[0], 0)[0], L(tel.oitao[1], 0)[0]] : [x0, x1];
    const forma = new THREE.Shape([new THREE.Vector2(ox0, 0), new THREE.Vector2(ox1, 0), new THREE.Vector2(ox1, alturaEm(ox1)), new THREE.Vector2(tcx, tel.altura - 0.05), new THREE.Vector2(ox0, alturaEm(ox0))]);
    const fg = new THREE.ShapeGeometry(forma);
    const frente = new THREE.Mesh(fg, tel.oitaoVidro ? M.vidro : matExt);
    frente.position.set(0, H, z1); frente.renderOrder = 2;
    const fundo = new THREE.Mesh(fg, std({ color: def.paredeExterna, roughness: 0.9, side: THREE.DoubleSide }));
    fundo.position.set(0, H, z0); fundo.castShadow = true;
    tg.add(frente, fundo);
    const mont = new THREE.Group();
    for (let k = 0; k <= 8; k++) {
      const x = ox0 + ((ox1 - ox0) / 8) * k, hh = alturaEm(x) - 0.08;
      if (hh > 0.1) mont.add(caixa(0.07, hh, 0.09, matCaixilho, x, H + hh / 2, z1));
    }
    mont.add(caixa(ox1 - ox0, 0.08, 0.09, matCaixilho, (ox0 + ox1) / 2, H + 0.04, z1));
    tg.add(fundir(mont));
  }
  // tesouras de madeira aparentes
  const tes = new THREE.Group();
  const longoZ = duas || bd > bw;
  const vao = longoZ ? W : Dd, comprimento = longoZ ? Dd : W;
  const nT = Math.max(2, Math.floor(comprimento / 3.2));
  for (let i = 1; i < nT; i++) {
    const t = -comprimento / 2 + (comprimento / nT) * i;
    const [px, pz] = longoZ ? [mx, mz + t] : [mx + t, mz];
    tes.add(longoZ ? caixa(vao, 0.18, 0.14, M.vigas, px, H + 0.05, pz) : caixa(0.14, 0.18, vao, M.vigas, px, H + 0.05, pz));
    tes.add(caixa(0.14, tel.altura * 0.85, 0.14, M.vigas, px, H + tel.altura * 0.42, pz));
  }
  tg.add(fundir(tes));
  grupo.add(tg);
  telhados.push(tg);

  // cômodos
  const comodos = (def.comodos || []).map((c) => {
    const [a, b] = L(c.r[0], c.r[1]), [cc, d] = L(c.r[2], c.r[3]);
    const [wx, wz] = paraMundo((a + cc) / 2, (b + d) / 2);
    return { ...c, pos: new THREE.Vector3(wx, 1.4, wz), edif: def.id };
  });

  edificacoes[def.id] = { def, grupo, telhado: tg, centro, ang, comodos, raio: Math.hypot(W, Dd) / 2, altura: H + tel.altura, plantaParaMundo: (p) => paraMundo(...L(p[0], p[1])) };
}

// ============================================================
// Elementos externos
// ============================================================
function ombrelone() {
  const g = new THREE.Group();
  g.add(cilindro(0.03, 0.03, 2.4, M.metal, 0, 1.2, 0, 8));
  const topo = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.55, 8, 1, true), M.ombrelone);
  topo.position.y = 2.35; topo.castShadow = true; g.add(topo);
  g.add(cilindro(0.45, 0.45, 0.04, M.roupaCama, 0, 0.74, 0, 16), cilindro(0.04, 0.04, 0.72, M.metal, 0, 0.36, 0, 6));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(caixa(0.45, 0.05, 0.45, M.preto, Math.cos(a) * 0.85, 0.45, Math.sin(a) * 0.85));
  }
  return g;
}

// bacia da piscina: paredes e fundo revestidos de pastilha
function bacia(w, d, prof) {
  const g = new THREE.Group();
  const mat = (a, b) => std({ map: T.pastilha([a, b]), roughness: 0.25 });
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(w, d));
  fundo.rotation.x = -Math.PI / 2; fundo.position.y = -prof; g.add(fundo);
  for (const [px, pz, ry, len] of [[0, -d / 2, 0, w], [0, d / 2, Math.PI, w], [-w / 2, 0, Math.PI / 2, d], [w / 2, 0, -Math.PI / 2, d]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, prof), mat(len, prof));
    p.position.set(px, -prof / 2, pz); p.rotation.y = ry; g.add(p);
  }
  return g;
}

function criaPiscina() {
  const P = D.PISCINA, c = aerea(P.deck.c), ang = rotEixoZ(P.deck.eixoZ);
  const g = new THREE.Group();
  g.position.set(c.x, 0, c.y); g.rotation.y = ang;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const paraLocal = (v) => { const dx = v.x - c.x, dz = v.y - c.y; return [cos * dx - sin * dz, sin * dx + cos * dz]; };
  const paraMundo = (lx, lz) => [c.x + cos * lx + sin * lz, c.y - sin * lx + cos * lz];
  const [w, d] = P.deck.tam;
  const [ax, az] = paraLocal(aerea(P.adulto.c)), [pw, pd] = P.adulto.tam;
  const [kx, kz] = paraLocal(aerea(P.infantil.c)), [kw, kd] = P.infantil.tam;

  // solário com furos para as piscinas (shape no plano XY → gira para XZ, então y = -z)
  const forma = new THREE.Shape();
  forma.moveTo(-w / 2, -d / 2); forma.lineTo(w / 2, -d / 2); forma.lineTo(w / 2, d / 2); forma.lineTo(-w / 2, d / 2); forma.closePath();
  const furo = new THREE.Path();
  furo.moveTo(ax - pw / 2, -az - pd / 2); furo.lineTo(ax - pw / 2, -az + pd / 2); furo.lineTo(ax + pw / 2, -az + pd / 2); furo.lineTo(ax + pw / 2, -az - pd / 2); furo.closePath();
  const furoK = new THREE.Path(); furoK.absellipse(kx, -kz, kw / 2, kd / 2, 0, Math.PI * 2, true);
  forma.holes.push(furo, furoK);
  const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.14, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const deck = new THREE.Mesh(geo, std({ map: T.solario([0.25, 0.25]), normalMap: T.solarioN([0.25, 0.25]), roughness: 0.85 }));
  deck.receiveShadow = true; g.add(deck);

  const b = bacia(pw, pd, 1.4); b.position.set(ax, 0.14, az); g.add(b);
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), M.agua);
  agua.rotation.x = -Math.PI / 2; agua.position.set(ax, 0.06, az); agua.renderOrder = 1; g.add(agua);
  // piscina infantil: cilindro aberto + fundo
  const parK = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 40, 1, true), std({ map: T.pastilha([6, 0.5]), roughness: 0.25, side: THREE.BackSide }));
  parK.scale.set(kw / 2, 1, kd / 2); parK.position.set(kx, 0.14 - 0.25, kz); g.add(parK);
  const fundoK = new THREE.Mesh(new THREE.CircleGeometry(1, 40), std({ map: T.pastilha([2, 2]), roughness: 0.25 }));
  fundoK.rotation.x = -Math.PI / 2; fundoK.scale.set(kw / 2, kd / 2, 1); fundoK.position.set(kx, -0.36, kz); g.add(fundoK);
  const aguaK = new THREE.Mesh(new THREE.CircleGeometry(1, 40), M.agua);
  aguaK.rotation.x = -Math.PI / 2; aguaK.scale.set(kw / 2, kd / 2, 1); aguaK.position.set(kx, 0.07, kz); aguaK.renderOrder = 1; g.add(aguaK);

  obstCaixa(...paraMundo(ax, az), pw / 2, pd / 2, ang);
  furosTerreno.uPisc.value.set(...paraMundo(ax, az), cos, sin); furosTerreno.uPiscH.value.set(pw / 2, pd / 2);
  furosTerreno.uInf.value.set(...paraMundo(kx, kz), cos, sin); furosTerreno.uInfR.value.set(kw / 2, kd / 2);
  obstElipse(...paraMundo(kx, kz), kw / 2, kd / 2, ang);
  pisosCaminhaveis.push({ cx: c.x, cz: c.y, cos, sin, ox: 0, oz: 0, hx: w / 2, hz: d / 2, y: 0.14 });

  // ombrelones, espreguiçadeiras e cadeiras (foto 10)
  const extras = new THREE.Group();
  for (const z of [-5.5, -1.8, 2.0, 5.8]) {
    const o = ombrelone(); o.position.set(-w / 2 + 1.4, 0.14, z); extras.add(o);
    obstCirculo(...paraMundo(-w / 2 + 1.4, z), 0.5);
  }
  for (const x of [-1.6, -0.5, 0.6, 1.7]) {
    const e = new THREE.Group();
    e.add(caixa(0.65, 0.08, 1.9, M.madeiraEsc, 0, 0.34, 0));
    const enc = caixa(0.65, 0.08, 0.7, M.madeiraEsc, 0, 0.55, -0.85); enc.rotation.x = -0.6; e.add(enc);
    e.position.set(ax + x, 0.14, az - pd / 2 - 1.5); extras.add(e);
  }
  for (const z of [-3, 0, 3]) { const cad = caixa(0.5, 0.45, 0.5, M.madeiraEsc, w / 2 - 1.0, 0.36, z); extras.add(cad); }
  g.add(fundir(extras));
  cena.add(g);
}

function criaLago() {
  const L = D.LAGO, c = aerea(L.c), ang = rotEixoZ(L.eixoZ);
  const forma = new THREE.Shape();
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + (fbm(Math.cos(a) * 1.5 + 3, Math.sin(a) * 1.5) - 0.5) * 0.35;
    const x = Math.cos(a) * L.raios[0] * k, y = Math.sin(a) * L.raios[1] * k;
    i ? forma.lineTo(x, y) : forma.moveTo(x, y);
  }
  const g = new THREE.Group();
  g.position.set(c.x, 0, c.y); g.rotation.y = ang;
  const agua = new THREE.Mesh(new THREE.ShapeGeometry(forma), M.lago);
  agua.rotation.x = -Math.PI / 2; agua.position.y = 0.04; agua.receiveShadow = true;
  g.add(agua);
  const pedra = new THREE.IcosahedronGeometry(0.45, 1);
  const pts = forma.getSpacedPoints(80);
  const inst = new THREE.InstancedMesh(pedra, M.rocha, pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  pts.forEach((p, i) => {
    const s = 0.6 + rnd() * 0.7;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(p.x * 1.03, 0.1, -p.y * 1.03), q, new THREE.Vector3(s * 1.3, s * 0.7, s));
    inst.setMatrixAt(i, m4);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  g.add(inst);
  const jatos = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const j = new THREE.Mesh(new THREE.ConeGeometry(0.18 - i * 0.02, 2.2 - i * 0.25, 10, 1, true), M.jato);
    j.position.y = 1.1 - i * 0.12; j.rotation.y = i;
    jatos.add(j);
  }
  const espuma = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), M.jato);
  espuma.rotation.x = -Math.PI / 2; espuma.position.y = 0.06;
  jatos.add(espuma);
  g.add(jatos);
  animados.push((t) => { jatos.children.forEach((j, i) => { if (i < 5) j.scale.y = 0.85 + Math.sin(t * 6 + i) * 0.12; }); });
  cena.add(g);
  obstElipse(c.x, c.y, L.raios[0] * 0.95, L.raios[1] * 0.95, ang);
}

function criaQuadras() {
  const { beach, society } = D.QUADRAS;
  const quadra = (q, base, linhas) => {
    const c = aerea(q.c), ang = rotEixoZ(q.eixoZ), [w, d] = q.tam;
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.y); g.rotation.y = ang;
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(w, d), base);
    piso.rotation.x = -Math.PI / 2; piso.position.y = 0.03; piso.receiveShadow = true; g.add(piso);
    const lg = new THREE.Group();
    for (const [x, z, lw, ld] of linhas(w, d)) lg.add(caixa(lw, 0.01, ld, M.linhaQuadra, x, 0.04, z, false));
    g.add(fundir(lg));
    cena.add(g);
    return { g, c, ang, w, d };
  };
  const ret = (w, d, m = 0.6) => [[0, -d / 2 + m, w - 2 * m, 0.06], [0, d / 2 - m, w - 2 * m, 0.06], [-w / 2 + m, 0, 0.06, d - 2 * m], [w / 2 - m, 0, 0.06, d - 2 * m]];
  const b = quadra(beach, M.areia, (w, d) => ret(w, d, 0.5));
  const redeB = new THREE.Mesh(new THREE.PlaneGeometry(beach.tam[0] - 0.6, 1.0), M.redeVolei);
  redeB.position.set(0, 1.25, 0); b.g.add(redeB);
  b.g.add(cilindro(0.05, 0.05, 1.9, M.metal, -(beach.tam[0] / 2 - 0.2), 0.95, 0, 8), cilindro(0.05, 0.05, 1.9, M.metal, beach.tam[0] / 2 - 0.2, 0.95, 0, 8));
  const s = quadra(society, M.gramaQuadra, (w, d) => [...ret(w, d, 0.4), [0, 0, w - 0.8, 0.08]]);
  for (const z of [-1, 1]) {
    const gol = new THREE.Group();
    gol.add(caixa(0.08, 2, 0.08, M.linhaQuadra, -1.5, 1, 0), caixa(0.08, 2, 0.08, M.linhaQuadra, 1.5, 1, 0), caixa(3.08, 0.08, 0.08, M.linhaQuadra, 0, 2, 0));
    gol.position.z = z * (society.tam[1] / 2 - 0.5);
    s.g.add(gol);
  }
  for (const q of [b, s]) {
    const ag = new THREE.Group();
    const lados = [[0, -q.d / 2 - 0.4, q.w + 0.8, true], [0, q.d / 2 + 0.4, q.w + 0.8, true], [-q.w / 2 - 0.4, 0, q.d + 0.8, false], [q.w / 2 + 0.4, 0, q.d + 0.8, false]];
    lados.forEach(([x, z, len, eixoX], i) => {
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(len, 4), M.alambrado);
      tela.position.set(x, 2, z); if (!eixoX) tela.rotation.y = Math.PI / 2;
      tela.userData.manter = true;
      ag.add(tela);
      for (let k = 0; k <= Math.round(len / 3); k++) {
        const t = -len / 2 + (len / Math.round(len / 3)) * k;
        ag.add(eixoX ? cilindro(0.04, 0.04, 4.2, M.metal, x + t, 2.1, z, 6) : cilindro(0.04, 0.04, 4.2, M.metal, x, 2.1, z + t, 6));
      }
      const cos = Math.cos(q.ang), sin = Math.sin(q.ang);
      const segs = i === 0 ? [[-len / 2, -0.7], [0.7, len / 2]] : [[-len / 2, len / 2]];
      for (const [s0, s1] of segs) {
        const m = (s0 + s1) / 2, lx = eixoX ? x + m : x, lz = eixoX ? z : z + m;
        obstCaixa(q.c.x + cos * lx + sin * lz, q.c.y - sin * lx + cos * lz, eixoX ? (s1 - s0) / 2 : 0.05, eixoX ? 0.05 : (s1 - s0) / 2, q.ang);
      }
    });
    for (const [x, z] of [[-1, -1], [1, 1]]) ag.add(cilindro(0.07, 0.09, 7, M.metal, x * (q.w / 2 + 0.4), 3.5, z * (q.d / 2 + 0.4), 8), caixa(0.6, 0.3, 0.2, M.preto, x * (q.w / 2 + 0.4), 7, z * (q.d / 2 + 0.4)));
    q.g.add(fundir(ag));
  }
}

// quiosque de sapê com tocos de madeira (foto 40)
function criaQuiosque(px) {
  const c = aerea(px), g = new THREE.Group();
  g.add(cilindro(0.11, 0.13, 2.6, M.madeiraEsc, 0, 1.3, 0, 10));
  const teto = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.0, 24, 3), M.sape);
  teto.position.y = 2.95; teto.castShadow = true; g.add(teto);
  const franja = new THREE.Mesh(new THREE.CylinderGeometry(2.08, 2.2, 0.75, 32, 1, true), M.sapeFranja);
  franja.position.y = 2.2; franja.castShadow = true; g.add(franja);
  g.add(cilindro(0.4, 0.4, 0.13, M.vigas, 0, 3.55, 0, 12));
  g.add(cilindro(0.72, 0.72, 0.07, M.madeiraClara, 0, 0.8, 0, 24));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; g.add(cilindro(0.18, 0.2, 0.48, M.madeiraClara, Math.cos(a) * 1.25, 0.24, Math.sin(a) * 1.25, 12)); }
  const f = fundir(g); f.position.set(c.x, 0, c.y); cena.add(f);
  obstCirculo(c.x, c.y, 0.85);
}

function criaFogo() {
  const c = aerea(D.FOGO), g = new THREE.Group();
  const bacia = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.ferro);
  bacia.position.y = 0.55; bacia.castShadow = true; g.add(bacia);
  g.add(cilindro(0.18, 0.3, 0.25, M.ferro, 0, 0.12, 0, 10));
  for (const a of [0.4, Math.PI + 0.4]) {
    const b = new THREE.Group();
    b.add(caixa(1.8, 0.08, 0.4, M.madeiraClara, 0, 0.45, 0), caixa(1.8, 0.4, 0.06, M.madeiraClara, 0, 0.75, -0.2));
    b.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2); b.rotation.y = -a - Math.PI / 2;
    g.add(b);
  }
  const fixo = fundir(g); fixo.position.set(c.x, 0, c.y); cena.add(fixo);
  const chamas = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 6), M.fogo);
    f.position.set(Math.cos(i * 1.7) * 0.2, 0.85, Math.sin(i * 1.7) * 0.2);
    chamas.add(f);
  }
  chamas.position.set(c.x, 0, c.y); cena.add(chamas);
  animados.push((t) => chamas.children.forEach((f, i) => { f.scale.set(1, 0.7 + Math.abs(Math.sin(t * 7 + i * 2)) * 0.6, 1); }));
  obstCirculo(c.x, c.y, 0.8);
}

function criaArena() {
  const c = aerea(D.ARENA.c), r = D.ARENA.raio;
  const disco = new THREE.Mesh(new THREE.CircleGeometry(r, 48), M.areia);
  disco.rotation.x = -Math.PI / 2; disco.position.set(c.x, 0.03, c.y); disco.receiveShadow = true; cena.add(disco);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 8, 64), M.borda);
  anel.rotation.x = -Math.PI / 2; anel.position.set(c.x, 0.05, c.y); anel.receiveShadow = true; cena.add(anel);
}

function criaPlayground() {
  const c = aerea(D.PLAYGROUND), g = new THREE.Group();
  for (const s of [-1, 1]) {
    const p1 = caixa(0.1, 2.4, 0.1, M.brinquedoA, s * 1.4, 1.2, -0.6); p1.rotation.x = 0.25; g.add(p1);
    const p2 = caixa(0.1, 2.4, 0.1, M.brinquedoA, s * 1.4, 1.2, 0.6); p2.rotation.x = -0.25; g.add(p2);
  }
  g.add(caixa(3, 0.1, 0.1, M.brinquedoA, 0, 2.3, 0));
  for (const x of [-0.6, 0.6]) g.add(caixa(0.45, 0.05, 0.2, M.brinquedoC, x, 0.5, 0));
  const torre = new THREE.Group();
  torre.add(caixa(1.2, 0.1, 1.2, M.brinquedoB, 0, 1.4, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) torre.add(caixa(0.08, 2.3, 0.08, M.brinquedoB, x * 0.55, 1.15, z * 0.55));
  const esc = caixa(0.6, 0.06, 2.6, M.brinquedoC, 0, 0.75, 1.75); esc.rotation.x = 0.6; torre.add(esc);
  torre.position.set(3.4, 0, 0);
  g.add(torre);
  const f = fundir(g); f.position.set(c.x, 0, c.y); f.rotation.y = 0.4; cena.add(f);
  obstCirculo(c.x, c.y, 1.4); obstCirculo(c.x + Math.cos(0.4) * 3.4, c.y - Math.sin(0.4) * 3.4, 0.9);
}

function criaGols() {
  for (const [px, py, r] of D.GOLS) {
    const c = aerea([px, py]), g = new THREE.Group();
    g.add(caixa(0.1, 2.2, 0.1, M.linhaQuadra, -2.5, 1.1, 0), caixa(0.1, 2.2, 0.1, M.linhaQuadra, 2.5, 1.1, 0), caixa(5.1, 0.1, 0.1, M.linhaQuadra, 0, 2.2, 0));
    const f = fundir(g); f.position.set(c.x, 0, c.y); f.rotation.y = deg(r); cena.add(f);
  }
}

function criaRedes() {
  for (const [px, py, r] of D.REDES) {
    const c = aerea([px, py]), a = deg(r), dx = Math.cos(a) * 1.9, dz = Math.sin(a) * 1.9;
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(-dx, 1.5, -dz), new THREE.Vector3(-dx * 0.5, 0.85, -dz * 0.5), new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(dx * 0.5, 0.85, dz * 0.5), new THREE.Vector3(dx, 1.5, dz)]);
    const rede = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.35, 6, false), M.redeTecido);
    rede.position.set(c.x, 0, c.y); rede.castShadow = true;
    cena.add(rede);
    for (const s of [-1, 1]) { cena.add(cilindro(0.18, 0.22, 3.2, M.tronco, c.x + s * dx * 1.08, 1.6, c.y + s * dz * 1.08, 8)); obstCirculo(c.x + s * dx * 1.08, c.y + s * dz * 1.08, 0.25); }
  }
}

function criaGalpoes() {
  for (const [px, py, r] of D.GALPOES) {
    const c = aerea([px, py]), g = new THREE.Group(), grande = px < 150;
    const [w, d] = grande ? [11, 4.6] : [4.2, 3.6];
    g.add(caixa(w, 2.8, d, M.galpao, 0, 1.4, 0));
    const t = new THREE.Mesh(telhadoQuatroAguas(w + 0.8, d + 0.8, 1.2), std({ color: 0xd8dcdc, normalMap: T.telhaN([1, 1]), roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }));
    t.position.y = 2.8; t.castShadow = true; g.add(t);
    const f = fundir(g); f.position.set(c.x, 0, c.y); f.rotation.y = deg(r); cena.add(f);
    obstCaixa(c.x, c.y, w / 2, d / 2, deg(r));
  }
}

// caminhos de placas de pedra São Tomé e postes de jardim (fotos 19, 51)
function criaCaminhos() {
  const pontos = [], postes = [];
  for (const linha of D.CAMINHOS) {
    let acum = 0;
    for (let i = 0; i < linha.length - 1; i++) {
      const a = aerea(linha[i]), b = aerea(linha[i + 1]), len = a.distanceTo(b), n = Math.floor(len / 0.62);
      const dir = b.clone().sub(a).normalize();
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n), lado = (rnd() - 0.5) * 0.18;
        pontos.push([p.x - dir.y * lado, p.y + dir.x * lado, Math.atan2(dir.x, dir.y)]);
        acum += len / n;
        if (acum > 14) { acum = 0; postes.push([p.x + dir.y * 1.1, p.y - dir.x * 1.1]); }
      }
    }
  }
  const geo = new THREE.BoxGeometry(0.78, 0.05, 0.4);
  const inst = new THREE.InstancedMesh(geo, M.pedraCaminho, pontos.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), cor = new THREE.Color();
  pontos.forEach(([x, z, a], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + (rnd() - 0.5) * 0.35);
    m4.compose(new THREE.Vector3(x, 0.025, z), q, new THREE.Vector3(0.85 + rnd() * 0.35, 1, 0.8 + rnd() * 0.4));
    inst.setMatrixAt(i, m4);
    const v = 0.88 + rnd() * 0.14; inst.setColorAt(i, cor.setRGB(v, v, v * 0.97));
  });
  inst.receiveShadow = true;
  cena.add(inst);
  const pg = new THREE.Group();
  for (const [x, z] of postes) {
    pg.add(cilindro(0.035, 0.05, 1.3, M.ferro, x, 0.65, z, 8));
    pg.add(caixa(0.2, 0.26, 0.2, M.lampiao, x, 1.42, z));
    pg.add(cilindro(0.01, 0.16, 0.1, M.ferro, x, 1.6, z, 8));
    obstCirculo(x, z, 0.12);
  }
  cena.add(fundir(pg));
}

// ============================================================
// Vegetação
// ============================================================
const varia = (c, base = 1) => { const v = (0.78 + rnd() * 0.4) * base; return c.setRGB(v * (0.9 + rnd() * 0.18), v, v * (0.85 + rnd() * 0.2), THREE.LinearSRGBColorSpace); };

// copa = nuvem de cartões de folhas com normais esféricas (sombreamento suave)
function geoCopa(n = 44, achata = 0.8) {
  const geos = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = new THREE.PlaneGeometry(1, 1);
    p.rotateX(rnd() * Math.PI); p.rotateY(rnd() * Math.PI * 2); p.rotateZ(rnd() * Math.PI);
    const s = 0.75 + rnd() * 0.55; p.scale(s, s, s);
    v.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.35 + rnd() * 0.5);
    p.translate(v.x, v.y * achata, v.z);
    geos.push(p);
  }
  const g = mergeGeometries(geos);
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i) / achata + 0.25, pos.getZ(i)).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
// fronde arqueada (jerivá, cica)
function geoFronde(larg, comp, sobe, cai) {
  const g = new THREE.PlaneGeometry(1, 1, 1, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5, x = p.getX(i);
    p.setXYZ(i, x * larg, comp * (sobe * t - cai * t * t), t * comp);
  }
  g.computeVertexNormals();
  return g;
}

function criaVegetacao() {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), cor = new THREE.Color();
  const copaG = geoCopa(48);

  // ---- árvores de copa ----
  const troncoG = (() => {
    const partes = [new THREE.CylinderGeometry(0.11, 0.2, 1, 7).translate(0, 0.5, 0)];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.CylinderGeometry(0.04, 0.08, 0.55, 5).translate(0, 0.27, 0);
      b.rotateZ(0.7); b.rotateY((i / 3) * Math.PI * 2 + 0.4); b.translate(0, 0.72 + i * 0.08, 0);
      partes.push(b);
    }
    return mergeGeometries(partes);
  })();
  const N = D.ARVORES.length;
  const troncos = new THREE.InstancedMesh(troncoG, M.tronco, N);
  const copas = new THREE.InstancedMesh(copaG, M.folha, N * 4);
  let k = 0;
  D.ARVORES.forEach(([px, py, r], i) => {
    const c = aerea([px, py]), h = 1.8 + r * 0.5;
    m4.compose(v.set(c.x, 0, c.y), q.setFromEuler(e.set(0, rnd() * 6, 0)), s.set(0.8 + r * 0.12, h, 0.8 + r * 0.12)); troncos.setMatrixAt(i, m4);
    obstCirculo(c.x, c.y, 0.25 + r * 0.04);
    for (let j = 0; j < 4; j++) {
      const a = rnd() * Math.PI * 2, d = j ? r * 0.42 : 0, sc = r * (j ? 0.5 : 0.66);
      e.set(0, rnd() * 6, 0); q.setFromEuler(e);
      m4.compose(v.set(c.x + Math.cos(a) * d, h + sc * 0.7 + (j ? -0.4 + rnd() * 0.5 : 0.2), c.y + Math.sin(a) * d), q, s.set(sc, sc * 0.82, sc));
      copas.setMatrixAt(k, m4); copas.setColorAt(k++, varia(cor));
    }
  });
  troncos.castShadow = copas.castShadow = true; troncos.receiveShadow = copas.receiveShadow = true;
  cena.add(troncos, copas);

  // ---- palmeiras: leque perto da piscina, jerivá no resto ----
  const piscina = aerea(D.PISCINA.deck.c);
  const leques = [], jerivas = [];
  for (const p of D.PALMEIRAS) (aerea(p).distanceTo(piscina) < 16 ? leques : jerivas).push(p);

  const tronco = new THREE.CylinderGeometry(0.15, 0.22, 1, 9).translate(0, 0.5, 0);
  const NF = 13;
  const frondeJ = geoFronde(1.25, 3.4, 0.5, 0.95);
  const tJ = new THREE.InstancedMesh(tronco, M.palmeiraTronco, jerivas.length), fJ = new THREE.InstancedMesh(frondeJ, M.jeriva, jerivas.length * NF);
  let kf = 0;
  jerivas.forEach(([px, py], i) => {
    const c = aerea([px, py]), h = 5.5 + rnd() * 4;
    const incl = new THREE.Euler((rnd() - 0.5) * 0.1, 0, (rnd() - 0.5) * 0.1);
    m4.compose(v.set(c.x, 0, c.y), q.setFromEuler(incl), s.set(1, h, 1)); tJ.setMatrixAt(i, m4);
    obstCirculo(c.x, c.y, 0.3);
    const topo = new THREE.Vector3(0, h, 0).applyEuler(incl).add(new THREE.Vector3(c.x, 0, c.y));
    for (let j = 0; j < NF; j++) {
      e.set(-0.1 - rnd() * 0.5, (j / NF) * Math.PI * 2 + rnd() * 0.4, (rnd() - 0.5) * 0.4, 'YXZ');
      const sc = 0.8 + rnd() * 0.35;
      m4.compose(topo, q.setFromEuler(e), s.set(sc, sc, sc)); fJ.setMatrixAt(kf, m4); fJ.setColorAt(kf++, varia(cor));
    }
  });
  tJ.castShadow = fJ.castShadow = true;
  cena.add(tJ, fJ);

  const folhaLeque = new THREE.PlaneGeometry(1.9, 1.9).translate(0, 0.95, 0);
  folhaLeque.rotateX(-1.0);
  const NL = 16;
  const tL = new THREE.InstancedMesh(tronco, M.palmeiraTronco, leques.length), fL = new THREE.InstancedMesh(folhaLeque, M.leque, leques.length * NL);
  kf = 0;
  leques.forEach(([px, py], i) => {
    const c = aerea([px, py]), h = 4 + rnd() * 3;
    m4.compose(v.set(c.x, 0, c.y), q.identity(), s.set(1.6, h, 1.6)); tL.setMatrixAt(i, m4);
    obstCirculo(c.x, c.y, 0.35);
    for (let j = 0; j < NL; j++) {
      const alto = j < 5;
      e.set(alto ? 0.5 + rnd() * 0.4 : -0.2 + rnd() * 0.5, (j / NL) * Math.PI * 2 * 2.3 + rnd(), 0, 'YXZ');
      const sc = 0.85 + rnd() * 0.3;
      m4.compose(v.set(c.x, h - 0.1, c.y), q.setFromEuler(e), s.set(sc, sc, sc)); fL.setMatrixAt(kf, m4); fL.setColorAt(kf++, varia(cor));
    }
  });
  tL.castShadow = fL.castShadow = true;
  cena.add(tL, fL);

  // ---- cicas ao redor das casas e dos caminhos (fotos 16, 19) ----
  const cicas = [];
  for (const id of ['salao', 'casa2', 'casa1']) {
    const e2 = D.EDIFICACOES.find((x) => x.id === id), c = aerea(e2.centroAerea);
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = 12 + rnd() * 6;
      const p = new THREE.Vector2(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
      if (pontoLivre(p.x, p.y, 0.5, true)) cicas.push(p);
    }
  }
  for (const linha of D.CAMINHOS) for (let i = 0; i < linha.length - 1; i += 1) {
    const a = aerea(linha[i]), b = aerea(linha[i + 1]), dir = b.clone().sub(a).normalize(), m = a.clone().lerp(b, 0.5), lado = rnd() > 0.5 ? 1 : -1;
    cicas.push(new THREE.Vector2(m.x - dir.y * 2.4 * lado, m.y + dir.x * 2.4 * lado));
  }
  const frondeC = geoFronde(0.5, 1.3, 0.9, 0.75);
  const NC = 16, fC = new THREE.InstancedMesh(frondeC, M.cica, cicas.length * NC);
  kf = 0;
  cicas.forEach((p) => {
    const esc = 0.8 + rnd() * 0.5;
    for (let j = 0; j < NC; j++) {
      e.set(-0.25 - rnd() * 0.5, (j / NC) * Math.PI * 2 + rnd() * 0.3, 0, 'YXZ');
      m4.compose(v.set(p.x, 0.15, p.y), q.setFromEuler(e), s.set(esc, esc, esc)); fC.setMatrixAt(kf, m4); fC.setColorAt(kf++, varia(cor, 0.9));
    }
    obstCirculo(p.x, p.y, 0.5 * esc);
  });
  fC.castShadow = true;
  cena.add(fC);

  // ---- arbustos e tuias ----
  const locais = [];
  for (const linha of D.CAMINHOS) for (let i = 0; i < linha.length - 1; i++) {
    const a = aerea(linha[i]), b = aerea(linha[i + 1]);
    for (let t = 0.1; t < 1; t += 0.25) {
      const p = a.clone().lerp(b, t), d = b.clone().sub(a).normalize(), lado = rnd() > 0.5 ? 1 : -1, off = 1.8 + rnd() * 1.8;
      locais.push([p.x - d.y * off * lado, p.y + d.x * off * lado, 0.45 + rnd() * 0.5, 1]);
    }
  }
  for (let i = 0; i < 90; i++) {
    const p = aerea([150 + rnd() * 950, 200 + rnd() * 650]);
    if (pontoLivre(p.x, p.y, 2.5)) locais.push([p.x, p.y, 0.4 + rnd() * 0.5, 1]);
  }
  for (const p of D.TUIAS || []) { const c = aerea(p); locais.push([c.x, c.y, 0.9, 3.2]); obstCirculo(c.x, c.y, 0.5); }
  const arb = new THREE.InstancedMesh(copaG, M.folha, locais.length);
  locais.forEach(([x, z, r, alt], i) => {
    const sy = r * 0.95 * alt;
    m4.compose(v.set(x, sy * 0.95, z), q.setFromEuler(e.set(0, rnd() * 6, 0)), s.set(r * 1.1, sy, r * 1.1)); arb.setMatrixAt(i, m4);
    arb.setColorAt(i, varia(cor, alt > 1 ? 0.7 : 0.85));
  });
  arb.castShadow = true; arb.receiveShadow = true;
  cena.add(arb);

  // ---- cercas-vivas ----
  const sebes = new THREE.Group();
  for (const linha of D.SEBES) for (let i = 0; i < linha.length - 1; i++) {
    const a = aerea(linha[i]), b = aerea(linha[i + 1]), len = a.distanceTo(b), ang = Math.atan2(-(b.y - a.y), b.x - a.x);
    const m = a.clone().add(b).multiplyScalar(0.5);
    const geo = new THREE.BoxGeometry(len + 1, 2.4, 1.6, Math.ceil(len / 2), 3, 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let j = 0; j < p.count; j++) {
      const n = fbm(p.getX(j) * 0.7 + i * 13, p.getY(j) * 0.7, 2) - 0.5;
      p.setY(j, p.getY(j) + n * 0.4); p.setZ(j, p.getZ(j) * (1 + n * 0.4));
      uv.setXY(j, (p.getX(j) + p.getZ(j)) / 2.2, p.getY(j) / 2.2);
    }
    geo.computeVertexNormals();
    const box = new THREE.Mesh(geo, M.sebe);
    box.position.set(m.x, 1.2, m.y); box.rotation.y = ang; box.castShadow = box.receiveShadow = true;
    sebes.add(box);
    obstCaixa(m.x, m.y, (len + 1) / 2, 0.8, ang);
  }
  cena.add(fundir(sebes));
}

// ponto livre para espalhar plantas (evita construções e áreas de lazer)
function pontoLivre(x, z, r, perto = false) {
  for (const id in edificacoes) { const e = edificacoes[id]; if (Math.hypot(x - e.centro.x, z - e.centro.y) < e.raio + r + (perto ? 0.5 : 2)) return false; }
  const especiais = [D.PISCINA.deck.c, D.LAGO.c, D.QUADRAS.beach.c, D.QUADRAS.society.c, D.ARENA.c, D.PLAYGROUND, D.FOGO, ...D.QUIOSQUES];
  for (const s of especiais) { const p = aerea(s); if (Math.hypot(x - p.x, z - p.y) < 11 + r) return false; }
  return true;
}

// ============================================================
// Montagem da cena
// ============================================================
const animados = [];
criaTerreno();
D.EDIFICACOES.forEach(criaEdificacao);
criaPiscina();
criaLago();
criaQuadras();
D.QUIOSQUES.forEach(criaQuiosque);
criaFogo();
criaArena();
criaPlayground();
criaGols();
criaRedes();
criaGalpoes();
criaCaminhos();
criaVegetacao();
renderer.shadowMap.needsUpdate = true;

// ============================================================
// Modelos assados no Blender (ferramentas/blender): substituem a versão procedural da edificação
// ============================================================
// A luz (sol, céu, luz rebatida, sombras) já vem gravada nas texturas, então os materiais são "sem luz".
const carregaGltf = new GLTFLoader();
for (const def of D.EDIFICACOES) {
  if (!def.modelo) continue;
  const e = edificacoes[def.id];
  // o host do site não serve .glb: o modelo vai em base64 num .txt
  const aoCarregar = (g) => {
    for (const o of [...e.grupo.children]) e.grupo.remove(o);
    telhados.splice(telhados.indexOf(e.telhado), 1);
    const brilho = def.modelo.brilho ?? 1;
    const reflexos = [];
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name.startsWith('vidro')) { o.material = M.vidro; o.renderOrder = 2; return; }
      o.castShadow = true;
      if (o.name.startsWith('telhado')) telhados.push(o);
      // telha metálica por fora: material com luz do site (o assado do lado de fora estoura no sol)
      if (o.name.startsWith('telhado_ext')) {
        o.material = std({ color: def.telhado.cor, normalMap: T.telhaN([1, 1]), roughnessMap: T.telhaR([1, 1]), roughness: 0.6, metalness: 0.45 });
        return;
      }
      const map = o.material.map;
      if (map) map.anisotropy = ANISO;
      // porcelanato brilhante rebate muita luz nas fotos: o piso ganha mais brilho e sombras mais abertas
      const ehPiso = o.name.startsWith('piso'), k = brilho * (ehPiso ? 1.45 : 1), gama = ehPiso ? '0.7' : '0.85';
      o.material = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k) });
      // levanta as sombras assadas sem estourar os claros
      o.material.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n  diffuseColor.rgb = pow(diffuseColor.rgb, vec3(${gama}));`);
      };
      o.layers.enable(1);
      // porcelanato espelhado: uma cópia preta, lisa e aditiva soma só o reflexo do céu
      if (o.name.startsWith('piso') && def.modelo.reflexo) {
        const r = new THREE.Mesh(o.geometry, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.22, metalness: 0, envMapIntensity: 0.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        r.position.copy(o.position); r.quaternion.copy(o.quaternion); r.scale.copy(o.scale); r.renderOrder = 1;
        reflexos.push([o.parent, r]);
      }
    });
    for (const [pai, r] of reflexos) pai.add(r);
    e.grupo.add(g.scene);
    telhados.forEach((t) => (t.visible = modo !== 'interior' && !(modo === 'foto' && foto?.v.interna)));
    renderer.shadowMap.needsUpdate = true;
  };
  const falha = (erro) => console.warn('modelo do Blender indisponível', def.id, erro);
  gerente.itemStart(def.modelo.url);
  fetch(def.modelo.url).then((r) => (def.modelo.url.endsWith('.txt') ? r.text().then((t) => Uint8Array.from(atob(t.replace(/\s/g, '')), (c) => c.charCodeAt(0)).buffer) : r.arrayBuffer()))
    .then((buf) => carregaGltf.parseAsync(buf, def.modelo.url.replace(/[^/]*$/, '')))
    .then(aoCarregar, falha).finally(() => gerente.itemEnd(def.modelo.url));
}

// ============================================================
// Estilo: maquete de arquiteto (padrão) ou texturas
// ============================================================
// Na maquete as construções e os móveis viram "papel" claro; gramado, água e vegetação mantêm a cor,
// para as fotos reais (vistas fotográficas) serem o que traz a realidade.
const MANTER_COR = new Set([M.folha, M.jeriva, M.leque, M.cica, M.sebe, M.agua, M.lago, M.fogo, M.jato, M.vidro,
  M.tronco, M.palmeiraTronco, M.gramaQuadra, M.areia, M.sape, M.sapeFranja, M.alambrado, M.redeVolei]);
const VEGETAIS = new Set([M.folha, M.jeriva, M.leque, M.cica, M.sebe, M.tronco, M.palmeiraTronco]);
const materiaisEstilo = [];
{
  const vistos = new Set(), srgb = new THREE.Color();
  cena.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material);
    // camada 1: superfícies que recebem a projeção das fotos (sem folhagem, vidro e água)
    if (!o.isInstancedMesh && !mats.some((m) => VEGETAIS.has(m) || m.transparent || m.alphaTest > 0)) o.layers.enable(1);
    for (const m of mats) {
      if (vistos.has(m) || !m.isMeshStandardMaterial) continue;
      vistos.add(m);
      if (m === terreno.mat || MANTER_COR.has(m) || m.alphaTest > 0 || m.transparent || /pastilha/.test(m.map?.userData.url || '')) continue;
      srgb.copy(m.color).convertLinearToSRGB();
      const lum = srgb.r * 0.3 + srgb.g * 0.59 + srgb.b * 0.11;
      const tom = 0.64 + 0.32 * Math.sqrt(lum);
      m.userData.estilo = {
        texturas: { color: m.color.clone(), map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, roughness: m.roughness, metalness: m.metalness, envMapIntensity: m.envMapIntensity },
        maquete: { color: new THREE.Color().setRGB(tom * 0.97, tom * 0.95, tom * 0.91, THREE.SRGBColorSpace), map: null, normalMap: null, roughnessMap: null, roughness: 0.9, metalness: 0, envMapIntensity: 0.45 },
      };
      materiaisEstilo.push(m);
    }
  });
}
const LUZ_ESTILO = {
  maquete: { sol: 2.7, ceu: 0.5, chaoCeu: 0x7d8a5c, env: 0.7, tom: THREE.ACESFilmicToneMapping, exp: 1.0 },
  texturas: { sol: 3.0, ceu: 0.25, chaoCeu: 0x5d6a3c, env: 0.85, tom: THREE.ACESFilmicToneMapping, exp: 1.0 },
};
let estilo = 'texturas';
function aplicaEstilo(novo) {
  estilo = novo;
  for (const m of materiaisEstilo) {
    const s = m.userData.estilo[novo];
    m.color.copy(s.color);
    Object.assign(m, { map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: s.roughness, metalness: s.metalness, envMapIntensity: s.envMapIntensity });
    m.needsUpdate = true;
  }
  const L = LUZ_ESTILO[novo];
  luzSol.intensity = L.sol; luzCeu.intensity = L.ceu; luzCeu.groundColor.set(L.chaoCeu);
  cena.environmentIntensity = L.env;
  renderer.toneMapping = L.tom; renderer.toneMappingExposure = L.exp;
  renderer.shadowMap.needsUpdate = true;
  for (const b of document.querySelectorAll('#estilo button')) b.setAttribute('aria-pressed', String(b.dataset.estilo === novo));
}
{
  let salvo = null;
  try { salvo = localStorage.getItem('estilo-v2'); localStorage.removeItem('estilo'); } catch { /* sem armazenamento */ }
  aplicaEstilo(salvo === 'maquete' ? 'maquete' : 'texturas');
  for (const b of document.querySelectorAll('#estilo button')) b.addEventListener('click', () => {
    aplicaEstilo(b.dataset.estilo);
    try { localStorage.setItem('estilo-v2', b.dataset.estilo); } catch { /* sem armazenamento */ }
  });
}

// ============================================================
// Pontos de interesse
// ============================================================
const lugares = D.LUGARES.map((l) => {
  const p = aerea(l.aerea), e = l.edif ? edificacoes[l.edif] : null;
  return { ...l, pos: new THREE.Vector3(p.x, e ? e.altura + 1.5 : 3, p.y), alvo: new THREE.Vector3(p.x, e ? 1.5 : 0.5, p.y), e };
});
const comodos = Object.values(edificacoes).flatMap((e) => e.comodos);

// ============================================================
// Ambientes reais (Gaussian Splatting — Fase 2)
// ============================================================
const AMBIENTES = [...(D.AMBIENTES_REAIS || [])];
// cena pública só para teste interno (não é publicada): abra com #teste
if (location.hash.includes('teste')) AMBIENTES.push({ id: 'teste', nome: 'Sala de exemplo', vinculo: 'salao-jogos', partes: ['_teste/teste.0.txt', '_teste/teste.1.txt'], aviso: 'cena pública de teste, não é a chácara', pose: { pos: [0, 0, 0], rotY: 0, inverteX: true, escala: 1, piso: 0 } });
for (const a of AMBIENTES) {
  const alvo = [...lugares, ...comodos].find((x) => x.id === a.vinculo);
  if (alvo) alvo.real = a;
}
let spark = null, sparkRender = null, modoReal = null;
const ocultosReal = [];

async function bytesDoAmbiente(a, progresso) {
  if (a.arquivo) return new Uint8Array(await (await fetch(a.arquivo)).arrayBuffer());
  let feitos = 0;
  const textos = await Promise.all(a.partes.map((p) => fetch(p).then((r) => r.text()).then((t) => { progresso(++feitos / a.partes.length); return t; })));
  const bin = atob(textos.join('').replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function aplicaPose(m, pose) {
  m.position.set(...pose.pos);
  m.rotation.set(pose.inverteX ? Math.PI : 0, deg(pose.rotY || 0), 0, 'YXZ');
  m.scale.setScalar(pose.escala || 1);
  m.updateMatrixWorld(true);
}
function mostraMaquete(sim) { for (const o of ocultosReal) o.visible = sim; }

async function entraReal(a) {
  if (modoReal) saiReal(true);
  $('painel').hidden = true;
  $('real').hidden = false;
  $('realNome').textContent = a.nome;
  $('realAviso').textContent = a.aviso || 'captura 3D fotorrealista';
  $('realStatus').textContent = 'carregando a captura…';
  try {
    if (!spark) {
      spark = await import('@sparkjsdev/spark');
      sparkRender = new spark.SparkRenderer({ renderer });
      cena.add(sparkRender);
    }
    const bytes = await bytesDoAmbiente(a, (f) => ($('realStatus').textContent = `baixando · ${Math.round(f * 100)}%`));
    $('realStatus').textContent = 'montando…';
    const malha = new spark.SplatMesh({ fileBytes: bytes, fileType: a.tipo || 'spz' });
    await malha.initialized;
    aplicaPose(malha, a.pose);
    for (const o of cena.children) if (o !== sparkRender && !o.isLight && o.visible) { o.visible = false; ocultosReal.push(o); }
    cena.add(malha);
    const caixa = malha.getBoundingBox().clone().applyMatrix4(malha.matrixWorld);
    const centro = caixa.getCenter(new THREE.Vector3()), tam = caixa.getSize(new THREE.Vector3());
    modoReal = { a, malha, colisao: !!a.alinhado, piso: a.pose.piso ?? 0, centro, raio: Math.max(2, Math.max(tam.x, tam.z) / 2) };
    document.body.classList.add('em-real');
    $('mapaCaixa').hidden = !a.alinhado;
    controles.minDistance = 0.3; controles.maxDistance = modoReal.raio * 5; controles.maxPolarAngle = Math.PI * 0.95;
    $('modoAereo').textContent = 'Orbitar'; $('modoInterior').disabled = true;
    const n = malha.numSplats || a.splats;
    $('realStatus').textContent = n ? `${n.toLocaleString('pt-BR')} splats` : '';
    if (a.inicio) setModo('caminhar', { ponto: { x: a.inicio.pos[0], z: a.inicio.pos[1] }, yaw: deg(a.inicio.yaw || 0) });
    else {
      setModo('aereo', { semVoo: true });
      const alvo = a.olhar ? new THREE.Vector3(...a.olhar) : centro.clone();
      voa(alvo.clone().add(new THREE.Vector3(modoReal.raio * 0.7, modoReal.raio * 0.35, modoReal.raio * 0.7)), alvo, 1.2);
    }
    if (location.hash.includes('alinhar')) abreAlinhar();
  } catch (e) {
    console.error(e);
    $('realStatus').textContent = 'não foi possível carregar a captura';
  }
}

function saiReal(trocando) {
  if (!modoReal) return;
  cena.remove(modoReal.malha);
  modoReal.malha.dispose?.();
  mostraMaquete(true); ocultosReal.length = 0;
  modoReal = null;
  document.body.classList.remove('em-real');
  $('mapaCaixa').hidden = false;
  controles.minDistance = 6; controles.maxDistance = 260; controles.maxPolarAngle = deg(84);
  $('modoAereo').textContent = 'Vista aérea'; $('modoInterior').disabled = false;
  if (trocando === true) return;
  $('real').hidden = true; $('alinhar').hidden = true;
  setModo('aereo', { semVoo: true });
  voa(new THREE.Vector3(-68, 38, 110), new THREE.Vector3(6, 0, 14), 1.4);
  renderer.shadowMap.needsUpdate = true;
}
$('realSair').addEventListener('click', () => saiReal());

// ferramenta de alinhamento (#alinhar): encaixa a captura sobre a maquete
function abreAlinhar() {
  const p = modoReal.a.pose;
  $('alinhar').hidden = false;
  const val = { x: p.pos[0], y: p.pos[1], z: p.pos[2], rotY: p.rotY || 0, escala: p.escala || 1, piso: p.piso ?? 0 };
  const sinc = () => {
    const v = (k) => Number($('al_' + k).value);
    p.pos = [v('x'), v('y'), v('z')]; p.rotY = v('rotY'); p.escala = v('escala'); p.piso = v('piso'); p.inverteX = $('al_inverteX').checked;
    modoReal.piso = p.piso;
    aplicaPose(modoReal.malha, p);
    $('al_json').value = JSON.stringify({ pose: p });
  };
  for (const [k, v] of Object.entries(val)) { $('al_' + k).value = v; $('al_' + k).oninput = sinc; }
  $('al_inverteX').checked = !!p.inverteX; $('al_inverteX').onchange = sinc;
  $('al_maquete').checked = false; $('al_maquete').onchange = () => mostraMaquete($('al_maquete').checked);
  $('al_copiar').onclick = () => { navigator.clipboard?.writeText($('al_json').value).then(() => ($('al_copiar').textContent = 'Copiado'), () => $('al_json').select()); };
  sinc();
}
const pinos = $('pinos');
const pinosLista = [];
function criaPino(item, classe) {
  const b = document.createElement('button');
  b.className = 'pino ' + classe;
  b.innerHTML = `<span></span><i></i><b></b>`;
  b.querySelector('span').textContent = item.nome;
  b.addEventListener('click', (ev) => { ev.stopPropagation(); seleciona(item); });
  pinos.appendChild(b);
  pinosLista.push({ el: b, item, classe });
}
lugares.filter((l) => !l.semPino).forEach((l) => criaPino(l, 'lugar'));
comodos.forEach((c) => criaPino(c, 'comodo'));

// ============================================================
// Estado de navegação
// ============================================================
let modo = 'aereo';
const anda = { pos: new THREE.Vector3(), yaw: 0, pitch: -0.05, vel: new THREE.Vector3(), alvo: null, olhoY: 1.65 };
const teclas = new Set();
let voo = null; // animação de câmera
let selecionado = null;

function alturaPiso(x, z) {
  if (modoReal) return modoReal.piso;
  let y = 0;
  for (const p of pisosCaminhaveis) {
    const dx = x - p.cx, dz = z - p.cz, lx = p.cos * dx - p.sin * dz - p.ox, lz = p.sin * dx + p.cos * dz - p.oz;
    if (Math.abs(lx) < p.hx && Math.abs(lz) < p.hz) y = Math.max(y, p.y);
  }
  return y;
}

const facil = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function voa(posFim, alvoFim, dur = 1.6, fim) {
  voo = { t: 0, dur, p0: camera.position.clone(), a0: controles.target.clone(), p1: posFim, a1: alvoFim, fim };
}

function enquadra(alvo, dist, elev = 0.75) {
  const dir = camera.position.clone().sub(controles.target).setY(0);
  if (dir.lengthSq() < 1) dir.set(1, 0, 1);
  dir.normalize();
  const pos = alvo.clone().addScaledVector(dir, dist * Math.cos(elev)).setY(alvo.y + dist * Math.sin(elev));
  voa(pos, alvo.clone());
}

function setModo(novo, opts = {}) {
  // saindo de uma vista fotográfica por um botão de modo: segue a partir do ponto da foto
  if (foto) {
    const v = foto.v;
    if (novo === 'caminhar' && !opts.ponto) { opts.ponto = { x: v.pos.x, z: v.pos.z }; opts.yaw = v.yaw; }
    pedidoVista++;
    encerraVista();
    modo = 'foto';
  }
  const anterior = modo;
  modo = novo;
  for (const [id, m] of [['modoAereo', 'aereo'], ['modoInterior', 'interior'], ['modoCaminhar', 'caminhar']]) $(id).setAttribute('aria-pressed', String(m === novo));
  telhados.forEach((t) => (t.visible = novo !== 'interior'));
  $('joy').hidden = !(novo === 'caminhar' && MOBILE);
  controles.autoRotate = false;
  if (novo === 'caminhar') {
    controles.enabled = false;
    const ponto = opts.ponto || pontoDeEntrada(controles.target);
    anda.pos.set(ponto.x, 0, ponto.z);
    if (!modoReal || modoReal.colisao) resolveColisao(anda.pos, 0.3);
    anda.yaw = opts.yaw ?? Math.atan2(-(controles.target.x - camera.position.x), -(controles.target.z - camera.position.z));
    anda.pitch = -0.05;
    anda.alvo = null;
    const olho = new THREE.Vector3(anda.pos.x, alturaPiso(anda.pos.x, anda.pos.z) + anda.olhoY, anda.pos.z);
    const frente = new THREE.Vector3(-Math.sin(anda.yaw), 0, -Math.cos(anda.yaw)).add(olho);
    voa(olho, frente, opts.instantaneo ? 0.01 : 1.8);
    dica(MOBILE ? 'Joystick para andar · arraste para olhar · toque no chão para ir' : 'W A S D para andar · arraste para olhar · clique no chão para ir · Shift corre');
  } else {
    controles.enabled = true;
    if (anterior === 'caminhar' || anterior === 'foto') {
      const frente = anterior === 'foto' ? camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize() : new THREE.Vector3(-Math.sin(anda.yaw), 0, -Math.cos(anda.yaw));
      const alvo = (anterior === 'foto' ? camera.position.clone() : anda.pos.clone()).addScaledVector(frente, 6).setY(0.5);
      controles.target.copy(camera.position).addScaledVector(frente, 0.01);
      if (modoReal) { alvo.y = modoReal.piso + 1; enquadra(alvo, modoReal.raio * 1.2, 0.5); }
      else enquadra(alvo, novo === 'interior' ? 26 : 48, novo === 'interior' ? 1.05 : 0.7);
    } else if (novo === 'interior' && !opts.semVoo) {
      const alvo = selecionado?.e ? selecionado.e.centro : null;
      if (alvo) enquadra(new THREE.Vector3(alvo.x, 0.5, alvo.y), 28, 1.1);
      else enquadra(controles.target.clone(), Math.min(camera.position.distanceTo(controles.target), 90), 1.05);
    }
    dica(novo === 'interior' ? 'Telhados removidos · clique num cômodo para ver as fotos' : MOBILE ? 'Arraste para girar · pinça para aproximar' : 'Arraste para girar · role para aproximar · botão direito move');
  }
  renderer.shadowMap.needsUpdate = true;
}

function pontoDeEntrada(alvo) {
  // procura um ponto livre perto do alvo
  const p = new THREE.Vector3(alvo.x, 0, alvo.z);
  resolveColisao(p, 0.6);
  return p;
}

let timerDica;
function dica(txt) {
  const el = $('dica');
  el.textContent = txt; el.style.opacity = '1';
  clearTimeout(timerDica);
  timerDica = setTimeout(() => (el.style.opacity = '0'), 7000);
}

// ============================================================
// Vistas fotográficas: a foto real encaixada no ponto de onde foi tirada
// ============================================================
// Cada foto vira uma malha com a profundidade estimada pelo MoGe-2 (img/prof), posicionada na pose
// calibrada (D.VISTAS). A câmera voa pela maquete até a pose; no caminho a foto é projetada sobre a
// maquete e, ao chegar, a malha da foto assume — mexer o mouse dá paralaxe (foto em 3D).
let PROF = {};
const profPronto = fetch('img/prof/indice.json').then((r) => (r.ok ? r.json() : {})).then((j) => { PROF = j; }).catch(() => {});
const carregaFoto = new THREE.TextureLoader();
const cenaFoto = new THREE.Scene();
const pad2 = (n) => String(n).padStart(2, '0');
const FOV_BASE = 50;

const vistas = (D.VISTAS || []).map((v) => {
  const e = v.onde ? edificacoes[v.onde] : null;
  const conv = (p) => (e ? e.plantaParaMundo(p) : (({ x, y }) => [x, y])(aerea(p)));
  const [px, pz] = conv(v.pos), [ox, oz] = conv(v.olha);
  const chao = alturaPiso(px, pz);
  const yaw = Math.atan2(-(ox - px), -(oz - pz));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(v.incl ?? 0), yaw, deg(v.giro ?? 0), 'YXZ'));
  const item = comodos.find((c) => c.fotos.includes(v.n)) || lugares.find((l) => l.id !== 'visao' && l.fotos.includes(v.n)) || lugares.find((l) => l.fotos.includes(v.n));
  const lugar = item?.edif && !item.e ? lugares.find((l) => l.edif === item.edif) : item;
  return { ...v, pos: new THREE.Vector3(px, chao + (v.alt ?? 1.5), pz), chao: new THREE.Vector3(px, chao + 0.25, pz), q, yaw, item, lugar, interna: !!v.onde };
});
const vistaDaFoto = new Map(vistas.map((v) => [v.n, v]));
const vistasDe = (item) => (item?.fotos || []).map((n) => vistaDaFoto.get(n)).filter(Boolean);
const grupoDaVista = (v) => { const g = vistasDe(v.lugar); return g.includes(v) ? g : [v]; };

function carregaImagem(src) {
  return new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
}
// foto + profundidade → malha em relevo no referencial da câmera (olhando para -Z)
function recursosDaVista(v) {
  v.rec ??= (async () => {
    await profPronto;
    const info = PROF[v.n];
    const [foto, img] = await Promise.all([
      carregaFoto.loadAsync(urlFoto(v.n)),
      info ? carregaImagem(`img/prof/${pad2(v.n)}.png`).catch(() => null) : null,
    ]);
    foto.colorSpace = THREE.SRGBColorSpace; foto.anisotropy = ANISO;
    const aspecto = foto.image.width / foto.image.height;
    const tx = Math.tan(deg(v.fov ?? info?.fov ?? 65) / 2), ty = tx / aspecto;
    // sem mapa de profundidade: um plano (na foto aérea, o chão)
    const dPlano = (v.alt ?? 1.5) > 20 ? v.alt / Math.max(0.2, Math.sin(-deg(v.incl ?? -90))) : 8;
    let gw = 2, gh = 2, prof = null, profTex = null;
    if (img) {
      gw = img.width; gh = img.height;
      const c = document.createElement('canvas'); c.width = gw; c.height = gh;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, gw, gh).data;
      const [lo, hi] = info.log, dados = new Uint8Array(gw * gh * 4);
      prof = new Float32Array(gw * gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const k = (j * gw + i) * 4, kk = ((gh - 1 - j) * gw + i) * 4; // textura: linha de baixo primeiro
        prof[j * gw + i] = Math.exp(lo + (hi - lo) * ((px[k] * 256 + px[k + 1]) / 65535));
        dados[kk] = px[k]; dados[kk + 1] = px[k + 1]; dados[kk + 3] = 255;
      }
      profTex = new THREE.DataTexture(dados, gw, gh);
      profTex.needsUpdate = true;
    }
    const pos = new Float32Array(gw * gh * 3), uv = new Float32Array(gw * gh * 2), idx = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i, u = i / (gw - 1), t = j / (gh - 1), d = prof ? prof[k] : dPlano;
      pos.set([(u * 2 - 1) * tx * d, (1 - t * 2) * ty * d, -d], k * 3);
      uv.set([u, 1 - t], k * 2);
    }
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return { foto, geo, profTex, tx, ty, aspecto, dMed: info?.med ?? dPlano, log: info?.log || [0, 0] };
  })();
  v.rec.catch(() => { v.rec = null; });
  return v.rec;
}

const matFoto = (mapa) => new THREE.ShaderMaterial({
  uniforms: { mapa: { value: mapa }, opac: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D mapa; uniform float opac; varying vec2 vUv;
void main() {
  vec2 b = smoothstep(vec2(0.0), vec2(0.02), vUv) * smoothstep(vec2(0.0), vec2(0.02), 1.0 - vUv);
  gl_FragColor = vec4(texture2D(mapa, vUv).rgb, opac * b.x * b.y);
  #include <colorspace_fragment>
}`,
  transparent: true, side: THREE.DoubleSide,
});

// projeção da foto sobre a maquete (técnica de "camera mapping"): repinta as superfícies da
// camada 1 com a foto vista da câmera original; a profundidade da foto evita pintar o que estava escondido
const fotoCam = new THREE.PerspectiveCamera(50, 1, 0.05, 3000);
const projMat = new THREE.ShaderMaterial({
  uniforms: { uFoto: { value: null }, uProf: { value: null }, uMat: { value: new THREE.Matrix4() }, uLog: { value: new THREE.Vector2() }, uTemProf: { value: 0 }, uMix: { value: 0 } },
  vertexShader: `varying vec3 vMundo;
void main() {
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vec4 w = modelMatrix * p; vMundo = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
  fragmentShader: `uniform sampler2D uFoto, uProf; uniform mat4 uMat; uniform vec2 uLog; uniform float uTemProf, uMix; varying vec3 vMundo;
void main() {
  vec4 c = uMat * vec4(vMundo, 1.0);
  if (c.w <= 0.02) discard;
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
  if (uTemProf > 0.5) {
    vec2 rg = floor(texture2D(uProf, uv).rg * 255.0 + 0.5);
    float d = exp(mix(uLog.x, uLog.y, (rg.r * 256.0 + rg.g) / 65535.0));
    if (c.w > d * 1.2 + 0.35) discard;
  }
  vec2 b = smoothstep(vec2(0.0), vec2(0.08), uv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - uv);
  gl_FragColor = vec4(texture2D(uFoto, uv).rgb, uMix * b.x * b.y);
  #include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
});
function preparaProjecao(v, rec) {
  fotoCam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(rec.ty));
  fotoCam.aspect = rec.aspecto;
  fotoCam.updateProjectionMatrix();
  fotoCam.position.copy(v.pos); fotoCam.quaternion.copy(v.q); fotoCam.updateMatrixWorld(true);
  const u = projMat.uniforms;
  u.uMat.value.multiplyMatrices(fotoCam.projectionMatrix, fotoCam.matrixWorldInverse);
  u.uFoto.value = rec.foto; u.uProf.value = rec.profTex; u.uTemProf.value = rec.profTex ? 1 : 0; u.uLog.value.set(...rec.log);
}

// campo de visão vertical para a foto caber inteira na tela
function fovConter(rec) {
  // em tela retrato (celular), corta um pouco as laterais da foto para ela não virar uma faixa estreita
  const a = camera.aspect, ty = a > rec.aspecto ? rec.ty : Math.max(rec.ty, (rec.tx / a) * (a < 0.8 ? 0.62 : 1));
  return THREE.MathUtils.radToDeg(2 * Math.atan(ty * 1.04));
}

let foto = null; // vista aberta: { v, rec, malha, voltar, trans, ... }
let pedidoVista = 0;
const eulerTmp = new THREE.Euler(), quatTmp = new THREE.Quaternion();

async function entraVista(v) {
  const meu = ++pedidoVista;
  if (modoReal) { saiReal(true); $('real').hidden = true; $('alinhar').hidden = true; }
  $('caixa').hidden = true;
  if (!foto) dica('carregando a foto…');
  let rec;
  try { rec = await recursosDaVista(v); } catch (e) { console.warn(e); dica('Não foi possível carregar a foto'); return; }
  if (meu !== pedidoVista) return;
  const de = foto;
  // limpa vistas que já estavam saindo
  for (const m of [...cenaFoto.children]) if (m !== de?.malha) { cenaFoto.remove(m); m.material.dispose(); }
  const malha = new THREE.Mesh(rec.geo, matFoto(rec.foto));
  malha.position.copy(v.pos); malha.quaternion.copy(v.q);
  malha.frustumCulled = false;
  cenaFoto.add(malha);
  const voltar = de?.voltar || { modo, pos: camera.position.clone(), alvo: controles.target.clone(), fov: camera.fov, painel: !$('painel').hidden };
  foto = { v, rec, malha, voltar, anterior: de?.malha || null, trans: null, mx: 0, my: 0, sx: 0, sy: 0, yawD: 0, pitchD: 0, zoom: 1, mov: 0, arrasto: null };
  modo = 'foto';
  for (const id of ['modoAereo', 'modoInterior', 'modoCaminhar']) $(id).setAttribute('aria-pressed', 'false');
  telhados.forEach((t) => (t.visible = !v.interna));
  controles.enabled = false; controles.autoRotate = false;
  $('joy').hidden = true; $('painel').hidden = true;
  document.body.classList.add('em-foto');
  preparaProjecao(v, rec);
  const p0 = camera.position.clone(), dist = p0.distanceTo(v.pos);
  const ctrl = p0.clone().lerp(v.pos, 0.65);
  ctrl.y = Math.max(p0.y, v.pos.y + Math.min(dist * 0.3, v.interna ? 14 : 8));
  foto.trans = { t: 0, dur: THREE.MathUtils.clamp(0.9 + dist * 0.025, 1.2, 2.6), p0, ctrl, p1: v.pos.clone(), q0: camera.quaternion.clone(), q1: v.q.clone(), f0: camera.fov, f1: fovConter(rec) };
  renderer.shadowMap.needsUpdate = true;
  mostraHudFoto();
  dispatchEvent(new Event('vista'));
  // adianta as vizinhas do mesmo lugar
  const g = grupoDaVista(v), i = g.indexOf(v);
  for (const w of [g[i + 1], g[i - 1]]) if (w) recursosDaVista(w).catch(() => {});
}

function saiVista() {
  if (!foto || foto.trans?.saida) return;
  const vo = foto.voltar;
  pedidoVista++;
  $('fotoHud').hidden = true;
  if (vo.modo === 'caminhar') {
    // continua caminhando a partir de onde a foto foi tirada
    const v = foto.v;
    encerraVista();
    setModo('caminhar', { ponto: { x: v.pos.x, z: v.pos.z }, yaw: v.yaw });
    return;
  }
  const q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(vo.pos, vo.alvo, camera.up));
  const p0 = camera.position.clone(), dist = p0.distanceTo(vo.pos);
  const ctrl = p0.clone().lerp(vo.pos, 0.35);
  ctrl.y = Math.max(vo.pos.y, p0.y + Math.min(dist * 0.3, 14));
  foto.trans = { t: 0, dur: THREE.MathUtils.clamp(0.9 + dist * 0.02, 1.1, 2.2), p0, ctrl, p1: vo.pos.clone(), q0: camera.quaternion.clone(), q1, f0: camera.fov, f1: vo.fov, saida: true };
}

// fecha a vista na hora (sem voo); quem chama decide o próximo modo
function encerraVista() {
  if (!foto) return;
  for (const m of [...cenaFoto.children]) { cenaFoto.remove(m); m.material.dispose(); }
  projMat.uniforms.uMix.value = 0;
  const vo = foto.voltar;
  foto = null;
  modo = vo.modo;
  document.body.classList.remove('em-foto');
  $('fotoHud').hidden = true;
  if (vo.painel && selecionado) $('painel').hidden = false;
}

function atualizaFoto(dt, t) {
  const f = foto, tr = f.trans;
  if (tr) {
    tr.t = Math.min(1, tr.t + dt / tr.dur);
    const k = facil(tr.t), a = 1 - k;
    camera.position.set(
      a * a * tr.p0.x + 2 * a * k * tr.ctrl.x + k * k * tr.p1.x,
      a * a * tr.p0.y + 2 * a * k * tr.ctrl.y + k * k * tr.p1.y,
      a * a * tr.p0.z + 2 * a * k * tr.ctrl.z + k * k * tr.p1.z);
    camera.quaternion.slerpQuaternions(tr.q0, tr.q1, k);
    camera.fov = THREE.MathUtils.lerp(tr.f0, tr.f1, k);
    camera.updateProjectionMatrix();
    const S = THREE.MathUtils.smoothstep;
    if (tr.saida) {
      f.malha.material.uniforms.opac.value = 1 - S(tr.t, 0, 0.3);
    } else {
      f.malha.material.uniforms.opac.value = S(tr.t, 0.62, 1);
      if (f.anterior) f.anterior.material.uniforms.opac.value = 1 - S(tr.t, 0, 0.3);
      projMat.uniforms.uMix.value = S(tr.t, 0.4, 0.8) * 0.6;
    }
    if (tr.t >= 1) {
      f.trans = null;
      projMat.uniforms.uMix.value = 0;
      if (f.anterior) { cenaFoto.remove(f.anterior); f.anterior.material.dispose(); f.anterior = null; }
      if (tr.saida) {
        const vo = f.voltar;
        encerraVista();
        controles.target.copy(vo.alvo);
        setModo(vo.modo, { semVoo: true });
      } else if (!calibrando) dica(MOBILE ? 'Arraste para olhar em volta · a foto tem profundidade' : 'Mova o mouse: a foto ganha profundidade · arraste para olhar em volta · ← → trocam a foto');
    }
    return;
  }
  // paralaxe: o mouse (ou um balanço lento quando parado) desloca a câmera em volta do ponto focal
  const parado = !f.arrasto && performance.now() - f.mov > 2500;
  const ax = parado ? Math.sin(t * 0.45) * 0.6 : f.mx, ay = parado ? Math.sin(t * 0.31) * 0.35 : f.my;
  f.sx += (ax - f.sx) * Math.min(1, dt * 3); f.sy += (ay - f.sy) * Math.min(1, dt * 3);
  const dm = f.rec.dMed, amp = calibrando ? 0 : THREE.MathUtils.clamp(dm * 0.035, 0.04, 0.5);
  tmp.set(f.sx * amp, -f.sy * amp * 0.6, 0);
  eulerTmp.set(-Math.atan2(tmp.y, dm) + f.pitchD, Math.atan2(tmp.x, dm) + f.yawD, 0, 'YXZ');
  tmp.applyQuaternion(f.v.q);
  camera.position.copy(f.v.pos).add(tmp);
  camera.quaternion.copy(f.v.q).multiply(quatTmp.setFromEuler(eulerTmp));
  const fovAlvo = fovConter(f.rec) * f.zoom;
  if (Math.abs(camera.fov - fovAlvo) > 0.01) { camera.fov += (fovAlvo - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
}

// ---- interface da vista ----
function mostraHudFoto() {
  const { v } = foto, g = grupoDaVista(v), i = g.indexOf(v);
  const it = v.item, edif = it?.edif ? edificacoes[it.edif].def.nome : null;
  $('fotoHud').hidden = false;
  $('fotoTipo').textContent = `Foto real · ${edif || v.lugar?.tipo || 'Chácara'}`;
  $('fotoNome').textContent = it?.nome || 'Foto';
  $('fotoInfo').textContent = `foto ${pad2(v.n)} do anúncio`;
  $('fotoConta').textContent = `${i + 1}/${g.length}`;
  $('fotoAnt').disabled = $('fotoProx').disabled = g.length < 2;
}
function trocaFoto(passo) {
  if (!foto) return;
  const g = grupoDaVista(foto.v), i = g.indexOf(foto.v);
  if (g.length > 1) entraVista(g[(i + passo + g.length) % g.length]);
}
$('fotoAnt').addEventListener('click', () => trocaFoto(-1));
$('fotoProx').addEventListener('click', () => trocaFoto(1));
$('fotoSair').addEventListener('click', () => saiVista());
$('fotoAmpliar').addEventListener('click', () => {
  if (!foto) return;
  const ns = grupoDaVista(foto.v).map((w) => w.n);
  abreCaixa(ns, ns.indexOf(foto.v.n));
});

// pinos das vistas (ícone de câmera no ponto onde cada foto foi tirada)
for (const v of vistas) {
  const b = document.createElement('button');
  b.className = 'pino vista';
  b.setAttribute('aria-label', `Ver foto ${pad2(v.n)}${v.item ? ' · ' + v.item.nome : ''}`);
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13.2" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span></span>';
  b.querySelector('span').textContent = `foto ${pad2(v.n)}`;
  b.addEventListener('click', (ev) => { ev.stopPropagation(); entraVista(v); });
  pinos.appendChild(b);
  pinosLista.push({ el: b, item: v, classe: 'vista', pos: v.chao });
}
function vistaVisivel(v, dist) {
  if (modoReal) return false;
  if (modo === 'foto') return !!foto && !foto.trans && v !== foto.v && v.onde === foto.v.onde && dist > 0.8 && dist < 40;
  if (modo === 'caminhar') return dist > 1.2 && dist < 26 && v.interna === alturaPiso(anda.pos.x, anda.pos.z) > 0.05;
  if (modo === 'interior') return dist < 55;
  return !v.interna && !!selecionado && (v.lugar === selecionado || v.item === selecionado) && dist < 120;
}

// ---- calibração (#calibrar): ajustar a pose de cada foto sobre a maquete ----
const calibrando = location.hash.includes('calibrar');
if (calibrando) {
  const cx = $('calibrar');
  cx.hidden = false;
  const campos = ['pos', 'olha', 'alt', 'incl', 'giro', 'fov'];
  const sinc = () => {
    if (!foto) return;
    const v = foto.v, src = D.VISTAS.find((x) => x.n === v.n);
    const num = (id) => Number($('cal_' + id).value);
    const par = (id) => $('cal_' + id).value.split(',').map(Number);
    Object.assign(src, { pos: par('pos'), olha: par('olha'), alt: num('alt'), incl: num('incl'), giro: num('giro') || undefined, fov: num('fov') || undefined });
    const novo = vistas.find((x) => x.n === v.n);
    const e = src.onde ? edificacoes[src.onde] : null;
    const conv = (p) => (e ? e.plantaParaMundo(p) : (({ x, y }) => [x, y])(aerea(p)));
    const [px, pz] = conv(src.pos), [ox, oz] = conv(src.olha);
    novo.yaw = Math.atan2(-(ox - px), -(oz - pz));
    novo.pos.set(px, alturaPiso(px, pz) + src.alt, pz); novo.chao.set(px, novo.pos.y - src.alt + 0.25, pz);
    novo.q.setFromEuler(new THREE.Euler(deg(src.incl), novo.yaw, deg(src.giro || 0), 'YXZ'));
    if (src.fov) { foto.rec.tx = Math.tan(deg(src.fov) / 2); foto.rec.ty = foto.rec.tx / foto.rec.aspecto; }
    foto.malha.position.copy(novo.pos); foto.malha.quaternion.copy(novo.q);
    foto.malha.material.uniforms.opac.value = Number($('cal_opac').value);
    $('cal_json').value = JSON.stringify(Object.fromEntries(Object.entries(src).filter(([, x]) => x !== undefined))).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w)/g, ', ');
  };
  const carrega = () => {
    if (!foto) return;
    const src = D.VISTAS.find((x) => x.n === foto.v.n);
    $('cal_n').textContent = `foto ${pad2(src.n)}${src.onde ? ' · planta ' + src.onde : ' · aérea'}`;
    for (const k of campos) $('cal_' + k).value = Array.isArray(src[k]) ? src[k].join(',') : src[k] ?? '';
    if (!src.fov) $('cal_fov').placeholder = String(PROF[src.n]?.fov ?? 65);
    sinc();
  };
  for (const k of [...campos, 'opac']) $('cal_' + k).addEventListener('input', sinc);
  $('cal_copiar').addEventListener('click', () => navigator.clipboard?.writeText($('cal_json').value).catch(() => $('cal_json').select()));
  addEventListener('vista', carrega);
  // automação: renderiza a maquete exatamente na pose da foto (para comparar lado a lado)
  window.__vistas = {
    lista: () => vistas.map((v) => v.n),
    entra: (n) => entraVista(vistaDaFoto.get(n)),
    estado: () => (foto ? { n: foto.v.n, t: foto.trans?.t ?? 1, mix: projMat.uniforms.uMix.value } : null),
    async render(n, larg = 640) {
      const v = vistaDaFoto.get(n);
      const rec = await recursosDaVista(v);
      const alt = Math.round(larg / rec.aspecto);
      renderer.setPixelRatio(1); renderer.setSize(larg, alt, false);
      camera.aspect = rec.aspecto; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(rec.ty));
      camera.updateProjectionMatrix();
      camera.position.copy(v.pos); camera.quaternion.copy(v.q);
      telhados.forEach((t) => (t.visible = true));
      renderer.shadowMap.needsUpdate = true;
      renderer.render(cena, camera);
      const url = renderer.domElement.toDataURL('image/jpeg', 0.85);
      renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      return url;
    },
  };
}
function seleciona(item) {
  selecionado = item;
  document.querySelectorAll('#listaLugares button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === item.id)));
  pinosLista.forEach((p) => p.el.classList.toggle('ativo', p.item === item));
  // cômodo com foto: voa direto para o ponto de vista da foto
  const vs = item.edif && !item.e ? vistasDe(item) : [];
  if (vs.length) { abrePainel(item); entraVista(vs[0]); return; }
  if (foto) { const vo = foto.voltar; pedidoVista++; encerraVista(); setModo(vo.modo === 'caminhar' ? 'aereo' : vo.modo, { semVoo: true }); }
  abrePainel(item);
  if (modo === 'caminhar') return;
  if (item.edif && item.pos && !item.e) {
    // cômodo
    if (modo !== 'interior') setModo('interior', { semVoo: true });
    enquadra(new THREE.Vector3(item.pos.x, 0.5, item.pos.z), 11, 1.05);
  } else if (item.id === 'visao') {
    voa(new THREE.Vector3(-70, 95, 110), new THREE.Vector3(0, 0, 5), 2);
  } else if (item.e) {
    enquadra(item.alvo, item.e.raio * 2.6 + 12, modo === 'interior' ? 1.1 : 0.55);
  } else {
    enquadra(item.alvo, 26, 0.5);
  }
}

function urlFoto(n, mini) { return `img/${mini ? 'mini' : 'fotos'}/${String(n).padStart(2, '0')}.jpg`; }

function abrePainel(item) {
  $('painel').hidden = false;
  $('pTipo').textContent = item.tipo || (item.edif ? edificacoes[item.edif].def.nome : '');
  $('pNome').textContent = item.nome;
  const corpo = $('pCorpo');
  corpo.replaceChildren();
  const p = document.createElement('p'); p.textContent = item.texto; corpo.appendChild(p);
  if (item.fotos?.length) {
    const grade = document.createElement('div'); grade.className = 'fotos';
    item.fotos.forEach((n, i) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', `Abrir foto ${n}`);
      const v = vistaDaFoto.get(n);
      b.innerHTML = `<img loading="lazy" alt=""><span class="n${v ? ' local' : ''}">foto ${pad2(n)}</span>`;
      b.querySelector('img').src = urlFoto(n, i > 0);
      b.addEventListener('click', () => (v ? entraVista(v) : abreCaixa(item.fotos, i)));
      grade.appendChild(b);
    });
    corpo.appendChild(grade);
  } else {
    const v = document.createElement('div'); v.className = 'vazio';
    v.innerHTML = '<b>Sem fotos no anúncio.</b> Vale fotografar este ambiente na visita de captura.';
    corpo.appendChild(v);
  }
  const acoes = document.createElement('div'); acoes.className = 'acoes';
  const btn = (txt, fn, sec) => { const b = document.createElement('button'); b.className = 'btn' + (sec ? ' sec' : ''); b.textContent = txt; b.addEventListener('click', fn); acoes.appendChild(b); };
  const vs = vistasDe(item);
  if (vs.length) { btn(vs.length > 1 ? `Ver as ${vs.length} fotos no local` : 'Ver a foto no local', () => entraVista(vs[0])); acoes.lastChild.classList.add('foto'); }
  if (item.real) { btn('Ver ambiente real', () => entraReal(item.real)); acoes.lastChild.classList.add('real'); }
  if (item.id !== 'visao') btn('Caminhar até aqui', () => caminharAte(item), !!item.real || vs.length > 0);
  if (item.e) btn('Ver por dentro', () => { setModo('interior', { semVoo: true }); enquadra(new THREE.Vector3(item.e.centro.x, 0.5, item.e.centro.y), item.e.raio * 2.2 + 6, 1.15); }, true);
  corpo.appendChild(acoes);
  const lista = item.e ? item.e.comodos : null;
  if (lista?.length) {
    const c = document.createElement('div'); c.className = 'comodos';
    c.innerHTML = '<h3>Cômodos</h3>';
    lista.forEach((cm) => {
      const b = document.createElement('button');
      b.innerHTML = `<span></span><small>${cm.fotos.length ? cm.fotos.length + (cm.fotos.length > 1 ? ' fotos' : ' foto') : 'sem foto'}</small>`;
      b.querySelector('span').textContent = cm.nome;
      b.addEventListener('click', () => seleciona(cm));
      c.appendChild(b);
    });
    corpo.appendChild(c);
  }
  corpo.scrollTop = 0;
}

function caminharAte(item) {
  let ponto, yaw;
  if (item.e) {
    // de frente para a edificação, do lado da câmera
    const c = item.e.centro, dir = new THREE.Vector2(camera.position.x - c.x, camera.position.z - c.y).normalize();
    const d = item.e.raio + 4;
    ponto = new THREE.Vector3(c.x + dir.x * d, 0, c.y + dir.y * d);
    yaw = Math.atan2(dir.x, dir.y);
  } else if (item.edif) {
    ponto = new THREE.Vector3(item.pos.x, 0, item.pos.z);
    yaw = anda.yaw;
  } else {
    const c = item.alvo, dir = new THREE.Vector2(camera.position.x - c.x, camera.position.z - c.z).normalize();
    ponto = new THREE.Vector3(c.x + dir.x * 7, 0, c.z + dir.y * 7);
    yaw = Math.atan2(dir.x, dir.y);
  }
  if (MOBILE) $('painel').hidden = true;
  setModo('caminhar', { ponto, yaw });
}

$('pFechar').addEventListener('click', () => {
  $('painel').hidden = true;
  selecionado = null;
  pinosLista.forEach((p) => p.el.classList.remove('ativo'));
  document.querySelectorAll('#listaLugares button').forEach((b) => b.setAttribute('aria-current', 'false'));
});

// lightbox
let caixaFotos = [], caixaI = 0;
function abreCaixa(fotos, i) { caixaFotos = fotos; caixaI = i; $('caixa').hidden = false; mostraCaixa(); }
function mostraCaixa() {
  const n = caixaFotos[caixaI];
  $('caixaImg').src = urlFoto(n);
  $('caixaLeg').textContent = `foto ${String(n).padStart(2, '0')} · ${caixaI + 1}/${caixaFotos.length}`;
}
$('caixaAnt').addEventListener('click', () => { caixaI = (caixaI - 1 + caixaFotos.length) % caixaFotos.length; mostraCaixa(); });
$('caixaProx').addEventListener('click', () => { caixaI = (caixaI + 1) % caixaFotos.length; mostraCaixa(); });
$('caixaFechar').addEventListener('click', () => ($('caixa').hidden = true));
$('caixa').addEventListener('click', (e) => { if (e.target.id === 'caixa' || e.target.id === 'caixaImg') $('caixa').hidden = true; });

// ============================================================
// Interface: cabeçalho e lista
// ============================================================
$('titulo').textContent = D.IMOVEL.titulo;
$('subtitulo').textContent = D.IMOVEL.subtitulo;
$('fatos').innerHTML = D.IMOVEL.resumo.map((r) => { const [n, ...t] = r.split(' '); return `<span><b>${n}</b> ${t.join(' ')}</span>`; }).join('');
$('nota').textContent = D.IMOVEL.nota;
$('avaliacoes').textContent = `${D.IMOVEL.avaliacoes} avaliações`;
$('airbnb').href = D.IMOVEL.airbnb;
const ul = $('listaLugares');
for (const l of lugares) {
  const li = document.createElement('li'), b = document.createElement('button');
  b.dataset.id = l.id;
  b.innerHTML = `<span class="nome"></span>${l.real ? '<span class="selo">3D real</span>' : l.fotos.length ? '' : '<span class="sem">sem foto</span>'}<span class="tipo"></span>`;
  b.querySelector('.nome').textContent = l.nome;
  b.querySelector('.tipo').textContent = l.tipo;
  b.addEventListener('click', () => seleciona(l));
  li.appendChild(b); ul.appendChild(li);
}
$('modoAereo').addEventListener('click', () => setModo('aereo'));
$('modoInterior').addEventListener('click', () => setModo('interior'));
$('modoCaminhar').addEventListener('click', () => setModo('caminhar'));

// ============================================================
// Entrada: teclado, arrasto, clique no chão, joystick
// ============================================================
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (!$('caixa').hidden) {
    if (e.key === 'Escape') $('caixa').hidden = true;
    if (e.key === 'ArrowRight') $('caixaProx').click();
    if (e.key === 'ArrowLeft') $('caixaAnt').click();
    return;
  }
  if (modo === 'foto') {
    if (e.key === 'Escape') saiVista();
    if (e.key === 'ArrowRight') trocaFoto(1);
    if (e.key === 'ArrowLeft') trocaFoto(-1);
    return;
  }
  teclas.add(e.code);
  if (modo === 'caminhar' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());

const tela = renderer.domElement;
let arrasto = null;
tela.addEventListener('pointerdown', (e) => {
  if (modo === 'foto' && foto) {
    foto.arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY };
    tela.setPointerCapture(e.pointerId);
    return;
  }
  if (modo !== 'caminhar') return;
  arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() };
  tela.setPointerCapture(e.pointerId);
});
tela.addEventListener('pointermove', (e) => {
  if (modo === 'foto' && foto) {
    foto.mov = performance.now();
    const a = foto.arrasto;
    if (a && a.id === e.pointerId) {
      const k = (e.pointerType === 'touch' ? 0.005 : 0.003) * foto.zoom;
      foto.yawD = THREE.MathUtils.clamp(foto.yawD + (e.clientX - a.x) * k, -0.45, 0.45);
      foto.pitchD = THREE.MathUtils.clamp(foto.pitchD + (e.clientY - a.y) * k, -0.3, 0.3);
      a.x = e.clientX; a.y = e.clientY;
    } else if (e.pointerType === 'mouse') {
      foto.mx = (e.clientX / innerWidth) * 2 - 1; foto.my = (e.clientY / innerHeight) * 2 - 1;
    }
    return;
  }
  if (!arrasto || e.pointerId !== arrasto.id) return;
  const k = e.pointerType === 'touch' ? 0.006 : 0.0035;
  anda.yaw -= (e.clientX - arrasto.x) * k;
  anda.pitch = THREE.MathUtils.clamp(anda.pitch - (e.clientY - arrasto.y) * k, -1.2, 1.0);
  arrasto.x = e.clientX; arrasto.y = e.clientY;
});
const ray = new THREE.Raycaster(), chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
tela.addEventListener('pointerup', (e) => {
  if (foto?.arrasto?.id === e.pointerId) { foto.arrasto = null; foto.mov = performance.now(); return; }
  if (!arrasto || e.pointerId !== arrasto.id) return;
  const curto = Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 6 && performance.now() - arrasto.t < 350;
  arrasto = null;
  if (!curto || modo !== 'caminhar' || voo) return;
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  chao.constant = modoReal ? -modoReal.piso : 0;
  if (ray.ray.intersectPlane(chao, p) && p.distanceTo(anda.pos) < 70) anda.alvo = p.setY(0);
});

tela.addEventListener('pointercancel', () => { if (foto) foto.arrasto = null; });
tela.addEventListener('wheel', (e) => {
  if (modo !== 'foto' || !foto) return;
  e.preventDefault();
  foto.zoom = THREE.MathUtils.clamp(foto.zoom * Math.exp(e.deltaY * 0.0012), 0.45, 1);
}, { passive: false });
tela.addEventListener('dblclick', () => { if (foto) { foto.yawD = foto.pitchD = 0; foto.zoom = 1; } });

const joy = { x: 0, y: 0, ativo: false };
const joyEl = $('joy');
function joyMove(e) {
  const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const m = Math.hypot(dx, dy), max = r.width / 2 - 10;
  if (m > max) { dx *= max / m; dy *= max / m; }
  joy.x = dx / max; joy.y = dy / max;
  joyEl.style.setProperty('--jx', dx + 'px'); joyEl.style.setProperty('--jy', dy + 'px');
}
joyEl.addEventListener('pointerdown', (e) => { joy.ativo = true; joyEl.setPointerCapture(e.pointerId); joyMove(e); anda.alvo = null; });
joyEl.addEventListener('pointermove', (e) => joy.ativo && joyMove(e));
const joySolta = () => { joy.ativo = false; joy.x = joy.y = 0; joyEl.style.setProperty('--jx', '0px'); joyEl.style.setProperty('--jy', '0px'); };
joyEl.addEventListener('pointerup', joySolta);
joyEl.addEventListener('pointercancel', joySolta);

// ============================================================
// Minimapa
// ============================================================
const mm = $('minimapa'), mg = mm.getContext('2d'), mmImg = new Image();
mmImg.src = 'img/mapa.jpg';
function desenhaMinimapa() {
  const W = mm.width, H = mm.height;
  if (mmImg.complete && mmImg.naturalWidth) mg.drawImage(mmImg, 0, 0, W, H); else { mg.fillStyle = '#6b8f3a'; mg.fillRect(0, 0, W, H); }
  const sx = W / D.MAPA.largura, sy = H / D.MAPA.altura;
  const ponto = modo === 'caminhar' ? anda.pos : modo === 'foto' ? camera.position : controles.target;
  const [ax, ay] = mundoParaAerea(ponto.x, ponto.z);
  const x = ax * sx, y = ay * sy;
  let yaw;
  if (modo === 'caminhar') yaw = anda.yaw;
  else if (modo === 'foto') { camera.getWorldDirection(tmp); yaw = Math.atan2(-tmp.x, -tmp.z); }
  else yaw = Math.atan2(-(controles.target.x - camera.position.x), -(controles.target.z - camera.position.z));
  // cone de visão
  mg.save(); mg.translate(x, y); mg.rotate(-yaw);
  const grd = mg.createRadialGradient(0, 0, 0, 0, 0, 60);
  grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  mg.fillStyle = grd; mg.beginPath(); mg.moveTo(0, 0); mg.arc(0, 0, 60, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); mg.closePath(); mg.fill();
  mg.restore();
  mg.fillStyle = '#e0a35a'; mg.strokeStyle = '#fff'; mg.lineWidth = 3;
  mg.beginPath(); mg.arc(x, y, 7, 0, Math.PI * 2); mg.fill(); mg.stroke();
}
mm.addEventListener('click', (e) => {
  const r = mm.getBoundingClientRect();
  const ax = ((e.clientX - r.left) / r.width) * D.MAPA.largura, ay = ((e.clientY - r.top) / r.height) * D.MAPA.altura;
  const p = aerea([ax, ay]);
  if (modo === 'foto') return;
  if (modo === 'caminhar') { anda.pos.set(p.x, 0, p.y); resolveColisao(anda.pos, 0.6); anda.alvo = null; }
  else enquadra(new THREE.Vector3(p.x, 0.5, p.y), Math.min(camera.position.distanceTo(controles.target), 60), modo === 'interior' ? 1.05 : 0.7);
});

// ============================================================
// Loop
// ============================================================
const relogio = new THREE.Clock();
const tmp = new THREE.Vector3();
let quadros = 0, tempoMedido = 0, ajustado = false;

function atualizaCaminhada(dt) {
  if (voo) return;
  let fx = 0, fz = 0;
  if (teclas.has('KeyW') || teclas.has('ArrowUp')) fz += 1;
  if (teclas.has('KeyS') || teclas.has('ArrowDown')) fz -= 1;
  if (teclas.has('KeyA')) fx -= 1;
  if (teclas.has('KeyD')) fx += 1;
  if (teclas.has('ArrowLeft')) anda.yaw += dt * 1.8;
  if (teclas.has('ArrowRight')) anda.yaw -= dt * 1.8;
  if (joy.ativo) { fx += joy.x; fz -= joy.y; }
  const correr = teclas.has('ShiftLeft') || teclas.has('ShiftRight');
  const vmax = correr ? 5.5 : 2.6;
  const sin = Math.sin(anda.yaw), cos = Math.cos(anda.yaw);
  const desejo = new THREE.Vector3();
  if (fx || fz) {
    anda.alvo = null;
    desejo.set(-sin * fz + cos * fx, 0, -cos * fz - sin * fx);
    if (desejo.length() > 1) desejo.normalize();
    desejo.multiplyScalar(vmax);
  } else if (anda.alvo) {
    tmp.copy(anda.alvo).sub(anda.pos).setY(0);
    const d = tmp.length();
    if (d < 0.4) anda.alvo = null;
    else {
      desejo.copy(tmp).normalize().multiplyScalar(Math.min(vmax * 1.3, d * 2));
      const alvoYaw = Math.atan2(-tmp.x, -tmp.z);
      let dy = alvoYaw - anda.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      anda.yaw += dy * Math.min(1, dt * 3);
    }
  }
  anda.vel.lerp(desejo, Math.min(1, dt * 8));
  const antes = anda.pos.clone();
  anda.pos.addScaledVector(anda.vel, dt);
  if (!modoReal || modoReal.colisao) resolveColisao(anda.pos, 0.3);
  if (anda.alvo && anda.pos.distanceTo(antes) < anda.vel.length() * dt * 0.2) anda.alvo = null; // travou numa parede
  const y = alturaPiso(anda.pos.x, anda.pos.z) + anda.olhoY;
  const passo = anda.vel.length() > 0.3 ? Math.sin(relogio.elapsedTime * 9) * 0.025 : 0;
  camera.position.set(anda.pos.x, THREE.MathUtils.lerp(camera.position.y, y + passo, Math.min(1, dt * 10)), anda.pos.z);
  camera.rotation.set(anda.pitch, anda.yaw, 0, 'YXZ');
}

const ocupados = [];
function atualizaPinos() {
  const w = innerWidth, h = innerHeight;
  ocupados.length = 0;
  pinosLista.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
  for (const p of pinosLista) {
    const ehComodo = p.classe === 'comodo';
    const pos = p.pos || p.item.pos;
    const dist = camera.position.distanceTo(pos);
    p.dist = dist;
    let visivel = modoReal || modo === 'foto' ? false : ehComodo ? modo !== 'aereo' : true;
    if (p.classe === 'vista') visivel = vistaVisivel(p.item, dist);
    else if (ehComodo) {
      if (modo === 'interior' && dist > 45) visivel = false;
      if (modo === 'caminhar' && dist > 9) visivel = false;
    } else {
      if (modo === 'caminhar' && (dist > 70 || dist < 5)) visivel = false;
      if (modo === 'interior' && p.item.e) visivel = visivel && dist > 50;
      if (modo !== 'caminhar' && !p.item.principal && dist > 85 && selecionado !== p.item) visivel = false;
    }
    if (visivel) {
      tmp.copy(pos).project(camera);
      if (tmp.z > 1 || tmp.x < -1.1 || tmp.x > 1.1 || tmp.y < -1.1 || tmp.y > 1.1) visivel = false;
      else {
        const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
        // rótulos de lugares não se sobrepõem: o mais próximo da câmera vence
        if (p.classe === 'lugar') {
          const lw = (p.lw ??= p.el.querySelector('span').offsetWidth || 90), r = [x - lw / 2, y - 52, x + lw / 2, y - 22];
          if (ocupados.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) visivel = false;
          else ocupados.push(r);
        }
        p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${p.classe === 'lugar' ? '-100%' : '-50%'})`;
        p.el.style.zIndex = String(1000 - Math.round(dist));
      }
    }
    if (p.visivel !== visivel) { p.el.style.opacity = visivel ? '1' : '0'; p.el.style.pointerEvents = visivel ? 'auto' : 'none'; p.visivel = visivel; }
  }
}

function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.05), t = relogio.elapsedTime;
  if (modo === 'foto' && foto) atualizaFoto(dt, t);
  else if (voo) {
    voo.t += dt / voo.dur;
    const k = facil(Math.min(voo.t, 1));
    camera.position.lerpVectors(voo.p0, voo.p1, k);
    controles.target.lerpVectors(voo.a0, voo.a1, k);
    camera.lookAt(controles.target);
    if (voo.t >= 1) {
      const fim = voo.fim; voo = null;
      if (modo === 'caminhar') camera.rotation.set(anda.pitch, anda.yaw, 0, 'YXZ');
      fim?.();
    }
  } else if (modo === 'caminhar') atualizaCaminhada(dt);
  else controles.update();
  // ao sair de uma vista, a lente volta aos poucos ao normal
  if (modo !== 'foto' && Math.abs(camera.fov - FOV_BASE) > 0.01) {
    camera.fov += (FOV_BASE - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }

  M.agua.normalMap.offset.set(t * 0.02, t * 0.013);
  for (const f of animados) f(t);
  atualizaPinos();
  if ((quadros & 3) === 0) desenhaMinimapa();
  renderer.render(cena, camera);
  // projeção da foto sobre a maquete (durante o voo até a vista)
  if (projMat.uniforms.uMix.value > 0.002) {
    const fundo = cena.background, nevoa = cena.fog;
    cena.background = null; cena.fog = null; cena.overrideMaterial = projMat;
    camera.layers.set(1); renderer.autoClear = false;
    renderer.render(cena, camera);
    camera.layers.set(0); cena.overrideMaterial = null; cena.background = fundo; cena.fog = nevoa;
    renderer.autoClear = true;
  }
  // a foto em relevo por cima de tudo
  if (cenaFoto.children.length) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(cenaFoto, camera);
    renderer.autoClear = true;
  }

  // qualidade adaptativa: se estiver lento nos primeiros segundos, reduz a resolução
  quadros++;
  if (!ajustado) {
    tempoMedido += dt;
    if (tempoMedido > 3) {
      const fps = quadros / tempoMedido;
      if (fps < 40 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); }
      ajustado = true;
    }
  }
  requestAnimationFrame(quadro);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

dica(MOBILE ? 'Arraste para girar · pinça para aproximar' : 'Arraste para girar · role para aproximar · botão direito move');
requestAnimationFrame(quadro);

// atalho #caminhar no link abre direto no modo caminhada
if (location.hash === '#caminhar') { const p = aerea([645, 540]); setModo('caminhar', { ponto: { x: p.x, z: p.y }, yaw: 0, instantaneo: true }); }
