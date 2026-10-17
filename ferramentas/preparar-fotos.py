#!/usr/bin/env python3
"""Prepara as fotos do anúncio para as "vistas fotográficas" do site.

Etapa 1 (profundidade): roda o MoGe-2 (Microsoft, MIT) em cada foto e grava a
profundidade métrica (.npy) e o campo de visão estimado.
Etapa 2 (site): reduz cada mapa de profundidade para uma grade leve e grava
img/prof/NN.png (profundidade log em 16 bits: R = byte alto, G = byte baixo)
e img/prof/indice.json com o campo de visão e a faixa de profundidade.

Uso:
  python preparar-fotos.py profundidade <pasta-fotos> <pasta-trabalho> [n ...]
  python preparar-fotos.py site <pasta-trabalho> <pasta-do-site> [--largura 192]

A etapa 1 precisa de torch + moge (pip install --no-deps git+https://github.com/microsoft/MoGe.git,
mais utils3d-moge, pipeline, opencv-python-headless, scipy, trimesh, huggingface-hub).
A etapa 2 precisa só de numpy + Pillow.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def profundidade(fotos: Path, trabalho: Path, numeros):
    # MoGe-2 (Microsoft, licença MIT — código e pesos): profundidade métrica + lente estimada.
    # Não trocar por Depth Pro/SHARP: os pesos da Apple são só para pesquisa não comercial.
    import math
    import time
    import torch
    from moge.model.v2 import MoGeModel

    dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    model = MoGeModel.from_pretrained('Ruicheng/moge-2-vitl-normal').to(dev).eval()
    trabalho.mkdir(parents=True, exist_ok=True)
    indice_path = trabalho / 'fov.json'
    indice = json.loads(indice_path.read_text()) if indice_path.exists() else {}
    for n in numeros:
        t = time.time()
        im = Image.open(fotos / f'{int(n):02d}.jpg').convert('RGB')
        x = torch.tensor(np.asarray(im) / 255, dtype=torch.float32, device=dev).permute(2, 0, 1)
        with torch.no_grad():
            out = model.infer(x, use_fp16=False)
        d = out['depth'].float().cpu().numpy()
        ok = out['mask'].cpu().numpy().astype(bool) & np.isfinite(d)
        # céu / sem profundidade: vira fundo distante
        d[~ok] = np.inf
        fx = float(out['intrinsics'][0, 0])  # normalizado pela largura
        fov = math.degrees(2 * math.atan(0.5 / fx))
        np.save(trabalho / f'{int(n):02d}.npy', d.astype(np.float32))
        indice[str(int(n))] = {'w': im.width, 'h': im.height, 'fov': fov}
        indice_path.write_text(json.dumps(indice, indent=1))
        print(n, 'fov', round(fov, 1), 'med', round(float(np.median(d[ok])), 2), f'{time.time() - t:.0f}s', flush=True)


def site(trabalho: Path, destino: Path, largura: int):
    fov = json.loads((trabalho / 'fov.json').read_text())
    pasta = destino / 'img' / 'prof'
    pasta.mkdir(parents=True, exist_ok=True)
    indice = {}
    for npy in sorted(trabalho.glob('*.npy')):
        n = str(int(npy.stem))
        d = np.load(npy)
        h, w = d.shape
        ok = np.isfinite(d)
        # céu e fundo muito distantes viram uma cúpula a no máximo 80 m (ou 25x a mediana)
        med = float(np.median(d[ok])) if ok.any() else 10.0
        teto = min(80.0, med * 25, float(d[ok].max()) * 1.5 if ok.any() else 80.0)
        d = np.clip(np.where(ok, d, teto), 0.3, teto)
        ld = np.log(d)
        gw = largura
        gh = max(2, round(largura * h / w))
        # média em log por blocos (preserva bordas melhor que média linear)
        red = np.asarray(Image.fromarray(ld.astype(np.float32), mode='F').resize((gw, gh), Image.BOX))
        lo, hi = float(red.min()), float(red.max())
        q = np.round((red - lo) / max(hi - lo, 1e-6) * 65535).astype(np.uint32)
        rgb = np.zeros((gh, gw, 3), np.uint8)
        rgb[..., 0] = q >> 8
        rgb[..., 1] = q & 255
        Image.fromarray(rgb, 'RGB').save(pasta / f'{int(n):02d}.png', optimize=True)
        indice[n] = {'fov': round(fov[n]['fov'], 2), 'w': fov[n]['w'], 'h': fov[n]['h'], 'log': [round(lo, 4), round(hi, 4)],
                     'med': round(med, 3)}
    (pasta / 'indice.json').write_text(json.dumps(indice, separators=(',', ':')))
    print(f'{len(indice)} fotos → {pasta}')


if __name__ == '__main__':
    etapa, *resto = sys.argv[1:] or ['']
    if etapa == 'profundidade':
        profundidade(Path(resto[0]), Path(resto[1]), resto[2:])
    elif etapa == 'site':
        larg = int(resto[resto.index('--largura') + 1]) if '--largura' in resto else 192
        site(Path(resto[0]), Path(resto[1]), larg)
    else:
        print(__doc__)
