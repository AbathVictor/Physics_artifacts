// Service worker da Videoanálise Móvel: guarda uma cópia de todos os arquivos da página no aparelho, para que ela
// continue funcionando sem internet (modo avião, por exemplo) e possa até ser recarregada sem conexão.
//
// Estratégia: rede primeiro. Com conexão, cada arquivo vem da rede (o aluno recebe sempre a versão publicada) e a
// cópia guardada é atualizada; sem conexão, ou se a rede demorar, usa a cópia guardada.
//
// Ao criar, renomear ou apagar um arquivo da página, atualize a lista ARQUIVOS (o teste test_offline.py confere)
// e mude VERSAO, para que a cópia antiga seja descartada.
const VERSAO = "videoanalise-10";
const ARQUIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "css/fontes.css",
  "css/paisagem.css",
  "fonts/OFL.txt",
  "fonts/ibm-plex-mono-400-latin-ext.woff2",
  "fonts/ibm-plex-mono-400-latin.woff2",
  "fonts/ibm-plex-mono-400-symbols2.woff2",
  "fonts/ibm-plex-mono-500-latin-ext.woff2",
  "fonts/ibm-plex-mono-500-latin.woff2",
  "fonts/ibm-plex-mono-500-symbols2.woff2",
  "fonts/ibm-plex-sans-400-greek.woff2",
  "fonts/ibm-plex-sans-400-latin-ext.woff2",
  "fonts/ibm-plex-sans-400-latin.woff2",
  "fonts/ibm-plex-sans-500-greek.woff2",
  "fonts/ibm-plex-sans-500-latin-ext.woff2",
  "fonts/ibm-plex-sans-500-latin.woff2",
  "fonts/ibm-plex-sans-600-greek.woff2",
  "fonts/ibm-plex-sans-600-latin-ext.woff2",
  "fonts/ibm-plex-sans-600-latin.woff2",
  "fonts/ibm-plex-sans-condensed-600-latin-ext.woff2",
  "fonts/ibm-plex-sans-condensed-600-latin.woff2",
  "img/icone-192.png",
  "img/icone-512.png",
  "img/icone-mascara-512.png",
  "js/analise.js",
  "js/arquivos.js",
  "js/barra.js",
  "js/dados.js",
  "js/desenho.js",
  "js/diagnostico.js",
  "js/entradas.js",
  "js/estado.js",
  "js/ferramentas.js",
  "js/gaveta.js",
  "js/gestos.js",
  "js/icones.js",
  "js/janela.js",
  "js/lupa.js",
  "js/main.js",
  "js/massas.js",
  "js/medicao.js",
  "js/navegacao.js",
  "js/objetos.js",
  "js/paineis.js",
  "js/paisagem.js",
  "js/rastreio/modelo.js",
  "js/rastreio/previsao.js",
  "js/rastreio/rastreador.js",
  "js/tema.js",
  "js/util.js",
  "js/video/conteiner.js",
  "js/video/decodificador.js",
  "js/video/exemplo.js",
  "js/video/leitor.js",
  "vendor/mp4box.all.min.js",
];
// sem resposta da rede neste tempo, usa a cópia guardada (conexão ruim se comporta como sem conexão)
const ESPERA_REDE_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((a) => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSAO) await caches.delete(nome);
    // passa a atender já a página aberta na primeira visita, sem precisar recarregar
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(redePrimeiro(req));
});

async function redePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  try {
    const resp = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("rede lenta")), ESPERA_REDE_MS)),
    ]);
    if (resp.ok && resp.type === "basic") cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const guardada = await cache.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (guardada) return guardada;
    throw err;
  }
}
