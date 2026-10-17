# Auditoria — Chácara maravilhosa (piscina aquecida), Bofete/SP

Fonte: https://www.airbnb.com.br/rooms/1016846721454616704 · coletado em 2026-10-14
Dados estruturados: `imovel.json` · Fotos: `fotos/01.jpg … 55.jpg` (55 arquivos, 18,5 MB)

## Resumo do imóvel
- Casa inteira, 16+ hóspedes (descrição fala em até 23), 7 quartos, 23 camas, 6 banheiros
- Estrutura: **Casa 1** (suíte + 2 quartos), **Casa 2** (suíte + 3 quartos), **Edícula/salão** (mesa 24 lugares, jogos, churrasqueira, forno de pizza, 2 banheiros)
- Lazer: piscinas adulto e infantil aquecidas, lago com chafariz, quadra society, beach tennis, playground, redes, fogo de chão, quiosques
- Nota 5,0 (27 avaliações), "Preferido dos hóspedes" (top 5%). Anfitriã: Paula (verificada)
- Coordenada aproximada: -23.1478, -48.2804

## Inventário das fotos
| Categoria | Fotos |
|---|---|
| Plantas baixas | 15 (edícula/salão), 18 (Casa 2), 25 (Casa 1) |
| Vista aérea do terreno | 10, 31 |
| Fachadas | 01, 06, 16, 19, 44, 50, 51 |
| Salão / edícula | 09, 17, 42, 46, 47, 48 |
| Salas das casas | 04, 08, 20, 21, 22 |
| Quartos | 23, 24, 26, 28 |
| Corredor | 27 |
| Área externa / lazer | 02, 03, 05, 07, 11–14, 29, 30, 32–41, 43, 45, 49, 52–55 |

Resolução: 30 fotos com ≥3000 px (boas), 25 entre 450 e 1600 px (baixas).

## Problemas encontrados no anúncio (útil para a conversa com a cliente)
1. **Faltam ambientes**: não há fotos de nenhum banheiro (6 no total) nem da cozinha. Dos 7 quartos, só 3 aparecem.
2. **Foto duplicada**: 26 e 28 são a mesma imagem.
3. **Comodidades inconsistentes**: o anúncio marca "Ar-condicionado" e "Água quente" como *não disponíveis*, mas a descrição cita uma suíte com ar-condicionado (visível na foto 23) e piscinas aquecidas. Isso pode estar derrubando a posição nas buscas.
4. **Capacidade divergente**: o anúncio diz 16+, a descrição diz até 23 pessoas.
5. As plantas são esquemáticas, sem medidas e sem a cozinha nem as salas das casas.

## Viabilidade 3D
**Só com as fotos do anúncio não dá para gerar um tour 3D fotorrealista em que se possa andar livremente.** Gaussian splatting precisa de centenas de quadros sobrepostos de cada ambiente, e aqui há 1 a 3 fotos isoladas por cômodo, tiradas com câmeras diferentes.

O que dá para fazer **com o material atual**:
- **Maquete 3D navegável do terreno** (estilizada): modelar implantação a partir das fotos aéreas 10/31, volumes das casas a partir das fachadas e layout interno a partir das 3 plantas. As fotos reais aparecem como pontos clicáveis em cada local. Funciona como um "mapa 3D" do imóvel.
- **Cenas 2.5D**: profundidade gerada por IA em fotos boas (ex.: 46, 48, 21) para dar parallax ao mover o mouse/celular.

Para o **tour fotorrealista de verdade** é necessária uma captura no local:
- Vídeo 4K com celular (idealmente iPhone Pro) ou câmera 360°, cerca de 2–5 min por ambiente
- Escopo sugerido para o piloto: **salão/edícula + área da piscina + Casa 1** (são os ambientes que mais vendem)
- Faltam medidas reais: uma passada com LiDAR (iPhone Pro) resolve
