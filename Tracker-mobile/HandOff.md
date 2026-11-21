# Videoanálise Móvel (Tracker-mobile)

Contexto para o Claude Code. Leia antes de mexer nesta pasta.

## O que é

Uma página (`index.html` com módulos JavaScript em `js/`) de vídeo-análise quadro a quadro no celular, inspirada no
[Tracker](https://github.com/OpenSourcePhysics/tracker) do Open Source Physics, para as atividades experimentais
de Física Básica (sistema massa-mola, pêndulo). O aluno grava o vídeo no próprio celular, define o intervalo,
calibra a escala e os eixos, informa as massas, marca a posição de cada objeto (à mão ou com rastreamento
automático; até 10 massas e centros de massa formados pelas massas que ele escolher) e exporta t, x, y para analisar no [Laboratório de Oscilações](../laboratorio-oscilacoes/OscLab.html), numa planilha ou em Python.

- Público: alunos com celular **Android e Chrome**. iOS ainda não é alvo.
- Tudo roda no navegador; o vídeo nunca sai do aparelho. Nada para instalar (instalar como app pelo Chrome é
  opcional; o app instalado abre sempre deitado e em tela cheia). Por hora, só com o celular deitado.
- Funciona **sem internet** depois de aberta: o aluno abre o link uma vez com conexão e a página continua
  funcionando em modo avião, e até recarrega sem conexão (service worker, `sw.js`).
- Publicada pelo GitHub Pages em `https://abathvictor.github.io/Physics_artifacts/Tracker-mobile/`.

## Como trabalhar com o autor

- Converse em **português do Brasil**. Na interface, números com **vírgula decimal** (`Intl.NumberFormat("pt-BR")`);
  comentários do código também em português.
- **Funcionalidades grandes: proponha o plano e espere o autor decidir antes de escrever código.** É assim que ele
  prefere trabalhar. Correções e ajustes pequenos podem ir direto.
- O autor testa no próprio celular Android. Diga claramente o que você conseguiu verificar no computador e o que
  só dá para confirmar no aparelho (sensação do toque, desempenho, janela de download).
- Rode os testes (seção **Testes**) antes de cada commit que mexa na página (`index.html`, `js/`, `css/`).
- Textos da interface: curtos, diretos, escritos para o aluno; mensagens de erro dizem o que aconteceu e como resolver.

## Especificação decidida (não mude sem combinar)

| Tema | Decisão |
| --- | --- |
| Plataforma | Android + Chrome primeiro; iOS fica para depois |
| Forma | Página nesta pasta em **módulos JavaScript nativos, sem passo de montagem** (sem Node/npm para publicar): edita e publica. Decidido em 14/11/2026, substituiu o arquivo único (que existia só por causa do artefato do claude.ai, hoje obsoleto) |
| Sem internet | uma vez aberta, a página **não pode perder nenhuma função sem conexão** (modo avião). Nada é carregado de fora: `mp4box.js` e as fontes são cópias locais; todos os módulos são importados no início (sem `import()` tardio); o `sw.js` guarda tudo para recarregar sem conexão |
| Compatibilidade com o Tracker | princípio permanente: a versão móvel e o Tracker de computador **devem conversar sempre**. Os formatos e o modelo de dados seguem os do Tracker (objetos como os *point mass* dele, coordenadas em pixels da imagem, eixos, fita de calibração, intervalo do clipe), para que no futuro um trabalho feito no celular abra no Tracker e vice-versa (arquivo `.trk`) |
| Várias massas | até **10 massas** no mesmo vídeo (massa A a massa J, cores do Tracker em A a D) e **centros de massa** (cm A a cm J), como o `CenterOfMass` do Tracker: cada um **nasce vazio** e é formado pelas massas que o usuário escolher (nunca entram sozinhas; pedido do autor), e pode haver vários, cada um com as suas massas. Posição: média das posições ponderada pelas massas, calculada em pixels, só nos quadros em que todas as massas do sistema têm ponto. A escolha das massas fica logo abaixo dos botões dos objetos, quando o cm está ativo (no Tracker é a janela `CenterOfMassInspector`). Todos na cor verde do Tracker; o nome os distingue. Feito em 14/11/2026. Falta rastrear todas numa passada só de decodificação |
| Cores das massas | A a D com as cores do Tracker; E a J escolhidas para não confundir (E azul `#1791cf` e J framboesa `#c2185b`, longe do âmbar da mira). O usuário pode **trocar a cor de cada massa** tocando na bolinha dela no passo 5 (pedido do autor); a cor trocada vai no salvamento |
| Cores e temas | tokens combinados com o autor em 14/11/2026 (tabela em `css/app.css`): fundo `#F5F6F8`/`#121619`, cartões `#FFFFFF`/`#1A1F24`, texto `#1F2933`/`#E6EAEE`, texto secundário `#52606D`/`#9AA5B1`, bordas `#DDE1E6`/`#2E363E`, botão principal `#0F766E` (texto branco) / `#2DD4BF` (texto `#06201D`), botão suave `#E6F2F1`/`#0F766E` e `#17302E`/`#5EEAD4`, âmbar `#D97706`/`#F59E0B`, área do vídeo `#1E2228`/`#0B0D10`. Tema automático (segue o sistema) ou escolhido à mão, guardado em `localStorage` (`va-tema`) fora do salvamento por vídeo. **Âmbar só** na mira (anel com contorno escuro), no indicador do quadro atual e nas alças do intervalo, nunca em botão de texto. Cor de objeto só em bolinha ou borda (o botão Marcar ponto é verde-petróleo, com a bolinha da massa ativa); objeto ativo com fundo suave e borda. Marcas e pontos com contorno fino (escuro no claro, claro no escuro); pontos fora do intervalo ou futuros (depois do quadro atual) na cor de borda, no vídeo e no gráfico. Todo texto com contraste ≥ 4,5:1 (conferido pelo `test_tema.py`) |
| Sem escala | como no Tracker, **1 px = 1 u.a.** (unidade arbitrária), a partir da origem dos eixos. A tabela, o gráfico e o CSV funcionam sem escala; digitar a distância real converte tudo na hora (os pontos ficam sempre em pixels) |
| Massas sem valor | **nenhuma** informada: massas iguais, 1 u.a. cada (a massa padrão do Tracker é 1). **Todas**: valores reais, numa unidade só para todas (g ou kg), como no Tracker. **Só parte**: o centro de massa fica sem posição, com o aviso **"massa B faltante"** (texto pedido pelo autor) |
| Tabela e gráfico | de **um objeto por vez**, o ativo, como no Tracker (uma tabela por trilha). Copiar e CSV levam todos os objetos com pontos |
| Fluxo | vídeo (câmera ou galeria) → intervalo → escala → eixos → massa → marcação → tabela e gráfico |
| Dados | apenas **t, x, y** por quadro de cada objeto, mais a **massa** de cada um (valor ± incerteza, g ou kg). Velocidade e aceleração ficaram de fora por decisão |
| Saída | **Copiar tabela** (tabulação) e **Exportar CSV** em dois formatos que o aluno escolhe: *Excel/Planilhas Google* (`;` entre colunas, vírgula decimal, com marca UTF-8 no início) e *Internacional/Python* (`,` entre colunas, ponto decimal) |
| Estrutura do CSV | igual à do Tracker, com metadados antes: `massa: (0,250 ± 0,001) kg`, `unidades: t em s · x e y em cm`, `calibração: origem x0 = 946,37 px · y0 = 668,52 px · ângulo 0,80° (0,013963 rad) · escala 12,8000 px por cm` (desde 21/11/2026, pedido do autor, para ficar em conformidade com o .trk do Tracker, que guarda a calibração: os mesmos xorigin, yorigin, angle e xscale do sistema de coordenadas da imagem; origem em pixels da imagem, x para a direita e y para baixo; ângulo do eixo x no sentido anti-horário; escala em pixels por unidade, 1 px por u.a. sem escala; a linha não tem o separador de colunas), linha do objeto (`;massa A`), cabeçalho `t;x;y`, dados. No Python: `pd.read_csv(arquivo, skiprows=4)`. O Laboratório de Oscilações lê os dois formatos (testado; a linha de calibração é texto de uma célula, como as outras de metadados) | Com vários objetos, o formato de várias trilhas do Tracker (`ExportDataDialog`): uma linha por massa (`massa A: …`), uma linha por centro de massa (`cm A: massa A + massa B · …`), `unidades`, `calibração`, `#multi:`, a linha dos nomes `;massa A;;massa B;;cm A;;`, o cabeçalho `t;x;y;x;y;x;y;` e os dados (célula vazia no quadro em que o objeto não tem ponto). Com um objeto só, o formato continua o de antes |
| Descartado | botão "Enviar para o Laboratório de Oscilações" |
| Reprodução | play em **velocidade real** (sem câmera lenta) e botão **Reproduzir do início ao fim**, com opção **Repetir**. Desde 21/11/2026 (fase 1 do plano de memória e decodificação, decisão do autor): o play **mostra todos os quadros**, um de cada vez, **no máximo em velocidade real**; quando o celular não dá conta, **desacelera** em vez de pular quadros (o intuito é avaliar o movimento, não precisa ser em tempo real). Consequência: vídeo com mais quadros por segundo que a tela (câmera lenta de 120 ou 240 q/s) toca mais devagar que o real, um quadro por quadro de tela |
| Arrastar na barra (prévia) | decidido em 21/11/2026 (fase 1): enquanto o dedo arrasta a barra de quadros ou uma alça do intervalo, a imagem é a **prévia** do quadro-chave mais próximo (imagem pequena, com a etiqueta "prévia" no alto do vídeo), que sai rápido mesmo em vídeos pesados; quando o dedo **para** (0,25 s) ou **solta**, aparece o **quadro exato**. O número do quadro é sempre o exato, e o início e o fim do intervalo ficam no quadro certo. Um toque sem arrastar vai direto ao quadro exato |
| Marcação | **zoom de pinça** no próprio vídeo + **toque posiciona a mira** (substituiu uma lupa lateral, que o autor achou pior) |
| Lupa | **só para a escala** (pedido do autor, 14/11/2026): ao arrastar uma ponta da fita de calibração, um círculo ampliado (124 px, 2,5× a vista, de 3 a 12 px de tela por pixel do vídeo) com cruz fina no centro, 70 px acima do dedo; perto do topo da tela vai para baixo do dedo, perto de uma borda lateral vai para o outro lado; some ao soltar. Sem lupa para marcar nem para a mira. Usa o quadro já guardado (`S.full`), sem cache novo |
| Gráfico na tela cheia | decidido em 15/11/2026: o gráfico fica numa **janela móvel** sobre o vídeo, que se arrasta por **qualquer ponto** (o dedo precisa andar 8 px para virar arrasto; antes disso é toque) e nunca sai da tela, e se **redimensiona pelas quatro bordas e pelos quatro cantos** (18 px de toque nas bordas, que passam 12 px para fora da janela; mínimo de 220 × 140 px; marca no canto de baixo à direita). **Toque duplo** maximiza na área do vídeo livre dos controles flutuantes (da coluna de etapas à borda direita, do topo até a barra de quadros), e outro toque duplo volta ao tamanho e ao lugar de antes. Maximizada, não se move, e Marcar ponto e Rastrear somem (play, ±1 e a barra de quadros continuam funcionando). **Sem botão de maximizar** no cabeçalho, só o toque duplo (pedido do autor). Um toque simples no gráfico espera 0,25 s antes de ir ao quadro, para não confundir com o toque duplo. O cabeçalho tem só recolher e y(t)/x(t) (o objeto ativo fica na alça dos objetos, no canto de cima). A janela fica acima do vídeo e abaixo dos controles flutuantes. Lugar, tamanho e se está recolhida ficam em `localStorage` (`va-grafico`, em frações da tela), fora do salvamento por vídeo; ao entrar na tela cheia, a janela nunca vem maximizada |
| Objetos deitado (gaveta) | decidido em 15/11/2026, para tirar a poluição visual em volta do gráfico (o autor escolheu **gaveta** em vez de menu flutuante): no alto do painel fica **uma linha só**, a alça (bolinha, nome do objeto ativo, seta e, num centro de massa sem posição, um aviso curto em vermelho: "escolha as massas" ou "massa B faltante") e, **na mesma linha, y(t)/x(t)** (em A, só com a aba Gráfico; em B, sempre). Tocar na alça faz descer, por cima do conteúdo, a fileira dos objetos de sempre (+ massa, + cm) e a escolha das massas do cm ativo, com rolagem se não couber. Fecha ao tocar de novo na alça, ao tocar fora (o toque segue: tocar no vídeo também põe a mira), com Esc, com o Voltar do Android e ao escolher ou criar uma massa; ao escolher ou criar um cm, ela fica aberta para a escolha das massas dele. A linha repetida com o nome do objeto acima do gráfico e da tabela saiu. Na **tela cheia**, a alça sobe para o canto de cima (no lugar do antigo indicador do objeto ativo) e abre a gaveta ali mesmo; o painel (Parâmetros e Tabela) abre por um **botão do painel** ao lado dela e começa logo abaixo dessa linha, que fica por cima dele (com o painel aberto ainda dá para trocar de objeto, sair da tela cheia e abrir o ≡). **Em pé, nada mudou** (a fileira continua abaixo dos controles do vídeo; desde 21/11/2026, por hora, a diagramação em pé fica coberta pelo aviso "Gire o celular") |
| Abrir deitado | pedido do autor em 16/11/2026, **por hora**: o app abre deitado. Uma página numa aba do Chrome não consegue girar a tela (o Chrome só deixa travar a orientação em tela cheia ou no app instalado), então a página virou **app instalável** (`manifest.webmanifest`: `"orientation": "landscape"`, `"display": "fullscreen"` desde 21/11/2026, ícones em `img/`). Instalado pelo Chrome (⋮ → Instalar app), abre sempre deitado e sem as barras do sistema, mesmo com a rotação automática desligada; em pé fica inalcançável no app. Numa aba comum quem gira a tela é o celular. Para voltar atrás, basta trocar `"orientation"` para `"any"` (e `"display"` para `"standalone"`) |
| Só deitado | pedido do autor em 21/11/2026, **por hora**: as funções em pé ficam desativadas. Com o celular em pé, o aviso **"Gire o celular"** cobre a página, com o botão **"Deitar em tela cheia"** (pede a tela cheia e trava a orientação deitada; numa aba, o Chrome só trava a orientação em tela cheia, e a tela cheia exige um toque). A diagramação em pé continua no código, intacta e montada por baixo do aviso (girar não perde nada); `SO_DEITADO = false` em `paisagem.js` a devolve. Computador e tablet (deitados, com mais de 500 px de altura) continuam com a diagramação de sempre |
| Abrir em tela cheia | pedido do autor em 21/11/2026: a página **abre na tela cheia (C)** (`S.telaCheia` começa `true`), e sair dela é escolha do aluno, no botão do canto de cima; nada fica guardado, a próxima abertura volta à tela cheia. No app instalado, o manifesto já tira as barras do sistema; numa aba comum, é a diagramação de tela cheia com as barras do navegador (a tela cheia do sistema exige um toque: o botão do aviso em pé ou sair e entrar de novo no botão do canto). Girar em pé na tela cheia não sai dela: o aviso cobre a página e, ao deitar de novo, a tela cheia continua |
| Etapas deitado | sem marca nas etapas concluídas (o ✓ saiu a pedido do autor em 16/11/2026: informação demais). Fica só o selo neutro "u.a." em Escala e Massas sem valor |
| Rastreamento | automático no estilo do autotracker do Tracker (ver abaixo) |
| Toque | sensibilidade "aceitável"; otimizar no futuro |

## Estado atual

Validado no celular do autor (Android 10, Chrome 156, 8 GB de memória, decodificação por hardware):
abertura de vídeo da câmera ou da galeria, navegação, play, reprodução do intervalo, zoom de pinça, marcação,
janela de download do CSV, fluidez. O rastreamento automático foi testado num vídeo real de pêndulo
(1080p, massa de 28 px): funciona depois da medição automática do tamanho do alvo (ver armadilha 9).

**Rastreamento comparado com o Tracker de computador** (21/11/2026, rastreamento automático nos dois programas, no
mesmo vídeo; arquivos em `Test_videos/`, fora do git):
- `Pendulum_test.mp4` (1080p, 254 quadros; `Pendulum_test_desktop_version.trk/.txt` × `Pendulum_test_mobile_version.csv`
  já com a linha de calibração): levando o CSV do celular a pixels da imagem pela própria calibração (eixos em
  (948,50; 775,45) px, inclinados −0,86°; 1 px por u.a.), **sem ajuste nenhum**, a diferença para os pixels do .trk é
  quase toda constante, (−1,2; −1,7) px desde o primeiro quadro (o ponto onde a mira foi posta em cada programa), com
  0,24 px de variação em x e 0,22 px em y; descontada a constante, 0,29 px em média (máximo 0,82 px). Período por
  cruzamentos: 2,1241 s no Tracker e 2,1235 s no celular.
- `de_money.mp4` (640 × 480, 667 quadros; `de_money_desktop_version.txt`, só massa A, em m, sem .trk ×
  `de_money_trajetoria_mobile_version.csv`, massa A, massa B e cm A): descontadas a escala, a rotação e a origem
  (ajuste), a massa A difere 0,12 px em média (RMS 0,15 px, máximo 0,54 px; 0,2 mm). As calibrações diferem: escala
  do Tracker ~570,6 px/m (estimada) × 586,5 px/m no celular (2,7 %), por isso a amplitude difere 3,4 %. A oscilação
  rápida (sobre uma deriva lenta) tem o mesmo período nos dois: **0,4424 s**. O cm A do celular é a média de A e B
  (massas iguais) até 0,005 mm.
- **Carimbo de tempo errado no `de_money.mp4`**: o arquivo tem um intervalo de 66,7 ms antes do quadro 256 (t = 8,567 s),
  mas a imagem não pula (a velocidade muda suave quadro a quadro, e o ciclo que contém o salto mede 0,475 s contra
  0,440–0,446 s dos outros): nenhum quadro foi perdido, o carimbo é que está errado. A página usa os carimbos (decisão
  da especificação, para vídeos de taxa variável), então herda o erro ali: um ciclo 33 ms mais longo e a velocidade
  daquele intervalo pela metade. O Tracker espalha o tempo por igual (33,383 ms por quadro, 0,15 % a mais em todo o
  vídeo, até 20 ms fora de lugar perto do salto). Com o salto tirado, os dois dão 0,4424 s. **Decidido pelo autor:
  fazer como o Tracker** (armadilha 2): desde então, os tempos da página no `de_money.mp4` coincidem com os do
  Tracker até 5 µs.
- Observações: um arquivo do celular chegou como planilha (.xlsx com nome .csv) com o CSV "Internacional/Python" numa
  coluna só, por ter sido aberto numa planilha em português (para planilha, o formato certo é "Excel/Planilhas Google").

## Arquitetura

```
index.html                 marcação da página; carrega vendor/mp4box.all.min.js e js/main.js (type="module")
sw.js                      service worker: cópia local de todos os arquivos (lista ARQUIVOS, conferida por teste)
manifest.webmanifest, img/ app instalável: abre deitado (orientation landscape), ícones de 192 e 512 px e um para o
                           recorte do Android (maskable), desenhados por tests/gerar_icones.py (Pillow: fundo
                           #0F766E, eixos, trajetória de pontos e a mira)
css/app.css                estilos e tokens de cor (temas claro e escuro)
css/fontes.css, fonts/     IBM Plex (cópia local, SIL OFL em fonts/OFL.txt)
vendor/mp4box.all.min.js   mp4box.js 0.5.4 (BSD-3), globais MP4Box e DataStream
js/main.js                 entrada: importa todos os módulos (vários só registram eventos), registra o sw.js e inicia
js/util.js                 $, fmt, parseNum, LS, toast, clampF, dist (sem estado)
js/estado.js               estado S, exposto em globalThis.__va (os testes dependem disso; não remova); orçamento de memória
js/video/conteiner.js      MP4/MOV: topBoxes, openFile, buildIndex, computeDims
js/video/decodificador.js  pump → nextJob → decodeGop; caches S.low e S.full; prévias dos quadros-chave (S.previa);
                           onFrame, copyFrame, putCache
js/video/leitor.js         leitura do arquivo em blocos de 8 MB guardados na memória (lerBytes), com o resto do arquivo
                           lido em segundo plano quando cabe no limite
js/video/exemplo.js        vídeo de exemplo em base64 (SAMPLE_B64)
js/objetos.js              objetos no molde do Tracker: massas (nome, cor, valor, pontos) e centros de massa (nomes das
                           massas do sistema); pesos, pontos do cm, salvar e reabrir. Sem DOM (testado no Node)
js/massas.js               interface dos objetos: fileira de botões (ativo, + massa, + centro de massa), escolha das
                           massas do cm ativo e passo 5 (cor, valor e incerteza de cada massa; situação de cada cm)
js/tema.js                 tema automático, claro ou escuro (data-theme no <html>) e meta theme-color; um script curto
                           no <head> do index.html aplica a escolha antes de a página aparecer
js/gaveta.js               gaveta ≡ montada da lista MENU (grupo → itens com rótulo, ícone e ação); as ações chamam as
                           funções exportadas por arquivos.js, dados.js, diagnostico.js e tema.js (sem lógica copiada)
js/icones.js               ícones em SVG embutido (IC.menu, IC.camera…)
js/paisagem.js             celular deitado: move os elementos da página para os contêineres de #pais (e os devolve
                           ao girar); etapas, gaveta dos objetos, abas do painel, variações B (vídeo em pé) e C (tela cheia)
js/barra.js                barra de quadros deitada: trilho, trecho do intervalo, alças do início e do fim, quadro atual
js/janela.js               janela do gráfico na tela cheia (C): arrastar, redimensionar pelas bordas, toque duplo
                           maximiza, recolher; posicionarJanela() é chamada por prepararLayout (paisagem.js)
css/paisagem.css           estilos da diagramação deitada (só valem com a classe "paisagem" no body)
js/lupa.js                 lupa da escala: canvas fixo na tela, desenhado por render() ao arrastar uma ponta da fita
js/analise.js              escala (real ou genérica, 1 px = 1 u.a.), eixos, phys(), predict(), salvamento por vídeo (persist)
js/desenho.js              vista com zoom (S.view), drawMain, drawOverlays
js/gestos.js               pinça, arrastar, toque
js/rastreio/modelo.js      cálculo do rastreamento: recorte, máscara, correlação, subpixel, evolução com âncora
js/rastreio/previsao.js    predictNext (pura: recebe as dimensões da imagem)
js/rastreio/rastreador.js  TR, autoSizeAt, initTemplate, trackFrame, runTrack
js/medicao.js              "Medir este vídeo" (≡ → Diagnóstico): salto, arrasto, play e decodificador à parte, no
                           próprio celular; o resultado (S.medicao) entra no diagnóstico
js/navegacao.js · ferramentas.js · paineis.js · dados.js · entradas.js · arquivos.js · diagnostico.js
```

Regras da estrutura:
- Os módulos foram separados das antigas seções do arquivo único movendo o código **sem alterá-lo** (só `import` e
  `export`); nenhum módulo altera variáveis de outro (só lê), e o estado compartilhado fica em `S`.
- Código de cálculo (sem DOM ao carregar) fica em módulos que o Node consegue importar, para ter testes rápidos
  (`tests/test_calculo.mjs`). `estado.js` usa `globalThis` por isso.
- Arquivo novo na página: inclua em `ARQUIVOS` no `sw.js` e mude `VERSAO` (o `test_offline.py` confere a lista).
- Objetos: `S.objs` (massas e cm) e `S.ativo` (índice do objeto ativo). `S.marks` é um *getter* definido em
  `objetos.js`: os pontos do objeto ativo (para o cm, os calculados). Escreva pontos só em `objeto.marks` de uma
  massa. Toda alteração de pontos, massas ou sistema passa por `persist()`, que aumenta `S.ver`; é o `S.ver` que
  manda recalcular o centro de massa (o rastreamento também aumenta `S.ver` a cada ponto).
- Abrir o `index.html` direto do disco não funciona mais (módulos exigem http). Para ver no computador:
  `python -m http.server` dentro desta pasta e abra `http://localhost:8000/`.

Coordenadas: toda posição (mira, marcas, escala, eixos) fica em **pixels da imagem exibida**, já girada e na
resolução nativa (`S.dispW × S.dispH`). `phys()` converte para unidades físicas com o eixo y para cima e o ângulo
do eixo x medido no sentido anti-horário.

## Decisões técnicas e armadilhas (todas encontradas em testes)

1. **WebCodecs + mp4box.js 0.5.4** (build UMD, globais `MP4Box` e `DataStream`, cópia local em `vendor/`).
   Só `ftyp` + `moov` vão para o mp4box; os dados (`mdat`) são lidos sob demanda com `File.slice`, por grupo de
   quadros. O `onReady` do mp4box exige `ftyp`; se o arquivo não tiver, um `ftyp` falso é usado.
2. **Tempo de cada quadro**: o carimbo do arquivo (`cts`) é lido e guardado em `S.frames[i].t` (play, diagnóstico,
   "taxa variável"). Na análise (tabela, gráfico, CSV, tempo na tela, previsão dos pontos e do rastreamento), desde
   21/11/2026 o tempo é **como no Tracker** (decisão do autor): `tempo(i)` (`analise.js`) usa o mesmo Δt para todos
   os quadros, a média do intervalo de análise (tempo do arquivo no quadro de fim − no de início, ÷ número de
   passos), com t = 0 no quadro de início. Conferido no `de_money.mp4`: o Tracker dá 33,38338 ms por quadro (a média
   do intervalo analisado; a do vídeo inteiro seria 33,3505 ms), e os tempos da página coincidem com os do .txt do
   Tracker até 5 µs. Mudar o início ou o fim do intervalo muda um pouco o Δt, como no Tracker; o bloco do intervalo
   mostra o "tempo por quadro". Antes, a análise usava o carimbo de cada quadro, e um carimbo errado no arquivo virava
   um ciclo mais longo e uma velocidade pela metade. Teste: `salto_carimbo.mp4` (`gerar_videos.py`).
3. O quadro que sai do decodificador é identificado pela **ordem dentro do grupo** (de um quadro-chave ao próximo),
   não pelo carimbo de tempo: o decodificador do Chrome às vezes altera o carimbo de saída em vídeos com quadros B.
   O diagnóstico conta as divergências (`S.tsMismatch`).
4. **Cada `VideoFrame` é copiado na hora e fechado** (`OffscreenCanvas` + `transferToImageBitmap`). Decodificadores
   por hardware do Android têm poucos quadros de saída; a versão que usava `createImageBitmap` assíncrono travou no
   celular do autor depois de arrastar a barra. Há também um vigia de 8 s que recria o decodificador e tenta de novo.
5. A **rotação** guardada nos metadados (vídeos gravados em pé) é aplicada na cópia: os quadros em cache já estão girados.
6. **Caches**: baixa resolução (lado maior ≤ 960 px) numa janela de até 61 quadros (15 atrás, 45 à frente), e
   resolução cheia (lado maior ≤ 2560 px) para o zoom, só o quadro atual e o próximo da marcação. Desde a fase 2
   (21/11/2026): a baixa guarda só a janela, com no máximo `BAIXA` bytes (`estado.js`: 96 MB num aparelho de 8 GB,
   64 MB com 4 GB, 40 MB com 2 GB ou menos); num vídeo de até 960 px a resolução cheia **é** a baixa (`cheiaIgual()`,
   `conteiner.js`) e não há segunda cópia (desenho, lupa e rastreador já usam a baixa quando a cheia falta; a fila de
   trabalhos e o aviso de "carregando a resolução cheia" do zoom sabem disso). O orçamento vem de
   `navigator.deviceMemory`. O grupo seguinte é decodificado em segundo plano para
   não haver pausa ao avançar.
7. **Salvamento** em `localStorage` por vídeo (nome + tamanho + número de quadros), 0,3 s depois da última mudança,
   e na hora quando a aba é escondida ou fechada (`visibilitychange`/`pagehide`).
8. **Rastreamento**: correlação normalizada nas cores (RGB) em dois níveis: grosso (modelo com ~25 px de lado,
   busca ampla) e fino (resolução cheia até raio 60 px; acima disso, versão reduzida com no máximo 121 px de lado),
   com subpixel por parábola. O modelo tem **máscara circular** (os cantos do quadrado, quase sempre fundo, ficam
   fora da correlação), como a elipse do autotracker do Tracker. **Previsão** como a do Tracker (`predictNext`): com
   os até 4 últimos pontos e o tempo real de cada quadro, em cada eixo usa aceleração constante quando a aceleração
   é consistente, senão velocidade constante, senão fica parado (num pêndulo sintético a 30 quadros/s, o erro médio
   da previsão caiu de 2,5 px para 0,4 px em relação à velocidade constante). Se a semelhança
   ficar abaixo da exigência (0,55 / 0,7 / 0,85), uma segunda busca 2,5× maior; se ainda falhar, para no quadro e
   deixa a mira na posição prevista. O modelo evolui 20% por quadro, **recortado na posição exata com fração de
   pixel** (recortar no pixel inteiro acumulava deriva: erro de 15 px num vídeo 1080p), e é **ancorado 5% no modelo
   original** a cada quadro, como no Tracker, para não virar fundo num rastreamento longo. Durante o rastreamento,
   ele usa um decodificador próprio e o `pump` fica parado. Referência: `TemplateMatcher` (biblioteca osp) e
   `AutoTracker` (repositório tracker), GPL: só ideias, nenhum código copiado.
9. **Tamanho do alvo**: medido sozinho ao tocar na massa (`autoSizeAt`). Se o quadrado tiver mais fundo que objeto,
   o rastreador segue o fundo parado com semelhança alta **e termina como se tivesse dado certo**. Foi o que
   aconteceu no vídeo real do pêndulo (massa de 28 px, quadrado padrão de 109 px). Mexer no tamanho à mão desliga
   a medição automática.
10. **Artefato do claude.ai: obsoleto** (decisão do autor, 14/11/2026); só o GitHub Pages importa. Ainda resta no
    código o caminho da capacidade `downloads` (`window.claude.use("downloads")`); fora do claude.ai, o CSV é baixado
    por um `Blob`. Não remova esse caminho sem combinar.
11. O **vídeo de exemplo** está embutido como base64 (`SAMPLE_B64`, em `js/video/exemplo.js`); é o
    `tests/videos/exemplo.mp4` gerado por `tests/gerar_videos.py`.
12. **Service worker com rede primeiro**: com conexão, cada arquivo vem da rede (o aluno recebe a versão publicada
    sem precisar limpar cache) e a cópia é atualizada; sem conexão, ou sem resposta em 4 s, usa a cópia. O
    `clients.claim()` faz o service worker atender a página já na primeira visita (inclui as fontes, que o navegador
    só busca quando um caractere de cada subconjunto aparece).
13. **Fileira de objetos abaixo de Marcar ponto e Rastrear**: posta logo abaixo das ferramentas, ela empurrava
    *Marcar ponto* para fora da tela num celular de 412 × 915, e o aluno teria de rolar a página entre tocar no
    vídeo e marcar. Cuidado ao pôr qualquer coisa entre o vídeo e a barra de marcação. Os botões quebram linha:
    com rolagem para o lado, alguns ficavam escondidos.
14. **Salvamento no formato 2** (`v: 2`, com `objs`, `ativo` e `massUnit`). O formato 1 (uma massa, `marks` e `mass`)
    ainda é lido e vira a massa A; não remova essa leitura enquanto houver alunos com dados antigos. A cor de uma
    massa só é guardada (campo opcional `cor`) quando o usuário a trocou; sem o campo, vale a cor padrão da letra.
15. **Cores lidas do CSS pelo JavaScript**: o desenho sobre o vídeo e o gráfico leem os tokens (`--amber`, `--line`,
    `--ov-edge`…) com `getComputedStyle` (`readOV` em `desenho.js`, `drawPlot` em `dados.js`) e redesenham quando o
    tema muda (`main.js` observa `data-theme` e `prefers-color-scheme`). Token novo usado no canvas: leia-o ali.
16. **Gaveta e histórico**: cada nível da gaveta (menu, página) faz `history.pushState`; fechar volta com
    `history.go(-nível)` e o `popstate` atualiza a tela. Assim o Voltar do Android fecha a gaveta em vez de sair da
    página. Com a gaveta aberta, `header`, `main` e `footer` ficam `inert`; antes de uma ação que abre o seletor de
    arquivo, a página deixa de ser inerte (o campo `fileIn` está dentro do `main`).
17. **Celular deitado: mover, não recriar**. `paisagem.js` move os elementos que já existem (mesmos ids e
    eventos) para os contêineres de `#pais` e deixa um comentário no lugar de origem de cada um; ao girar para em pé,
    cada elemento volta para o comentário dele. Só move quando a diagramação muda (A, B, C ou em pé), porque mover
    tira o foco de um campo em edição. A condição é `(orientation: landscape) and (max-height: 500px)`; o Chrome
    a partir da versão 108 não muda o tamanho da página quando o teclado abre, então digitar não troca a diagramação.
    Os outros módulos avisam a paisagem por eventos (`va:antes-layout` em `layout()`, `va:paineis` em `renderData()`,
    `va:modo` em `setMode()`), sem importá-la, para evitar importações circulares no carregamento. Um vídeo 16:9 na
    coluna do centro bate na largura antes de ocupar a altura toda (limite da geometria com o painel a 37%).
18. **Desenho juntado num quadro de tela**: os gestos (pinça, arrastar a imagem, as pontas da escala e os eixos)
    chamam `agendarRender()`, que redesenha uma vez por `requestAnimationFrame`; `render()` direto cancela o
    pedido pendente. A lupa é desenhada dentro de `render()`, no mesmo ciclo do vídeo.
19. **Janela do gráfico (tela cheia)**: a captura do ponteiro (`setPointerCapture`) só começa quando o dedo anda
    8 px. Capturar já no `pointerdown` mudaria o alvo do clique e os botões do cabeçalho (recolher, y(t)/x(t))
    deixariam de funcionar. Na tela cheia, o `click` do gráfico em `dados.js` é ignorado: quem decide entre toque e
    toque duplo é a `janela.js`, que chama `irAoPontoDoGrafico()` depois da espera. `posicionarJanela()` é chamada
    no fim de `prepararLayout()`, depois de a classe `pais-c` ir para o `body` (se a `janela.js` ouvisse o
    `va:antes-layout` sozinha, rodaria antes, porque é importada antes da `paisagem.js`). Um `ResizeObserver` no
    `plotBox` redesenha o gráfico uma vez por quadro de tela enquanto a janela muda de tamanho.
20. **Gaveta dos objetos (deitado)**: a fileira `#objs` e o `#cmSel` são movidos para dentro da gaveta (`#pObjsCorpo`);
    na tela cheia, a gaveta inteira (`#pObjs`) vai para o `#pTopo`. Abrir faz `history.pushState({ va: "objs" })`
    e todo fechamento passa por `history.back()`; o `popstate` atualiza a tela (como na gaveta ≡). O toque fora é
    ouvido no `pointerdown` em fase de captura, sem consumir o toque, e ignora o ≡ e a gaveta ≡ aberta: um
    `history.back()` da gaveta dos objetos ao mesmo tempo que o `pushState` da gaveta ≡ fecharia o menu na hora.
    O clique nos botões dos objetos é tratado primeiro por `massas.js` (importado antes); `paisagem.js` só decide
    se a gaveta fecha. `reorganizar()` fecha a gaveta antes de qualquer mudança de diagramação; sem vídeo (um
    arquivo que não abriu), ela também fecha. Com o painel estreito (até 280 px de largura na linha da alça, numa
    *container query*), a alça mostra só a letra da massa ("● A"); na tela cheia não há contenção, porque lá a linha
    da alça tem a largura do conteúdo e a contenção a encolheria a zero.
    **Voltar uma vez só**: as duas gavetas fecham por `voltarHistorico()` (`gaveta.js`), que volta no histórico uma
    vez só até o `popstate` chegar (ou até 1 s). O `popstate` é assíncrono; sem a trava, dois pedidos seguidos (os
    dois dedos de uma pinça pousam juntos e dão dois `pointerdown` no mesmo quadro, ou Esc repetido) voltavam duas
    vezes, e o segundo Voltar **saía da página** (achado no debug de 16/11/2026, com teste em `test_paisagem.py`).
21. **Orientação**: o `"orientation"` do manifesto só vale no app instalado (numa aba, o Chrome ignora). No app,
    sair da tela cheia chama `screen.orientation.unlock()`, que volta à orientação do manifesto (deitado), e não à
    livre. `start_url`, `scope` e `id` são `"./"`, relativos ao manifesto, para funcionar dentro da subpasta do
    GitHub Pages. O `test_offline.py` pergunta ao próprio Chrome (`Page.getAppManifest` e
    `Page.getInstallabilityErrors`) se o manifesto é lido sem erros e se a página é instalável; o motivo
    "in-incognito" é descontado, porque a janela do Playwright é anônima. **Só deitado** (21/11/2026): o aviso
    `#gire` aparece com `(orientation: portrait)`, não com o contrário da condição da paisagem, para que computador
    e tablet deitados (mais de 500 px de altura) continuem com a diagramação de sempre. Ele cobre a página (z 60,
    acima da gaveta ≡), mas a diagramação em pé continua montada por baixo: girar não mexe em S nem nos elementos.
    `localStorage` "va-retrato" = "1" libera a diagramação em pé; `helpers.abrir()` põe essa chave antes de a página
    carregar (`retrato=True`, o padrão), porque a maior parte dos testes roda em pé; o `test_paisagem.py` abre sem
    ela. Com o em pé liberado, girar em pé sai da tela cheia, como antes; sem ele, a tela cheia fica guardada.

22. **Leitura do arquivo e decodificação aos poucos** (fase 1, 21/11/2026). No celular do autor, cada leitura do
    arquivo custa ~0,9 s, qualquer que seja o tamanho (com `File.slice().arrayBuffer()`; no computador, 3 ms), e
    abrir um decodificador custa ~0,25 s. Por isso: (a) tudo o que lê o arquivo passa por `lerBytes()` (`leitor.js`),
    em blocos de 8 MB que ficam na memória (até 128 MB num aparelho de 8 GB), e um arquivo que cabe no limite é lido
    inteiro em segundo plano depois da primeira leitura (o índice, `conteiner.js`, também: um vídeo pequeno é uma
    leitura só); (b) `decodeGop` alimenta o grupo aos poucos (fila de até 4, evento `dequeue`) e para se o quadro
    atual sair do grupo (`serve()`), **sem recriar o decodificador** (nada de `reset()`/`configure()` de novo); um
    grupo abandonado não entra em `S.failed`; (c) ao parar no meio, os quadros que ainda vão sair são os que
    entraram e não saíram, na ordem de apresentação: com quadros B, **não** são os seguintes da ordem do grupo
    inteiro, e a lista `keep.P` é refeita (sem isso, quadros seriam guardados com o número errado); (d) o quadro
    pedido aparece assim que sai do decodificador (`onFrame` chama `agendarRender()`), sem esperar o grupo todo;
    (e) prévias: imagem de até 400 px do quadro-chave de cada grupo (`S.previa`, limite de 32 MB, saem as mais longe
    do quadro atual), feitas ao decodificar um grupo, em segundo plano quando não há mais nada a fazer (espaçadas por
    igual se não couberem todas) e, com o dedo arrastando (`S.arrasto`, `barra.js`), na hora, para o grupo debaixo
    do dedo; com o dedo arrastando, `nextJob` só faz prévias. `S.semFundo` para as prévias de fundo durante a
    medição; o `pump` para quando o rastreamento começa. **Há esperas no meio da alimentação** (leitura, fila): a cada
    passo, `decodeGop` confere se outro vídeo foi aberto (`S.gen`), e o `pump` não tenta de novo nem mostra erro de
    um vídeo já trocado (sem isso, abrir um vídeo durante as prévias de fundo do anterior mostrava por um instante
    "Não consegui decodificar este trecho").
23. **Memória** (fase 2, 21/11/2026). Limites da baixa e da cheia na armadilha 6. O rastreamento fecha o decodificador
    da página antes de abrir o seu (um só aberto por vez; o `pump` cria outro depois, ~0,25 s no celular) e lê o
    vídeo amostra por amostra pelo leitor (`lerAmostra`), não mais o grupo inteiro de uma vez. Com a página em
    segundo plano (`visibilitychange`, `S.oculta`), os quadros guardados, menos o atual, e o decodificador são
    devolvidos (o arquivo e as prévias ficam); ao voltar, o `pump` refaz a janela. Durante o rastreamento e a
    medição, nada é devolvido. Teto de tudo num aparelho de 8 GB: ~96 MB de baixa + 2 quadros em cheia + 32 MB de
    prévias + até 128 MB do arquivo.
24. **Sessão do decodificador e grupos longos** (21/11/2026, depois do teste da fase 2 no celular: engasgos no play
    do `Test_videos/Pendulum_test.mp4`, 1080p com só 2 grupos de até 158 quadros). Cada pedido decodificava do
    quadro-chave até o fim do grupo e esvaziava o decodificador (`flush`, que exige um quadro-chave depois): no play,
    cada reposição da janela recomeçava do quadro-chave (127 recomeços em 300 quadros no `gop150.mp4` de teste).
    Agora `keep` é uma **sessão**: o grupo, até onde foi alimentado (`fed`) e quantos quadros já saíram (`k`). Um
    pedido no mesmo grupo cujo menor quadro que falta ainda não saiu **continua** de onde a sessão parou; o pedido
    alimenta só até o último quadro que quer, mais `MARGEM` (3) amostras que empurram os quadros para fora do
    decodificador; a reposição não passa do fim da janela. A sessão só termina (`terminarSessao`, com o `flush` e a
    lista de saída refeita) ao trocar de grupo, voltar para trás no grupo, fazer uma prévia, chegar ao fim do grupo
    ou quando o quadro atual pedido não sai logo. Cuidados que apareceram nos testes: (a) guardar tudo o que sai
    dentro da janela **atual** (um quadro preso no decodificador sai durante um pedido seguinte, que começa mais à
    frente); (b) o descarte da baixa resolução tira primeiro os quadros fora da janela, depois os de trás, e os da
    frente por último (o descarte pelos usados há mais tempo tirava justamente os quadros à frente no play, guardados
    antes e ainda não mostrados); (c) um quadro que já entrou e não saiu (`pendente()`) não conta como faltando; (d)
    resultado "pendente" (com quadros B, um quadro P fica preso até entrarem os B anteriores a ele) e "abandonado"
    não são falha, e um grupo só é marcado como falho se o quadro ainda era o que se queria (sem isso, um salto no
    meio de um pedido marcava o grupo e a página nunca mais o decodificava). `S.sessoes` conta as sessões.
25. **Tudo acompanha o quadro atual** (21/11/2026, pedido do autor): `quadroMudou()` (`navegacao.js`) redesenha o
    vídeo com as marcas, destaca a linha da tabela e a rola para a vista dentro do `#tblWrap` (nunca a página; só o
    necessário para ficar abaixo do cabeçalho fixo), redesenha o gráfico (anel âmbar no ponto do quadro atual;
    `S.graficoNoQuadro`) e move o indicador da barra de quadros. `show()`, o avanço do play (`tick`) e o começo do
    play passam por ela: antes o play só redesenhava o vídeo, e o gráfico, a tabela e a barra ficavam parados até
    o play parar. O play (`tick`, `navegacao.js`) só avança para o próximo
    quadro quando chega a hora dele e ele já está decodificado; atrasado, o relógio recomeça desse quadro.

## Testes

Os testes abrem a página, servida por um servidor local que o próprio `helpers.py` sobe, num **Google Chrome de verdade** (o Chromium do Playwright não decodifica H.264),
com tela de celular e toque simulado, e comparam o que a página mede com vídeos sintéticos cuja trajetória é
conhecida (a equação está em `tests/gerar_videos.py`; o número de cada quadro está codificado em 12 quadradinhos
no topo da imagem).

```bash
pip install -r tests/requirements.txt      # Playwright e Pillow; não precisa de "playwright install"
python tests/gerar_videos.py               # uma vez; precisa do ffmpeg no PATH (libx265 é opcional)
python tests/test_decodificacao.py         # quadro certo, tempo de cada quadro, taxa variável, quadros B, rotação, tempo como no Tracker (salto_carimbo.mp4), HEVC
python tests/test_marcacao.py              # play, intervalo, pinça, marcação, CSV nos dois formatos (com a calibração), play sincronizado com o gráfico, a tabela e a barra, recuperação
python tests/test_rastreamento.py          # medição do alvo, precisão, um decodificador só, perda do alvo, botão Parar
python tests/test_massas.py                # escala genérica, duas massas, cm vazio e escolha das massas, dois cm, CSV com vários objetos, migração
python tests/test_tema.py                  # cores dos dois temas, contraste de todo texto, theme-color, tema manual, mira, pontos futuros, cor da massa
python tests/test_gaveta.py                # gaveta ≡: abrir, fechar (✕, toque fora, Esc, Voltar), páginas (Diagnóstico com "Medir este vídeo"), tema, cada ação
python tests/test_paisagem.py              # deitado (915 × 412), sem liberar o em pé: aviso "Gire o celular", abre em tela cheia, etapas, barra e alças, pinça, gaveta dos objetos, pior caso 10 massas + 2 cm, girar, B, C, janela do gráfico (arrastar, bordas, mínimo, toque duplo, lugar lembrado), gaveta ≡, Voltar uma vez só (pinça e Esc duplo), alça a 640 × 360, temas, arquivo que não é vídeo
python tests/test_lupa.py                  # lupa da escala: só nas pontas da fita, lado certo perto das bordas, pixel do centro, some ao soltar
python tests/test_desempenho.py            # fases 1 e 2, com a leitura lenta do celular simulada (0,9 s) e decodificação por software: arquivo em poucas leituras, abrir vídeo durante a decodificação do anterior, arrasto na barra e na alça com prévia, quadro exato e certo ao soltar, quadros B com trabalho abandonado, play sem pular quadros, play com grupos longos sem recomeçar do quadro-chave (gop150.mp4), memória dentro dos limites, segundo plano, vídeo de até 960 px sem cópia repetida
python tests/test_offline.py               # modo avião com a página aberta, recarregar sem conexão, lista do sw.js, nada externo, app instalável e deitado
node tests/test_calculo.mjs                # previsão, máscara, correlação e modelo de objetos, direto no Node (sem navegador)
python tests/medir_desempenho.py [--software] [--leitura-lenta] v.mp4   # não é teste: a mesma medição do "Medir este vídeo" do celular, para comparar antes e depois
```

Cada teste imprime `ok`/`FALHA` por item e sai com código 1 se algo falhar. Variáveis opcionais: `CHROME_PATH`
(outro executável do Chrome). Por hora a página só funciona deitada; `helpers.abrir()` libera a diagramação em pé
(chave "va-retrato"), onde roda a maior parte dos testes, e o `test_paisagem.py` abre sem ela, como o aluno. Os vídeos ficam em `tests/videos/`, fora do git.

Resultados de referência (computador, decodificação por software): tempo de cada quadro igual ao do arquivo
(erro ≤ 6 µs, resolução do próprio arquivo); rastreamento com erro máximo de 0,4 px nos vídeos de 360 a
720 px e 0,64 px no 1080p com massa de 230 px (antes da âncora, da máscara circular e da previsão por aceleração
eram 3,0 px nesse vídeo); de 69 a 119 quadros/s (medido em 14/11/2026).

No Windows, rode os testes com `PYTHONIOENCODING=utf-8`: sem isso, o console não imprime caracteres como "₁" e
o teste para com `UnicodeEncodeError`.

## Desempenho medido no celular do autor

Vídeo 1080p a 30 quadros/s, H.264: decodificação por hardware; cerca de 10 ms por quadro e 320 ms por grupo de
30 quadros; varredura do vídeo inteiro a 108 quadros/s. A velocidade do rastreamento no celular ainda não foi medida.

## Pendências

- Decididas para depois: **suporte a iOS** e **otimizar a sensibilidade do toque**.
- **Roteiro combinado em 14/11/2026** (fases em ordem):
  0. ~~Dividir em módulos e usar cópias locais do mp4box e das fontes~~ (feito).
  1. ~~Funcionamento sem internet (service worker)~~ (feito).
  2. **Memória e decodificação** (plano aprovado pelo autor em 21/11/2026; fases em ordem, commit e push ao fim de
     cada uma e teste do autor no celular antes da seguinte). Problema relatado: com vídeos grandes, o play trava e
     a escolha do início e do fim fica comprometida. Medido no computador (`tests/medir_desempenho.py --software`,
     decodificação por software, mais perto do celular; vídeos sintéticos com um quadro-chave por segundo, 4K a
     30 q/s e 1080p a 60 q/s): arrastando na barra, o quadro pedido fica na tela só 0 a 2 % do tempo; depois de
     soltar, 0,3 a 0,8 s até aparecer; salto de 0,1 a 0,7 s; play com 81 a 85 % dos quadros na hora; decodificar só
     o quadro-chave custa 0,02 s (1080p) e 0,09 s (4K). Com o hardware do computador (~9× mais rápido que o do
     celular do autor) tudo passa. Causas no código: para mostrar um quadro, o grupo inteiro é decodificado antes;
     o trabalho não é cancelado quando o dedo muda de lugar; o play espera o decodificador esvaziar a cada grupo;
     até 192 MB de quadros guardados na mesma memória de vídeo do decodificador por hardware, e dois
     decodificadores abertos no rastreamento; o grupo é lido do arquivo de uma vez (151 MB no vídeo com um só
     quadro-chave).
     0. ~~Medir no celular~~ (feito em 21/11/2026; falta o autor medir um vídeo que trava): o diagnóstico mostra
        quadros por grupo, taxa de bits, tempo por quadro e limite de memória, e ganhou **"Medir este vídeo"**
        (`js/medicao.js`), que roda no celular os mesmos testes do computador.
     1. ~~A imagem acompanha o dedo~~ (feito em 21/11/2026; **testado pelo autor no celular**: "não há travamentos
        perceptíveis", a etiqueta "prévia" não atrapalha; medido no celular, antes → depois: uma leitura só do arquivo
        (0,51 s), tempo por grupo 762 → 123 ms, salto 0,82–1,13 s → 0,05–0,16 s, arrasto com imagem do lugar 8 % →
        98 %, quadro exato depois de soltar 1,44 s → 0,16 s, play 54 de 120 quadros → todos em velocidade real;
        quadro-chave com o decodificador aberto 47 ms, com um novo 272 ms). A medição do autor
        (vídeo `Test_videos/de_sei_lá.mp4`, 848 × 480, 4,1 MB, grupos de 30) mostrou que o principal culpado era a
        **leitura do arquivo** (0,96 s para 0,2 MB no celular, 3 ms no computador), e não a memória; a leitura em
        blocos entrou como primeiro item. Feito: leitura em blocos (`leitor.js`), grupo alimentado aos poucos e
        abandonado quando o dedo sai dele, quadro na tela assim que sai do decodificador, prévias no arrasto, play
        que desacelera e mostra todos os quadros (armadilha 22). Com a leitura lenta simulada (0,9 s por leitura, o
        que reproduz os números do celular), antes → depois: vídeo do autor, salto 0,92 s → 0,03 s, arrasto com
        imagem do lugar 5 % → 98 % do tempo, quadro exato depois de soltar 1,39 s → 0,03 s, play 66 de 121 quadros →
        todos em velocidade real; 4K 30 q/s com decodificação por software, arrasto 5 % → 100 %, depois de soltar
        2,89 s → 0,68 s, play 11 de 121 quadros → todos a 86 % da velocidade real.
     2. ~~Memória~~ (feito em 21/11/2026; falta o autor testar no celular; armadilhas 6 e 23): a baixa resolução
        só guarda a janela, num limite pela memória do aparelho; a cheia, só o quadro atual e o próximo da marcação;
        num vídeo de até 960 px, sem a segunda cópia idêntica; um decodificador só no rastreamento, lendo amostra por
        amostra; memória devolvida com a página em segundo plano. No vídeo do autor, com a leitura lenta simulada:
        quadros guardados 161 MB (190 MB antes da fase 1) → 94 MB, com salto, arrasto e play iguais aos da fase 1.
        **Testado pelo autor no celular**: no `de_sei_lá.mp4`, 94 MB e tudo bem; no `Pendulum_test.mp4` (1080p, 2
        grupos de até 158 quadros), engasgos no play (70 % da velocidade). Corrigido no mesmo dia com a sessão do
        decodificador (armadilha 24): com a leitura lenta e a decodificação por software simuladas, o play do
        Pendulum foi de 77 % para 100 % da velocidade real; saltos de 0,14 a 0,73 s e 0,47 s depois de soltar (o
        limite de um vídeo com grupos tão longos: um quadro no meio do grupo exige decodificar desde o quadro-chave; a
        prévia cobre a espera). **Testado pelo autor no celular**: play do Pendulum em 100 % da velocidade real
        (era 70 %), "não há travamentos perceptíveis", e a espera de ~0,5 s depois de soltar não incomoda.
     3. Dispensada por ora (decisão do autor em 21/11/2026, com as fases 1 e 2 testadas no celular sem travamentos):
        cópia leve para navegar (540p com quadros-chave frequentes, feita uma vez ao abrir o vídeo; navegação e play
        nela, marcação, zoom e rastreamento no original). Só ela tiraria a espera de ~0,5 s ao saltar no meio de um
        grupo longo.
     Dica de gravação ("grave em 1080p"): não, por hora; fica para a versão beta (decisão do autor).
  3. ~~Modelo de dados com vários objetos, no molde do Tracker, com migração do que os alunos já salvaram~~ (feito
     em 14/11/2026, antes da fase 2, a pedido do autor; junto vieram a interface para até 10 massas, o centro de
     massa e a escala genérica).
  4. Rastrear todas as massas numa passada só de decodificação (hoje o rastreamento é da massa ativa).
  4a. **Celular deitado e cores** (plano aprovado pelo autor em 14/11/2026, etapas em ordem, uma por vez, testada no
     celular entre elas; o autor pediu commit e push ao fim de cada etapa): 1. ~~cores e temas~~ (feito);
     2. ~~gaveta ≡~~ (feito: Vídeo, Dados, Ferramentas, com Diagnóstico, Tema e Ajuda, também em pé, sem tirar os
     botões de onde estão; Voltar do Android fecha; a Ajuda é montada com as notas de cada passo da página, até o
     autor escrever o texto próprio);
     3, 5 e 6. ~~paisagem A, variação B e tela cheia C~~ (feitas juntas: as três dividem o mesmo módulo);
     4. ~~lupa da escala e desenho juntado num quadro de tela~~ (feito). Todas as etapas do plano estão feitas; falta
     o autor conferir no celular.
     Depois: ~~janela do gráfico na tela cheia~~ (feita em 15/11/2026; falta conferir no celular). Em seguida, pedido
     pelo autor em 15/11/2026: **limpar a poluição visual**, começando pela escolha das massas perto do gráfico:
     ~~gaveta dos objetos deitado~~ (feita em 15/11/2026; falta conferir no celular); ~~sem ✓ nas etapas~~ (feito
     em 16/11/2026). Outros pontos da limpeza: a combinar com o autor. Também em 16/11/2026, por hora: ~~app
     instalável que abre deitado~~ (falta conferir a instalação no celular). Em 21/11/2026, por hora: ~~só deitado~~ (aviso "Gire o celular" em pé) e ~~abrir em tela cheia~~ (app em `display: fullscreen`); falta conferir no celular. Em aberto, para o autor decidir
     (debug de 16/11/2026): com a janela do gráfico maximizada durante um rastreamento, o botão Parar some junto
     com o rodapé (decisão "Marcar ponto e Rastrear somem"); hoje é preciso um toque duplo para voltar e parar.
     3. paisagem A (coluna de etapas, vídeo na altura toda, barra de quadros com duas alças que grudam no quadro,
     painel Parâmetros/Gráfico/Tabela, rodapé fixo Marcar ponto/Rastrear, botões de objeto compactos com bolinha e
     letra, girar sem perder etapa, objeto, quadro, mira, zoom e marcas); "Repetir" no Parâmetros do Intervalo, e
     "do início ao fim" é voltar ao início + play; 4. **lupa só na escala** (pontas da fita), acima do dedo, trocando
     para baixo perto do topo e de lado perto das bordas; sem lupa na mira; desenho juntado em um por quadro de tela
     (requestAnimationFrame); 5. variação B (vídeo em pé); 6. variação C (tela cheia).
  5. Futuro: exportar e importar `.trk` (arquivo de projeto do Tracker).
