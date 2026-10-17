// Dados da Chácara (Bofete/SP) para a maquete 3D.
// Coordenadas externas em pixels da foto aérea 31 (img/mapa.jpg, 1200×900).
// Plantas internas em pixels das fotos 15, 18 e 25 do anúncio.
// Tudo que não aparece nas fotos foi estimado — revisar com a anfitriã.

export const MAPA = { largura: 1200, altura: 900, metrosPorPixel: 0.12 };

export const IMOVEL = {
  titulo: 'Chácara maravilhosa',
  subtitulo: 'Piscina aquecida · Bofete, SP',
  resumo: ['16+ hóspedes', '7 quartos', '23 camas', '6 banheiros'],
  nota: '5,0',
  avaliacoes: 27,
  airbnb: 'https://www.airbnb.com.br/rooms/1016846721454616704',
};

// ---------- Edificações ----------
// eixoX: direção (em px da aérea) para onde aponta o eixo X da planta.
// esc: metros por pixel da planta [x, z].
// paredes: [x0,y0,x1,y1] na planta. ext: true marca fachada.
// aberturas: { p: [x0,y0,x1,y1] (trecho sobre uma parede), tipo: 'porta'|'janela'|'vidro'|'basculante' }
// portas: pontos internos [x,y] onde a parede ganha um vão de 0,9 m.
// moveis: { t: tipo, c:[x,y] na planta, r: rotação em graus (0 = comprimento no eixo Z) }

export const EDIFICACOES = [
  {
    id: 'salao',
    nome: 'Salão de jogos e gourmet',
    centroAerea: [628, 368],
    eixoX: [0.41, 0.91],
    planta: { centro: [322, 230], esc: [0.042, 0.042] },
    altura: 4.0,
    // fotos 16, 42, 46: oitão de vidro, telhado cinza, acabamento marrom, colunas torcidas
    telhado: { tipo: 'duas', altura: 4.4, beiral: 0.9, cor: 0x8e999f, testeira: 0x4a3426, oitaoVidro: true, oitao: [145, 500] },
    pisoPadrao: 'madeira',
    paredeExterna: 0xb9d0df, caixilho: 0x2b2f31, sofa: 'cinza',
    // fotos 09, 46, 48: paredes creme, rodapé de madeira escura
    // versão modelada e iluminada no Blender (ferramentas/blender/salao.py); a procedural fica como reserva
    modelo: { url: 'modelos/salao/salao.glb.txt', brilho: 1.1 },
    paredeInterna: 0xf0e8d8, rodape: 0x4a3426, topoParede: 0x4b3524,
    // mesa de 24: tampo de vidro e cadeiras de madeira clara (fotos 09, 48)
    tampoVidro: 0xc8d8d0, cadeira: 0xb08a5a,
    colunas: [[230, 300], [360, 300], [300, 232]],
    paredes: [
      [205, 15, 500, 15, true], [500, 15, 500, 445, true], [500, 445, 145, 445, true],
      [145, 445, 145, 195, true], [145, 195, 205, 195, true], [205, 195, 205, 15, true],
      // banheiros anexos
      [105, 200, 145, 200, true], [105, 200, 105, 278, true], [105, 278, 145, 278, true],
      [105, 330, 145, 330, true], [105, 330, 105, 405, true], [105, 405, 145, 405, true],
      // parede da TV (foto 17); a cozinha é aberta, separada só pela bancada (foto 48)
      [205, 240, 290, 240, false],
    ],
    portas: [[145, 239], [105, 368]],
    aberturas: [
      { p: [160, 445, 175, 445], tipo: 'vidro' },
      { p: [175, 445, 225, 445], tipo: 'porta' },
      { p: [225, 445, 295, 445], tipo: 'vidro' },
      { p: [295, 445, 345, 445], tipo: 'porta' },
      { p: [345, 445, 415, 445], tipo: 'vidro' },
      { p: [415, 445, 465, 445], tipo: 'porta' },
      { p: [465, 445, 490, 445], tipo: 'vidro' },
      { p: [500, 30, 500, 250], tipo: 'vidro' },
      { p: [500, 272, 500, 318], tipo: 'porta' },
      { p: [500, 340, 500, 435], tipo: 'vidro' },
      { p: [205, 30, 205, 60], tipo: 'vidro' },
      { p: [205, 60, 205, 100], tipo: 'porta' },
      { p: [205, 100, 205, 185], tipo: 'vidro' },
      { p: [145, 300, 145, 325], tipo: 'basculante' },
      { p: [145, 410, 145, 435], tipo: 'vidro' },
    ],
    pisos: [
      { r: [105, 200, 145, 278], piso: 'ceramica' },
      { r: [105, 330, 145, 405], piso: 'ceramica' },
    ],
    deck: { r: [40, 15, 205, 145] },
    moveis: [
      { t: 'mesa24', c: [272, 128], r: 0 },
      { t: 'bancada', c: [452, 28], r: 90, comp: 3.6 },
      { t: 'churrasqueira', c: [390, 27], r: 90 },
      { t: 'fornoPizza', c: [482, 64] },
      { t: 'bancada', c: [380, 90], r: 0, comp: 5.0 },
      { t: 'balcao', c: [418, 200], r: 90, comp: 4.2 },
      { t: 'geladeira', c: [488, 120] },
      { t: 'geladeira', c: [488, 150] },
      // ordem confirmada pelas fotos 17 e 46: air hockey, pingue-pongue, pebolim e bilhar junto ao vidro
      { t: 'futmesa', c: [185, 365], r: 0 },
      { t: 'pingpong', c: [250, 365], r: 0 },
      { t: 'pebolim', c: [310, 365], r: 0 },
      { t: 'bilhar', c: [373, 365], r: 0 },
      { t: 'tv', c: [248, 250], r: -90 },
      { t: 'sofa', c: [248, 305], r: 90, comp: 2.8 },
      { t: 'mesaRedonda', c: [305, 282] },
      { t: 'sofa', c: [482, 376], r: 0 },
      { t: 'poltrona', c: [445, 300], r: -90 },
      { t: 'fliperama', c: [395, 232], r: 90 },
    ],
    comodos: [
      { id: 'salao-mesa', nome: 'Mesa para 24 pessoas', r: [215, 30, 355, 195], fotos: [9, 48], texto: 'Mesa de jantar única para a família inteira, ao lado da cozinha gourmet.' },
      { id: 'salao-jogos', nome: 'Sala de jogos', r: [150, 300, 410, 440], fotos: [46, 47, 17, 42], texto: 'Bilhar, pebolim, pingue-pongue, futmesa e fliperama. Paredes de vidro para o jardim.' },
      { id: 'salao-cozinha', nome: 'Cozinha gourmet', r: [365, 15, 500, 195], fotos: [], texto: 'Churrasqueira, forno de pizza, fogão a lenha, fogão industrial, micro-ondas e geladeiras (pela planta).' },
      { id: 'salao-deck', nome: 'Deck', r: [40, 15, 205, 145], fotos: [3], texto: 'Deck de madeira com guarda-corpo, mesa e ombrelone, com vista para a serra.' },
      { id: 'salao-banheiros', nome: 'Banheiros do salão', r: [105, 200, 145, 405], fotos: [], texto: 'Um banheiro interno e um externo, com acesso pelo jardim.' },
    ],
  },
  {
    id: 'casa1',
    nome: 'Casa 1',
    centroAerea: [815, 632],
    eixoX: [-0.94, 0.34],
    planta: { centro: [360, 265], esc: [0.026, 0.026] },
    altura: 2.9,
    // fotos 51, 20, 23, 24: fachada azul-clara, esquadrias de madeira, sala em ardósia, sofá bege
    telhado: { altura: 2.6, beiral: 0.8, cor: 0xe6e9ea, testeira: 0xf2f2ee },
    varanda: { lado: 'x+', prof: 2.6 },
    pisoPadrao: 'ardosiaEscura',
    paredeExterna: 0xbfd6e4, caixilho: 0x5a3520, sofa: 'bege', folhas: true,
    // fotos 20–24: paredes creme, ardósia escura em todos os cômodos, cortinas de linho cru
    paredeInterna: 0xeadfc6, rodape: 0x2f3330, cortinas: 0xe6d8b8, topoParede: 0x5c3d24, mesa: 0x4a2f1c,
    paredes: [
      [5, 5, 715, 5, true], [715, 5, 715, 525, true], [715, 525, 5, 525, true], [5, 525, 5, 5, true],
      [5, 232, 512, 232], [258, 5, 258, 232], [512, 5, 512, 232],
      [5, 298, 472, 298], [262, 298, 262, 525], [365, 298, 365, 525], [472, 298, 472, 525],
    ],
    portas: [[230, 232], [292, 232], [230, 298], [262, 335], [400, 298]],
    aberturas: [
      { p: [715, 40, 715, 110], tipo: 'vidro' },
      { p: [715, 110, 715, 160], tipo: 'porta' },
      { p: [715, 160, 715, 210], tipo: 'vidro' },
      { p: [715, 330, 715, 470], tipo: 'janela' },
      { p: [480, 525, 530, 525], tipo: 'porta' },
      { p: [5, 70, 5, 170], tipo: 'janela' },
      { p: [40, 5, 200, 5], tipo: 'janela' },
      { p: [310, 5, 460, 5], tipo: 'janela' },
      { p: [560, 5, 690, 5], tipo: 'janela' },
      { p: [5, 380, 5, 480], tipo: 'janela' },
      { p: [60, 525, 200, 525], tipo: 'janela' },
      { p: [290, 525, 335, 525], tipo: 'basculante' },
      { p: [395, 525, 440, 525], tipo: 'basculante' },
      { p: [600, 525, 690, 525], tipo: 'janela' },
    ],
    pisos: [
      { r: [262, 298, 365, 525], piso: 'ceramica' },
      { r: [365, 298, 472, 525], piso: 'ceramica' },
    ],
    moveis: [
      { t: 'solteiro', c: [70, 67], r: 90 },
      { t: 'solteiro', c: [72, 163], r: 90 },
      { t: 'solteiro', c: [225, 62], r: 0 },
      { t: 'queen', c: [336, 72], r: 90 },
      { t: 'solteiro', c: [473, 62], r: 0 },
      { t: 'solteiro', c: [450, 198], r: 90 },
      { t: 'solteiro', c: [71, 331], r: 90 },
      { t: 'queen', c: [84, 435], r: 90 },
      { t: 'arCond', c: [10, 330], r: 90 },
      { t: 'sanitario', c: [340, 500] }, { t: 'pia', c: [290, 505] },
      { t: 'sanitario', c: [448, 500] }, { t: 'pia', c: [395, 505] },
      { t: 'tapete', c: [640, 160], r: 0, comp: 2.6 },
      { t: 'sofaL', c: [600, 170], r: 0 },
      { t: 'rackTv', c: [700, 120], r: 0 },
      { t: 'mesa6', c: [560, 60], r: 90 },
      { t: 'bancada', c: [650, 505], r: 90, comp: 3.0 },
      { t: 'bancada', c: [700, 420], r: 0, comp: 2.4 },
      { t: 'geladeira', c: [700, 340] },
      { t: 'lustre', c: [600, 150] }, { t: 'lustre', c: [560, 60] },
    ],
    comodos: [
      { id: 'c1-suite', nome: 'Suíte', r: [5, 298, 262, 525], fotos: [23], texto: 'Cama queen + 1 solteiro, ar-condicionado e banheiro privativo.' },
      { id: 'c1-q2', nome: 'Quarto · 3 solteiros', r: [5, 5, 258, 232], fotos: [], texto: 'Três camas de solteiro e ventilador de teto.' },
      { id: 'c1-q3', nome: 'Quarto · queen + 2 solteiros', r: [258, 5, 512, 232], fotos: [24], texto: 'Cama queen, duas de solteiro e ventilador de teto.' },
      { id: 'c1-sala', nome: 'Sala e jantar', r: [512, 5, 715, 298], fotos: [20, 21, 22], texto: 'Sala com sofá, TV e mesa de jantar sob forro de madeira.' },
      { id: 'c1-banho', nome: 'Banheiros', r: [262, 298, 472, 525], fotos: [], texto: 'Dois banheiros — nenhum aparece nas fotos do anúncio.' },
    ],
  },
  {
    id: 'casa2',
    nome: 'Casa 2',
    centroAerea: [192, 652],
    eixoX: [0.17, 0.985],
    planta: { centro: [330, 221], esc: [0.03, 0.024] },
    altura: 2.9,
    // fotos 19, 04, 08, 26: fachada azul-clara, sofás vermelhos, parede de pedra filete
    telhado: { altura: 2.5, beiral: 0.8, cor: 0xe4e7e8, testeira: 0xf2f2ee },
    varanda: { lado: 'z-', prof: 2.4 },
    pisoPadrao: 'porcelanatoBege',
    paredeExterna: 0xc3d8e5, caixilho: 0x5a3520, sofa: 'vermelho', folhas: true,
    // fotos 04, 08, 26, 27: paredes brancas quentes, porcelanato bege, rodapé de cerâmica
    paredeInterna: 0xf2ece0, rodape: 0xb9a98e, cortinas: 0xd9c9a8, topoParede: 0x6b4a30, mesa: 0x6b4a30,
    paredes: [
      [5, 5, 655, 5, true], [655, 5, 655, 437, true], [655, 437, 5, 437, true], [5, 437, 5, 5, true],
      [155, 5, 155, 190], [220, 5, 220, 190], [358, 5, 358, 190], [505, 5, 505, 190],
      [155, 190, 655, 190],
      [160, 248, 437, 248], [160, 248, 160, 437], [248, 248, 248, 437], [437, 248, 437, 437],
    ],
    portas: [[220, 40], [245, 190], [385, 190], [535, 190], [205, 248], [285, 248]],
    aberturas: [
      { p: [655, 200, 655, 245], tipo: 'porta' },
      { p: [40, 5, 120, 5], tipo: 'janela' },
      { p: [255, 5, 330, 5], tipo: 'janela' },
      { p: [395, 5, 475, 5], tipo: 'janela' },
      { p: [545, 5, 625, 5], tipo: 'janela' },
      { p: [175, 5, 205, 5], tipo: 'basculante' },
      { p: [300, 437, 400, 437], tipo: 'janela' },
      { p: [185, 437, 225, 437], tipo: 'basculante' },
      { p: [480, 437, 620, 437], tipo: 'janela' },
      { p: [5, 60, 5, 160], tipo: 'janela' },
      { p: [5, 270, 5, 310], tipo: 'vidro' },
      { p: [5, 310, 5, 360], tipo: 'porta' },
      { p: [5, 360, 5, 400], tipo: 'vidro' },
      { p: [655, 300, 655, 420], tipo: 'janela' },
    ],
    pisos: [
      { r: [155, 5, 220, 190], piso: 'ceramica' },
      { r: [160, 248, 248, 437], piso: 'ceramica' },
    ],
    moveis: [
      { t: 'casal', c: [300, 104], r: 90 },
      { t: 'casal', c: [445, 52], r: 0 },
      { t: 'solteiro', c: [454, 164], r: 90 },
      { t: 'casal', c: [595, 52], r: 0 },
      { t: 'solteiro', c: [603, 164], r: 90 },
      { t: 'casal', c: [392, 310], r: 0 },
      { t: 'solteiro', c: [276, 390], r: 0 },
      { t: 'sanitario', c: [190, 170] }, { t: 'pia', c: [175, 40] },
      { t: 'sanitario', c: [200, 420] }, { t: 'pia', c: [230, 300] },
      { t: 'tapete', c: [80, 110], r: 0, comp: 2.4 },
      { t: 'sofa', c: [60, 120], r: 0 },
      { t: 'sofa', c: [110, 48], r: 90 },
      { t: 'lareira', c: [12, 215], r: 0 },
      { t: 'rackTv', c: [140, 120], r: 0 },
      { t: 'mesa6', c: [545, 340], r: 90 },
      { t: 'bancada', c: [640, 380], r: 0, comp: 2.4 },
      { t: 'geladeira', c: [640, 290] },
      { t: 'paredePedra', c: [152, 120], r: 0, comp: 3.6 },
      { t: 'pilarPedra', c: [40, 235] },
    ],
    comodos: [
      { id: 'c2-suite', nome: 'Suíte', r: [220, 5, 358, 190], fotos: [], texto: 'Cama de casal, banheiro privativo e ventilador de teto.' },
      { id: 'c2-q3', nome: 'Quarto · casal + solteiro', r: [358, 5, 505, 190], fotos: [26], texto: 'Cama de casal, uma de solteiro e ventilador de teto.' },
      { id: 'c2-q4', nome: 'Quarto · casal + solteiro', r: [505, 5, 655, 190], fotos: [], texto: 'Cama de casal, uma de solteiro e ventilador de teto.' },
      { id: 'c2-q2', nome: 'Quarto · casal + solteiro', r: [248, 248, 437, 437], fotos: [], texto: 'Cama de casal e uma de solteiro.' },
      { id: 'c2-sala', nome: 'Sala com lareira', r: [5, 5, 155, 437], fotos: [4, 8, 27], texto: 'Sofás, lareira, TV e Wi-Fi. (Fotos atribuídas a esta casa por estimativa.)' },
    ],
  },
];

// ---------- Área externa ----------
export const PISCINA = {
  deck: { c: [650, 680], tam: [11.6, 17.6], eixoZ: [30, 67] },
  adulto: { c: [646, 690], tam: [4.6, 8.6] },
  infantil: { c: [624, 637], tam: [3.4, 2.1] },
};

export const LAGO = { c: [356, 404], raios: [6.0, 5.2], eixoZ: [10, 80] };

export const QUADRAS = {
  beach: { c: [875, 184], tam: [9, 16.5], eixoZ: [45, 128] },
  society: { c: [966, 166], tam: [12.5, 16], eixoZ: [32, 128] },
};

export const ARENA = { c: [518, 780], raio: 3.9 };
export const FOGO = [495, 578];
export const PLAYGROUND = [468, 700];
export const QUIOSQUES = [[468, 615], [750, 437], [700, 738]];
export const GOLS = [[998, 374, 90], [1104, 352, 20]];
// tuias (ciprestes) ao lado da Casa 1 — foto 51
export const TUIAS = [[712, 566], [905, 548], [700, 690]];
export const REDES = [[330, 598, 30], [355, 625, 70]];
export const GALPOES = [[75, 70, 0], [75, 115, 0], [212, 220, 0], [283, 592, 15]];

export const CAMINHOS = [
  [[660, 455], [652, 520], [642, 560], [645, 605]],
  [[668, 462], [718, 508], [756, 548], [778, 572]],
  [[640, 525], [560, 538], [480, 546], [400, 551], [330, 552], [268, 566]],
  [[400, 556], [372, 598], [345, 640], [318, 688], [298, 722]],
  [[652, 600], [700, 640], [722, 662]],
];

export const SEBES = [
  [[240, 215], [330, 190], [480, 150], [600, 118], [700, 92], [810, 72]],
  [[1040, 95], [1075, 200], [1110, 300], [1180, 410]],
  [[110, 560], [120, 650], [130, 760]],
];

export const ARVORES = [
  [553, 232, 3], [620, 228, 2.2], [757, 258, 2.4], [830, 392, 6.5], [870, 305, 3.4],
  [1105, 90, 4.5], [1092, 432, 5.5], [996, 505, 4.4], [1015, 585, 4.2], [862, 518, 3],
  [930, 495, 2.4], [383, 678, 6.5], [330, 762, 6.5], [402, 762, 5.5], [305, 700, 4],
  [220, 428, 5], [242, 470, 4], [30, 330, 4.5], [112, 318, 4.2], [205, 300, 4.3],
  [190, 205, 3.4], [868, 800, 5.5], [720, 852, 3.5], [1000, 770, 5.2], [1180, 560, 4.5],
  [60, 640, 3.4], [480, 485, 2.2], [1150, 680, 4.4], [1060, 820, 4.6], [915, 640, 2.4],
  [140, 860, 4.6], [600, 870, 3], [440, 860, 4], [1170, 160, 3.6], [960, 250, 3],
];

export const PALMEIRAS = [
  [295, 330], [320, 345], [380, 330], [420, 320], [455, 315], [485, 312], [435, 372], [462, 382],
  [492, 352], [510, 402], [450, 410], [270, 372], [255, 402], [540, 518], [568, 560], [560, 598],
  [520, 622], [582, 642], [645, 572], [722, 618], [932, 650], [662, 762], [622, 772], [578, 690],
  [470, 552], [590, 470], [742, 708], [705, 420],
];

// ---------- Pontos de interesse ----------
// fotos = números das fotos do anúncio (img/fotos/NN.jpg)
export const LUGARES = [
  { id: 'visao', nome: 'Visão geral', tipo: 'Terreno', aerea: [600, 450], fotos: [31, 10], texto: 'Cerca de 1,5 hectare com duas casas, salão de jogos, piscinas aquecidas, lago, quadras e muito jardim — tudo exclusivo para um único grupo.', semPino: true },
  { id: 'salao', principal: true, nome: 'Salão de jogos', tipo: 'Edícula', edif: 'salao', aerea: [628, 368], fotos: [46, 48, 9, 47, 17, 42, 16, 44, 15], texto: 'Mesa para 24 pessoas, cozinha gourmet com churrasqueira e forno de pizza, sala de TV e jogos: bilhar, pebolim, pingue-pongue e fliperama.' },
  { id: 'casa1', principal: true, nome: 'Casa 1', tipo: 'Casa', edif: 'casa1', aerea: [815, 632], fotos: [51, 20, 21, 22, 23, 24, 25], texto: 'Suíte com ar-condicionado e mais dois quartos, sala com TV e jantar. Fica de frente para a piscina.' },
  { id: 'casa2', principal: true, nome: 'Casa 2', tipo: 'Casa', edif: 'casa2', aerea: [192, 652], fotos: [19, 4, 8, 27, 18], texto: 'Suíte e mais três quartos, sala com lareira. A atribuição das fotos internas a esta casa é uma estimativa.' },
  { id: 'piscina', principal: true, nome: 'Piscinas aquecidas', tipo: 'Lazer', aerea: [650, 680], fotos: [10, 2, 5, 11, 13], texto: 'Piscina adulto e infantil aquecidas, solário em pedra com espreguiçadeiras e ombrelones.' },
  { id: 'lago', principal: true, nome: 'Lago com chafariz', tipo: 'Jardim', aerea: [356, 404], fotos: [1, 6, 30, 37, 38], texto: 'Lago ornamental cercado de palmeiras, com chafariz e borda de pedras.' },
  { id: 'quadras', principal: true, nome: 'Quadras', tipo: 'Esporte', aerea: [920, 175], fotos: [14, 7, 12, 32, 33], texto: 'Quadra de beach tennis em areia e quadra society cercada, com iluminação.' },
  { id: 'fogo', nome: 'Fogo de chão', tipo: 'Jardim', aerea: [495, 578], fotos: [34, 45], texto: 'Braseiro com bancos de madeira para as noites frias da serra.' },
  { id: 'quiosques', nome: 'Quiosques e redes', tipo: 'Jardim', aerea: [468, 615], fotos: [40, 36, 29, 41, 52], texto: 'Quiosques de sapê com mesa e redes entre as árvores.' },
  { id: 'arena', nome: 'Arena e jardim', tipo: 'Jardim', aerea: [518, 780], fotos: [49, 50, 35, 39, 43, 53, 54, 55], texto: 'Círculo de areia, gramado amplo e vista para a serra de Bofete.' },
  { id: 'playground', nome: 'Playground', tipo: 'Crianças', aerea: [468, 700], fotos: [], texto: 'Parquinho infantil ao ar livre. Não há fotos dele no anúncio.' },
];

// ---------- Vistas fotográficas ----------
// De onde cada foto do anúncio foi tirada, para a câmera voar até lá e a foto real se encaixar na maquete.
// onde: id da edificação (pos/olha em px da planta) · sem onde: px da foto aérea.
// pos: posição da câmera · olha: ponto para onde ela aponta · alt: altura da lente acima do piso (m)
// incl: inclinação (graus, negativo = para baixo) · giro: rolagem (graus) · fov: campo de visão horizontal
// (graus; se omitido, usa o estimado pelo Depth Pro em img/prof/indice.json).
// Ajuste fino com #calibrar no link.
export const VISTAS = [
  // Salão de jogos (planta 15)
  { n: 46, onde: 'salao', pos: [150, 425], olha: [450, 185], alt: 1.52, incl: -8 },
  { n: 48, onde: 'salao', pos: [330, 30], olha: [290, 440], alt: 1.52, incl: -10 },
  { n: 9, onde: 'salao', pos: [235, 205], olha: [290, 15], alt: 1.33, incl: -8 },
  { n: 47, onde: 'salao', pos: [480, 425], olha: [300, 200], alt: 1.3, incl: -17 },
  { n: 17, onde: 'salao', pos: [215, 330], olha: [420, 265], alt: 1.36, incl: -12 },
  { n: 42, onde: 'salao', pos: [320, 150], olha: [305, 445], alt: 1.4, incl: 2 },
  { n: 3, onde: 'salao', pos: [195, 135], olha: [60, 30], alt: 1.5, incl: -8 },
  // Casa 1 (planta 25)
  { n: 20, onde: 'casa1', pos: [525, 40], olha: [715, 160], alt: 1.5, incl: -8 },
  { n: 21, onde: 'casa1', pos: [610, 330], olha: [610, 0], alt: 1.5, incl: -5 },
  { n: 22, onde: 'casa1', pos: [680, 90], olha: [512, 265], alt: 1.5, incl: -8 },
  { n: 23, onde: 'casa1', pos: [240, 330], olha: [20, 470], alt: 1.5, incl: -10 },
  { n: 24, onde: 'casa1', pos: [400, 215], olha: [320, 20], alt: 1.4, incl: -15 },
  // Casa 2 (planta 18)
  { n: 4, onde: 'casa2', pos: [60, 410], olha: [140, 80], alt: 1.6, incl: -12 },
  { n: 8, onde: 'casa2', pos: [45, 330], olha: [150, 115], alt: 1.4, incl: -8 },
  { n: 27, onde: 'casa2', pos: [560, 219], olha: [5, 219], alt: 1.5, incl: -4 },
  { n: 26, onde: 'casa2', pos: [490, 180], olha: [420, 20], alt: 1.4, incl: -12 },
  // Externas (foto aérea)
  { n: 31, pos: [600, 451], olha: [600, 450], alt: 120, incl: -90 },
  { n: 10, pos: [628, 575], olha: [650, 700], alt: 24, incl: -52 },
  { n: 2, pos: [632, 652], olha: [664, 735], alt: 1.5, incl: -10 },
  { n: 5, pos: [662, 738], olha: [628, 640], alt: 1.5, incl: -6 },
  { n: 11, pos: [638, 650], olha: [600, 770], alt: 1.5, incl: -6 },
  { n: 13, pos: [690, 728], olha: [640, 690], alt: 1.1, incl: -10 },
  { n: 1, pos: [300, 440], olha: [600, 370], alt: 1.4, incl: 4 },
  { n: 6, pos: [325, 452], olha: [600, 360], alt: 1.4, incl: 2 },
  { n: 30, pos: [392, 432], olha: [330, 380], alt: 1.3, incl: -8 },
  { n: 37, pos: [555, 395], olha: [356, 404], alt: 6, incl: -14 },
  { n: 38, pos: [548, 405], olha: [356, 404], alt: 6, incl: -18 },
  { n: 16, pos: [424, 460], olha: [590, 390], alt: 1.5, incl: 4 },
  { n: 44, pos: [440, 480], olha: [590, 390], alt: 1.5, incl: 4 },
  { n: 50, pos: [600, 450], olha: [790, 640], alt: 6, incl: -12 },
  { n: 51, pos: [655, 540], olha: [815, 632], alt: 3, incl: -4 },
  { n: 52, pos: [700, 700], olha: [660, 640], alt: 1.4, incl: -10 },
  { n: 19, pos: [330, 540], olha: [192, 652], alt: 3, incl: -10 },
  { n: 29, pos: [385, 560], olha: [300, 650], alt: 1.3, incl: -6 },
  { n: 41, pos: [372, 600], olha: [300, 560], alt: 1.4, incl: -5 },
  { n: 34, pos: [510, 600], olha: [495, 578], alt: 1.4, incl: -25 },
  { n: 45, pos: [522, 560], olha: [470, 615], alt: 1.3, incl: -10 },
  { n: 40, pos: [500, 652], olha: [468, 615], alt: 1.5, incl: -5 },
  { n: 36, pos: [440, 660], olha: [468, 600], alt: 1.4, incl: -8 },
  { n: 39, pos: [430, 470], olha: [480, 600], alt: 1.6, incl: 4 },
  { n: 49, pos: [470, 700], olha: [560, 860], alt: 1.6, incl: -4 },
  { n: 35, pos: [560, 830], olha: [600, 880], alt: 1.5, incl: 6 },
  { n: 53, pos: [600, 800], olha: [700, 880], alt: 1.4, incl: -6 },
  { n: 54, pos: [470, 820], olha: [420, 880], alt: 1.4, incl: -4 },
  { n: 55, pos: [520, 520], olha: [430, 560], alt: 1.5, incl: 0 },
  { n: 43, pos: [688, 731], olha: [640, 700], alt: 1.1, incl: -12 },
  { n: 14, pos: [905, 262], olha: [966, 166], alt: 1.4, incl: 2 },
  { n: 7, pos: [880, 238], olha: [870, 140], alt: 1.5, incl: -2 },
  { n: 12, pos: [875, 205], olha: [875, 150], alt: 0.6, incl: -22 },
  { n: 32, pos: [845, 262], olha: [885, 175], alt: 1.3, incl: -8 },
  { n: 33, pos: [930, 255], olha: [935, 230], alt: 1.2, incl: -35 },
];

// ---------- Ambientes reais (Fase 2: Gaussian Splatting) ----------
// Gerados por ferramentas/preparar-splat.mjs a partir da captura no local.
// vinculo: id do lugar ou cômodo onde aparece o botão "Ver ambiente real".
// pose: posição/rotação/escala da captura no mundo da maquete (ajuste com #alinhar).
// alinhado: true liga a colisão com as paredes da maquete; inicio: { pos: [x, z], yaw } abre já caminhando.
export const AMBIENTES_REAIS = [
  // { id: 'salao', nome: 'Salão de jogos', vinculo: 'salao', partes: ['splats/salao.0.txt'], splats: 1200000,
  //   pose: { pos: [0, 0, 0], rotY: 0, inverteX: true, escala: 1, piso: 0 }, alinhado: false },
];
