# Videoanálise Móvel (Tracker-mobile)

Contexto para o Claude Code. Leia antes de mexer nesta pasta.

## O que é

Uma página única (`index.html`) de vídeo-análise quadro a quadro no celular, inspirada no
[Tracker](https://github.com/OpenSourcePhysics/tracker) do Open Source Physics, para as atividades experimentais
de Física Básica (sistema massa-mola, pêndulo). O aluno grava o vídeo no próprio celular, define o intervalo,
calibra a escala e os eixos, informa a massa, marca a posição do objeto (à mão ou com rastreamento automático)
e exporta t, x, y para analisar no [Laboratório de Oscilações](../laboratorio-oscilacoes/), numa planilha ou em Python.

- Público: alunos com celular **Android e Chrome**. iOS ainda não é alvo.
- Tudo roda no navegador; o vídeo nunca sai do aparelho.
- Publicada pelo GitHub Pages em `https://abathvictor.github.io/Physics_artifacts/Tracker-mobile/`.

## Como trabalhar com o autor

- Converse em **português do Brasil**. Na interface, números com **vírgula decimal** (`Intl.NumberFormat("pt-BR")`);
  comentários do código também em português.
- **Funcionalidades grandes: proponha o plano e espere o autor decidir antes de escrever código.** É assim que ele
  prefere trabalhar. Correções e ajustes pequenos podem ir direto.
- O autor testa no próprio celular Android. Diga claramente o que você conseguiu verificar no computador e o que
  só dá para confirmar no aparelho (sensação do toque, desempenho, janela de download).
- Rode os testes (seção **Testes**) antes de cada commit que mexa no `index.html`.
- Textos da interface: curtos, diretos, escritos para o aluno; mensagens de erro dizem o que aconteceu e como resolver.

## Especificação decidida (não mude sem combinar)

| Tema | Decisão |
| --- | --- |
| Plataforma | Android + Chrome primeiro; iOS fica para depois |
| Forma | Página separada nesta pasta, arquivo único autocontido |
| Fluxo | vídeo (câmera ou galeria) → intervalo → escala → eixos → massa → marcação → tabela e gráfico |
| Dados | apenas **t, x, y** por quadro, mais a **massa** (valor ± incerteza, g ou kg). Velocidade e aceleração ficaram de fora por decisão |
| Saída | **Copiar tabela** (tabulação) e **Exportar CSV** em dois formatos que o aluno escolhe: *Excel/Planilhas Google* (`;` entre colunas, vírgula decimal, com marca UTF-8 no início) e *Internacional/Python* (`,` entre colunas, ponto decimal) |
| Estrutura do CSV | igual à do Tracker, com metadados antes: `massa: (0,250 ± 0,001) kg`, `unidades: t em s · x e y em cm`, linha do objeto (`;massa A`), cabeçalho `t;x;y`, dados. No Python: `pd.read_csv(arquivo, skiprows=3)`. O Laboratório de Oscilações lê os dois formatos (testado) |
| Descartado | botão "Enviar para o Laboratório de Oscilações" |
| Reprodução | play em **velocidade real** (sem câmera lenta) e botão **Reproduzir do início ao fim**, com opção **Repetir** |
| Marcação | **zoom de pinça** no próprio vídeo + **toque posiciona a mira** (substituiu uma lupa lateral, que o autor achou pior) |
| Rastreamento | automático no estilo do autotracker do Tracker (ver abaixo) |
| Toque | sensibilidade "aceitável"; otimizar no futuro |

## Estado atual

Validado no celular do autor (Android 10, Chrome 156, 8 GB de memória, decodificação por hardware):
abertura de vídeo da câmera ou da galeria, navegação, play, reprodução do intervalo, zoom de pinça, marcação,
janela de download do CSV, fluidez. O rastreamento automático foi testado num vídeo real de pêndulo
(1080p, massa de 28 px): funciona depois da medição automática do tamanho do alvo (ver armadilha 9).

## Arquitetura do `index.html`

Um arquivo só: `<style>` com tokens de cor (temas claro e escuro), marcação HTML e um `<script>` em IIFE dividido
em seções marcadas com `// ===== ... =====`:

1. **formatação pt-BR** (`fmt`, `parseNum`) e `localStorage` protegido (`LS`).
2. **estado** `S`, exposto em `window.__va` (os testes dependem disso; não remova).
3. **contêiner MP4/MOV**: `topBoxes`, `openFile`, `buildIndex`, `computeDims`.
4. **decodificação**: `pump` → `nextJob` → `decodeGop`; caches `S.low` e `S.full`; `onFrame`, `copyFrame`, `putCache`.
5. **análise**: escala, eixos, `phys()`, `predict()`, salvamento por vídeo (`persist`).
6. **desenho**: vista com zoom (`S.view`), `drawMain`, `drawOverlays`.
7. **interação**: gestos no vídeo (pinça, arrastar, toque).
8. **rastreamento automático**: `TR`, `autoSizeAt`, `initTemplate`, `trackFrame`, `runTrack`.
9. **navegação e reprodução**, **ferramentas** (`setMode`, `markPoint`), **painéis**, **dados** (`rows`, `exportText`), entradas, diagnóstico e início.

Coordenadas: toda posição (mira, marcas, escala, eixos) fica em **pixels da imagem exibida**, já girada e na
resolução nativa (`S.dispW × S.dispH`). `phys()` converte para unidades físicas com o eixo y para cima e o ângulo
do eixo x medido no sentido anti-horário.

## Decisões técnicas e armadilhas (todas encontradas em testes)

1. **WebCodecs + mp4box.js 0.5.4** (build UMD, globais `MP4Box` e `DataStream`, via cdn.jsdelivr.net).
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
   com subpixel por parábola. Previsão por velocidade constante a partir dos dois últimos pontos; se a semelhança
   ficar abaixo da exigência (0,55 / 0,7 / 0,85), uma segunda busca 2,5× maior; se ainda falhar, para no quadro e
   deixa a mira na posição prevista. O modelo evolui 20% por quadro, **recortado na posição exata com fração de
   pixel**: recortar no pixel inteiro acumulava deriva (erro de 15 px num vídeo 1080p). Durante o rastreamento,
   ele usa um decodificador próprio e o `pump` fica parado.
9. **Tamanho do alvo**: medido sozinho ao tocar na massa (`autoSizeAt`). Se o quadrado tiver mais fundo que objeto,
   o rastreador segue o fundo parado com semelhança alta **e termina como se tivesse dado certo**. Foi o que
   aconteceu no vídeo real do pêndulo (massa de 28 px, quadrado padrão de 109 px). Mexer no tamanho à mão desliga
   a medição automática.
10. **Artefato do claude.ai e GitHub Pages**: a mesma página também existe como artefato no claude.ai, onde ela vai
    sem `<!doctype>`/`<head>` (a hospedagem acrescenta), o CSV é salvo pela capacidade `downloads`
    (`window.claude.use("downloads")`) e o sandbox bloqueia downloads comuns. Fora do claude.ai, o CSV é baixado
    por um `Blob`. **Este repositório é a fonte da verdade**; o artefato é uma cópia.
11. O **vídeo de exemplo** está embutido como base64 (`SAMPLE_B64`) porque o artefato não pode buscar arquivos.
    Ele é o `tests/videos/exemplo.mp4` gerado por `tests/gerar_videos.py`.

## Testes

Os testes abrem o `index.html` num **Google Chrome de verdade** (o Chromium do Playwright não decodifica H.264),
com tela de celular e toque simulado, e comparam o que a página mede com vídeos sintéticos cuja trajetória é
conhecida (a equação está em `tests/gerar_videos.py`; o número de cada quadro está codificado em 12 quadradinhos
no topo da imagem).

```bash
pip install -r tests/requirements.txt      # Playwright e Pillow; não precisa de "playwright install"
python tests/gerar_videos.py               # uma vez; precisa do ffmpeg no PATH (libx265 é opcional)
python tests/test_decodificacao.py         # quadro certo, tempo de cada quadro, taxa variável, quadros B, rotação, HEVC
python tests/test_marcacao.py              # play, intervalo, pinça, marcação, CSV nos dois formatos, recuperação
python tests/test_rastreamento.py          # medição do alvo, precisão, perda do alvo, botão Parar
```

Cada teste imprime `ok`/`FALHA` por item e sai com código 1 se algo falhar. Variáveis opcionais: `CHROME_PATH`
(outro executável do Chrome) e `MP4BOX_LOCAL` (caminho de um `mp4box.all.min.js` 0.5.4, se não houver acesso ao CDN).
Os vídeos ficam em `tests/videos/`, fora do git.

Resultados de referência (computador, decodificação por software): tempo de cada quadro igual ao do arquivo
(erro ≤ 6 µs, resolução do próprio arquivo); rastreamento com erro máximo de 0,4 a 0,6 px nos vídeos de 360 a
720 px e 1,6 px no 1080p com massa de 230 px; de 14 a 35 quadros/s.

## Desempenho medido no celular do autor

Vídeo 1080p a 30 quadros/s, H.264: decodificação por hardware; cerca de 10 ms por quadro e 320 ms por grupo de
30 quadros; varredura do vídeo inteiro a 108 quadros/s. A velocidade do rastreamento no celular ainda não foi medida.

## Pendências

- Decididas para depois: **suporte a iOS** e **otimizar a sensibilidade do toque**.
- Em aberto (sugestão técnica, ainda não decidida com o autor): dividir o `index.html` em módulos, o que pediria
  um passo de montagem para continuar gerando o arquivo único usado no artefato do claude.ai.
- O artefato no claude.ai precisa ser atualizado à mão a partir deste arquivo quando houver mudanças.
