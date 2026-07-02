self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const title = data.name ? `Alerta: ${data.name} (${data.ticker})` : 'Alerta de Mercado';
      const options = {
        body: `${data.signal || ''}\nPrecio: $${data.price}\nDetalle: ${data.detail}`,
        icon: '/logo.svg',
        badge: '/logo.svg',
        data: {
          url: `/market/${data.ticker}`
        }
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('Push data not JSON', e);
      event.waitUntil(
        self.registration.showNotification('Finance Portfolio', {
          body: event.data.text()
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        // Try to find an existing window to focus
        for (let client of windowClients) {
          if (client.url.includes(event.notification.data.url) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not found, open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});
