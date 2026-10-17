# Roteiro de captura · Chácara Bofete (Fase 2)

Objetivo: gravar cada ambiente para virar um **ambiente real** (Gaussian Splatting) dentro do site.
Tempo estimado no local: **3 a 4 horas**, de preferência entre 9h e 11h ou 14h e 16h (luz estável, sem sol rasante).

## Equipamento
- **Interiores e entorno das casas:** iPhone 12 Pro ou mais novo (tem LiDAR, que dá escala real e chão nivelado), com o app **Scaniverse** (gratuito, processa no próprio celular e exporta o splat). Confirmar na véspera que a versão instalada exporta **SPZ ou PLY**.
  Sem iPhone Pro: gravar **vídeo 4K a 30 fps** com qualquer celular bom. O processamento de vídeo exige GPU em nuvem (custo de alguns dólares por ambiente), porque o Mac M1 daqui não dá conta.
- **Área externa geral (opcional, recomendado):** drone tipo DJI Mini, para o voo em órbita do terreno.
- Bateria externa e celular com pelo menos 30 GB livres.

## Preparar a casa antes de gravar
1. Acender **todas** as luzes internas e abrir cortinas. A luz não pode mudar durante uma gravação.
2. Desligar TVs, ventiladores de teto e o chafariz (coisas que se mexem viram borrão).
3. Ninguém circulando no ambiente, nem animais.
4. Arrumar como no anúncio: camas feitas, almofadas, mesa posta se quiser.
5. Espelhos grandes: cobrir com um pano ou aceitar que vão sair distorcidos.

## Como gravar cada ambiente
- Andar **devagar**, com o celular na altura do peito, fazendo **três voltas**: uma com o celular reto, uma inclinado para baixo (chão e móveis) e uma inclinado para cima (teto e forro de madeira).
- Passar **por todos os cantos** e **pelas portas** (a passagem entre cômodos é o que permite andar de um para o outro no site).
- Nada de giro rápido parado no lugar: sempre se deslocando um pouco.
- De 2 a 5 minutos por cômodo; salas grandes (o salão) podem ter até 10 minutos.

## Ordem de prioridade (nome do arquivo entre parênteses)
| # | Ambiente | Arquivo | Observação |
|---|---|---|---|
| 1 | Salão de jogos + deck | `salao` | o que mais vende; incluir mesa de 24, jogos e cozinha gourmet |
| 2 | Área da piscina | `piscina` | dar a volta completa no solário; incluir quiosque próximo |
| 3 | Casa 1 · sala e jantar | `c1-sala` | forro de madeira e lustres |
| 4 | Casa 1 · suíte | `c1-suite` | mostrar o ar-condicionado e o banheiro |
| 5 | Casa 2 · sala com lareira | `c2-sala` | parede de pedra e sofás vermelhos |
| 6 | Demais quartos e banheiros | `c1-q2`, `c1-q3`, `c2-q2`, `c2-q3`, `c2-q4` | um arquivo por quarto |
| 7 | Lago, fogo de chão, quadras | `lago`, `fogo`, `quadras` | |
| 8 | Voo de drone | `terreno` | 3 órbitas: 15 m, 30 m e 50 m de altura, câmera a 45° para baixo |

Os nomes batem com os ids do site, então cada captura entra no lugar certo.

## Fotos que faltam no anúncio (aproveitar a visita)
- Todos os **banheiros** (6) e a **cozinha** de cada casa.
- Os quartos que não aparecem: da Casa 1, o de 3 solteiros; da Casa 2, a suíte e os quartos 2 e 4.
- Playground.

## Entrega
Enviar os arquivos exportados (`.spz`, `.ply` ou os vídeos) com os nomes da tabela. Para cada um eu rodo:

```
node ferramentas/preparar-splat.mjs <arquivo> clientes/chacara-bofete/site <id>
```

Depois disso, encaixo a captura sobre a maquete com a ferramenta de alinhamento (`#alinhar`) e publico. São uns 15 minutos por ambiente.
