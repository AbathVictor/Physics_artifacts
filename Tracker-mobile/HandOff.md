# Videoanálise Móvel (Tracker-mobile)

Contexto para o Claude Code. Leia antes de mexer nesta pasta.

## O que é

Uma página (`index.html` com módulos JavaScript em `js/`) de vídeo-análise quadro a quadro no celular, inspirada no
[Tracker](https://github.com/OpenSourcePhysics/tracker) do Open Source Physics, para as atividades experimentais
de Física Básica (sistema massa-mola, pêndulo). O aluno grava o vídeo no próprio celular, define o intervalo,
calibra a escala e os eixos, informa as massas, marca a posição de cada objeto (à mão ou com rastreamento
automático; até 10 massas e centros de massa formados pelas massas que ele escolher) e exporta t, x, y para analisar no [Laboratório de Oscilações](../laboratorio-oscilacoes/OscLab.html), numa planilha ou em Python.

- Público: alunos com celular **Android e Chrome**. iOS ainda não é alvo.
- Tudo roda no navegador; o vídeo nunca sai do aparelho. Nada para instalar.
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
| Estrutura do CSV | igual à do Tracker, com metadados antes: `massa: (0,250 ± 0,001) kg`, `unidades: t em s · x e y em cm`, linha do objeto (`;massa A`), cabeçalho `t;x;y`, dados. No Python: `pd.read_csv(arquivo, skiprows=3)`. O Laboratório de Oscilações lê os dois formatos (testado) | Com vários objetos, o formato de várias trilhas do Tracker (`ExportDataDialog`): uma linha por massa (`massa A: …`), uma linha por centro de massa (`cm A: massa A + massa B · …`), `unidades`, `#multi:`, a linha dos nomes `;massa A;;massa B;;cm A;;`, o cabeçalho `t;x;y;x;y;x;y;` e os dados (célula vazia no quadro em que o objeto não tem ponto). Com um objeto só, o formato continua o de antes |
| Descartado | botão "Enviar para o Laboratório de Oscilações" |
| Reprodução | play em **velocidade real** (sem câmera lenta) e botão **Reproduzir do início ao fim**, com opção **Repetir** |
| Marcação | **zoom de pinça** no próprio vídeo + **toque posiciona a mira** (substituiu uma lupa lateral, que o autor achou pior) |
| Lupa | **só para a escala** (pedido do autor, 14/11/2026): ao arrastar uma ponta da fita de calibração, um círculo ampliado (124 px, 2,5× a vista, de 3 a 12 px de tela por pixel do vídeo) com cruz fina no centro, 70 px acima do dedo; perto do topo da tela vai para baixo do dedo, perto de uma borda lateral vai para o outro lado; some ao soltar. Sem lupa para marcar nem para a mira. Usa o quadro já guardado (`S.full`), sem cache novo |
| Gráfico na tela cheia | decidido em 15/11/2026: o gráfico fica numa **janela móvel** sobre o vídeo, que se arrasta por **qualquer ponto** (o dedo precisa andar 8 px para virar arrasto; antes disso é toque) e nunca sai da tela, e se **redimensiona pelas quatro bordas e pelos quatro cantos** (18 px de toque nas bordas, que passam 12 px para fora da janela; mínimo de 220 × 140 px; marca no canto de baixo à direita). **Toque duplo** maximiza na área do vídeo livre dos controles flutuantes (da coluna de etapas à borda direita, do topo até a barra de quadros), e outro toque duplo volta ao tamanho e ao lugar de antes. Maximizada, não se move, e Marcar ponto e Rastrear somem (play, ±1 e a barra de quadros continuam funcionando). **Sem botão de maximizar** no cabeçalho, só o toque duplo (pedido do autor). Um toque simples no gráfico espera 0,25 s antes de ir ao quadro, para não confundir com o toque duplo. O cabeçalho tem recolher, o objeto ativo e y(t)/x(t). A janela fica acima do vídeo e abaixo dos controles flutuantes. Lugar, tamanho e se está recolhida ficam em `localStorage` (`va-grafico`, em frações da tela), fora do salvamento por vídeo; ao entrar na tela cheia, a janela nunca vem maximizada |
| Rastreamento | automático no estilo do autotracker do Tracker (ver abaixo) |
| Toque | sensibilidade "aceitável"; otimizar no futuro |

## Estado atual

Validado no celular do autor (Android 10, Chrome 156, 8 GB de memória, decodificação por hardware):
abertura de vídeo da câmera ou da galeria, navegação, play, reprodução do intervalo, zoom de pinça, marcação,
janela de download do CSV, fluidez. O rastreamento automático foi testado num vídeo real de pêndulo
(1080p, massa de 28 px): funciona depois da medição automática do tamanho do alvo (ver armadilha 9).

## Arquitetura

```
index.html                 marcação da página; carrega vendor/mp4box.all.min.js e js/main.js (type="module")
sw.js                      service worker: cópia local de todos os arquivos (lista ARQUIVOS, conferida por teste)
css/app.css                estilos e tokens de cor (temas claro e escuro)
css/fontes.css, fonts/     IBM Plex (cópia local, SIL OFL em fonts/OFL.txt)
vendor/mp4box.all.min.js   mp4box.js 0.5.4 (BSD-3), globais MP4Box e DataStream
js/main.js                 entrada: importa todos os módulos (vários só registram eventos), registra o sw.js e inicia
js/util.js                 $, fmt, parseNum, LS, toast, clampF, dist (sem estado)
js/estado.js               estado S, exposto em globalThis.__va (os testes dependem disso; não remova); orçamento de memória
js/video/conteiner.js      MP4/MOV: topBoxes, openFile, buildIndex, computeDims
js/video/decodificador.js  pump → nextJob → decodeGop; caches S.low e S.full; onFrame, copyFrame, putCache
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
                           ao girar); etapas, abas do painel, variações B (vídeo em pé) e C (tela cheia)
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
2. O **tempo de cada quadro vem do carimbo do arquivo** (`cts`), não de uma taxa fixa: vídeos de celular podem ter
   taxa variável. t = 0 no quadro de início do intervalo.
3. O quadro que sai do decodificador é identificado pela **ordem dentro do grupo** (de um quadro-chave ao próximo),
   não pelo carimbo de tempo: o decodificador do Chrome às vezes altera o carimbo de saída em vídeos com quadros B.
   O diagnóstico conta as divergências (`S.tsMismatch`).
4. **Cada `VideoFrame` é copiado na hora e fechado** (`OffscreenCanvas` + `transferToImageBitmap`). Decodificadores
   por hardware do Android têm poucos quadros de saída; a versão que usava `createImageBitmap` assíncrono travou no
   celular do autor depois de arrastar a barra. Há também um vigia de 8 s que recria o decodificador e tenta de novo.
5. A **rotação** guardada nos metadados (vídeos gravados em pé) é aplicada na cópia: os quadros em cache já estão girados.
6. **Caches**: baixa resolução (lado maior ≤ 960 px) numa janela de até 61 quadros (15 atrás, 45 à frente), e
   resolução cheia (lado maior ≤ 2560 px) para o zoom e para o quadro atual e os próximos da marcação.
   O orçamento de memória vem de `navigator.deviceMemory`. O grupo seguinte é decodificado em segundo plano para
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

## Testes

Os testes abrem a página, servida por um servidor local que o próprio `helpers.py` sobe, num **Google Chrome de verdade** (o Chromium do Playwright não decodifica H.264),
com tela de celular e toque simulado, e comparam o que a página mede com vídeos sintéticos cuja trajetória é
conhecida (a equação está em `tests/gerar_videos.py`; o número de cada quadro está codificado em 12 quadradinhos
no topo da imagem).

```bash
pip install -r tests/requirements.txt      # Playwright e Pillow; não precisa de "playwright install"
python tests/gerar_videos.py               # uma vez; precisa do ffmpeg no PATH (libx265 é opcional)
python tests/test_decodificacao.py         # quadro certo, tempo de cada quadro, taxa variável, quadros B, rotação, HEVC
python tests/test_marcacao.py              # play, intervalo, pinça, marcação, CSV nos dois formatos, recuperação
python tests/test_rastreamento.py          # medição do alvo, precisão, perda do alvo, botão Parar
python tests/test_massas.py                # escala genérica, duas massas, cm vazio e escolha das massas, dois cm, CSV com vários objetos, migração
python tests/test_tema.py                  # cores dos dois temas, contraste de todo texto, theme-color, tema manual, mira, pontos futuros, cor da massa
python tests/test_gaveta.py                # gaveta ≡: abrir, fechar (✕, toque fora, Esc, Voltar), páginas, tema, cada ação
python tests/test_paisagem.py              # deitado (915 × 412): etapas, barra e alças, pinça, pior caso 10 massas + 2 cm, girar, B, C, janela do gráfico (arrastar, bordas, mínimo, toque duplo, lugar lembrado), gaveta, temas
python tests/test_lupa.py                  # lupa da escala: só nas pontas da fita, lado certo perto das bordas, pixel do centro, some ao soltar
python tests/test_offline.py               # modo avião com a página aberta, recarregar sem conexão, lista do sw.js, nada externo
node tests/test_calculo.mjs                # previsão, máscara, correlação e modelo de objetos, direto no Node (sem navegador)
```

Cada teste imprime `ok`/`FALHA` por item e sai com código 1 se algo falhar. Variáveis opcionais: `CHROME_PATH`
(outro executável do Chrome). Os vídeos ficam em `tests/videos/`, fora do git.

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
  2. Memória e decodificação: travamentos em alguns vídeos no celular. Hipóteses e plano já levantados: grupos
     longos lidos e enviados de uma vez ao decodificador (confirmado no computador: vídeo 4K com um só quadro-chave
     leva 3 s por salto), memória de vídeo do Android dividida entre os caches e o decodificador por hardware, e dois
     decodificadores abertos durante o rastreamento. O Tracker não guarda quadros (decodifica sob demanda; ver
     `CVVideo`, `XuggleVideo` e `JSMovieVideo`). Antes de mudar, pedir ao autor o diagnóstico de um vídeo que trava.
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
     Depois: ~~janela do gráfico na tela cheia~~ (feita em 15/11/2026; falta conferir no celular). Próximo, pedido
     pelo autor em 15/11/2026: **limpar a poluição visual**, começando pela escolha das massas perto do gráfico
     (menu flutuante que alterna entre massas e centros de massa, ou gaveta que se esconde; mesma posição; plano a
     propor e combinar antes do código).
     3. paisagem A (coluna de etapas, vídeo na altura toda, barra de quadros com duas alças que grudam no quadro,
     painel Parâmetros/Gráfico/Tabela, rodapé fixo Marcar ponto/Rastrear, botões de objeto compactos com bolinha e
     letra, girar sem perder etapa, objeto, quadro, mira, zoom e marcas); "Repetir" no Parâmetros do Intervalo, e
     "do início ao fim" é voltar ao início + play; 4. **lupa só na escala** (pontas da fita), acima do dedo, trocando
     para baixo perto do topo e de lado perto das bordas; sem lupa na mira; desenho juntado em um por quadro de tela
     (requestAnimationFrame); 5. variação B (vídeo em pé); 6. variação C (tela cheia).
  5. Futuro: exportar e importar `.trk` (arquivo de projeto do Tracker).
