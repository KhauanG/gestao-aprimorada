// Firebase Configuration - Ice Beer Management - VERSÃO FINAL CORRIGIDA
// SUBSTITUA PELOS SEUS DADOS DO FIREBASE CONSOLE

const firebaseConfig = {
  apiKey: "AIzaSyAP-RKDGrnBjSsp0Bo10KUt-9L4I4-1GQU",
  authDomain: "icebeer-gestao.firebaseapp.com",
  projectId: "icebeer-gestao",
  storageBucket: "icebeer-gestao.firebasestorage.app",
  messagingSenderId: "262433847835",
  appId: "1:262433847835:web:d682d91656a1bc703496be",
  measurementId: "G-2L3DF18KSS"
};

// CORREÇÃO PRINCIPAL: Verificar se Firebase já foi inicializado
(function() {
    'use strict';
    
    console.log('🔥 Firebase Config: Iniciando configuração...');
    
    // Verificar se Firebase SDK está disponível
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK não carregado. Verifique os scripts.');
        return;
    }
    
    let firebaseApp, firebaseAuth, firebaseDb;
    
    try {
        // SOLUÇÃO: Tentar pegar app existente primeiro
        try {
            firebaseApp = firebase.app();
            console.log('🔄 Firebase: Reutilizando app existente');
        } catch (error) {
            // Se não existe, criar novo
            console.log('🆕 Firebase: Criando nova instância');
            firebaseApp = firebase.initializeApp(firebaseConfig);
        }
        
        // Inicializar serviços
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        
        console.log('✅ Firebase: Serviços inicializados');
        
    } catch (error) {
        console.error('❌ Firebase: Erro na inicialização:', error);
        return;
    }
    
    // Configurar Firestore com tratamento de erro
    let firestoreConfigured = false;
    
    async function configureFirestore() {
        if (firestoreConfigured) return;
        
        try {
            console.log('⚙️ Firebase: Configurando Firestore...');
            
            // Configurações básicas (antes de enablePersistence)
            firebaseDb.settings({
                timestampsInSnapshots: true,
                merge: true,
                ignoreUndefinedProperties: true
            });
            
            // Tentar habilitar persistência
            await firebaseDb.enablePersistence({
                synchronizeTabs: true,
                forceOwnership: false
            });
            
            console.log('✅ Firebase: Persistência offline habilitada');
            
        } catch (err) {
            console.warn('⚠️ Firebase: Persistência não habilitada:', err.code);
            
            if (err.code === 'failed-precondition') {
                console.log('💡 Firebase: Múltiplas abas abertas');
            } else if (err.code === 'unimplemented') {
                console.log('💡 Firebase: Navegador não suporta persistência');
            }
        } finally {
            firestoreConfigured = true;
        }
    }
    
    // Configurar Firestore
    configureFirestore();
    
    // Exportar para uso global (SEM CONFLITO)
    if (typeof window !== 'undefined') {
        // CORREÇÃO: Usar Object.defineProperty para evitar redeclaração
        if (!window.firebaseApp) {
            Object.defineProperty(window, 'firebaseApp', {
                value: firebaseApp,
                writable: false,
                configurable: false
            });
            console.log('📱 Firebase: App exportado globalmente');
        }
        
        if (!window.firebaseAuth) {
            Object.defineProperty(window, 'firebaseAuth', {
                value: firebaseAuth,
                writable: false,
                configurable: false
            });
            console.log('🔐 Firebase: Auth exportado globalmente');
        }
        
        if (!window.firebaseDb) {
            Object.defineProperty(window, 'firebaseDb', {
                value: firebaseDb,
                writable: false,
                configurable: false
            });
            console.log('💾 Firebase: Firestore exportado globalmente');
        }
    }
    
    // Listener de estado de autenticação
    firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            console.log('👤 Firebase: Usuário logado:', user.email);
        } else {
            console.log('👤 Firebase: Nenhum usuário logado');
        }
    });
    
    // Teste de conectividade com tratamento robusto
    async function testConnectivity() {
        try {
            console.log('🌐 Firebase: Testando conectividade...');
            
            // Tentar acessar servidor primeiro
            await firebaseDb.collection('_health').limit(1).get({ source: 'server' });
            console.log('✅ Firebase: Conectividade com servidor OK');
            
        } catch (error) {
            console.warn('⚠️ Firebase: Servidor não acessível:', error.code);
            
            if (error.code === 'permission-denied') {
                console.log('🔒 Firebase: Servidor OK, mas sem permissão (esperado sem login)');
            } else {
                // Tentar cache
                try {
                    await firebaseDb.collection('_health').limit(1).get({ source: 'cache' });
                    console.log('💾 Firebase: Cache funcionando');
                } catch (cacheError) {
                    console.warn('⚠️ Firebase: Cache não disponível');
                }
            }
        }
    }
    
    // Executar teste de conectividade
    setTimeout(testConnectivity, 1000);
    
    // Função de diagnóstico global
    window.checkFirebaseStatus = function() {
        console.log('🔍 === STATUS DO FIREBASE ===');
        
        const status = {
            sdkLoaded: typeof firebase !== 'undefined',
            appInitialized: !!window.firebaseApp,
            authReady: !!window.firebaseAuth,
            firestoreReady: !!window.firebaseDb,
            currentUser: window.firebaseAuth?.currentUser?.email || null,
            projectId: window.firebaseApp?.options?.projectId || 'não configurado'
        };
        
        console.table(status);
        
        // Verificar problemas comuns
        if (!status.sdkLoaded) {
            console.error('❌ Firebase SDK não carregado');
        }
        if (status.projectId === 'ice-beer-management') {
            console.log('✅ Projeto configurado corretamente');
        } else if (status.projectId === 'não configurado') {
            console.error('❌ Firebase não configurado');
        } else {
            console.warn('⚠️ ProjectId diferente:', status.projectId);
        }
        
        return status;
    };
    
    // Log de inicialização bem-sucedida
    console.log('🎉 Firebase: Configuração concluída com sucesso');
    
    // Marcar como pronto
    window.firebaseReady = true;
    
    // Disparar evento personalizado
    if (typeof window !== 'undefined' && window.document) {
        window.document.dispatchEvent(new CustomEvent('firebaseReady', {
            detail: { app: firebaseApp, auth: firebaseAuth, db: firebaseDb }
        }));
    }
    
})();