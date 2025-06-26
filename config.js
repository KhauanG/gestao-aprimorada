// Ice Beer Management System - Configuration File
// Arquivo de configuração para personalização e manutenção

const IceBeerConfig = {
    // Informações da aplicação
    app: {
        name: 'Ice Beer Management',
        version: '1.0.0',
        author: 'Ice Beer Development Team',
        description: 'Sistema de Gestão de Faturamento',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        locale: 'pt-BR'
    },

    // Configurações de data
    dateConfig: {
        format: 'dd/MM/yyyy',
        minDate: '2025-06-01',
        maxDate: '2028-12-31',
        timezone: 'GMT-3',
        firstDayOfWeek: 0 // 0 = Domingo, 1 = Segunda
    },

    // Configurações dos usuários
    users: {
        conveniences: {
            username: 'conv',
            password: '123',
            name: 'Gestor Conveniências',
            segment: 'conveniences',
            permissions: ['billing', 'reports', 'goals'],
            stores: ['loja1', 'loja2', 'loja3']
        },
        petiscarias: {
            username: 'peti',
            password: '123',
            name: 'Gestor Petiscarias',
            segment: 'petiscarias',
            permissions: ['billing', 'reports', 'goals'],
            stores: ['loja1', 'loja2']
        },
        diskChopp: {
            username: 'disk',
            password: '123',
            name: 'Gestor Disk Chopp',
            segment: 'diskChopp',
            permissions: ['billing', 'reports', 'goals'],
            stores: ['delivery']
        },
        owner: {
            username: 'dono',
            password: '123',
            name: 'Proprietário',
            segment: 'owner',
            permissions: ['reports', 'goals'],
            stores: ['all']
        }
    },

    // Configurações das lojas
    stores: {
        conveniences: {
            loja1: 'Conveniência - Loja 1',
            loja2: 'Conveniência - Loja 2',
            loja3: 'Conveniência - Loja 3'
        },
        petiscarias: {
            loja1: 'Petiscaria - Loja 1',
            loja2: 'Petiscaria - Loja 2'
        },
        diskChopp: {
            delivery: 'Disk Chopp - Delivery'
        }
    },

    // Configurações visuais
    theme: {
        colors: {
            primary: '#1e40af',        // Azul Royal
            secondary: '#3b82f6',      // Azul Claro
            accent: '#60a5fa',         // Azul Médio
            light: '#dbeafe',          // Azul Muito Claro
            success: '#10b981',        // Verde
            warning: '#f59e0b',        // Amarelo
            error: '#ef4444',          // Vermelho
            white: '#ffffff',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray600: '#4b5563',
            gray800: '#1f2937'
        },
        fonts: {
            primary: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            sizes: {
                small: '0.875rem',
                medium: '1rem',
                large: '1.25rem',
                xlarge: '1.5rem'
            }
        },
        animations: {
            duration: '0.3s',
            easing: 'ease-in-out'
        }
    },

    // Configurações de notificações
    notifications: {
        duration: 3000, // 3 segundos
        position: 'top-right',
        maxVisible: 3
    },

    // Configurações de cache
    cache: {
        version: '1.0.0',
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        cleanupInterval: 6 * 60 * 60 * 1000 // 6 horas
    },

    // Configurações de backup
    backup: {
        autoBackup: true,
        backupInterval: 24 * 60 * 60 * 1000, // 24 horas
        maxBackups: 30, // Manter 30 backups
        compressionEnabled: true
    },

    // Configurações de validação
    validation: {
        maxAmount: 1000000, // R$ 1.000.000,00
        minAmount: 0.01,    // R$ 0,01
        maxDescriptionLength: 200,
        dateRangeMaxDays: 365 // Máximo 1 ano por lançamento
    },

    // Configurações de performance
    performance: {
        lazyLoadDelay: 100,
        debounceDelay: 300,
        maxEntriesPerPage: 50,
        enableVirtualization: true
    },

    // Configurações de segurança
    security: {
        sessionTimeout: 8 * 60 * 60 * 1000, // 8 horas
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutos
        enableCSRFProtection: true
    },

    // Configurações de relatórios
    reports: {
        defaultFormat: 'html',
        supportedFormats: ['html', 'json'],
        maxDateRange: 365, // dias
        cacheReports: true,
        reportCacheDuration: 1 * 60 * 60 * 1000 // 1 hora
    },

    // Configurações de metas
    goals: {
        allowNegativeGoals: false,
        maxGoalAmount: 10000000, // R$ 10.000.000,00
        goalProgressThresholds: {
            low: 50,    // < 50% = vermelho
            medium: 80, // 50-80% = amarelo
            high: 100   // > 80% = verde
        }
    },

    // Mensagens do sistema
    messages: {
        success: {
            login: 'Login realizado com sucesso!',
            logout: 'Logout realizado com sucesso!',
            billingSubmit: 'Faturamento lançado com sucesso!',
            billingUpdate: 'Lançamento atualizado com sucesso!',
            billingDelete: 'Lançamento excluído com sucesso!',
            goalSave: 'Meta salva com sucesso!',
            goalDelete: 'Meta excluída com sucesso!'
        },
        error: {
            loginFailed: 'Usuário ou senha incorretos!',
            invalidDateRange: 'Período de datas inválido!',
            missingFields: 'Preencha todos os campos obrigatórios!',
            networkError: 'Erro de conexão. Tente novamente.',
            saveError: 'Erro ao salvar dados!',
            loadError: 'Erro ao carregar dados!'
        },
        warning: {
            unsavedChanges: 'Há alterações não salvas. Deseja continuar?',
            deleteConfirm: 'Tem certeza que deseja excluir este item?',
            goalExceeded: 'Meta atingida! Parabéns!',
            lowPerformance: 'Performance abaixo da meta.'
        },
        info: {
            loading: 'Carregando...',
            noData: 'Nenhum dado encontrado.',
            offlineMode: 'Modo offline ativo.',
            updateAvailable: 'Nova versão disponível!'
        }
    },

    // Configurações de debug
    debug: {
        enableConsoleLog: false, // Ativar apenas em desenvolvimento
        enablePerformanceLog: false,
        enableErrorTracking: true,
        verboseMode: false
    },

    // Configurações de exportação
    export: {
        supportedFormats: ['json', 'csv'],
        maxExportSize: 10000, // máximo de registros
        includeMetadata: true,
        defaultFilename: 'ice-beer-export'
    },

    // URLs e endpoints (para futuras integrações)
    api: {
        baseUrl: '',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
    },

    // Configurações PWA
    pwa: {
        enableNotifications: true,
        enableBackgroundSync: true,
        enableOfflineMode: true,
        updateInterval: 24 * 60 * 60 * 1000 // 24 horas
    },

    // Configurações de analytics (para futuro)
    analytics: {
        enabled: false,
        trackPageViews: true,
        trackUserActions: true,
        trackErrors: true
    },

    // Métodos de configuração
    getConfig: function(path) {
        const keys = path.split('.');
        let value = this;
        for (const key of keys) {
            value = value[key];
            if (value === undefined) break;
        }
        return value;
    },

    setConfig: function(path, value) {
        const keys = path.split('.');
        let obj = this;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
    },

    // Validação de configuração
    validate: function() {
        const required = [
            'app.name',
            'app.version',
            'users.owner',
            'stores.conveniences',
            'theme.colors.primary'
        ];

        for (const path of required) {
            if (!this.getConfig(path)) {
                console.error(`Configuração obrigatória não encontrada: ${path}`);
                return false;
            }
        }
        return true;
    },

    // Inicialização
    init: function() {
        if (!this.validate()) {
            throw new Error('Configuração inválida');
        }

        // Aplicar configurações de tema
        this.applyTheme();

        // Configurar timezone
        this.configureTimezone();

        console.log(`${this.app.name} v${this.app.version} inicializado`);
    },

    applyTheme: function() {
        const root = document.documentElement;
        const colors = this.theme.colors;

        for (const [name, color] of Object.entries(colors)) {
            root.style.setProperty(`--${name.replace(/([A-Z])/g, '-$1').toLowerCase()}`, color);
        }
    },

    configureTimezone: function() {
        // Configurar timezone global se necessário
        if (typeof moment !== 'undefined') {
            moment.tz.setDefault(this.dateConfig.timezone);
        }
    }
};

// Inicializar configuração quando o DOM estiver pronto
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            IceBeerConfig.init();
        } catch (error) {
            console.error('Erro ao inicializar configuração:', error);
        }
    });
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.IceBeerConfig = IceBeerConfig;
}

// Exportar para Node.js (se aplicável)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IceBeerConfig;
}