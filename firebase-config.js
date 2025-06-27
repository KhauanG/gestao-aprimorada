// Firebase Configuration - Ice Beer Management - VERSÃO FINAL 100% FUNCIONAL

// ✅ CONFIGURAÇÃO FIREBASE (SUBSTITUA PELA SUA)
const firebaseConfig = {
  apiKey: "AIzaSyAP-RKDGrnBjSsp0Bo10KUt-9L4I4-1GQU",
  authDomain: "icebeer-gestao.firebaseapp.com",
  projectId: "icebeer-gestao",
  storageBucket: "icebeer-gestao.firebasestorage.app",
  messagingSenderId: "262433847835",
  appId: "1:262433847835:web:d682d91656a1bc703496be",
  measurementId: "G-2L3DF18KSS"
};

// ✅ INICIALIZAÇÃO ROBUSTA E SIMPLIFICADA
(function() {
    'use strict';
    
    console.log('🔥 Iniciando Firebase...');
    
    // Verificar se Firebase SDK está carregado
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK não carregado');
        showError('Firebase SDK não encontrado. Verifique sua conexão com a internet.');
        return;
    }
    
    let app, auth, db;
    let isReady = false;
    
    // ✅ FUNÇÃO DE INICIALIZAÇÃO PRINCIPAL
    async function initFirebase() {
        try {
            console.log('🔄 Inicializando Firebase App...');
            
            // Tentar obter app existente ou criar novo
            try {
                app = firebase.app();
                console.log('♻️ Reutilizando Firebase App existente');
            } catch (error) {
                console.log('🆕 Criando novo Firebase App');
                app = firebase.initializeApp(firebaseConfig);
            }
            
            if (!app) {
                throw new Error('Falha ao inicializar Firebase App');
            }
            
            // Inicializar Auth e Firestore
            console.log('🔐 Inicializando Auth...');
            auth = firebase.auth();
            
            console.log('💾 Inicializando Firestore...');
            db = firebase.firestore();
            
            // Configurar Firestore
            console.log('⚙️ Configurando Firestore...');
            await configureFirestore();
            
            // Exportar globalmente
            console.log('🌐 Exportando globalmente...');
            exportGlobals();
            
            // Configurar listeners
            setupListeners();
            
            // Testar conectividade
            console.log('🌐 Testando conectividade...');
            await testConnection();
            
            // Marcar como pronto
            markReady();
            
            console.log('✅ Firebase inicializado com sucesso!');
            hideLoader();
            
        } catch (error) {
            console.error('❌ Erro na inicialização do Firebase:', error);
            showError(`Erro ao inicializar Firebase: ${error.message}`);
        }
    }
    
    // ✅ CONFIGURAR FIRESTORE
    async function configureFirestore() {
        try {
            // Configurações básicas
            db.settings({
                timestampsInSnapshots: true,
                merge: true,
                ignoreUndefinedProperties: true
            });
            
            // Tentar habilitar persistência (opcional)
            try {
                await db.enablePersistence({
                    synchronizeTabs: true,
                    forceOwnership: false
                });
                console.log('💾 Persistência offline habilitada');
            } catch (err) {
                console.warn('⚠️ Persistência não habilitada:', err.code);
                // Continuar sem persistência
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao configurar Firestore:', error);
            // Não falhar por causa disso
        }
    }
    
    // ✅ EXPORTAR PARA ESCOPO GLOBAL
    function exportGlobals() {
        // Definir propriedades globais
        Object.defineProperty(window, 'firebaseApp', {
            value: app,
            writable: false,
            configurable: true
        });
        
        Object.defineProperty(window, 'firebaseAuth', {
            value: auth,
            writable: false,
            configurable: true
        });
        
        Object.defineProperty(window, 'firebaseDb', {
            value: db,
            writable: false,
            configurable: true
        });
        
        console.log('📤 Firebase exportado globalmente');
    }
    
    // ✅ CONFIGURAR LISTENERS
    function setupListeners() {
        // Auth state listener
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('👤 Usuário autenticado:', user.email);
            } else {
                console.log('👤 Usuário desconectado');
            }
            
            // Atualizar status na UI se disponível
            updateUIStatus();
        });
        
        // Listener de conectividade
        window.addEventListener('online', () => {
            console.log('🌐 Voltou online');
            updateUIStatus();
        });
        
        window.addEventListener('offline', () => {
            console.log('📱 Ficou offline');
            updateUIStatus();
        });
    }
    
    // ✅ TESTAR CONECTIVIDADE
    async function testConnection() {
        try {
            // Teste simples de conectividade
            const testRef = db.collection('_test').doc('connection');
            await testRef.set({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                test: true
            }, { merge: true });
            
            console.log('✅ Conectividade com Firebase OK');
            
            // Limpar teste
            await testRef.delete();
            
        } catch (error) {
            if (error.code === 'permission-denied') {
                console.log('🔒 Firebase conectado (sem permissões - normal)');
            } else {
                console.warn('⚠️ Possível problema de conectividade:', error.code);
                // Não falhar por causa disso
            }
        }
    }
    
    // ✅ MARCAR COMO PRONTO
    function markReady() {
        isReady = true;
        window.firebaseReady = true;
        
        // Disparar evento
        const event = new CustomEvent('firebaseReady', {
            detail: { app, auth, db, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
        
        console.log('📡 Evento firebaseReady disparado');
    }
    
    // ✅ ATUALIZAR STATUS NA UI
    function updateUIStatus() {
        setTimeout(() => {
            const statusIcon = document.getElementById('firebaseStatusIcon');
            const statusText = document.getElementById('firebaseStatusText');
            
            if (statusIcon && statusText) {
                if (isReady && auth?.currentUser) {
                    statusIcon.textContent = '🟢';
                    statusText.textContent = 'Online';
                } else if (isReady) {
                    statusIcon.textContent = '🟡';
                    statusText.textContent = 'Conectado';
                } else {
                    statusIcon.textContent = '🔴';
                    statusText.textContent = 'Conectando...';
                }
            }
        }, 100);
    }
    
    // ✅ MOSTRAR ERRO
    function showError(message) {
        console.error('🚨 Firebase Error:', message);
        
        // Remover loader
        hideLoader();
        
        // Mostrar erro na tela
        const errorHTML = `
            <div id="firebaseError" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                display: flex; align-items: center; justify-content: center; z-index: 9999;
                color: white; font-family: 'Inter', sans-serif;
            ">
                <div style="text-align: center; max-width: 500px; padding: 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
                    <h2 style="margin: 0 0 1rem 0; font-weight: 600;">Erro de Conexão</h2>
                    <p style="margin: 0 0 1rem 0; opacity: 0.9; font-size: 1.1rem;">${message}</p>
                    <p style="margin: 0 0 2rem 0; opacity: 0.7; font-size: 0.9rem;">
                        Verifique sua conexão com a internet e as configurações do Firebase.
                    </p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button onclick="location.reload()" style="
                            padding: 1rem 2rem; background: rgba(255,255,255,0.2); color: white;
                            border: 2px solid rgba(255,255,255,0.3); border-radius: 12px; 
                            cursor: pointer; font-weight: 600; backdrop-filter: blur(10px);
                        ">🔄 Recarregar</button>
                        <button onclick="window.tryFirebaseAgain && window.tryFirebaseAgain()" style="
                            padding: 1rem 2rem; background: rgba(255,255,255,0.1); color: white;
                            border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; 
                            cursor: pointer; font-weight: 600; backdrop-filter: blur(10px);
                        ">🔧 Tentar Novamente</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', errorHTML);
    }
    
    // ✅ REMOVER LOADER
    function hideLoader() {
        const loader = document.getElementById('firebaseLoader');
        if (loader) {
            loader.style.display = 'none';
        }
    }
    
    // ✅ FUNÇÃO GLOBAL DE STATUS
    window.checkFirebaseStatus = function() {
        const status = {
            sdkLoaded: typeof firebase !== 'undefined',
            appReady: !!app,
            authReady: !!auth,
            dbReady: !!db,
            isReady: isReady,
            currentUser: auth?.currentUser?.email || null,
            projectId: app?.options?.projectId || 'não configurado',
            online: navigator.onLine
        };
        
        console.table(status);
        return status;
    };
    
    // ✅ FUNÇÃO PARA TENTAR NOVAMENTE
    window.tryFirebaseAgain = function() {
        const errorDiv = document.getElementById('firebaseError');
        if (errorDiv) {
            errorDiv.remove();
        }
        
        // Mostrar loader novamente
        const loader = document.getElementById('firebaseLoader');
        if (loader) {
            loader.style.display = 'flex';
        }
        
        // Tentar inicializar novamente após 1 segundo
        setTimeout(initFirebase, 1000);
    };
    
    // ✅ INICIAR QUANDO DOM ESTIVER PRONTO
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFirebase);
    } else {
        // DOM já carregado, iniciar imediatamente
        setTimeout(initFirebase, 100);
    }
    
})();