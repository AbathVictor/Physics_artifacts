// Service worker de despedida do endereço antigo (22/11/2026): o aplicativo mudou para
// https://abathvictor.github.io/Physics-Mobile-Track/. Apaga só as cópias offline antigas ("videoanalise-N"; as do
// endereço novo, "vam-N", ficam), remove-se e recarrega as abas abertas, que então seguem o redirecionamento.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const nome of await caches.keys()) if (/^videoanalise-\d+$/.test(nome)) await caches.delete(nome);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url);
})()));
