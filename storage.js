// storage.js - Sistema de Armazenamento Robusto para Ice Beer Management
class RobustStorageManager {
    constructor() {
        this.storageVersion = '2.0.0';
        this.maxStorageSize = 8 * 1024 * 1024; // 8MB limite seguro
        this.compressionEnabled = true;
        this.autoBackupInterval = 7 * 24 * 60 * 60 * 1000; // 7 dias
        this.archiveThreshold = 365; // dias para arquivar
        
        this.init();
    }

    init() {
        console.log('🚀 Inicializando sistema de armazenamento robusto...');
        this.checkStorageCapacity();
        this.setupAutoBackup();
        this.migrateOldData();
        this.scheduleMaintenace();
        console.log('✅ Sistema de armazenamento inicializado');
    }

    // COMPRESSÃO E DESCOMPRESSÃO
    compress(data) {
        if (!this.compressionEnabled) return JSON.stringify(data);
        
        try {
            const jsonStr = JSON.stringify(data);
            const compressed = this.optimizeDataStructure(data);
            const compressedStr = JSON.stringify(compressed);
            
            const reduction = ((1 - compressedStr.length/jsonStr.length) * 100).toFixed(1);
            console.log(`💾 Compressão: ${jsonStr.length} → ${compressedStr.length} bytes (${reduction}% redução)`);
            
            return compressedStr;
        } catch (error) {
            console.error('❌ Erro na compressão:', error);
            return JSON.stringify(data);
        }
    }

    decompress(compressedStr) {
        if (!this.compressionEnabled) return JSON.parse(compressedStr);
        
        try {
            const compressed = JSON.parse(compressedStr);
            return this.restoreDataStructure(compressed);
        } catch (error) {
            console.error('❌ Erro na descompressão:', error);
            return JSON.parse(compressedStr);
        }
    }

    // OTIMIZAÇÃO DA ESTRUTURA DE DADOS
    optimizeDataStructure(data) {
        const optimized = {};
        
        // Otimizar billingData
        if (data.conveniences) {
            optimized.c = this.compressSegmentData(data.conveniences);
        }
        if (data.petiscarias) {
            optimized.p = this.compressSegmentData(data.petiscarias);
        }
        if (data.diskChopp) {
            optimized.d = this.compressEntries(data.diskChopp);
        }
        
        return optimized;
    }

    compressSegmentData(segmentData) {
        const compressed = {};
        for (const [store, entries] of Object.entries(segmentData)) {
            compressed[store] = this.compressEntries(entries);
        }
        return compressed;
    }

    compressEntries(entries) {
        if (!Array.isArray(entries)) return entries;
        
        return entries.map(entry => ({
            i: entry.id,
            s: entry.startDate,
            e: entry.endDate,
            a: entry.amount,
            d: entry.description || '',
            st: entry.store,
            c: entry.createdAt,
            sg: entry.segment,
            u: entry.updatedAt
        }));
    }

    restoreDataStructure(compressed) {
        const restored = {};
        
        // Restaurar conveniences
        if (compressed.c) {
            restored.conveniences = this.restoreSegmentData(compressed.c);
        }
        
        // Restaurar petiscarias
        if (compressed.p) {
            restored.petiscarias = this.restoreSegmentData(compressed.p);
        }
        
        // Restaurar diskChopp
        if (compressed.d) {
            restored.diskChopp = this.restoreEntries(compressed.d);
        }
        
        return restored;
    }

    restoreSegmentData(compressedSegment) {
        const restored = {};
        for (const [store, entries] of Object.entries(compressedSegment)) {
            restored[store] = this.restoreEntries(entries);
        }
        return restored;
    }

    restoreEntries(compressedEntries) {
        if (!Array.isArray(compressedEntries)) return compressedEntries;
        
        return compressedEntries.map(entry => ({
            id: entry.i,
            startDate: entry.s,
            endDate: entry.e,
            amount: entry.a,
            description: entry.d || '',
            store: entry.st,
            createdAt: entry.c,
            segment: entry.sg,
            updatedAt: entry.u
        }));
    }

    // SISTEMA DE BACKUP AUTOMÁTICO
    setupAutoBackup() {
        const lastBackup = localStorage.getItem('ice_beer_last_backup');
        const now = Date.now();
        
        if (!lastBackup || (now - parseInt(lastBackup)) > this.autoBackupInterval) {
            this.createBackup();
        }
        
        // Agendar próximo backup
        setTimeout(() => {
            this.createBackup();
            this.setupAutoBackup();
        }, this.autoBackupInterval);
    }

    createBackup() {
        try {
            const billingData = this.loadData('billingData');
            const monthlyGoals = this.loadData('monthlyGoals');
            
            if (!billingData && !monthlyGoals) {
                console.log('📂 Nenhum dado para backup');
                return;
            }
            
            const backup = {
                version: this.storageVersion,
                timestamp: Date.now(),
                data: {
                    billingData: billingData || {},
                    monthlyGoals: monthlyGoals || {}
                }
            };
            
            const backupStr = this.compress(backup);
            
            // Manter apenas os 5 backups mais recentes
            this.rotateBackups();
            
            // Salvar novo backup
            const backupKey = `ice_beer_backup_${Date.now()}`;
            localStorage.setItem(backupKey, backupStr);
            localStorage.setItem('ice_beer_last_backup', Date.now().toString());
            
            console.log('💾 Backup criado:', backupKey);
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
        }
    }

    rotateBackups() {
        const backupKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('ice_beer_backup_'))
            .sort((a, b) => {
                const timestampA = parseInt(a.split('_')[3]);
                const timestampB = parseInt(b.split('_')[3]);
                return timestampB - timestampA;
            });
        
        // Remover backups antigos (manter apenas 5)
        if (backupKeys.length >= 5) {
            for (let i = 4; i < backupKeys.length; i++) {
                localStorage.removeItem(backupKeys[i]);
                console.log('🗑️ Backup removido:', backupKeys[i]);
            }
        }
    }

    restoreFromBackup(backupKey = null) {
        try {
            let selectedBackup = backupKey;
            
            if (!selectedBackup) {
                // Usar backup mais recente
                const backupKeys = Object.keys(localStorage)
                    .filter(key => key.startsWith('ice_beer_backup_'))
                    .sort((a, b) => {
                        const timestampA = parseInt(a.split('_')[3]);
                        const timestampB = parseInt(b.split('_')[3]);
                        return timestampB - timestampA;
                    });
                
                if (backupKeys.length === 0) {
                    throw new Error('Nenhum backup encontrado');
                }
                
                selectedBackup = backupKeys[0];
            }
            
            const backupStr = localStorage.getItem(selectedBackup);
            if (!backupStr) {
                throw new Error('Backup não encontrado');
            }
            
            const backup = this.decompress(backupStr);
            
            // Restaurar dados
            if (backup.data.billingData) {
                this.saveData('billingData', backup.data.billingData);
            }
            if (backup.data.monthlyGoals) {
                this.saveData('monthlyGoals', backup.data.monthlyGoals);
            }
            
            console.log('✅ Backup restaurado:', selectedBackup);
            return true;
        } catch (error) {
            console.error('❌ Erro ao restaurar backup:', error);
            return false;
        }
    }

    // ARQUIVAMENTO DE DADOS ANTIGOS
    archiveOldData() {
        try {
            const billingData = this.loadData('billingData');
            if (!billingData) return;
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.archiveThreshold);
            
            const archivedData = {};
            let entriesArchived = 0;
            
            // Arquivar dados antigos de todos os segmentos
            ['conveniences', 'petiscarias', 'diskChopp'].forEach(segment => {
                if (billingData[segment]) {
                    if (segment === 'diskChopp') {
                        const { current, archived } = this.separateEntriesByDate(billingData[segment], cutoffDate);
                        billingData[segment] = current;
                        if (archived.length > 0) {
                            archivedData[segment] = archived;
                            entriesArchived += archived.length;
                        }
                    } else {
                        archivedData[segment] = {};
                        Object.keys(billingData[segment]).forEach(store => {
                            const { current, archived } = this.separateEntriesByDate(billingData[segment][store], cutoffDate);
                            billingData[segment][store] = current;
                            if (archived.length > 0) {
                                archivedData[segment][store] = archived;
                                entriesArchived += archived.length;
                            }
                        });
                    }
                }
            });
            
            if (entriesArchived > 0) {
                // Salvar dados arquivados
                const archiveKey = `ice_beer_archive_${Date.now()}`;
                const archiveData = {
                    version: this.storageVersion,
                    archivedAt: Date.now(),
                    cutoffDate: cutoffDate.toISOString(),
                    data: archivedData
                };
                
                localStorage.setItem(archiveKey, this.compress(archiveData));
                
                // Salvar dados atualizados (sem os arquivados)
                this.saveData('billingData', billingData);
                
                console.log(`📦 ${entriesArchived} entradas arquivadas em ${archiveKey}`);
            }
        } catch (error) {
            console.error('❌ Erro ao arquivar dados antigos:', error);
        }
    }

    separateEntriesByDate(entries, cutoffDate) {
        if (!Array.isArray(entries)) return { current: entries, archived: [] };
        
        const current = [];
        const archived = [];
        
        entries.forEach(entry => {
            if (entry.createdAt && new Date(entry.createdAt) < cutoffDate) {
                archived.push(entry);
            } else {
                current.push(entry);
            }
        });
        
        return { current, archived };
    }

    // MONITORAMENTO DE CAPACIDADE
    checkStorageCapacity() {
        try {
            const used = this.getStorageUsage();
            const percentage = (used / this.maxStorageSize) * 100;
            
            console.log(`📊 Uso do armazenamento: ${this.formatBytes(used)} / ${this.formatBytes(this.maxStorageSize)} (${percentage.toFixed(1)}%)`);
            
            if (percentage > 80) {
                console.warn('⚠️ Armazenamento próximo do limite! Executando limpeza...');
                this.cleanupStorage();
            }
            
            if (percentage > 95) {
                console.error('🚨 Armazenamento crítico! Arquivando dados antigos...');
                this.archiveOldData();
            }
            
            return { used, percentage };
        } catch (error) {
            console.error('❌ Erro ao verificar capacidade:', error);
            return { used: 0, percentage: 0 };
        }
    }

    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    cleanupStorage() {
        try {
            // Remover arquivos temporários
            const tempKeys = Object.keys(localStorage)
                .filter(key => key.includes('temp') || key.includes('cache'));
            
            tempKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            // Compactar dados existentes
            const billingData = this.loadData('billingData');
            if (billingData) {
                this.saveData('billingData', billingData);
            }
            
            const monthlyGoals = this.loadData('monthlyGoals');
            if (monthlyGoals) {
                this.saveData('monthlyGoals', monthlyGoals);
            }
            
            console.log('🧹 Limpeza do armazenamento concluída');
        } catch (error) {
            console.error('❌ Erro na limpeza:', error);
        }
    }

    // SISTEMA DE EXPORT/IMPORT
    exportData() {
        try {
            const billingData = this.loadData('billingData');
            const monthlyGoals = this.loadData('monthlyGoals');
            
            const exportData = {
                version: this.storageVersion,
                exportedAt: new Date().toISOString(),
                data: {
                    billingData: billingData || {},
                    monthlyGoals: monthlyGoals || {}
                }
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `ice_beer_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('📤 Dados exportados com sucesso');
        } catch (error) {
            console.error('❌ Erro ao exportar dados:', error);
        }
    }

    importData(fileContent) {
        try {
            const importData = JSON.parse(fileContent);
            
            if (!importData.version || !importData.data) {
                throw new Error('Formato de arquivo inválido');
            }
            
            // Criar backup antes da importação
            this.createBackup();
            
            // Importar dados
            if (importData.data.billingData) {
                this.saveData('billingData', importData.data.billingData);
            }
            if (importData.data.monthlyGoals) {
                this.saveData('monthlyGoals', importData.data.monthlyGoals);
            }
            
            console.log('📥 Dados importados com sucesso');
            return true;
        } catch (error) {
            console.error('❌ Erro ao importar dados:', error);
            return false;
        }
    }

    // MANUTENÇÃO PROGRAMADA
    scheduleMaintenace() {
        // Executar manutenção semanalmente
        const maintenanceInterval = 7 * 24 * 60 * 60 * 1000; // 7 dias
        
        setTimeout(() => {
            this.performMaintenance();
            this.scheduleMaintenace();
        }, maintenanceInterval);
    }

    performMaintenance() {
        console.log('🔧 Executando manutenção do sistema...');
        
        try {
            // Verificar integridade dos dados
            this.validateDataIntegrity();
            
            // Limpar cache antigo
            this.cleanupStorage();
            
            // Verificar capacidade
            this.checkStorageCapacity();
            
            // Otimizar dados
            this.optimizeExistingData();
            
            console.log('✅ Manutenção concluída com sucesso');
        } catch (error) {
            console.error('❌ Erro na manutenção:', error);
        }
    }

    validateDataIntegrity() {
        const billingData = this.loadData('billingData');
        if (!billingData) return;
        
        let corruptedEntries = 0;
        
        // Validar estrutura dos dados
        ['conveniences', 'petiscarias', 'diskChopp'].forEach(segment => {
            if (billingData[segment]) {
                if (segment === 'diskChopp') {
                    if (Array.isArray(billingData[segment])) {
                        billingData[segment] = billingData[segment].filter(entry => {
                            if (!this.isValidEntry(entry)) {
                                corruptedEntries++;
                                return false;
                            }
                            return true;
                        });
                    }
                } else {
                    Object.keys(billingData[segment]).forEach(store => {
                        if (Array.isArray(billingData[segment][store])) {
                            billingData[segment][store] = billingData[segment][store].filter(entry => {
                                if (!this.isValidEntry(entry)) {
                                    corruptedEntries++;
                                    return false;
                                }
                                return true;
                            });
                        }
                    });
                }
            }
        });
        
        if (corruptedEntries > 0) {
            console.warn(`⚠️ ${corruptedEntries} entradas corrompidas foram removidas`);
            this.saveData('billingData', billingData);
        }
    }

    isValidEntry(entry) {
        return entry && 
               entry.id && 
               entry.startDate && 
               entry.endDate && 
               typeof entry.amount === 'number' && 
               entry.createdAt;
    }

    optimizeExistingData() {
        const billingData = this.loadData('billingData');
        if (billingData) {
            this.saveData('billingData', billingData);
        }
        
        const monthlyGoals = this.loadData('monthlyGoals');
        if (monthlyGoals) {
            this.saveData('monthlyGoals', monthlyGoals);
        }
    }

    // MIGRAÇÃO DE DADOS ANTIGOS
    migrateOldData() {
        const currentVersion = localStorage.getItem('ice_beer_version');
        
        if (!currentVersion || currentVersion !== this.storageVersion) {
            console.log('🔄 Migrando dados para versão', this.storageVersion);
            
            // Criar backup antes da migração
            this.createBackup();
            
            // Aplicar migrações necessárias
            this.applyMigrations(currentVersion);
            
            localStorage.setItem('ice_beer_version', this.storageVersion);
        }
    }

    applyMigrations(fromVersion) {
        // Aplicar migrações baseadas na versão
        if (!fromVersion) {
            // Primeira instalação - não precisa migrar
            return;
        }
        
        // Adicionar migrações conforme necessário no futuro
        console.log(`✅ Migração de ${fromVersion} para ${this.storageVersion} concluída`);
    }

    // INTERFACE PRINCIPAL DO STORAGE
    saveData(key, data) {
        try {
            const compressedData = this.compress(data);
            localStorage.setItem(`ice_beer_${key}`, compressedData);
            
            // Verificar capacidade após salvar
            setTimeout(() => this.checkStorageCapacity(), 100);
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar dados:', error);
            
            // Tentar limpar espaço e salvar novamente
            this.cleanupStorage();
            
            try {
                const compressedData = this.compress(data);
                localStorage.setItem(`ice_beer_${key}`, compressedData);
                return true;
            } catch (retryError) {
                console.error('🚨 Erro crítico ao salvar dados:', retryError);
                return false;
            }
        }
    }

    loadData(key) {
        try {
            const data = localStorage.getItem(`ice_beer_${key}`);
            if (!data) return null;
            
            return this.decompress(data);
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            
            // Tentar restaurar do backup
            console.log('🔄 Tentando restaurar do backup...');
            if (this.restoreFromBackup()) {
                try {
                    const data = localStorage.getItem(`ice_beer_${key}`);
                    if (data) {
                        return this.decompress(data);
                    }
                } catch (backupError) {
                    console.error('❌ Erro ao carregar do backup:', backupError);
                }
            }
            
            return null;
        }
    }

    // ESTATÍSTICAS DO SISTEMA
    getStorageStats() {
        const stats = {
            version: this.storageVersion,
            usage: this.getStorageUsage(),
            maxSize: this.maxStorageSize,
            compressionEnabled: this.compressionEnabled,
            backupCount: Object.keys(localStorage).filter(key => key.startsWith('ice_beer_backup_')).length,
            archiveCount: Object.keys(localStorage).filter(key => key.startsWith('ice_beer_archive_')).length,
            lastBackup: localStorage.getItem('ice_beer_last_backup'),
            totalEntries: this.countTotalEntries()
        };
        
        stats.usagePercentage = (stats.usage / stats.maxSize) * 100;
        
        return stats;
    }

    countTotalEntries() {
        const billingData = this.loadData('billingData');
        if (!billingData) return 0;
        
        let total = 0;
        
        ['conveniences', 'petiscarias', 'diskChopp'].forEach(segment => {
            if (billingData[segment]) {
                if (segment === 'diskChopp') {
                    total += Array.isArray(billingData[segment]) ? billingData[segment].length : 0;
                } else {
                    Object.values(billingData[segment]).forEach(storeData => {
                        total += Array.isArray(storeData) ? storeData.length : 0;
                    });
                }
            }
        });
        
        return total;
    }

    // INTERFACE PARA DEBUG
    debugInfo() {
        const stats = this.getStorageStats();
        console.table(stats);
        
        console.log('📊 Estatísticas detalhadas:');
        console.log(`💾 Uso: ${this.formatBytes(stats.usage)} / ${this.formatBytes(stats.maxSize)} (${stats.usagePercentage.toFixed(1)}%)`);
        console.log(`📁 Entradas: ${stats.totalEntries}`);
        console.log(`💾 Backups: ${stats.backupCount}`);
        console.log(`📦 Arquivos: ${stats.archiveCount}`);
        console.log(`🔄 Último backup: ${stats.lastBackup ? new Date(parseInt(stats.lastBackup)).toLocaleString() : 'Nunca'}`);
        
        return stats;
    }
}

// Expor globalmente
window.RobustStorageManager = RobustStorageManager;