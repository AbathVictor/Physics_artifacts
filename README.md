# Physics_artifacts
Esse é um repositório público e de código aberto aonde compartilharei ferramentas de análise de dados voltados à atividades de experimentação em em aulas de Física.

## Ferramentas

### [Laboratório de Oscilações](laboratorio-oscilacoes/)

Página para analisar o oscilador amortecido (sistema massa-mola) a partir da vídeo-análise feita no [Tracker](https://physlets.org/tracker/). Tudo roda no navegador, em um único arquivo HTML, sem instalação.

| Aba | O que faz |
| --- | --- |
| **Análise da curva** | Importa a trajetória exportada do Tracker e traça a curva do modelo com os parâmetros medidos (massa, frequência, amplitude inicial e coeficiente de decaimento), com medidas de qualidade (RMS dos resíduos, R², χ²/ν, autocorrelação dos resíduos). Também faz o ajuste livre por mínimos quadrados, calcula τ, ω₀, b, k, Q e δ com propagação de incertezas e compara as medidas diretas com o ajuste. |
| **Ajuste dos picos** | Ajusta A(t) = A₀·e^(−γt/2) às amplitudes dos picos inseridas à mão ou coladas de uma planilha, com o gráfico linearizado ln A × t. |
| **Multivisualização** | Sobrepõe posição, velocidade e aceleração (ou mostra em gráficos empilhados) e estima as defasagens e as razões de amplitude, comparando com o MHS. |
| **Explorar o modelo** | Simula o oscilador para valores escolhidos de m, k e b e compara os regimes subcrítico, crítico e supercrítico, com a energia mecânica. |

**Como usar**

- Abra `laboratorio-oscilacoes/index.html` no navegador. Para isso, baixe o repositório ou o arquivo, ou use o endereço do GitHub Pages, se ele estiver ativado.
- Exporte do Tracker a tabela de dados como texto ou CSV, ou copie a tabela e cole na página. A página reconhece vírgula ou ponto decimal, tabulação e ponto e vírgula, e as linhas de título do Tracker. Só não use a vírgula ao mesmo tempo como delimitador e como decimal.
- Os dados ficam salvos apenas no navegador de quem usa. Nada é enviado para servidor algum. O botão **Limpar tudo** apaga os dados de todas as abas.

**Notação**

- Na aba Análise da curva (ajuste livre) e na aba Explorar, γ = b/(2m): a amplitude cai como e^(−γt).
- Nas medidas diretas e na aba Ajuste dos picos, γ = b/m: a amplitude cai como e^(−γt/2).
- A página indica a conversão entre as duas sempre que compara valores.
