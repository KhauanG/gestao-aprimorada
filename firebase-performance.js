// Firebase Test Script - Ice Beer Management
// Execute este script no console do navegador para testar a integração

class FirebaseTestSuite {
    constructor() {
        this.results = [];
        this.firebase = window.firebaseService;
        this.db = window.firebaseDb;
        this.auth = window.firebaseAuth;
    }

    async runAllTests() {
        console.log('🧪 Iniciando testes do Firebase...');
        
        const tests = [
            'testFirebaseConnection',
            'testAuthentication', 
            'testFirestoreWrite',
            'testFirestoreRead',
            'testRealTimeListener',
            'testOfflineCapability',
            'testSecurityRules',
            'testDataMigration'
        ];

        for (const test of tests) {
            try {
                console.log(`\n🔬 Executando: ${test}`);
                await this[test]();
                this.logResult(test, 'PASSOU', 'green');
            } catch (error) {
                this.logResult(test, `FALHOU: ${error.message}`, 'red');
                console.error(`❌ ${test}:`, error);
            }
        }

        this.showResults();
    }

    logResult(test, result, color) {
        this.results.push({ test, result, color });
        console.log(`%c${test}: ${result}`, `color: ${color}; font-weight: bold;`);
    }

    showResults() {
        console.log('\n📊 RESULTADOS DOS TESTES:');
        console.table(this.results);
        
        const passed = this.results.filter(r => r.result === 'PASSOU').length;
        const total = this.results.length;
        
        console.log(`\n🎯 RESUMO: ${passed}/${total} testes passaram`);
        
        if (passed === total) {
            console.log('🎉 TODOS OS TESTES PASSARAM! Firebase está funcionando perfeitamente.');
        } else {
            console.log('⚠️ Alguns testes falharam. Verifique a configuração.');
        }
    }

    // TESTE 1: Conexão Firebase
    async testFirebaseConnection() {
        if (!window.firebaseApp) {
            throw new Error('Firebase App não inicializado');
        }
        
        if (!window.firebaseDb) {
            throw new Error('Firestore não inicializado');
        }
        
        if (!window.firebaseAuth) {
            throw new Error('Firebase Auth não inicializado');
        }
        
        if (!window.firebaseService) {
            throw new Error('Firebase Service não inicializado');
        }
        
        console.log('✅ Todos os serviços Firebase estão conectados');
    }

    // TESTE 2: Autenticação
    async testAuthentication() {
        // Teste de criação/login de usuário
        const testEmail = 'test@icebeer.local';
        const testPassword = 'test123';
        
        try {
            // Tentar fazer login
            await this.auth.signInWithEmailAndPassword(testEmail, testPassword);
            console.log('✅ Login bem-sucedido');
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                // Criar usuário de teste
                await this.auth.createUserWithEmailAndPassword(testEmail, testPassword);
                console.log('✅ Usuário de teste criado e logado');
            } else {
                throw error;
            }
        }
        
        // Verificar se está logado
        const user = this.auth.currentUser;
        if (!user) {
            throw new Error('Usuário não está logado após autenticação');
        }
        
        console.log('✅ Usuário autenticado:', user.email);
    }

    // TESTE 3: Escrita no Firestore
    async testFirestoreWrite() {
        const testEntry = {
            startDate: '2025-01-01',
            endDate: '2025-01-07', 
            amount: 1500.50,
            segment: 'conveniences',
            store: 'loja1',
            description: 'Teste de integração Firebase',
            createdAt: new Date().toISOString()
        };

        const docRef = await this.db.collection('billingEntries').add(testEntry);
        
        if (!docRef.id) {
            throw new Error('Documento não foi criado');
        }
        
        console.log('✅ Documento criado com ID:', docRef.id);
        
        // Limpar teste
        await docRef.delete();
        console.log('✅ Documento de teste removido');
    }

    // TESTE 4: Leitura do Firestore
    async testFirestoreRead() {
        // Primeiro criar um documento para ler
        const testDoc = await this.db.collection('billingEntries').add({
            startDate: '2025-01-01',
            endDate: '2025-01-07',
            amount: 999.99,
            segment: 'petiscarias', 
            store: 'loja1',
            description: 'Teste de leitura',
            createdAt: new Date().toISOString()
        });

        // Ler o documento
        const doc = await testDoc.get();
        
        if (!doc.exists) {
            throw new Error('Documento não encontrado');
        }
        
        const data = doc.data();
        if (data.amount !== 999.99) {
            throw new Error('Dados não correspondem ao esperado');
        }
        
        console.log('✅ Leitura de documento bem-sucedida');
        
        // Limpar
        await testDoc.delete();
    }

    // TESTE 5: Listener em Tempo Real
    async testRealTimeListener() {
        return new Promise((resolve, reject) => {
            let listenerTriggered = false;
            
            // Configurar listener
            const unsubscribe = this.db.collection('billingEntries')
                .limit(1)
                .onSnapshot((snapshot) => {
                    listenerTriggered = true;
                    console.log('✅ Listener em tempo real funcionando');
                    unsubscribe();
                    resolve();
                }, (error) => {
                    unsubscribe();
                    reject(error);
                });
            
            // Timeout de segurança
            setTimeout(() => {
                if (!listenerTriggered) {
                    unsubscribe();
                    reject(new Error('Listener não foi acionado em 5 segundos'));
                }
            }, 5000);
        });
    }

    // TESTE 6: Capacidade Offline
    async testOfflineCapability() {
        // Verificar se persistência está habilitada
        try {
            await this.db.enablePersistence({ synchronizeTabs: true });
            console.log('✅ Persistência offline habilitada');
        } catch (error) {
            if (error.code === 'failed-precondition') {
                console.log('✅ Persistência já estava habilitada');
            } else {
                throw error;
            }
        }
        
        // Verificar cache local
        const cachedQuery = this.db.collection('billingEntries').limit(1);
        const snapshot = await cachedQuery.get({ source: 'cache' });
        
        console.log('✅ Cache offline acessível');
    }

    // TESTE 7: Regras de Segurança
    async testSecurityRules() {
        // Tentar acessar dados sem autenticação adequada
        await this.auth.signOut();
        
        try {
            await this.db.collection('billingEntries').get();
            throw new Error('Acesso permitido sem autenticação (FALHA DE SEGURANÇA)');
        } catch (error) {
            if (error.code === 'permission-denied') {
                console.log('✅ Regras de segurança estão funcionando');
            } else {
                throw error;
            }
        }
        
        // Fazer login novamente
        await this.auth.signInWithEmailAndPassword('test@icebeer.local', 'test123');
    }

    // TESTE 8: Migração de Dados
    async testDataMigration() {
        // Simular dados no localStorage
        const mockLocalData = {
            conveniences: {
                loja1: [{
                    id: 'test123',
                    startDate: '2025-01-01',
                    endDate: '2025-01-07',
                    amount: 1000,
                    description: 'Teste migração'
                }]
            }
        };
        
        localStorage.setItem('ice_beer_billingData', JSON.stringify(mockLocalData));
        
        // Testar migração
        await this.firebase.migrateFromLocalStorage();
        
        // Verificar se dados foram migrados
        const migratedData = await this.db.collection('billingEntries')
            .where('description', '==', 'Teste migração')
            .get();
        
        if (migratedData.empty) {
            throw new Error('Dados não foram migrados corretamente');
        }
        
        console.log('✅ Migração de dados funcionando');
        
        // Limpar dados de teste
        migratedData.forEach(async (doc) => {
            await doc.ref.delete();
        });
        
        localStorage.removeItem('ice_beer_billingData');
    }

    // TESTES ESPECÍFICOS ADICIONAIS
    async testFirebaseService() {
        console.log('\n🔧 Testando Firebase Service...');
        
        // Testar salvamento via service
        const result = await this.firebase.saveBillingEntry({
            startDate: '2025-01-01',
            endDate: '2025-01-07',
            amount: 750.25,
            segment: 'diskChopp',
            store: 'delivery',
            description: 'Teste service'
        });
        
        if (!result.success) {
            throw new Error('Falha ao salvar via Firebase Service');
        }
        
        console.log('✅ Firebase Service funcionando');
        
        // Limpar
        await this.db.collection('billingEntries').doc(result.id).delete();
    }

    async testPerformance() {
        console.log('\n⚡ Testando Performance...');
        
        const startTime = performance.now();
        
        // Teste de leitura em lote
        await this.db.collection('billingEntries').limit(10).get();
        
        const readTime = performance.now() - startTime;
        
        if (readTime > 2000) {
            console.warn('⚠️ Leitura lenta:', readTime + 'ms');
        } else {
            console.log('✅ Performance boa:', readTime.toFixed(2) + 'ms');
        }
    }
}

// FUNÇÕES DE TESTE RÁPIDO
window.testFirebase = {
    // Teste completo
    full: async () => {
        const suite = new FirebaseTestSuite();
        await suite.runAllTests();
        await suite.testFirebaseService();
        await suite.testPerformance();
    },
    
    // Teste básico
    basic: async () => {
        const suite = new FirebaseTestSuite();
        await suite.testFirebaseConnection();
        await suite.testAuthentication();
        await suite.testFirestoreWrite();
        await suite.testFirestoreRead();
        console.log('✅ Testes básicos concluídos');
    },
    
    // Teste de conexão
    connection: async () => {
        const suite = new FirebaseTestSuite();
        await suite.testFirebaseConnection();
        console.log('✅ Conexão Firebase OK');
    },
    
    // Limpar dados de teste
    cleanup: async () => {
        const db = window.firebaseDb;
        const testDocs = await db.collection('billingEntries')
            .where('description', 'in', ['Teste de integração Firebase', 'Teste de leitura', 'Teste service'])
            .get();
        
        const batch = db.batch();
        testDocs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('🧹 Dados de teste removidos');
    }
};

// COMANDOS PARA USAR NO CONSOLE:
console.log(`
🧪 COMANDOS DE TESTE DISPONÍVEIS:

// Teste completo (todos os aspectos)
testFirebase.full()

// Teste básico (funcionalidades principais)  
testFirebase.basic()

// Teste de conexão apenas
testFirebase.connection()

// Limpar dados de teste
testFirebase.cleanup()

Execute qualquer um desses comandos no console para testar!
`);

// Auto-executar teste básico se Firebase estiver pronto
if (window.firebaseService) {
    console.log('🚀 Firebase detectado! Execute testFirebase.basic() para testar.');
} else {
    console.log('⏳ Aguardando Firebase inicializar...');
}