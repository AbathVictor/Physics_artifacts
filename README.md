# Physics_artifacts

## Ferramentas

### [Laboratório de Oscilações](laboratorio-oscilacoes/OscLab.html)

Página para analisar o oscilador amortecido (sistema massa-mola) a partir da vídeo-análise feita no [Tracker](https://physlets.org/tracker/). Tudo roda no navegador, em um único arquivo HTML, sem instalação.

| Aba | O que faz |
| --- | --- |
| **Análise da curva** | Importa a trajetória exportada do Tracker e traça duas curvas: a do modelo com os parâmetros medidos (massa, frequência, amplitude inicial e coeficiente de decaimento) e a do ajuste livre por mínimos quadrados. Para cada curva, mostra R², RMSE e MAPE, sem dizer se o ajuste é bom: essa leitura fica com o aluno. Também calcula τ, ω₀, b, k, Q e δ com propagação de incertezas e compara as medidas diretas com o ajuste. |
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

### [Videoanálise Móvel](https://github.com/AbathVictor/Physics-Mobile-Track) · em desenvolvimento

Vídeo-análise quadro a quadro no celular, inspirada no Tracker. Em 22/11/2026 mudou-se para um repositório próprio, [AbathVictor/Physics-Mobile-Track](https://github.com/AbathVictor/Physics-Mobile-Track), com todo o histórico; o endereço antigo (`Tracker-mobile/`) redireciona para [abathvictor.github.io/Physics-Mobile-Track](https://abathvictor.github.io/Physics-Mobile-Track/). Instruções, licença e créditos estão lá.
