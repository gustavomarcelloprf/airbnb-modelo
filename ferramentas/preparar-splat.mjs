#!/usr/bin/env node
// Prepara uma captura em Gaussian Splatting para o site.
//
// Uso:
//   node preparar-splat.mjs <entrada.(spz|ply|splat|sog)> <site/> <id> [--max 1500000] [--caixa x,y,z,X,Y,Z] [--girar x,y,z] [--escala s]
//
// Faz: remove floaters (bolhas soltas) → recorta (opcional) → reduz até --max splats → grava SPZ
// e divide em pedaços base64 .txt (o host do site não serve .spz). Imprime o trecho para dados.js.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const aqui = dirname(fileURLToPath(import.meta.url));
const [entrada, site, id, ...resto] = process.argv.slice(2);
if (!entrada || !site || !id) {
  console.error('uso: node preparar-splat.mjs <entrada> <pasta-do-site> <id> [--max N] [--caixa x,y,z,X,Y,Z] [--girar x,y,z] [--escala s]');
  process.exit(1);
}
const opt = {};
for (let i = 0; i < resto.length; i += 2) opt[resto[i].replace(/^--/, '')] = resto[i + 1];
const max = Number(opt.max || 1_500_000);
const PEDACO = 12 * 1024 * 1024; // 12 MB de base64 por arquivo (limite do host: 15 MB)

const cli = join(aqui, 'node_modules/@playcanvas/splat-transform/bin/cli.mjs');
const st = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const info = st(resolve(entrada), 'null', '--info');
const total = Number(/gaussians:\s*(\d+)/.exec(info)?.[1] || 0);
console.log(`entrada: ${total.toLocaleString('pt-BR')} splats`);

const tmp = join(tmpdir(), `splat-${id}-${Date.now()}.spz`);
const acoes = [];
if (opt.girar) acoes.push('-r', opt.girar);
if (opt.escala) acoes.push('-s', opt.escala);
acoes.push('-F'); // remove floaters
if (opt.caixa) acoes.push('-B', opt.caixa);
// SPZ v3 (gzip): versão lida pelo Spark 2.3. A redução (-d) exige saída .ply, então vai em duas etapas.
if (total > max) {
  const ply = tmp.replace(/\.spz$/, '.ply');
  st('-w', resolve(entrada), ...acoes, '-d', String(max), ply);
  st('-w', ply, tmp, '--spz-version', '3');
  rmSync(ply);
} else st('-w', resolve(entrada), ...acoes, tmp, '--spz-version', '3');

const final = Number(/gaussians:\s*(\d+)/.exec(st(tmp, 'null', '--info'))?.[1] || 0);
const bytes = readFileSync(tmp);
console.log(`saída: ${final.toLocaleString('pt-BR')} splats · ${(bytes.length / 1e6).toFixed(1)} MB (spz)`);

const pasta = join(site, 'splats');
mkdirSync(pasta, { recursive: true });
for (const f of readdirSync(pasta)) if (f.startsWith(`${id}.`)) rmSync(join(pasta, f));
const b64 = bytes.toString('base64');
const partes = [];
for (let i = 0, n = 0; i < b64.length; i += PEDACO, n++) {
  const nome = `splats/${id}.${n}.txt`;
  writeFileSync(join(site, nome), b64.slice(i, i + PEDACO));
  partes.push(nome);
}
rmSync(tmp);
console.log(`gravado em ${partes.length} parte(s): ${partes.join(', ')}`);
console.log('\nadicione em AMBIENTES_REAIS (dados.js):');
console.log(JSON.stringify({ id, partes, splats: final, pose: { pos: [0, 0, 0], rotY: 0, inverteX: true, escala: 1 } }, null, 2));
