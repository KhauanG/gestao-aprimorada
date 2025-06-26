// Service Worker para Ice Beer Management System
const CACHE_NAME = 'ice-beer-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Service Worker: Erro ao adicionar arquivos ao cache', error);
            })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Ativando...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deletando cache antigo', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
    // Estratégia Cache First para recursos estáticos
    if (event.request.url.includes('.css') || 
        event.request.url.includes('.js') || 
        event.request.url.includes('.html') ||
        event.request.url.includes('.json')) {
        
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - retorna resposta do cache
                    if (response) {
                        return response;
                    }
                    
                    // Fazer requisição para a rede
                    return fetch(event.request)
                        .then((response) => {
                            // Verificar se a resposta é válida
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            
                            // Clonar a resposta
                            const responseToCache = response.clone();
                            
                            // Adicionar ao cache
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                            
                            return response;
                        })
                        .catch(() => {
                            // Se falhar, tentar retornar do cache
                            return caches.match('/index.html');
                        });
                })
        );
    } else {
        // Para outras requisições, tentar rede primeiro
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request);
                })
        );
    }
});

// Gerenciamento de dados offline
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Sincronização em background');
        event.waitUntil(doBackgroundSync());
    }
});

function doBackgroundSync() {
    // Aqui você pode implementar lógica para sincronizar dados
    // quando a conexão for restaurada
    return new Promise((resolve) => {
        console.log('Service Worker: Executando sincronização...');
        // Implementar lógica de sincronização aqui
        resolve();
    });
}

// Notificações Push (futuro)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push message recebida');
    
    const options = {
        body: event.data ? event.data.text() : 'Nova notificação do Ice Beer',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Abrir Sistema',
                icon: '/icon-192x192.png'
            },
            {
                action: 'close',
                title: 'Fechar',
                icon: '/icon-192x192.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Ice Beer Management', options)
    );
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notificação clicada');
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Abrir ou focar na janela do aplicativo
        event.waitUntil(
            clients.matchAll().then((clientList) => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
    console.log('Service Worker: Mensagem recebida', event.data);
    
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.action === 'getCacheSize') {
        caches.open(CACHE_NAME).then((cache) => {
            return cache.keys();
        }).then((keys) => {
            event.ports[0].postMessage({
                cacheSize: keys.length
            });
        });
    }
});

// Limpeza periódica do cache
function cleanupCache() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    const now = Date.now();
    
    caches.open(CACHE_NAME).then((cache) => {
        cache.keys().then((requests) => {
            requests.forEach((request) => {
                cache.match(request).then((response) => {
                    if (response) {
                        const dateHeader = response.headers.get('date');
                        if (dateHeader) {
                            const responseDate = new Date(dateHeader).getTime();
                            if (now - responseDate > maxAge) {
                                console.log('Service Worker: Removendo cache expirado', request.url);
                                cache.delete(request);
                            }
                        }
                    }
                });
            });
        });
    });
}

// Executar limpeza a cada 6 horas
setInterval(cleanupCache, 6 * 60 * 60 * 1000);