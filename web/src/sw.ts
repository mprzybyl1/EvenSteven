/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// Precache assetów wstrzykniętych przez vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);

interface PushData {
  title: string;
  body: string;
  url?: string;
}

// Odbiór powiadomienia push.
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let data: PushData;
  try {
    data = event.data.json() as PushData;
  } catch {
    data = { title: "EvenSteven", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

// Klik w powiadomienie -> otwórz/focusuj apkę na właściwym ekranie.
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          void client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
