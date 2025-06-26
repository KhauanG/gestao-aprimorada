// Firebase Service - Ice Beer Management - VERSÃO FINAL CORRIGIDA
class FirebaseService {
    constructor() {
        this.initialized = false;
        this.initPromise = null;
        this.isOnline = navigator.onLine;
        this.pendingOperations = [];
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        
        // Aguardar Firebase estar disponível
        this.initialize();
    }

    async initialize() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = this.waitForFirebaseAndInit();
        return this.initPromise;
    }

    async waitForFirebaseAndInit() {
        console.log('🔥 FirebaseService: Aguardando Firebase estar pronto...');
        
        // Aguardar Firebase estar disponível (com timeout)
        let attempts = 0;
        const maxAttempts = 100; // 10 segundos
        
        while (attempts < maxAttempts) {
            // Verificar se Firebase está pronto
            if (window.firebaseReady && window.firebaseDb && window.firebaseAuth) {
                break;
            }
            
            // Aguardar 100ms entre tentativas
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.firebaseDb || !window.firebaseAuth) {
            throw new Error('Firebase não inicializou dentro do tempo limite');
        }
        
        // Conectar aos serviços
        this.db = window.firebaseDb;
        this.auth = window.firebaseAuth;
        
        console.log('🔥 FirebaseService: Conectado aos serviços Firebase');
        
        // Configurar listeners de conectividade
        this.setupConnectivityListeners();
        
        // Marcar como inicializado
        this.initialized = true;
        
        console.log('✅ FirebaseService: Inicializado com sucesso');
        return true;
    }

    setupConnectivityListeners() {
        // Monitorar status de conexão
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Reconectado - processando operações pendentes...');
            this.processPendingOperations();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📱 Modo offline ativado');
        });
    }

    // Wrapper para garantir inicialização
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
        return true;
    }

    // AUTHENTICATION ROBUSTA
    async authenticateUser(username, password) {
        await this.ensureInitialized();
        
        try {
            const email = `${username}@icebeer.local`;
            console.log('🔑 Tentando autenticar:', email);
            
            // Verificar credenciais válidas primeiro
            const validCredentials = {
                'conv@icebeer.local': '123',
                'peti@icebeer.local': '123',
                'disk@icebeer.local': '123',
                'dono@icebeer.local': '123'
            };
            
            if (!validCredentials[email] || validCredentials[email] !== password) {
                console.log('❌ Credenciais inválidas');
                return false;
            }
            
            try {
                // Tentar login
                const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
                console.log('✅ Login realizado:', userCredential.user.email);
                return true;
                
            } catch (loginError) {
                console.log('⚠️ Usuário não encontrado, criando conta...');
                
                if (loginError.code === 'auth/user-not-found') {
                    // Criar usuário
                    const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
                    console.log('👤 Usuário criado e logado:', userCredential.user.email);
                    return true;
                    
                } else if (loginError.code === 'auth/wrong-password') {
                    console.error('❌ Senha incorreta para usuário existente');
                    return false;
                    
                } else if (loginError.code === 'auth/invalid-email') {
                    console.error('❌ Email inválido');
                    return false;
                    
                } else {
                    console.error('❌ Erro de autenticação:', loginError.code);
                    return false;
                }
            }
        } catch (error) {
            console.error('❌ Erro crítico na autenticação:', error);
            return false;
        }
    }

    async signOut() {
        await this.ensureInitialized();
        
        try {
            await this.auth.signOut();
            console.log('🚪 Logout realizado com sucesso');
            return true;
        } catch (error) {
            console.error('❌ Erro no logout:', error);
            return false;
        }
    }

    // OPERAÇÕES COM RETRY AUTOMÁTICO
    async executeWithRetry(operation, data, operationType) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`🔄 Tentativa ${attempt}/${this.retryAttempts} para ${operationType}`);
                
                const result = await operation(data);
                
                if (attempt > 1) {
                    console.log(`✅ ${operationType} bem-sucedido na tentativa ${attempt}`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Tentativa ${attempt} falhou:`, error.code || error.message);
                
                // Se é erro de permissão e usuário não está logado, não retry
                if (error.code === 'permission-denied' && !this.auth.currentUser) {
                    console.error('❌ Usuário não autenticado');
                    throw new Error('Usuário não autenticado. Faça login primeiro.');
                }
                
                // Se é último attempt, throw error
                if (attempt === this.retryAttempts) {
                    throw lastError;
                }
                
                // Aguardar antes de retry
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }
        
        throw lastError;
    }

    // BILLING ENTRIES COM RETRY
    async saveBillingEntry(entry) {
        await this.ensureInitialized();
        
        const operation = async (entryData) => {
            // Verificar se usuário está logado
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            // Adicionar metadados
            const entryWithTimestamp = {
                ...entryData,
                createdBy: this.auth.currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            console.log('💾 Salvando entrada:', entryWithTimestamp);
            
            const docRef = await this.db.collection('billingEntries').add(entryWithTimestamp);
            
            console.log('✅ Entrada salva com ID:', docRef.id);
            return { success: true, id: docRef.id };
        };
        
        try {
            return await this.executeWithRetry(operation, entry, 'saveBillingEntry');
        } catch (error) {
            console.error('❌ Erro ao salvar entrada após todas as tentativas:', error);
            
            // Se offline, adicionar à fila
            if (!this.isOnline) {
                this.pendingOperations.push({
                    type: 'saveBillingEntry',
                    data: entry,
                    timestamp: Date.now()
                });
                console.log('📱 Operação adicionada à fila offline');
                return { success: true, id: 'offline_' + Date.now() };
            }
            
            return { success: false, error: error.message };
        }
    }

    async updateBillingEntry(id, updates) {
        await this.ensureInitialized();
        
        const operation = async (data) => {
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            const updateData = {
                ...data,
                updatedBy: this.auth.currentUser.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('billingEntries').doc(id).update(updateData);
            console.log('✏️ Entrada atualizada:', id);
            return { success: true };
        };
        
        try {
            return await this.executeWithRetry(operation, updates, 'updateBillingEntry');
        } catch (error) {
            console.error('❌ Erro ao atualizar entrada:', error);
            
            if (!this.isOnline) {
                this.pendingOperations.push({
                    type: 'updateBillingEntry',
                    id: id,
                    data: updates,
                    timestamp: Date.now()
                });
            }
            
            return { success: false, error: error.message };
        }
    }

    async deleteBillingEntry(id) {
        await this.ensureInitialized();
        
        const operation = async () => {
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            await this.db.collection('billingEntries').doc(id).delete();
            console.log('🗑️ Entrada deletada:', id);
            return { success: true };
        };
        
        try {
            return await this.executeWithRetry(operation, null, 'deleteBillingEntry');
        } catch (error) {
            console.error('❌ Erro ao deletar entrada:', error);
            
            if (!this.isOnline) {
                this.pendingOperations.push({
                    type: 'deleteBillingEntry',
                    id: id,
                    timestamp: Date.now()
                });
            }
            
            return { success: false, error: error.message };
        }
    }

    async getBillingEntries(segment = null, store = null) {
        await this.ensureInitialized();
        
        try {
            let query = this.db.collection('billingEntries');
            
            if (segment) {
                query = query.where('segment', '==', segment);
            }
            
            if (store) {
                query = query.where('store', '==', store);
            }
            
            const snapshot = await query.orderBy('createdAt', 'desc').get();
            
            const entries = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                entries.push({
                    id: doc.id,
                    ...data,
                    // Converter timestamps para strings
                    createdAt: this.convertTimestamp(data.createdAt),
                    updatedAt: this.convertTimestamp(data.updatedAt)
                });
            });
            
            console.log(`📊 ${entries.length} entradas carregadas`);
            return entries;
            
        } catch (error) {
            console.error('❌ Erro ao carregar entradas:', error);
            
            // Tentar cache em caso de erro
            try {
                const query = this.db.collection('billingEntries');
                const snapshot = await query.get({ source: 'cache' });
                
                const entries = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    entries.push({
                        id: doc.id,
                        ...data,
                        createdAt: this.convertTimestamp(data.createdAt),
                        updatedAt: this.convertTimestamp(data.updatedAt)
                    });
                });
                
                console.log(`💾 ${entries.length} entradas carregadas do cache`);
                return entries;
            } catch (cacheError) {
                console.error('❌ Erro ao carregar do cache:', cacheError);
                return [];
            }
        }
    }

    // MONTHLY GOALS
    async saveMonthlyGoal(goalKey, amount) {
        await this.ensureInitialized();
        
        const operation = async (data) => {
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            const goalData = {
                key: data.goalKey,
                amount: data.amount,
                createdBy: this.auth.currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('monthlyGoals').doc(data.goalKey).set(goalData, { merge: true });
            console.log('🎯 Meta salva:', data.goalKey);
            return { success: true };
        };
        
        try {
            return await this.executeWithRetry(operation, { goalKey, amount }, 'saveMonthlyGoal');
        } catch (error) {
            console.error('❌ Erro ao salvar meta:', error);
            
            if (!this.isOnline) {
                this.pendingOperations.push({
                    type: 'saveMonthlyGoal',
                    key: goalKey,
                    amount: amount,
                    timestamp: Date.now()
                });
            }
            
            return { success: false, error: error.message };
        }
    }

    async deleteMonthlyGoal(goalKey) {
        await this.ensureInitialized();
        
        const operation = async () => {
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            await this.db.collection('monthlyGoals').doc(goalKey).delete();
            console.log('🗑️ Meta deletada:', goalKey);
            return { success: true };
        };
        
        try {
            return await this.executeWithRetry(operation, null, 'deleteMonthlyGoal');
        } catch (error) {
            console.error('❌ Erro ao deletar meta:', error);
            
            if (!this.isOnline) {
                this.pendingOperations.push({
                    type: 'deleteMonthlyGoal',
                    key: goalKey,
                    timestamp: Date.now()
                });
            }
            
            return { success: false, error: error.message };
        }
    }

    async getMonthlyGoals() {
        await this.ensureInitialized();
        
        try {
            const snapshot = await this.db.collection('monthlyGoals').get();
            
            const goals = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                goals[data.key] = data.amount;
            });
            
            console.log(`🎯 ${Object.keys(goals).length} metas carregadas`);
            return goals;
            
        } catch (error) {
            console.error('❌ Erro ao carregar metas:', error);
            return {};
        }
    }

    // REAL-TIME LISTENERS COM TRATAMENTO DE ERRO
    listenToBillingEntries(callback, segment = null) {
        if (!this.initialized) {
            console.warn('⚠️ Firebase Service não inicializado para listener');
            return null;
        }
        
        try {
            let query = this.db.collection('billingEntries');
            
            if (segment) {
                query = query.where('segment', '==', segment);
            }
            
            return query.orderBy('createdAt', 'desc').onSnapshot(
                snapshot => {
                    const entries = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        entries.push({
                            id: doc.id,
                            ...data,
                            createdAt: this.convertTimestamp(data.createdAt),
                            updatedAt: this.convertTimestamp(data.updatedAt)
                        });
                    });
                    
                    console.log('🔄 Dados atualizados em tempo real:', entries.length);
                    callback(entries);
                },
                error => {
                    console.error('❌ Erro no listener:', error);
                    // Callback com array vazio em caso de erro
                    callback([]);
                }
            );
            
        } catch (error) {
            console.error('❌ Erro ao configurar listener:', error);
            return null;
        }
    }

    listenToMonthlyGoals(callback) {
        if (!this.initialized) {
            console.warn('⚠️ Firebase Service não inicializado para listener de metas');
            return null;
        }
        
        try {
            return this.db.collection('monthlyGoals').onSnapshot(
                snapshot => {
                    const goals = {};
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        goals[data.key] = data.amount;
                    });
                    
                    console.log('🔄 Metas atualizadas em tempo real:', Object.keys(goals).length);
                    callback(goals);
                },
                error => {
                    console.error('❌ Erro no listener de metas:', error);
                    callback({});
                }
            );
            
        } catch (error) {
            console.error('❌ Erro ao configurar listener de metas:', error);
            return null;
        }
    }

    // UTILITIES
    convertTimestamp(timestamp) {
        if (!timestamp) return null;
        
        try {
            if (timestamp.toDate) {
                return timestamp.toDate().toISOString();
            } else if (timestamp instanceof Date) {
                return timestamp.toISOString();
            } else if (typeof timestamp === 'string') {
                return timestamp;
            } else {
                return new Date().toISOString();
            }
        } catch (error) {
            console.warn('⚠️ Erro ao converter timestamp:', error);
            return new Date().toISOString();
        }
    }

    // OPERAÇÕES OFFLINE
    async processPendingOperations() {
        if (this.pendingOperations.length === 0) return;
        
        console.log(`⏳ Processando ${this.pendingOperations.length} operações pendentes...`);
        
        const operations = [...this.pendingOperations];
        this.pendingOperations = [];
        
        for (const operation of operations) {
            try {
                switch (operation.type) {
                    case 'saveBillingEntry':
                        await this.saveBillingEntry(operation.data);
                        break;
                    case 'updateBillingEntry':
                        await this.updateBillingEntry(operation.id, operation.data);
                        break;
                    case 'deleteBillingEntry':
                        await this.deleteBillingEntry(operation.id);
                        break;
                    case 'saveMonthlyGoal':
                        await this.saveMonthlyGoal(operation.key, operation.amount);
                        break;
                    case 'deleteMonthlyGoal':
                        await this.deleteMonthlyGoal(operation.key);
                        break;
                }
                console.log('✅ Operação processada:', operation.type);
            } catch (error) {
                console.error('❌ Erro ao processar operação:', error);
                // Recolocar na fila se falhar
                this.pendingOperations.push(operation);
            }
        }
        
        console.log('🎉 Processamento de operações concluído');
    }

    // MIGRAÇÃO MELHORADA
    async migrateFromLocalStorage() {
        await this.ensureInitialized();
        
        // Verificar se usuário está logado
        if (!this.auth.currentUser) {
            console.log('⚠️ Migração adiada: usuário não logado');
            return;
        }
        
        try {
            console.log('🔄 Verificando dados do localStorage para migração...');
            
            const localBillingData = localStorage.getItem('ice_beer_billingData');
            const localGoalsData = localStorage.getItem('ice_beer_monthlyGoals');
            
            if (!localBillingData && !localGoalsData) {
                console.log('📭 Nenhum dado encontrado no localStorage');
                return;
            }
            
            let migratedEntries = 0;
            let migratedGoals = 0;
            
            // Migrar entradas de faturamento
            if (localBillingData) {
                const billingData = JSON.parse(localBillingData);
                console.log('📦 Migrando dados de faturamento...');
                
                // Migrar cada segmento
                for (const [segmentName, segmentData] of Object.entries(billingData)) {
                    if (segmentName === 'diskChopp' && Array.isArray(segmentData)) {
                        // DiskChopp é array
                        for (const entry of segmentData) {
                            try {
                                await this.saveBillingEntry({
                                    ...entry,
                                    segment: 'diskChopp',
                                    store: 'delivery'
                                });
                                migratedEntries++;
                            } catch (error) {
                                console.warn('⚠️ Erro ao migrar entrada diskChopp:', error);
                            }
                        }
                    } else if (typeof segmentData === 'object') {
                        // Outros segmentos são objetos com lojas
                        for (const [store, entries] of Object.entries(segmentData)) {
                            if (Array.isArray(entries)) {
                                for (const entry of entries) {
                                    try {
                                        await this.saveBillingEntry({
                                            ...entry,
                                            segment: segmentName,
                                            store: store
                                        });
                                        migratedEntries++;
                                    } catch (error) {
                                        console.warn(`⚠️ Erro ao migrar entrada ${segmentName}-${store}:`, error);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Migrar metas
            if (localGoalsData) {
                console.log('🎯 Migrando metas...');
                const goalsData = JSON.parse(localGoalsData);
                for (const [key, amount] of Object.entries(goalsData)) {
                    try {
                        await this.saveMonthlyGoal(key, amount);
                        migratedGoals++;
                    } catch (error) {
                        console.warn('⚠️ Erro ao migrar meta:', error);
                    }
                }
            }
            
            console.log(`🎉 Migração concluída: ${migratedEntries} entradas, ${migratedGoals} metas`);
            
            // Criar backup
            const backupData = {
                billingData: localBillingData ? JSON.parse(localBillingData) : null,
                monthlyGoals: localGoalsData ? JSON.parse(localGoalsData) : null,
                migratedAt: new Date().toISOString(),
                migratedBy: this.auth.currentUser.email
            };
            
            localStorage.setItem('ice_beer_migration_backup', JSON.stringify(backupData));
            console.log('💾 Backup do localStorage criado');
            
        } catch (error) {
            console.error('❌ Erro na migração:', error);
        }
    }

    // EXPORTAÇÃO E ESTATÍSTICAS
    async exportAllData() {
        await this.ensureInitialized();
        
        try {
            console.log('📤 Iniciando exportação...');
            
            const [billingEntries, monthlyGoals] = await Promise.all([
                this.getBillingEntries(),
                this.getMonthlyGoals()
            ]);
            
            const exportData = {
                version: '2.0.0',
                exportedAt: new Date().toISOString(),
                exportedBy: this.auth.currentUser?.email || 'unknown',
                source: 'firebase',
                data: {
                    billingEntries,
                    monthlyGoals
                }
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `ice-beer-firebase-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ Exportação concluída');
            return true;
        } catch (error) {
            console.error('❌ Erro na exportação:', error);
            return false;
        }
    }

    async getStats() {
        await this.ensureInitialized();
        
        try {
            const [billingSnapshot, goalsSnapshot] = await Promise.all([
                this.db.collection('billingEntries').get(),
                this.db.collection('monthlyGoals').get()
            ]);
            
            return {
                totalEntries: billingSnapshot.size,
                totalGoals: goalsSnapshot.size,
                isOnline: this.isOnline,
                pendingOperations: this.pendingOperations.length,
                initialized: this.initialized,
                currentUser: this.auth.currentUser?.email || null
            };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            return {
                totalEntries: 0,
                totalGoals: 0,
                isOnline: this.isOnline,
                pendingOperations: this.pendingOperations.length,
                initialized: this.initialized,
                currentUser: this.auth.currentUser?.email || null
            };
        }
    }
}

// Inicializar serviço quando Firebase estiver pronto
(function() {
    if (typeof window !== 'undefined') {
        // Aguardar evento firebaseReady
        if (window.firebaseReady) {
            // Firebase já está pronto
            if (!window.firebaseService) {
                console.log('🚀 Criando FirebaseService...');
                window.firebaseService = new FirebaseService();
            }
        } else {
            // Aguardar evento
            document.addEventListener('firebaseReady', () => {
                if (!window.firebaseService) {
                    console.log('🚀 Criando FirebaseService após evento firebaseReady...');
                    window.firebaseService = new FirebaseService();
                }
            });
        }
    }
})();