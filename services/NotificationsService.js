import steemService from './SteemService.js';
import authService from './AuthService.js';
import eventEmitter from '../utils/EventEmitter.js';
import { TYPES } from '../models/Notification.js';
import transactionHistoryService from './TransactionHistoryService.js';

/**
 * Service for managing user notifications in the Steem application
 */
class NotificationsService {
    constructor() {
        this.notificationsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        this.unreadCount = 0;
        this.allNotificationsCache = null;
        this.debugMode = true; // Attiva debugging esteso
    }

    /**
     * Fetches notifications for the current user
     */
    async getNotifications(type = TYPES.ALL, page = 1, limit = 20, forceRefresh = false) {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
            console.warn('Cannot get notifications: No authenticated user');
            return { notifications: [], hasMore: false };
        }

        const username = currentUser.username;
        
        // RISOLUZIONE MACELLO: FORZA SEMPRE IL RECUPERO COMPLETO PER OGNI TIPO
        console.log(`🚀 RECUPERO COMPLETO per ${username}, tipo: ${type}`);
        
        try {
            // Se in cache e non forzato, usa la cache
            const cacheKey = `${username}_ALL_NOTIFICATIONS`;
            let allNotifications = null;
            
            if (!forceRefresh) {
                allNotifications = this.getCachedNotifications(cacheKey)?.notifications;
                if (allNotifications && allNotifications.length > 0) {
                    console.log(`✅ Usando cache con ${allNotifications.length} notifiche`);
                }
            }
            
            // Se la cache non esiste o è forzato il refresh, recupera tutto
            if (!allNotifications || forceRefresh) {
                console.log(`🔄 Recupero completo dello storico per ${username}`);
                
                // Recupera TUTTE le notifiche storiche
                allNotifications = await this.fetchAllHistoricalNotifications(username);
                
                // Salva in cache
                this.setCachedNotifications(cacheKey, { 
                    notifications: allNotifications,
                    hasMore: false
                });
                
                console.log(`💾 Salvate ${allNotifications.length} notifiche in cache`);
            }
            
            // Filtra per tipo (se non è ALL)
            let filteredNotifications = allNotifications;
            if (type !== TYPES.ALL) {
                filteredNotifications = allNotifications.filter(n => n.type === type);
                console.log(`🔍 Filtrate per tipo ${type}: ${filteredNotifications.length} notifiche`);
            }
            
            // Debug dei conteggi per tipo
            if (this.debugMode) {
                const countByType = allNotifications.reduce((acc, n) => {
                    acc[n.type] = (acc[n.type] || 0) + 1;
                    return acc;
                }, {});
                
                console.log("📊 CONTEGGIO NOTIFICHE PER TIPO:", countByType);
            }
            
            // Applica paginazione
            const start = (page - 1) * limit;
            const end = start + limit;
            const paginatedNotifications = filteredNotifications.slice(start, end);
            
            console.log(`📄 Pagina ${page}: mostro ${paginatedNotifications.length} notifiche (${start}-${end} di ${filteredNotifications.length})`);
            
            return {
                notifications: paginatedNotifications,
                hasMore: end < filteredNotifications.length
            };
        } catch (error) {
            console.error(`❌ Errore nel recupero notifiche:`, error);
            return { notifications: [], hasMore: false };
        }
    }

    /**
     * Get notifications from cache
     */
    getCachedNotifications(cacheKey) {
        const cacheEntry = this.notificationsCache.get(cacheKey);
        
        if (!cacheEntry) {
            return null;
        }
        
        const now = Date.now();
        if (now - cacheEntry.timestamp > this.cacheExpiry) {
            this.notificationsCache.delete(cacheKey);
            return null;
        }
        
        return cacheEntry.data;
    }

    /**
     * Cache notifications
     */
    setCachedNotifications(cacheKey, data) {
        this.notificationsCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Recupera e analizza TUTTA la storia dell'account
     */
    async fetchAllHistoricalNotifications(username) {
        // RECUPERO MULTI-CICLO DI TUTTA LA STORIA SENZA SALTI
        console.log(`⏳ AVVIO RECUPERO MASSIVO per ${username}`);
        
        // Parametri iniziali
        let lastId = -1;
        let allNotifications = [];
        let seenTransactions = new Set();
        let seenNotifications = new Set();
        let historySizesUsed = [1000, 2000, 500, 200, 100]; // Dimensioni batch da provare
        let cycleCount = 0;
        let continueSearch = true;
        let totalTransactions = 0;
        
        this.showBusyMessage("RECUPERO STORICO NOTIFICHE IN CORSO...<br>Potrebbe richiedere qualche minuto");
        
        // APPROCCIO MASSIVO:
        // Recupera lo storico ripetutamente con diverse dimensioni batch fino a ID=1
        while (continueSearch && cycleCount < 100) { // Limite di sicurezza
            cycleCount++;
            
            for (const batchSize of historySizesUsed) {
                try {
                    this.updateBusyMessage(`Ciclo ${cycleCount}: Recupero ${batchSize} transazioni da ID ${lastId}<br>Trovate ${allNotifications.length} notifiche`);
                    
                    console.log(`🔍 Ciclo ${cycleCount}: Recupero ${batchSize} transazioni da ID ${lastId}`);
                    
                    const history = await transactionHistoryService.getUserTransactionHistory(username, batchSize, lastId);
                    
                    if (!history || !Array.isArray(history) || history.length === 0) {
                        console.log('📭 Nessuna transazione trovata');
                        continueSearch = false;
                        break;
                    }
                    
                    totalTransactions += history.length;
                    
                    // Trova l'ID più vecchio da cui continuare
                    const lastTransaction = history[history.length - 1];
                    if (!Array.isArray(lastTransaction) || lastTransaction.length < 1) {
                        continueSearch = false;
                        break;
                    }
                    
                    const oldestId = lastTransaction[0];
                    console.log(`📜 Recuperate ${history.length} transazioni. ID più vecchio: ${oldestId}`);
                    
                    // Se abbiamo raggiunto l'inizio o siamo bloccati, fermiamoci
                    if (oldestId <= 1 || oldestId === lastId) {
                        console.log(`🏁 Raggiunto ID ${oldestId}, fine ricerca`);
                        continueSearch = false;
                        break;
                    }
                    
                    // Salva il nuovo lastId per il prossimo ciclo
                    lastId = oldestId;
                    
                    // Processa le transazioni per estrarre notifiche
                    const newNotifications = this.processAccountHistory(history);
                    
                    // Aggiungi solo notifiche uniche
                    newNotifications.forEach(notification => {
                        const notificationId = this.generateNotificationId(notification, true);
                        if (!seenNotifications.has(notificationId)) {
                            seenNotifications.add(notificationId);
                            allNotifications.push(notification);
                        }
                    });
                    
                    console.log(`✅ Trovate ${newNotifications.length} nuove notifiche, totale: ${allNotifications.length}`);
                    
                    // Breve pausa per non sovraccaricare
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Se poche transazioni, probabilmente abbiamo finito
                    if (history.length < batchSize / 2) {
                        console.log('📉 Meno della metà del batch, probabilmente abbiamo finito');
                        continueSearch = false;
                        break;
                    }
                    
                    break; // Usciamo dal ciclo for se abbiamo avuto successo con questa dimensione
                } catch (error) {
                    console.error(`⚠️ Errore con batch size ${batchSize}:`, error);
                    // Continuiamo con la prossima dimensione batch
                }
            }
        }
        
        this.hideBusyMessage();
        
        // Ordina per data (più recenti prima)
        allNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log(`🎉 RECUPERO COMPLETATO: ${allNotifications.length} notifiche in ${totalTransactions} transazioni`);
        
        // Statistiche per tipo
        const countByType = {};
        allNotifications.forEach(n => {
            countByType[n.type] = (countByType[n.type] || 0) + 1;
        });
        
        console.log("📊 STATISTICHE FINALI:", countByType);
        
        return allNotifications;
    }

    /**
     * Processa la storia dell'account in modo più permissivo
     */
    processAccountHistory(history) {
        if (!history || !Array.isArray(history)) {
            return [];
        }
        
        const notifications = [];
        const currentUser = authService.getCurrentUser()?.username;
        if (!currentUser) return [];
        
        const seenIds = new Set();
        
        history.forEach(historyItem => {
            try {
                if (!Array.isArray(historyItem) || historyItem.length < 2) return;
                
                const [id, transaction] = historyItem;
                
                // Estrai operazione e dati
                let opType, opData;
                
                if (transaction.op && Array.isArray(transaction.op) && transaction.op.length >= 2) {
                    opType = transaction.op[0];
                    opData = transaction.op[1];
                } else if (transaction.operation && Array.isArray(transaction.operation) && transaction.operation.length >= 2) {
                    opType = transaction.operation[0];
                    opData = transaction.operation[1];
                } else if (transaction.operations && Array.isArray(transaction.operations) && transaction.operations.length > 0) {
                    const firstOp = transaction.operations[0];
                    if (Array.isArray(firstOp) && firstOp.length >= 2) {
                        opType = firstOp[0];
                        opData = firstOp[1];
                    } else {
                        return;
                    }
                } else {
                    return;
                }
                
                // Timestamp
                const timestamp = transaction.timestamp || new Date().toISOString();
                
                // REPLIES (quando qualcuno risponde a un tuo post)
                if (opType === 'comment' && opData.parent_author === currentUser) {
                    notifications.push(this.createNotification(
                        TYPES.REPLIES,
                        {
                            id,
                            author: opData.author,
                            permlink: opData.permlink,
                            parent_permlink: opData.parent_permlink,
                            body: opData.body?.substring(0, 140) + (opData.body?.length > 140 ? '...' : '') || '',
                            timestamp
                        },
                        false // Non letto
                    ));
                }
                
                // MENTIONS (quando qualcuno ti menziona)
                if (opType === 'comment' && opData.body && opData.body.includes(`@${currentUser}`)) {
                    notifications.push(this.createNotification(
                        TYPES.MENTIONS,
                        {
                            id,
                            author: opData.author,
                            permlink: opData.permlink,
                            body: opData.body?.substring(0, 140) + (opData.body?.length > 140 ? '...' : '') || '',
                            timestamp
                        },
                        false
                    ));
                }
                
                // UPVOTES (quando qualcuno vota un tuo post)
                if (opType === 'vote' && opData.author === currentUser && opData.weight > 0) {
                    notifications.push(this.createNotification(
                        TYPES.UPVOTES,
                        {
                            id,
                            voter: opData.voter,
                            permlink: opData.permlink,
                            weight: opData.weight / 100,
                            timestamp
                        },
                        false
                    ));
                }
                
                // CUSTOM_JSON per FOLLOWS e RESTEEMS
                if (opType === 'custom_json') {
                    let jsonData;
                    try {
                        jsonData = typeof opData.json === 'string' ? JSON.parse(opData.json) : opData.json;
                    } catch (e) {
                        return;
                    }
                    
                    if (jsonData && Array.isArray(jsonData) && jsonData.length > 1) {
                        // FOLLOWS
                        if (jsonData[0] === 'follow') {
                            const followData = jsonData[1];
                            if (followData && followData.following === currentUser && 
                                followData.what && Array.isArray(followData.what) && followData.what.includes('blog')) {
                                notifications.push(this.createNotification(
                                    TYPES.FOLLOWS,
                                    {
                                        id,
                                        follower: followData.follower,
                                        timestamp
                                    },
                                    false
                                ));
                            }
                        } 
                        // RESTEEMS
                        else if (jsonData[0] === 'reblog') {
                            const reblogData = jsonData[1];
                            if (reblogData && reblogData.author === currentUser) {
                                notifications.push(this.createNotification(
                                    TYPES.RESTEEMS,
                                    {
                                        id,
                                        account: reblogData.account,
                                        permlink: reblogData.permlink,
                                        timestamp
                                    },
                                    false
                                ));
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Errore nel processare item:', error);
            }
        });
        
        return notifications;
    }

    // UI helpers per il feedback durante recupero
    showBusyMessage(message) {
        let busyElement = document.getElementById('notifications-busy-message');
        
        if (!busyElement) {
            busyElement = document.createElement('div');
            busyElement.id = 'notifications-busy-message';
            busyElement.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px; border-radius: 10px; z-index: 9999; max-width: 80vw;';
            document.body.appendChild(busyElement);
        }
        
        busyElement.innerHTML = `
            <div style="text-align:center">
                <div style="width:50px;height:50px;border:3px solid rgba(255,255,255,0.2);border-top:3px solid white;border-radius:50%;margin:0 auto 15px;animation:notifications-spin 1s linear infinite"></div>
                <div style="font-weight:bold;margin-bottom:10px">RECUPERO NOTIFICHE</div>
                <div>${message}</div>
            </div>
        `;
        
        if (!document.querySelector('style#notifications-spin-style')) {
            const style = document.createElement('style');
            style.id = 'notifications-spin-style';
            style.textContent = '@keyframes notifications-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }
    }

    updateBusyMessage(message) {
        const busyElement = document.getElementById('notifications-busy-message');
        if (busyElement) {
            const messageDiv = busyElement.querySelector('div > div:last-child');
            if (messageDiv) {
                messageDiv.innerHTML = message;
            }
        }
    }

    hideBusyMessage() {
        const busyElement = document.getElementById('notifications-busy-message');
        if (busyElement) {
            busyElement.remove();
        }
    }

    /**
     * Clear the notifications cache completely
     */
    clearCache() {
        this.notificationsCache.clear();
        this.allNotificationsCache = null; // Direct reset instead of calling non-existent method
        this.unreadCount = 0;
        console.log('🧹 Cache notifiche completamente svuotata');
    }

    /**
     * Clear the specific all-notifications cache
     */
    clearAllNotificationsCache() {
        this.allNotificationsCache = null;
        console.log('🧹 Cache notifiche globali svuotata');
    }

    /**
     * Creates a notification object
     */
    createNotification(type, data, isRead = false) {
        return {
            type,
            data,
            timestamp: data.timestamp || new Date().toISOString(),
            isRead
        };
    }

    /**
     * Generate a unique ID for a notification
     * @param {Object} notification - The notification object
     * @param {boolean} forLookup - Whether this ID is for lookup (excludes timestamp)
     */
    generateNotificationId(notification, forLookup = false) {
        const { type, data } = notification;
        let idParts = [type];
        
        switch (type) {
            case TYPES.REPLIES:
            case TYPES.MENTIONS:
                idParts.push(data.author, data.permlink);
                break;
            case TYPES.UPVOTES:
                idParts.push(data.voter, data.permlink);
                break;
            case TYPES.FOLLOWS:
                idParts.push(data.follower);
                break;
            case TYPES.RESTEEMS:
                idParts.push(data.account, data.permlink);
                break;
        }
        
        if (!forLookup && notification.timestamp) {
            idParts.push(notification.timestamp);
        }
        
        return idParts.join('_');
    }
}

// Initialize singleton instance
const notificationsService = new NotificationsService();
export default notificationsService;
