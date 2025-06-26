// Ice Beer Management System - Backup & Maintenance
// Sistema de backup automático e manutenção de dados

class IceBeerBackup {
    constructor() {
        this.backupPrefix = 'ice-beer-backup-';
        this.maxBackups = 30;
        this.backupInterval = 24 * 60 * 60 * 1000; // 24 horas
        this.lastBackup = this.getLastBackupTime();
        
        this.init();
    }

    init() {
        // Verificar se precisa fazer backup
        this.checkAutoBackup();
        
        // Configurar backup automático
        setInterval(() => {
            this.checkAutoBackup();
        }, 60 * 60 * 1000); // Verificar a cada hora

        // Adicionar listeners para backup manual
        this.setupManualBackup();
    }

    // Backup Automático
    checkAutoBackup() {
        const now = Date.now();
        if (!this.lastBackup || (now - this.lastBackup) > this.backupInterval) {
            this.createBackup();
        }
    }

    createBackup() {
        try {
            const backupData = this.gatherBackupData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupKey = `${this.backupPrefix}${timestamp}`;
            
            // Comprimir dados se possível
            const compressedData = this.compressData(backupData);
            
            // Salvar backup
            localStorage.setItem(backupKey, JSON.stringify(compressedData));
            
            // Atualizar timestamp do último backup
            this.setLastBackupTime(Date.now());
            
            // Limpar backups antigos
            this.cleanOldBackups();
            
            console.log(`Backup criado: ${backupKey}`);
            return backupKey;
        } catch (error) {
            console.error('Erro ao criar backup:', error);
            return null;
        }
    }

    gatherBackupData() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            data: {
                billingData: this.getStorageData('billingData'),
                monthlyGoals: this.getStorageData('monthlyGoals'),
                userSettings: this.getStorageData('userSettings')
            },
            metadata: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                totalEntries: this.countTotalEntries()
            }
        };
    }

    compressData(data) {
        // Implementação simples de compressão
        // Em produção, poderia usar bibliotecas como pako.js
        const jsonString = JSON.stringify(data);
        
        // Remover espaços desnecessários
        const compressed = jsonString
            .replace(/\s+/g, ' ')
            .replace(/: /g, ':')
            .replace(/, /g, ',');
            
        return {
            compressed: true,
            size: compressed.length,
            originalSize: jsonString.length,
            data: compressed
        };
    }

    // Restauração de Backup
    listBackups() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.backupPrefix)) {
                try {
                    const backup = JSON.parse(localStorage.getItem(key));
                    backups.push({
                        key,
                        timestamp: backup.timestamp,
                        size: backup.size || 0,
                        compressed: backup.compressed || false
                    });
                } catch (error) {
                    console.warn(`Backup corrompido: ${key}`);
                }
            }
        }
        
        // Ordenar por data (mais recente primeiro)
        return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    restoreBackup(backupKey) {
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                throw new Error('Backup não encontrado');
            }

            const backup = JSON.parse(backupData);
            let data = backup.data;

            // Descomprimir se necessário
            if (backup.compressed) {
                data = JSON.parse(backup.data);
            }

            // Restaurar dados
            if (data.billingData) {
                localStorage.setItem('billingData', JSON.stringify(data.billingData));
            }
            if (data.monthlyGoals) {
                localStorage.setItem('monthlyGoals', JSON.stringify(data.monthlyGoals));
            }
            if (data.userSettings) {
                localStorage.setItem('userSettings', JSON.stringify(data.userSettings));
            }

            console.log(`Backup restaurado: ${backupKey}`);
            return true;
        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            return false;
        }
    }

    // Exportação de Dados
    exportData(format = 'json') {
        const data = this.gatherBackupData();
        const timestamp = new Date().toISOString().split('T')[0];
        
        switch (format.toLowerCase()) {
            case 'json':
                this.downloadFile(
                    JSON.stringify(data, null, 2),
                    `ice-beer-export-${timestamp}.json`,
                    'application/json'
                );
                break;
                
            case 'csv':
                this.exportToCSV(data, timestamp);
                break;
                
            default:
                console.error('Formato não suportado:', format);
        }
    }

    exportToCSV(data, timestamp) {
        let csv = 'Tipo,Loja,Data Inicio,Data Fim,Valor,Observacoes\n';
        
        // Processar dados de faturamento
        Object.entries(data.data.billingData).forEach(([segment, stores]) => {
            if (segment === 'diskChopp') {
                stores.forEach(entry => {
                    csv += `Disk Chopp,Delivery,${entry.startDate},${entry.endDate},${entry.amount},"${entry.description || ''}"\n`;
                });
            } else {
                Object.entries(stores).forEach(([store, entries]) => {
                    entries.forEach(entry => {
                        const segmentName = segment === 'conveniences' ? 'Conveniencia' : 'Petiscaria';
                        csv += `${segmentName},${store},${entry.startDate},${entry.endDate},${entry.amount},"${entry.description || ''}"\n`;
                    });
                });
            }
        });

        this.downloadFile(csv, `ice-beer-export-${timestamp}.csv`, 'text/csv');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    // Importação de Dados
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    let data;
                    
                    if (file.type === 'application/json' || file.name.endsWith('.json')) {
                        data = JSON.parse(content);
                        this.importFromJSON(data);
                    } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                        this.importFromCSV(content);
                    } else {
                        throw new Error('Formato de arquivo não suportado');
                    }
                    
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsText(file);
        });
    }

    importFromJSON(data) {
        if (data.data && data.data.billingData) {
            const currentData = this.getStorageData('billingData') || {};
            
            // Mesclar dados (evitar duplicatas)
            const mergedData = this.mergeData(currentData, data.data.billingData);
            localStorage.setItem('billingData', JSON.stringify(mergedData));
        }
        
        if (data.data && data.data.monthlyGoals) {
            const currentGoals = this.getStorageData('monthlyGoals') || {};
            const mergedGoals = { ...currentGoals, ...data.data.monthlyGoals };
            localStorage.setItem('monthlyGoals', JSON.stringify(mergedGoals));
        }
    }

    importFromCSV(csvContent) {
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',');
        
        if (!headers.includes('Tipo') || !headers.includes('Valor')) {
            throw new Error('Formato CSV inválido');
        }
        
        const currentData = this.getStorageData('billingData') || {
            conveniences: { loja1: [], loja2: [], loja3: [] },
            petiscarias: { loja1: [], loja2: [] },
            diskChopp: []
        };
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCSVLine(line);
            const entry = {
                id: Date.now() + Math.random(),
                startDate: values[2],
                endDate: values[3],
                amount: parseFloat(values[4]),
                description: values[5] || '',
                createdAt: new Date().toISOString()
            };
            
            // Adicionar ao segmento correto
            const tipo = values[0].toLowerCase();
            if (tipo.includes('disk')) {
                currentData.diskChopp.push(entry);
            } else if (tipo.includes('conveniencia')) {
                const loja = values[1].toLowerCase();
                if (currentData.conveniences[loja]) {
                    currentData.conveniences[loja].push(entry);
                }
            } else if (tipo.includes('petiscaria')) {
                const loja = values[1].toLowerCase();
                if (currentData.petiscarias[loja]) {
                    currentData.petiscarias[loja].push(entry);
                }
            }
        }
        
        localStorage.setItem('billingData', JSON.stringify(currentData));
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    // Manutenção e Limpeza
    cleanOldBackups() {
        const backups = this.listBackups();
        
        if (backups.length > this.maxBackups) {
            const toDelete = backups.slice(this.maxBackups);
            toDelete.forEach(backup => {
                localStorage.removeItem(backup.key);
                console.log(`Backup antigo removido: ${backup.key}`);
            });
        }
    }

    cleanStorage() {
        // Remover dados corrompidos ou inválidos
        let cleaned = 0;
        
        ['billingData', 'monthlyGoals'].forEach(key => {
            try {
                const data = localStorage.getItem(key);
                if (data) {
                    JSON.parse(data); // Testar se é JSON válido
                }
            } catch (error) {
                localStorage.removeItem(key);
                cleaned++;
                console.log(`Dados corrompidos removidos: ${key}`);
            }
        });
        
        return cleaned;
    }

    getStorageStats() {
        let totalSize = 0;
        let totalItems = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalSize += key.length + value.length;
            totalItems++;
        }
        
        return {
            totalItems,
            totalSize,
            totalSizeKB: Math.round(totalSize / 1024),
            availableSpace: this.getAvailableSpace()
        };
    }

    getAvailableSpace() {
        try {
            // Tentar estimar espaço disponível
            let testData = 'x';
            let size = 0;
            
            while (size < 10000000) { // 10MB máximo para teste
                try {
                    localStorage.setItem('__test__', testData);
                    localStorage.removeItem('__test__');
                    testData += testData;
                    size = testData.length;
                } catch (e) {
                    break;
                }
            }
            
            return size;
        } catch (error) {
            return 'Desconhecido';
        }
    }

    // Utilitários
    getStorageData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn(`Erro ao ler ${key}:`, error);
            return null;
        }
    }

    getLastBackupTime() {
        return parseInt(localStorage.getItem('lastBackupTime')) || 0;
    }

    setLastBackupTime(timestamp) {
        localStorage.setItem('lastBackupTime', timestamp.toString());
        this.lastBackup = timestamp;
    }

    countTotalEntries() {
        const data = this.getStorageData('billingData');
        if (!data) return 0;
        
        let count = 0;
        Object.values(data).forEach(segment => {
            if (Array.isArray(segment)) {
                count += segment.length;
            } else {
                Object.values(segment).forEach(store => {
                    count += store.length;
                });
            }
        });
        
        return count;
    }

    mergeData(current, imported) {
        const merged = JSON.parse(JSON.stringify(current));
        
        Object.entries(imported).forEach(([segment, data]) => {
            if (!merged[segment]) merged[segment] = {};
            
            if (Array.isArray(data)) {
                // Para diskChopp
                merged[segment] = [...(merged[segment] || []), ...data];
            } else {
                // Para conveniences e petiscarias
                Object.entries(data).forEach(([store, entries]) => {
                    if (!merged[segment][store]) merged[segment][store] = [];
                    merged[segment][store] = [...merged[segment][store], ...entries];
                });
            }
        });
        
        return merged;
    }

    setupManualBackup() {
        // Adicionar controles de backup à interface
        if (typeof window !== 'undefined' && window.document) {
            window.addEventListener('beforeunload', () => {
                // Backup rápido antes de sair
                if (Date.now() - this.lastBackup > 60 * 60 * 1000) { // 1 hora
                    this.createBackup();
                }
            });
        }
    }

    // Métodos públicos para interface
    createManualBackup() {
        return this.createBackup();
    }

    getBackupList() {
        return this.listBackups();
    }

    restore(backupKey) {
        return this.restoreBackup(backupKey);
    }

    export(format) {
        return this.exportData(format);
    }

    import(file) {
        return this.importData(file);
    }

    getStats() {
        return {
            storage: this.getStorageStats(),
            backups: this.listBackups().length,
            lastBackup: new Date(this.lastBackup).toLocaleString('pt-BR'),
            totalEntries: this.countTotalEntries()
        };
    }
}

// Inicializar sistema de backup
if (typeof window !== 'undefined') {
    window.IceBeerBackup = new IceBeerBackup();
}

// Exportar para Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IceBeerBackup;
}