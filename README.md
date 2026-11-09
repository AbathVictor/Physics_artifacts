# Physics_artifacts
Esse é um repositório público e de código aberto aonde compartilharei ferramentas de análise de dados voltados à atividades de experimentação em em aulas de Física.

## Ferramentas

### [Laboratório de Oscilações](laboratorio-oscilacoes/OscLab.html)

Página para analisar o oscilador amortecido (sistema massa-mola) a partir da vídeo-análise feita no [Tracker](https://physlets.org/tracker/). Tudo roda no navegador, em um único arquivo HTML, sem instalação.

| Aba | O que faz |
| --- | --- |
| **Análise da curva** | Importa a trajetória exportada do Tracker e traça a curva do modelo com os parâmetros medidos (massa, frequência, amplitude inicial e coeficiente de decaimento), com medidas de qualidade (RMS dos resíduos, R², χ²/ν, autocorrelação dos resíduos). Também faz o ajuste livre por mínimos quadrados, calcula τ, ω₀, b, k, Q e δ com propagação de incertezas e compara as medidas diretas com o ajuste. |
| **Ajuste dos picos** | Ajusta A(t) = A₀·e^(−γt/2) às amplitudes dos picos inseridas à mão ou coladas de uma planilha, com o gráfico linearizado ln A × t. |
| **Multivisualização** | Sobrepõe posição, velocidade e aceleração (ou mostra em gráficos empilhados) e estima as defasagens e as razões de amplitude, comparando com o MHS. |
| **Explorar o modelo** | Simula o oscilador para valores escolhidos de m, k e b e compara os regimes subcrítico, crítico e supercrítico, com a energia mecânica. |

**Como usar**

- Abra `laboratorio-oscilacoes/OscLab.html` no navegador. Para isso, baixe o repositório ou o arquivo, ou clique [aqui](https://abathvictor.github.io/Physics_artifacts/laboratorio-oscilacoes/OscLab.html).
- Exporte do Tracker a tabela de dados como texto ou CSV, ou copie a tabela e cole na página. A página reconhece vírgula ou ponto decimal, tabulação e ponto e vírgula, e as linhas de título do Tracker. NÃO USE A VÍRGULA SIMULTÂNEAMENTE COMO DELIMITADOR E SEPARADOR DECIMAL.
- Os dados ficam salvos apenas no navegador de quem usa. Nada é enviado para servidor algum. O botão **Limpar tudo** apaga os dados de todas as abas.

**Notação**

- Em todas as abas, γ = b/m: a amplitude cai como e^(−γt/2) e a energia mecânica como e^(−γt).
- Com essa convenção: τ = 2/γ (tempo para a amplitude cair a A₀/e), ω₀ = √(ω² + γ²/4), Q = ω₀/γ, δ = γT/2, e o amortecimento crítico ocorre em γ = 2ω₀.

### [Videoanálise Móvel](Tracker-mobile/) · em desenvolvimento

Vídeo-análise quadro a quadro feita no próprio celular, inspirada no Tracker. O aluno grava o vídeo, define a escala e os eixos, informa a massa e marca a posição do objeto em cada quadro (à mão, com zoom de pinça, ou com o rastreamento automático). A tabela t, x, y sai copiada ou em CSV, no formato do Excel e Planilhas Google ou no internacional (Python), e abre direto no Laboratório de Oscilações.

**Como usar**

- No celular Android, abra no Chrome: [abathvictor.github.io/Physics_artifacts/Tracker-mobile](https://abathvictor.github.io/Physics_artifacts/Tracker-mobile/). Por enquanto, iPhone não é suportado.
- Grave com o celular apoiado e parado, de frente para o movimento, com uma referência métrica no mesmo plano do objeto.
- O vídeo é processado no próprio aparelho; nada é enviado para servidor algum. As marcações ficam salvas no navegador de quem usa.
