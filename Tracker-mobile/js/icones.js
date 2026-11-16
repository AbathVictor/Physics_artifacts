// Ícones em SVG embutido (sem arquivos de fora): traço na cor do texto (currentColor), caixa de 24 × 24.
// Usados pela gaveta ≡ e pela diagramação com o celular deitado.

const svg = (corpo) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${corpo}</svg>`;

export const IC = {
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  fechar: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  voltar: svg('<path d="M15 5l-7 7 7 7"/>'),
  camera: svg('<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10.5l6-3.5v10l-6-3.5z"/>'),
  galeria: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  filme: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
  baixar: svg('<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'),
  copiar: svg('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  pulso: svg('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  tema: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
  ajuda: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6M12 17.2v.1"/>'),
  telaCheia: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  sairTela: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  abaixo: svg('<path d="M6 9l6 6 6-6"/>'),
  // etapas (coluna da esquerda, com o celular deitado)
  intervalo: svg('<path d="M4 12h16M7 8v8M17 8v8"/>'),
  escala: svg('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  eixos: svg('<path d="M5 3v16h16"/><path d="M5 19l7-7"/>'),
  massas: svg('<circle cx="8" cy="15" r="4"/><circle cx="17" cy="8" r="3"/>'),
  marcar: svg('<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  dados: svg('<path d="M4 20V4M4 20h16"/><path d="M7 15l4-5 3 3 5-7"/>'),
  play: '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M5 3l12 7-12 7z"/></svg>',
  pausa: '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4 3h4v14H4zM12 3h4v14h-4z"/></svg>',
  inicio: '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M3 3h3v14H3zM17 3L7 10l10 7z"/></svg>',
};
