// Firebase Service - Ice Beer Management - VERSÃO FINAL 100% FUNCIONAL

class FirebaseService {
    constructor() {
        this.initialized = false;
        this.initPromise = null;
        this.isOnline = navigator.onLine;
        this.pendingOperations = [];
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        
        // ✅ Credenciais corretas
        this.validCredentials = {
            'conv@icebeer.local': 'conv123',
            'peti@icebeer.local': 'peti123',
            'disk@icebeer.local': 'disk123',
            'dono@icebeer.local': 'dono123'
        };
        
        console.log('🔥 FirebaseService: Criado, aguardando inicialização...');
    }

    // ✅ INICIALIZAÇÃO ROBUSTA
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }
        
        this.initPromise = this.waitForFirebaseAndInit();
        return this.initPromise;
    }

    async waitForFirebaseAndInit() {
        console.log('⏳ FirebaseService: Aguardando Firebase estar pronto...');
        
        // ✅ Aguardar Firebase com método mais robusto
        let attempts = 0;
        const maxAttempts = 200; // 20 segundos
        
        while (attempts < maxAttempts) {
            // Verificar múltiplas condições
            const hasFirebase = typeof firebase !== 'undefined';
            const hasApp = !!window.firebaseApp;
            const hasAuth = !!window.firebaseAuth;
            const hasDb = !!window.firebaseDb;
            const isReady = !!window.firebaseReady;
            
            if (hasFirebase && hasApp && hasAuth && hasDb) {
                console.log('✅ Firebase detectado como pronto');
                break;
            }
            
            // Log periódico para debug
            if (attempts % 20 === 0) {
                console.log(`⏳ Tentativa ${attempts}/${maxAttempts} - Firebase: ${hasFirebase}, App: ${hasApp}, Auth: ${hasAuth}, DB: ${hasDb}, Ready: ${isReady}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // ✅ Verificação final
        if (!window.firebaseAuth || !window.firebaseDb) {
            const error = new Error('Firebase não inicializou completamente');
            console.error('❌', error.message);
            throw error;
        }
        
        // Conectar aos serviços
        this.auth = window.firebaseAuth;
        this.db = window.firebaseDb;
        
        console.log('🔗 FirebaseService: Conectado aos serviços');
        
        // Configurar listeners
        this.setupConnectivityListeners();
        
        // Marcar como inicializado
        this.initialized = true;
        
        console.log('✅ FirebaseService: Totalmente inicializado');
        return true;
    }

    setupConnectivityListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Reconectado');
            this.processPendingOperations();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📱 Offline');
        });
    }

    // ✅ GARANTIR INICIALIZAÇÃO
    async ensureInitialized() {
        if (!this.initialized) {
            console.log('🔄 Garantindo inicialização...');
            await this.initialize();
        }
        return true;
    }

    // ✅ AUTENTICAÇÃO ULTRA ROBUSTA
    async authenticateUser(emailOrUsername, password) {
        await this.ensureInitialized();
        
        try {
            let email = emailOrUsername;
            
            // Converter username para email se necessário
            if (!emailOrUsername.includes('@')) {
                email = `${emailOrUsername}@icebeer.local`;
            }
            
            console.log('🔑 Autenticando:', email);
            
            // ✅ Verificar credenciais válidas PRIMEIRO
            if (!this.validCredentials[email]) {
                console.error('❌ Email não reconhecido:', email);
                return false;
            }
            
            if (this.validCredentials[email] !== password) {
                console.error('❌ Senha incorreta para:', email);
                return false;
            }
            
            // ✅ Tentar autenticar no Firebase
            try {
                console.log('🔐 Tentando login Firebase...');
                const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
                console.log('✅ Login Firebase bem-sucedido:', userCredential.user.email);
                return true;
                
            } catch (authError) {
                console.log('⚠️ Erro de auth:', authError.code);
                
                // Se usuário não existe, criar
                if (authError.code === 'auth/user-not-found') {
                    console.log('👤 Criando usuário...');
                    try {
                        const newUserCredential = await this.auth.createUserWithEmailAndPassword(email, password);
                        console.log('✅ Usuário criado:', newUserCredential.user.email);
                        return true;
                    } catch (createError) {
                        console.error('❌ Erro ao criar usuário:', createError.code);
                        return false;
                    }
                    
                } else if (authError.code === 'auth/wrong-password') {
                    console.error('❌ Senha incorreta');
                    return false;
                    
                } else if (authError.code === 'auth/invalid-email') {
                    console.error('❌ Email inválido');
                    return false;
                    
                } else if (authError.code === 'auth/network-request-failed') {
                    console.error('❌ Erro de rede');
                    return false;
                    
                } else {
                    console.error('❌ Erro de autenticação:', authError.code, authError.message);
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
            console.log('🚪 Logout realizado');
            return true;
        } catch (error) {
            console.error('❌ Erro no logout:', error);
            return false;
        }
    }

    // ✅ OPERAÇÕES COM RETRY ROBUSTO
    async executeWithRetry(operation, data, operationType) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`🔄 Tentativa ${attempt}/${this.retryAttempts} para ${operationType}`);
                }
                
                const result = await operation(data);
                return result;
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Tentativa ${attempt} falhou:`, error.code || error.message);
                
                // Não fazer retry para erros de permissão
                if (error.code === 'permission-denied' && !this.auth.currentUser) {
                    throw new Error('Usuário não autenticado. Faça login primeiro.');
                }
                
                // Se é último attempt, lançar erro
                if (attempt === this.retryAttempts) {
                    throw lastError;
                }
                
                // Aguardar antes de retry
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }
        
        throw lastError;
    }

    // ✅ SALVAR ENTRADA DE FATURAMENTO
    async saveBillingEntry(entry) {
        await this.ensureInitialized();
        
        const operation = async (entryData) => {
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            const entryWithMetadata = {
                ...entryData,
                id: entryData.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                createdBy: this.auth.currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            console.log('💾 Salvando entrada:', entryWithMetadata);
            
            const docRef = await this.db.collection('billingEntries').add(entryWithMetadata);
            
            console.log('✅ Entrada salva:', docRef.id);
            return { success: true, id: docRef.id };
        };
        
        try {
            return await this.executeWithRetry(operation, entry, 'saveBillingEntry');
        } catch (error) {
            console.error('❌ Erro ao salvar entrada:', error.message);
            
            // Se offline, adicionar à fila
            if (!this.isOnline) {
                this.pendingOperations.push({
                    type: 'saveBillingEntry',
                    data: entry,
                    timestamp: Date.now()
                });
                console.log('📱 Operação offline adicionada à fila');
                return { success: true, id: 'offline_' + Date.now() };
            }
            
            return { success: false, error: error.message };
        }
    }

    // ✅ ATUALIZAR ENTRADA
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
            console.error('❌ Erro ao atualizar:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ✅ EXCLUIR ENTRADA
    async deleteBillingEntry(id) {
        await this.ensureInitialized();
        
        const operation = async () => {
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            await this.db.collection('billingEntries').doc(id).delete();
            console.log('🗑️ Entrada excluída:', id);
            return { success: true };
        };
        
        try {
            return await this.executeWithRetry(operation, null, 'deleteBillingEntry');
        } catch (error) {
            console.error('❌ Erro ao excluir:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ✅ BUSCAR ENTRADAS
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
                    createdAt: this.convertTimestamp(data.createdAt),
                    updatedAt: this.convertTimestamp(data.updatedAt)
                });
            });
            
            console.log(`📊 ${entries.length} entradas carregadas`);
            return entries;
            
        } catch (error) {
            console.error('❌ Erro ao carregar entradas:', error);
            return [];
        }
    }

    // ✅ SALVAR META
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
            console.error('❌ Erro ao salvar meta:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ✅ EXCLUIR META
    async deleteMonthlyGoal(goalKey) {
        await this.ensureInitialized();
        
        const operation = async () => {
            if (!this.auth.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            await this.db.collection('monthlyGoals').doc(goalKey).delete();
            console.log('🗑️ Meta excluída:', goalKey);
            return { success: true };
        };
        
        try {
            return await this.executeWithRetry(operation, null, 'deleteMonthlyGoal');
        } catch (error) {
            console.error('❌ Erro ao excluir meta:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ✅ BUSCAR METAS
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

    // ✅ LISTENERS EM TEMPO REAL
    listenToBillingEntries(callback, segment = null) {
        if (!this.initialized) {
            console.warn('⚠️ Service não inicializado para listener');
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
                    
                    console.log('🔄 Dados atualizados:', entries.length);
                    callback(entries);
                },
                error => {
                    console.error('❌ Erro no listener:', error);
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
            console.warn('⚠️ Service não inicializado para listener de metas');
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
                    
                    console.log('🔄 Metas atualizadas:', Object.keys(goals).length);
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

    // ✅ UTILITÁRIOS
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

    // ✅ PROCESSAR OPERAÇÕES PENDENTES
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
                this.pendingOperations.push(operation);
            }
        }
        
        console.log('🎉 Processamento concluído');
    }

    // ✅ ESTATÍSTICAS
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
            console.error('❌ Erro ao obter stats:', error);
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

    // ✅ EXPORTAR DADOS
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
                data: { billingEntries, monthlyGoals }
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `ice-beer-export-${new Date().toISOString().split('T')[0]}.json`;
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
}

// ✅ INICIALIZAÇÃO AUTOMÁTICA ROBUSTA
(function() {
    if (typeof window !== 'undefined') {
        console.log('🚀 Preparando FirebaseService...');
        
        let serviceCreated = false;
        
        const createService = () => {
            if (!serviceCreated && !window.firebaseService) {
                console.log('🔥 Criando FirebaseService...');
                try {
                    window.firebaseService = new FirebaseService();
                    serviceCreated = true;
                    console.log('✅ FirebaseService criado');
                } catch (error) {
                    console.error('❌ Erro ao criar FirebaseService:', error);
                }
            }
        };
        
        // Múltiplas estratégias de inicialização
        
        // 1. Se Firebase já está pronto
        if (window.firebaseReady) {
            createService();
        }
        
        // 2. Aguardar evento firebaseReady
        document.addEventListener('firebaseReady', () => {
            console.log('📡 Evento firebaseReady recebido');
            createService();
        });
        
        // 3. Verificação periódica
        const checkInterval = setInterval(() => {
            if (window.firebaseAuth && window.firebaseDb && !serviceCreated) {
                console.log('⏰ Verificação periódica detectou Firebase pronto');
                createService();
                clearInterval(checkInterval);
            }
        }, 500);
        
        // 4. Timeout de segurança (10 segundos)
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!serviceCreated && window.firebaseAuth && window.firebaseDb) {
                console.log('⏰ Timeout - criando service mesmo assim');
                createService();
            }
        }, 10000);
    }
})();