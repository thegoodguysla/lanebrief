// LaneBrief Service Worker
// Handles push notifications for rate alerts and provides PWA installability

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "LaneBrief Alert", body: event.data.text() };
  }

  const options = {
    body: data.body || "A lane rate has moved past your threshold.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "rate-alert",
    renotify: true,
    data: {
      url: data.url || "/dashboard",
    },
    actions: [
      { action: "view", title: "View Dashboard" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "LaneBrief Rate Alert", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
