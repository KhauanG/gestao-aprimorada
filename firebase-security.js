// Firebase Security & Validation - Ice Beer Management
class FirebaseSecurityManager {
    constructor() {
        this.auth = window.firebaseAuth;
        this.db = window.firebaseDb;
        this.maxAttempts = 5;
        this.lockoutTime = 15 * 60 * 1000; // 15 minutos
        this.attemptLog = new Map();
        
        this.init();
    }

    init() {
        console.log('🔐 Inicializando Security Manager...');
        
        // Configurar validações
        this.setupValidations();
        
        // Monitorar tentativas de login
        this.setupLoginMonitoring();
        
        // Configurar sanitização de dados
        this.setupDataSanitization();
        
        // Rate limiting
        this.setupRateLimiting();
        
        console.log('✅ Security Manager ativo');
    }

    // VALIDAÇÕES DE ENTRADA
    setupValidations() {
        this.validators = {
            billingEntry: (data) => {
                const errors = [];
                
                // Validar datas
                if (!data.startDate || !this.isValidDate(data.startDate)) {
                    errors.push('Data de início inválida');
                }
                
                if (!data.endDate || !this.isValidDate(data.endDate)) {
                    errors.push('Data de fim inválida');
                }
                
                if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
                    errors.push('Data de início deve ser anterior à data de fim');
                }
                
                // Validar valor
                if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
                    errors.push('Valor deve ser um número positivo');
                }
                
                if (data.amount > 1000000) { // Limite de R$ 1 milhão
                    errors.push('Valor excede o limite máximo');
                }
                
                // Validar segmento
                const validSegments = ['conveniences', 'petiscarias', 'diskChopp'];
                if (!validSegments.includes(data.segment)) {
                    errors.push('Segmento inválido');
                }
                
                // Validar loja por segmento
                const validStores = {
                    conveniences: ['loja1', 'loja2', 'loja3'],
                    petiscarias: ['loja1', 'loja2'],
                    diskChopp: ['delivery']
                };
                
                if (!validStores[data.segment]?.includes(data.store)) {
                    errors.push('Loja inválida para este segmento');
                }
                
                // Validar descrição
                if (data.description && data.description.length > 200) {
                    errors.push('Descrição muito longa (máximo 200 caracteres)');
                }
                
                return errors;
            },
            
            monthlyGoal: (data) => {
                const errors = [];
                
                if (!data.key || typeof data.key !== 'string') {
                    errors.push('Chave da meta inválida');
                }
                
                if (!data.amount || typeof data.amount !== 'number' || data.amount < 0) {
                    errors.push('Valor da meta deve ser um número positivo');
                }
                
                if (data.amount > 10000000) { // Limite de R$ 10 milhões
                    errors.push('Meta excede o limite máximo');
                }
                
                return errors;
            }
        };
    }

    isValidDate(dateString) {
        const date = new Date(dateString);
        const minDate = new Date('2025-01-01');
        const maxDate = new Date('2030-12-31');
        
        return date instanceof Date && 
               !isNaN(date) && 
               date >= minDate && 
               date <= maxDate;
    }

    // MONITORAMENTO DE LOGIN
    setupLoginMonitoring() {
        this.loginMonitor = {
            recordAttempt: (email, success) => {
                const attempts = this.attemptLog.get(email) || [];
                attempts.push({
                    timestamp: Date.now(),
                    success,
                    ip: this.getClientIP()
                });
                
                // Manter apenas últimas 10 tentativas
                if (attempts.length > 10) {
                    attempts.shift();
                }
                
                this.attemptLog.set(email, attempts);
                
                if (!success) {
                    this.checkForSuspiciousActivity(email);
                }
            },
            
            isLocked: (email) => {
                const attempts = this.attemptLog.get(email) || [];
                const recentFailed = attempts.filter(a => 
                    !a.success && 
                    (Date.now() - a.timestamp) < this.lockoutTime
                );
                
                return recentFailed.length >= this.maxAttempts;
            },
            
            getRemainingLockout: (email) => {
                const attempts = this.attemptLog.get(email) || [];
                const lastFailed = attempts.filter(a => !a.success).pop();
                
                if (!lastFailed) return 0;
                
                const elapsed = Date.now() - lastFailed.timestamp;
                const remaining = this.lockoutTime - elapsed;
                
                return Math.max(0, remaining);
            }
        };
    }

    checkForSuspiciousActivity(email) {
        const attempts = this.attemptLog.get(email) || [];
        const recentAttempts = attempts.filter(a => 
            (Date.now() - a.timestamp) < 60000 // Últimos 60 segundos
        );
        
        if (recentAttempts.length > 3) {
            console.warn('🚨 Atividade suspeita detectada:', email);
            this.logSecurityEvent('suspicious_login_activity', { email, attempts: recentAttempts.length });
        }
    }

    getClientIP() {
        // Em produção, implementar detecção real de IP
        return 'unknown';
    }

    // SANITIZAÇÃO DE DADOS
    setupDataSanitization() {
        this.sanitizer = {
            sanitizeInput: (input) => {
                if (typeof input !== 'string') return input;
                
                // Remover scripts maliciosos
                let clean = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                
                // Remover caracteres especiais perigosos
                clean = clean.replace(/[<>\"']/g, '');
                
                // Limitar tamanho
                if (clean.length > 1000) {
                    clean = clean.substring(0, 1000);
                }
                
                return clean.trim();
            },
            
            sanitizeObject: (obj) => {
                const sanitized = {};
                
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'string') {
                        sanitized[key] = this.sanitizer.sanitizeInput(value);
                    } else if (typeof value === 'number') {
                        sanitized[key] = isNaN(value) ? 0 : value;
                    } else if (typeof value === 'boolean') {
                        sanitized[key] = Boolean(value);
                    } else {
                        sanitized[key] = value;
                    }
                }
                
                return sanitized;
            }
        };
    }

    // RATE LIMITING
    setupRateLimiting() {
        this.rateLimiter = {
            requests: new Map(),
            limits: {
                billing: { max: 10, window: 60000 }, // 10 lançamentos por minuto
                goals: { max: 5, window: 60000 },    // 5 metas por minuto
                auth: { max: 3, window: 300000 }     // 3 logins por 5 minutos
            },
            
            checkLimit: (action, identifier = 'global') => {
                const limit = this.rateLimiter.limits[action];
                if (!limit) return true;
                
                const key = `${action}_${identifier}`;
                const requests = this.rateLimiter.requests.get(key) || [];
                
                // Remover requests antigos
                const cutoff = Date.now() - limit.window;
                const validRequests = requests.filter(time => time > cutoff);
                
                if (validRequests.length >= limit.max) {
                    console.warn(`⚠️ Rate limit excedido para ${action}:`, identifier);
                    return false;
                }
                
                // Registrar nova request
                validRequests.push(Date.now());
                this.rateLimiter.requests.set(key, validRequests);
                
                return true;
            }
        };
    }

    // VALIDAÇÃO SEGURA DE DADOS
    async validateAndSaveBillingEntry(data) {
        // 1. Rate limiting
        if (!this.rateLimiter.checkLimit('billing', this.auth.currentUser?.email)) {
            throw new Error('Muitas operações. Aguarde antes de tentar novamente.');
        }
        
        // 2. Sanitizar dados
        const sanitized = this.sanitizer.sanitizeObject(data);
        
        // 3. Validar entrada
        const errors = this.validators.billingEntry(sanitized);
        if (errors.length > 0) {
            throw new Error('Dados inválidos: ' + errors.join(', '));
        }
        
        // 4. Verificar permissões
        if (!this.checkSegmentPermission(sanitized.segment)) {
            throw new Error('Permissão negada para este segmento');
        }
        
        // 5. Adicionar metadados de segurança
        const secureData = {
            ...sanitized,
            createdBy: this.auth.currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent.substring(0, 200)
        };
        
        // 6. Salvar no Firestore
        const result = await this.db.collection('billingEntries').add(secureData);
        
        // 7. Log da operação
        this.logSecurityEvent('billing_entry_created', {
            documentId: result.id,
            segment: sanitized.segment,
            amount: sanitized.amount
        });
        
        return result;
    }

    async validateAndSaveGoal(key, amount) {
        // 1. Rate limiting
        if (!this.rateLimiter.checkLimit('goals', this.auth.currentUser?.email)) {
            throw new Error('Muitas operações. Aguarde antes de tentar novamente.');
        }
        
        // 2. Validar dados
        const errors = this.validators.monthlyGoal({ key, amount });
        if (errors.length > 0) {
            throw new Error('Meta inválida: ' + errors.join(', '));
        }
        
        // 3. Verificar permissões
        if (!this.checkGoalPermission(key)) {
            throw new Error('Permissão negada para esta meta');
        }
        
        // 4. Salvar meta
        const secureData = {
            key,
            amount,
            createdBy: this.auth.currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const result = await this.db.collection('monthlyGoals').doc(key).set(secureData, { merge: true });
        
        // 5. Log da operação
        this.logSecurityEvent('goal_created', { key, amount });
        
        return result;
    }

    // VERIFICAÇÃO DE PERMISSÕES
    checkSegmentPermission(segment) {
        const user = this.auth.currentUser;
        if (!user) return false;
        
        const email = user.email;
        const permissions = {
            'conv@icebeer.local': ['conveniences'],
            'peti@icebeer.local': ['petiscarias'],
            'disk@icebeer.local': ['diskChopp'],
            'dono@icebeer.local': [] // Proprietário não faz lançamentos
        };
        
        return permissions[email]?.includes(segment) || false;
    }

    checkGoalPermission(goalKey) {
        const user = this.auth.currentUser;
        if (!user) return false;
        
        const email = user.email;
        
        // Proprietário pode criar qualquer meta
        if (email === 'dono@icebeer.local') return true;
        
        // Gestores só podem criar metas do seu segmento
        const segmentPermissions = {
            'conv@icebeer.local': 'conveniences',
            'peti@icebeer.local': 'petiscarias',
            'disk@icebeer.local': 'diskChopp'
        };
        
        const allowedSegment = segmentPermissions[email];
        return allowedSegment && goalKey.startsWith(allowedSegment);
    }

    // LOGGING DE SEGURANÇA
    logSecurityEvent(event, data = {}) {
        const logEntry = {
            event,
            timestamp: Date.now(),
            user: this.auth.currentUser?.email || 'anonymous',
            data,
            userAgent: navigator.userAgent.substring(0, 200),
            url: window.location.href
        };
        
        // Em produção, enviar para sistema de logging centralizado
        console.log('🔐 Security Event:', logEntry);
        
        // Armazenar localmente para debug
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        logs.push(logEntry);
        
        // Manter apenas últimos 100 logs
        if (logs.length > 100) {
            logs.shift();
        }
        
        localStorage.setItem('security_logs', JSON.stringify(logs));
    }

    // INTERFACE DE SEGURANÇA
    async secureLogin(email, password) {
        // 1. Verificar se conta está bloqueada
        if (this.loginMonitor.isLocked(email)) {
            const remaining = this.loginMonitor.getRemainingLockout(email);
            const minutes = Math.ceil(remaining / 60000);
            throw new Error(`Conta temporariamente bloqueada. Tente novamente em ${minutes} minutos.`);
        }
        
        // 2. Rate limiting
        if (!this.rateLimiter.checkLimit('auth', email)) {
            throw new Error('Muitas tentativas de login. Aguarde antes de tentar novamente.');
        }
        
        try {
            // 3. Tentar login
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            
            // 4. Registrar sucesso
            this.loginMonitor.recordAttempt(email, true);
            this.logSecurityEvent('login_success', { email });
            
            return result;
        } catch (error) {
            // 5. Registrar falha
            this.loginMonitor.recordAttempt(email, false);
            this.logSecurityEvent('login_failure', { email, error: error.code });
            
            throw error;
        }
    }

    // RELATÓRIOS DE SEGURANÇA
    getSecurityReport() {
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        const last24h = logs.filter(log => Date.now() - log.timestamp < 24 * 60 * 60 * 1000);
        
        const report = {
            totalEvents: last24h.length,
            loginAttempts: last24h.filter(log => log.event.includes('login')).length,
            failedLogins: last24h.filter(log => log.event === 'login_failure').length,
            billingEntries: last24h.filter(log => log.event === 'billing_entry_created').length,
            goalsCreated: last24h.filter(log => log.event === 'goal_created').length,
            suspiciousActivity: last24h.filter(log => log.event === 'suspicious_login_activity').length,
            lockedAccounts: Array.from(this.attemptLog.keys()).filter(email => this.loginMonitor.isLocked(email))
        };
        
        console.table(report);
        return report;
    }

    // LIMPEZA DE LOGS
    clearSecurityLogs() {
        localStorage.removeItem('security_logs');
        this.attemptLog.clear();
        console.log('🧹 Logs de segurança limpos');
    }
}

// INICIALIZAÇÃO AUTOMÁTICA
if (typeof window !== 'undefined') {
    const initSecurityManager = () => {
        if (window.firebaseAuth && window.firebaseDb) {
            window.securityManager = new FirebaseSecurityManager();
            console.log('🔐 Security Manager inicializado');
        } else {
            setTimeout(initSecurityManager, 1000);
        }
    };
    
    initSecurityManager();
}

// INTERFACE GLOBAL
window.firebaseSecurity = {
    report: () => window.securityManager?.getSecurityReport(),
    clearLogs: () => window.securityManager?.clearSecurityLogs(),
    checkLocked: (email) => window.securityManager?.loginMonitor.isLocked(email),
    getLockout: (email) => window.securityManager?.loginMonitor.getRemainingLockout(email)
};