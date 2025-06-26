// Ice Beer Management System - Integrado com Storage Robusto
class IceBeerManagement {
    constructor() {
        // NOVO: Inicializar sistema de storage robusto
        this.storage = new RobustStorageManager();
        
        this.currentUser = null;
        this.editingEntry = null;

        // MODIFICADO: Carregar dados usando o novo sistema
        this.billingData = this.storage.loadData('billingData') || {
            conveniences: { loja1: [], loja2: [], loja3: [] },
            petiscarias: { loja1: [], loja2: [] },
            diskChopp: []
        };
        this.monthlyGoals = this.storage.loadData('monthlyGoals') || {};

        // Configurações dos usuários
        this.users = {
            conveniences: { username: 'conv', password: '123', name: 'Gestor Conveniências', segment: 'conveniences' },
            petiscarias: { username: 'peti', password: '123', name: 'Gestor Petiscarias', segment: 'petiscarias' },
            diskChopp: { username: 'disk', password: '123', name: 'Gestor Disk Chopp', segment: 'diskChopp' },
            owner: { username: 'dono', password: '123', name: 'Proprietário', segment: 'owner' }
        };

        // Configurações das lojas por segmento
        this.storeConfig = {
            conveniences: ['Loja 1', 'Loja 2', 'Loja 3'],
            petiscarias: ['Loja 1', 'Loja 2'],
            diskChopp: ['Delivery']
        };

        this.init();
    }

    init() {
        console.log('Inicializando Ice Beer Management System...');
        
        this.setupEventListeners();
        this.updateCurrentDate();
        
        // Garantir que começamos na tela de login
        setTimeout(() => {
            this.showLoginScreen();
        }, 100);
        
        // Registra Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => console.log('SW registrado:', registration))
                .catch(error => console.log('SW erro:', error));
        }
        
        console.log('Sistema inicializado com sucesso');
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        // Login - verificar se elementos existem
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navegação
        const navButtons = document.querySelectorAll('.nav-btn');
        if (navButtons.length > 0) {
            navButtons.forEach(btn => {
                if (btn && btn.dataset && btn.dataset.section) {
                    btn.addEventListener('click', (e) => this.showSection(e.target.dataset.section));
                }
            });
        }

        // Faturamento
        const billingForm = document.getElementById('billingForm');
        if (billingForm) {
            billingForm.addEventListener('submit', (e) => this.handleBillingSubmit(e));
        }

        // Relatórios
        const generateReportBtn = document.getElementById('generateReport');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => this.generateReport());
        }

        // Metas
        const saveGoalBtn = document.getElementById('saveGoal');
        if (saveGoalBtn) {
            saveGoalBtn.addEventListener('click', () => this.saveGoal());
        }

        // Modal
        const closeModalBtn = document.getElementById('closeModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.closeModal());
        }
        
        const cancelEditBtn = document.getElementById('cancelEdit');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => this.closeModal());
        }
        
        const editForm = document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
        }

        // Validação de datas
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        if (startDate) {
            startDate.addEventListener('change', () => this.validateDateRange());
        }
        if (endDate) {
            endDate.addEventListener('change', () => this.validateDateRange());
        }
        
        console.log('Event listeners configurados com sucesso');
    }

    // CORREÇÃO: Função helper para criar datas sem problemas de timezone
    parseLocalDate(dateStr) {
        if (!dateStr) return null;
        try {
            // Garante que a data seja interpretada como horário local
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day); // month - 1 porque Date usa 0-11
        } catch (error) {
            console.error('Erro ao fazer parse da data:', dateStr, error);
            return null;
        }
    }

    // CORREÇÃO: Função helper para verificar se uma entrada pertence a um mês específico
    isEntryInMonth(entry, month, year) {
        if (!entry || !entry.startDate || !entry.endDate) return false;
        
        try {
            const entryStart = this.parseLocalDate(entry.startDate);
            const entryEnd = this.parseLocalDate(entry.endDate);
            
            if (!entryStart || !entryEnd) return false;
            
            // Primeiro e último dia do mês desejado (horário local)
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0); // Último dia do mês
            
            // Verificar se há interseção entre os períodos
            // Há interseção se: início do período <= fim do mês E fim do período >= início do mês
            const hasIntersection = entryStart <= monthEnd && entryEnd >= monthStart;
            
            console.log(`Verificando entrada: ${entry.startDate} a ${entry.endDate} para ${month}/${year}:`, hasIntersection);
            
            return hasIntersection;
        } catch (error) {
            console.error('Erro ao verificar entrada no mês:', error);
            return false;
        }
    }

    // CORREÇÃO: Função para calcular quanto de uma entrada pertence a um mês específico
    calculateEntryAmountForMonth(entry, month, year) {
        if (!entry || !entry.startDate || !entry.endDate || !entry.amount) return 0;
        
        try {
            const entryStart = this.parseLocalDate(entry.startDate);
            const entryEnd = this.parseLocalDate(entry.endDate);
            
            if (!entryStart || !entryEnd) return 0;
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Se não há interseção, retorna 0
            if (entryStart > monthEnd || entryEnd < monthStart) return 0;
            
            // Calcular o período que intersecta com o mês
            const intersectionStart = entryStart < monthStart ? monthStart : entryStart;
            const intersectionEnd = entryEnd > monthEnd ? monthEnd : entryEnd;
            
            // Calcular dias totais da entrada e dias que intersectam com o mês
            const totalDays = Math.ceil((entryEnd - entryStart) / (1000 * 60 * 60 * 24)) + 1;
            const intersectionDays = Math.ceil((intersectionEnd - intersectionStart) / (1000 * 60 * 60 * 24)) + 1;
            
            // Calcular proporção do valor que pertence ao mês
            const proportion = intersectionDays / totalDays;
            const monthAmount = parseFloat(entry.amount) * proportion;
            
            console.log(`Entrada ${entry.startDate}-${entry.endDate}: ${intersectionDays}/${totalDays} dias no mês ${month}/${year} = R$ ${monthAmount}`);
            
            return monthAmount;
        } catch (error) {
            console.error('Erro ao calcular valor da entrada para o mês:', error);
            return 0;
        }
    }

    // Autenticação
    handleLogin(e) {
        e.preventDefault();
        console.log('Tentativa de login...');
        
        const username = document.getElementById('username')?.value?.trim();
        const password = document.getElementById('password')?.value?.trim();

        if (!username || !password) {
            this.showNotification('Preencha usuário e senha!', 'error');
            return;
        }

        const user = Object.values(this.users).find(u => 
            u.username === username && u.password === password
        );

        if (user) {
            console.log('Login bem-sucedido:', user.name);
            this.currentUser = user;
            
            // Forçar mudança de tela
            setTimeout(() => {
                this.showDashboard();
                this.setupUserInterface();
                this.showNotification('Login realizado com sucesso!', 'success');
            }, 100);
        } else {
            console.log('Login falhou');
            this.showNotification('Usuário ou senha incorretos!', 'error');
        }
    }

    handleLogout() {
        this.currentUser = null;
        this.showLoginScreen();
        this.showNotification('Logout realizado com sucesso!', 'success');
    }

    // Interface do usuário
    showLoginScreen() {
        console.log('Mostrando tela de login...');
        
        const loginScreen = document.getElementById('loginScreen');
        const dashboardScreen = document.getElementById('dashboardScreen');
        
        if (loginScreen) {
            loginScreen.classList.add('active');
            loginScreen.style.display = 'flex';
        }
        
        if (dashboardScreen) {
            dashboardScreen.classList.remove('active');
            dashboardScreen.style.display = 'none';
        }
        
        // Limpar formulário
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        
        if (usernameField) usernameField.value = '';
        if (passwordField) passwordField.value = '';
        
        console.log('Tela de login mostrada');
    }

    showDashboard() {
        console.log('Mostrando dashboard...');
        
        // Esconder tela de login
        const loginScreen = document.getElementById('loginScreen');
        const dashboardScreen = document.getElementById('dashboardScreen');
        
        if (loginScreen) {
            loginScreen.classList.remove('active');
            loginScreen.style.display = 'none';
        }
        
        if (dashboardScreen) {
            dashboardScreen.classList.add('active');
            dashboardScreen.style.display = 'block';
        }
        
        // Atualizar informações do usuário
        const userInfo = document.getElementById('userInfo');
        if (userInfo && this.currentUser) {
            userInfo.textContent = `Bem-vindo, ${this.currentUser.name}!`;
        }
        
        // Atualizar dashboard
        this.updateDashboard();
        
        console.log('Dashboard mostrado com sucesso');
    }

    setupUserInterface() {
        console.log('Configurando interface do usuário...');
        
        const segment = this.currentUser?.segment;
        if (!segment) {
            console.error('Segmento do usuário não definido');
            return;
        }
        
        try {
            // Configurar navegação baseada no usuário
            const billingNav = document.getElementById('billingNav');
            if (billingNav) {
                if (segment === 'owner') {
                    // Proprietário não faz lançamentos
                    billingNav.style.display = 'none';
                } else {
                    // Gestores veem todos os botões
                    billingNav.style.display = 'flex';
                }
            }

            // Configurar seletores de loja
            this.setupStoreSelectors(segment);
            
            // Atualizar dados específicos do usuário
            this.updateDashboard();
            this.loadBillingHistory();
            
            console.log('Interface configurada para:', segment);
            
        } catch (error) {
            console.error('Erro ao configurar interface:', error);
        }
    }

    setupStoreSelectors(segment) {
        console.log('Configurando seletores de loja para:', segment);
        
        const storeSelects = ['storeSelect', 'reportStore', 'goalStore'];
        
        storeSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) {
                console.warn(`Seletor ${selectId} não encontrado`);
                return;
            }
            
            try {
                select.innerHTML = '';
                
                if (segment === 'owner') {
                    // Proprietário vê todos os segmentos
                    select.innerHTML = `
                        <option value="all">Todos os Segmentos</option>
                        <optgroup label="Conveniências">
                            <option value="conveniences-loja1">Conveniência - Loja 1</option>
                            <option value="conveniences-loja2">Conveniência - Loja 2</option>
                            <option value="conveniences-loja3">Conveniência - Loja 3</option>
                        </optgroup>
                        <optgroup label="Petiscarias">
                            <option value="petiscarias-loja1">Petiscaria - Loja 1</option>
                            <option value="petiscarias-loja2">Petiscaria - Loja 2</option>
                        </optgroup>
                        <optgroup label="Disk Chopp">
                            <option value="diskChopp-delivery">Disk Chopp - Delivery</option>
                        </optgroup>
                    `;
                } else {
                    // Gestores veem apenas suas lojas
                    const stores = this.storeConfig[segment] || [];
                    stores.forEach((store, index) => {
                        const key = segment === 'diskChopp' ? 'delivery' : `loja${index + 1}`;
                        const option = document.createElement('option');
                        option.value = `${segment}-${key}`;
                        option.textContent = store;
                        select.appendChild(option);
                    });
                }
                
                console.log(`Seletor ${selectId} configurado com sucesso`);
                
            } catch (error) {
                console.error(`Erro ao configurar seletor ${selectId}:`, error);
            }
        });

        // Ocultar seletor de loja para gestor de Disk Chopp (só tem uma opção)
        if (segment === 'diskChopp') {
            const storeGroups = ['storeSelectGroup', 'reportStoreGroup', 'goalStoreGroup'];
            storeGroups.forEach(groupId => {
                const group = document.getElementById(groupId);
                if (group) {
                    group.style.display = 'none';
                }
            });
        }
    }

    // Dashboard
    updateDashboard() {
        console.log('Atualizando dashboard...');
        
        const summaryStats = document.getElementById('summaryStats');
        if (!summaryStats) {
            console.warn('Elemento summaryStats não encontrado');
            return;
        }
        
        const segment = this.currentUser?.segment;
        if (!segment) {
            console.warn('Usuário atual não definido');
            return;
        }
        
        try {
            if (segment === 'owner') {
                this.updateOwnerDashboard();
            } else {
                this.updateManagerDashboard(segment);
            }
            console.log('Dashboard atualizado com sucesso');
        } catch (error) {
            console.error('Erro ao atualizar dashboard:', error);
        }
    }

    updateOwnerDashboard() {
        const summaryStats = document.getElementById('summaryStats');
        if (!summaryStats) return;
        
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        console.log(`Atualizando dashboard do proprietário para ${currentMonth}/${currentYear}`);
        
        // Calcular totais para todos os segmentos
        const convTotal = this.calculateSegmentTotal('conveniences', currentMonth, currentYear);
        const petiTotal = this.calculateSegmentTotal('petiscarias', currentMonth, currentYear);
        const diskTotal = this.calculateSegmentTotal('diskChopp', currentMonth, currentYear);
        const totalGeral = convTotal + petiTotal + diskTotal;

        summaryStats.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">R$ ${this.formatCurrency(totalGeral)}</div>
                <div class="stat-label">Faturamento Total do Mês</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">R$ ${this.formatCurrency(convTotal)}</div>
                <div class="stat-label">Conveniências</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">R$ ${this.formatCurrency(petiTotal)}</div>
                <div class="stat-label">Petiscarias</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">R$ ${this.formatCurrency(diskTotal)}</div>
                <div class="stat-label">Disk Chopp</div>
            </div>
        `;
        
        console.log('Dashboard do proprietário atualizado:', {convTotal, petiTotal, diskTotal, totalGeral});
    }

    updateManagerDashboard(segment) {
        const summaryStats = document.getElementById('summaryStats');
        if (!summaryStats) return;
        
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        console.log(`Atualizando dashboard do gestor ${segment} para ${currentMonth}/${currentYear}`);
        
        const segmentTotal = this.calculateSegmentTotal(segment, currentMonth, currentYear);
        const dailyAverage = this.calculateSegmentDailyAverage(segment, currentMonth, currentYear);
        const monthlyProjection = this.calculateMonthlyProjection(dailyAverage, currentMonth, currentYear);
        const goalKey = `${segment}-${currentMonth}-${currentYear}`;
        const goal = this.monthlyGoals[goalKey] || 0;
        const goalProgress = goal > 0 ? (segmentTotal / goal * 100) : 0;

        summaryStats.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">R$ ${this.formatCurrency(segmentTotal)}</div>
                <div class="stat-label">Faturamento do Mês</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">R$ ${this.formatCurrency(dailyAverage)}</div>
                <div class="stat-label">Média Diária</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">R$ ${this.formatCurrency(monthlyProjection)}</div>
                <div class="stat-label">Projeção Mensal</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${goalProgress.toFixed(1)}%</div>
                <div class="stat-label">Meta do Mês</div>
            </div>
        `;
        
        console.log('Dashboard do gestor atualizado:', {segmentTotal, dailyAverage, monthlyProjection, goalProgress});
    }

    // CORREÇÃO: Cálculos corrigidos com tratamento adequado de datas
    calculateSegmentTotal(segment, month, year) {
        console.log(`Calculando total para ${segment}, ${month}/${year}`);
        
        let total = 0;
        const data = this.billingData[segment];
        
        if (!data) {
            console.warn(`Dados não encontrados para segmento: ${segment}`);
            return 0;
        }
        
        try {
            if (segment === 'diskChopp') {
                if (Array.isArray(data)) {
                    total = data.reduce((sum, entry) => {
                        return sum + this.calculateEntryAmountForMonth(entry, month, year);
                    }, 0);
                }
            } else {
                if (typeof data === 'object' && data !== null) {
                    Object.values(data).forEach(storeData => {
                        if (Array.isArray(storeData)) {
                            total += storeData.reduce((sum, entry) => {
                                return sum + this.calculateEntryAmountForMonth(entry, month, year);
                            }, 0);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao calcular total do segmento:', error);
            return 0;
        }
        
        console.log(`Total calculado para ${segment}: R$ ${total}`);
        return total;
    }

    // CORREÇÃO: Cálculo de média diária corrigido
    calculateSegmentDailyAverage(segment, month, year) {
        console.log(`Calculando média diária para ${segment}, ${month}/${year}`);
        
        const entries = this.getSegmentEntriesForMonth(segment, month, year);
        if (entries.length === 0) {
            console.log('Nenhuma entrada encontrada para cálculo de média');
            return 0;
        }
        
        let totalAmount = 0;
        let totalDays = 0;
        
        try {
            entries.forEach(entry => {
                if (!entry || !entry.startDate || !entry.endDate) {
                    console.warn('Entrada inválida encontrada:', entry);
                    return;
                }
                
                const entryStart = this.parseLocalDate(entry.startDate);
                const entryEnd = this.parseLocalDate(entry.endDate);
                
                if (!entryStart || !entryEnd) return;
                
                const monthStart = new Date(year, month - 1, 1);
                const monthEnd = new Date(year, month, 0);
                
                // Calcular apenas os dias que intersectam com o mês
                const intersectionStart = entryStart < monthStart ? monthStart : entryStart;
                const intersectionEnd = entryEnd > monthEnd ? monthEnd : entryEnd;
                
                const days = Math.ceil((intersectionEnd - intersectionStart) / (1000 * 60 * 60 * 24)) + 1;
                const amount = this.calculateEntryAmountForMonth(entry, month, year);
                
                totalAmount += amount;
                totalDays += Math.max(days, 0);
                
                console.log(`Entrada: R$ ${amount}, ${days} dias no mês`);
            });
            
            const average = totalDays > 0 ? totalAmount / totalDays : 0;
            console.log(`Média diária calculada: R$ ${average} (Total: R$ ${totalAmount}, Dias: ${totalDays})`);
            return average;
            
        } catch (error) {
            console.error('Erro ao calcular média diária:', error);
            return 0;
        }
    }

    calculateMonthlyProjection(dailyAverage, month, year) {
        if (!dailyAverage || dailyAverage <= 0) return 0;
        
        try {
            const daysInMonth = new Date(year, month, 0).getDate();
            const projection = dailyAverage * daysInMonth;
            console.log(`Projeção mensal: R$ ${projection} (${dailyAverage}/dia × ${daysInMonth} dias)`);
            return projection;
        } catch (error) {
            console.error('Erro ao calcular projeção mensal:', error);
            return 0;
        }
    }

    // CORREÇÃO: Função corrigida para buscar entradas de um mês
    getSegmentEntriesForMonth(segment, month, year) {
        console.log(`Buscando entradas para ${segment}, ${month}/${year}`);
        
        const data = this.billingData[segment];
        let entries = [];
        
        if (!data) {
            console.warn(`Dados não encontrados para segmento: ${segment}`);
            return [];
        }
        
        try {
            if (segment === 'diskChopp') {
                if (Array.isArray(data)) {
                    entries = data.filter(entry => {
                        return this.isEntryInMonth(entry, month, year);
                    });
                }
            } else {
                if (typeof data === 'object' && data !== null) {
                    Object.values(data).forEach(storeData => {
                        if (Array.isArray(storeData)) {
                            entries = entries.concat(storeData.filter(entry => {
                                return this.isEntryInMonth(entry, month, year);
                            }));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao buscar entradas do segmento:', error);
            return [];
        }
        
        console.log(`${entries.length} entradas encontradas para ${segment}`);
        return entries;
    }

    // Faturamento
    handleBillingSubmit(e) {
        e.preventDefault();
        console.log('Processando lançamento de faturamento...');
        
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const amountInput = document.getElementById('amount')?.value;
        const description = document.getElementById('description')?.value || '';
        
        if (!startDate || !endDate || !amountInput) {
            this.showNotification('Preencha todos os campos obrigatórios!', 'error');
            return;
        }
        
        const amount = parseFloat(amountInput);
        if (isNaN(amount) || amount <= 0) {
            this.showNotification('Digite um valor válido!', 'error');
            return;
        }
        
        let storeKey;
        if (this.currentUser.segment === 'diskChopp') {
            storeKey = 'delivery';
        } else {
            const storeSelect = document.getElementById('storeSelect');
            if (!storeSelect || !storeSelect.value) {
                this.showNotification('Selecione uma loja!', 'error');
                return;
            }
            storeKey = storeSelect.value.split('-')[1];
        }

        if (!this.validateDateRange(startDate, endDate)) {
            this.showNotification('Período de datas inválido!', 'error');
            return;
        }

        const entry = {
            id: Date.now() + Math.random(), // ID único
            startDate,
            endDate,
            amount,
            description,
            store: storeKey,
            createdAt: new Date().toISOString(),
            segment: this.currentUser.segment
        };

        console.log('Criando entrada:', entry);

        // Adicionar ao banco de dados
        try {
            if (this.currentUser.segment === 'diskChopp') {
                this.billingData.diskChopp.push(entry);
            } else {
                if (!this.billingData[this.currentUser.segment][storeKey]) {
                    this.billingData[this.currentUser.segment][storeKey] = [];
                }
                this.billingData[this.currentUser.segment][storeKey].push(entry);
            }

            // Salvar dados
            this.saveData('billingData', this.billingData);
            console.log('Dados salvos:', this.billingData);
            
            // Atualizar interface
            this.loadBillingHistory();
            this.updateDashboard();
            
            // Limpar formulário
            const form = document.getElementById('billingForm');
            if (form) {
                form.reset();
            }
            
            this.showNotification('Faturamento lançado com sucesso!', 'success');
            console.log('Lançamento concluído com sucesso');
            
        } catch (error) {
            console.error('Erro ao salvar faturamento:', error);
            this.showNotification('Erro ao salvar faturamento!', 'error');
        }
    }

    loadBillingHistory() {
        console.log('Carregando histórico de faturamento...');
        
        const historyContainer = document.getElementById('billingHistory');
        if (!historyContainer) {
            console.warn('Container de histórico não encontrado');
            return;
        }
        
        const segment = this.currentUser?.segment;
        if (!segment) {
            console.warn('Segmento do usuário não definido');
            return;
        }
        
        if (segment === 'owner') {
            historyContainer.innerHTML = '<p>Proprietário acessa apenas relatórios.</p>';
            return;
        }
        
        let entries = [];
        
        try {
            if (segment === 'diskChopp') {
                const diskData = this.billingData.diskChopp || [];
                entries = diskData.map(entry => ({
                    ...entry,
                    storeName: 'Delivery'
                }));
            } else {
                const segmentData = this.billingData[segment] || {};
                Object.entries(segmentData).forEach(([storeKey, storeData]) => {
                    if (Array.isArray(storeData)) {
                        const storeIndex = Object.keys(segmentData).indexOf(storeKey);
                        const storeName = this.storeConfig[segment] ? this.storeConfig[segment][storeIndex] : storeKey;
                        entries = entries.concat(storeData.map(entry => ({
                            ...entry,
                            storeName: storeName || storeKey
                        })));
                    }
                });
            }
            
            // Ordenar por data de criação (mais recente primeiro)
            entries.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.startDate);
                const dateB = new Date(b.createdAt || b.startDate);
                return dateB - dateA;
            });
            
            console.log(`${entries.length} entradas encontradas para ${segment}`);
            
            if (entries.length === 0) {
                historyContainer.innerHTML = '<p>Nenhum lançamento encontrado.</p>';
                return;
            }
            
            historyContainer.innerHTML = entries.map(entry => `
                <div class="billing-item">
                    <div class="billing-info">
                        <div class="billing-amount">R$ ${this.formatCurrency(parseFloat(entry.amount) || 0)}</div>
                        <div class="billing-period">${this.formatDate(entry.startDate)} a ${this.formatDate(entry.endDate)}</div>
                        <div class="billing-store">${entry.storeName}${entry.description ? ` - ${entry.description}` : ''}</div>
                    </div>
                    <div class="billing-actions">
                        <button class="btn-edit" onclick="app.editEntry('${entry.id}', '${segment}', '${entry.store}')">
                            ✏️
                        </button>
                        <button class="btn-delete" onclick="app.deleteEntry('${entry.id}', '${segment}', '${entry.store}')">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('');
            
            console.log('Histórico carregado com sucesso');
            
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            historyContainer.innerHTML = '<p>Erro ao carregar histórico.</p>';
        }
    }

    editEntry(id, segment, store) {
        console.log(`Editando entrada: ${id}, ${segment}, ${store}`);
        
        if (!id || !segment || !store) {
            console.error('Parâmetros inválidos para edição');
            this.showNotification('Erro: Parâmetros inválidos!', 'error');
            return;
        }
        
        let entry;
        
        try {
            if (segment === 'diskChopp') {
                const diskData = this.billingData.diskChopp || [];
                entry = diskData.find(e => e.id && e.id.toString() === id.toString());
            } else {
                const segmentData = this.billingData[segment] || {};
                const storeData = segmentData[store] || [];
                entry = storeData.find(e => e.id && e.id.toString() === id.toString());
            }
            
            if (!entry) {
                console.error('Entrada não encontrada:', {id, segment, store});
                this.showNotification('Entrada não encontrada!', 'error');
                return;
            }
            
            console.log('Entrada encontrada:', entry);
            
            this.editingEntry = { id, segment, store };
            
            // Preencher formulário de edição
            const editStartDate = document.getElementById('editStartDate');
            const editEndDate = document.getElementById('editEndDate');
            const editAmount = document.getElementById('editAmount');
            const editDescription = document.getElementById('editDescription');
            
            if (editStartDate) editStartDate.value = entry.startDate || '';
            if (editEndDate) editEndDate.value = entry.endDate || '';
            if (editAmount) editAmount.value = entry.amount || '';
            if (editDescription) editDescription.value = entry.description || '';
            
            // Mostrar modal
            const modal = document.getElementById('editModal');
            if (modal) {
                modal.classList.add('active');
            }
            
        } catch (error) {
            console.error('Erro ao editar entrada:', error);
            this.showNotification('Erro ao editar entrada!', 'error');
        }
    }

    handleEditSubmit(e) {
        e.preventDefault();
        console.log('Processando edição...');
        
        if (!this.editingEntry) {
            console.error('Nenhuma entrada sendo editada');
            return;
        }
        
        const startDateEl = document.getElementById('editStartDate');
        const endDateEl = document.getElementById('editEndDate');
        const amountEl = document.getElementById('editAmount');
        const descriptionEl = document.getElementById('editDescription');
        
        if (!startDateEl || !endDateEl || !amountEl) {
            console.error('Elementos do formulário de edição não encontrados');
            this.showNotification('Erro: Formulário inválido!', 'error');
            return;
        }
        
        const startDate = startDateEl.value;
        const endDate = endDateEl.value;
        const amountValue = amountEl.value;
        const description = descriptionEl ? descriptionEl.value : '';
        
        if (!startDate || !endDate || !amountValue) {
            this.showNotification('Preencha todos os campos obrigatórios!', 'error');
            return;
        }
        
        const amount = parseFloat(amountValue);
        if (isNaN(amount) || amount <= 0) {
            this.showNotification('Digite um valor válido!', 'error');
            return;
        }
        
        if (!this.validateDateRange(startDate, endDate)) {
            this.showNotification('Período de datas inválido!', 'error');
            return;
        }
        
        try {
            const { id, segment, store } = this.editingEntry;
            
            let entries;
            if (segment === 'diskChopp') {
                entries = this.billingData.diskChopp || [];
            } else {
                const segmentData = this.billingData[segment] || {};
                entries = segmentData[store] || [];
            }
            
            const entryIndex = entries.findIndex(e => e.id && e.id.toString() === id.toString());
            if (entryIndex === -1) {
                throw new Error('Entrada não encontrada para edição');
            }
            
            // Atualizar entrada
            entries[entryIndex] = {
                ...entries[entryIndex],
                startDate,
                endDate,
                amount,
                description,
                updatedAt: new Date().toISOString()
            };
            
            console.log('Entrada atualizada:', entries[entryIndex]);
            
            this.saveData('billingData', this.billingData);
            this.loadBillingHistory();
            this.updateDashboard();
            this.closeModal();
            
            this.showNotification('Lançamento atualizado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            this.showNotification('Erro ao salvar alterações!', 'error');
        }
    }

    deleteEntry(id, segment, store) {
        console.log(`Excluindo entrada: ${id}, ${segment}, ${store}`);
        
        if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
        
        if (!id || !segment || !store) {
            console.error('Parâmetros inválidos para exclusão');
            this.showNotification('Erro: Parâmetros inválidos!', 'error');
            return;
        }
        
        try {
            let entries;
            if (segment === 'diskChopp') {
                entries = this.billingData.diskChopp || [];
            } else {
                const segmentData = this.billingData[segment] || {};
                entries = segmentData[store] || [];
            }
            
            const entryIndex = entries.findIndex(e => e.id && e.id.toString() === id.toString());
            if (entryIndex === -1) {
                console.error('Entrada não encontrada para exclusão:', {id, segment, store});
                this.showNotification('Entrada não encontrada!', 'error');
                return;
            }
            
            // Remover entrada
            const removedEntry = entries.splice(entryIndex, 1)[0];
            console.log('Entrada removida:', removedEntry);
            
            this.saveData('billingData', this.billingData);
            this.loadBillingHistory();
            this.updateDashboard();
            
            this.showNotification('Lançamento excluído com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao excluir entrada:', error);
            this.showNotification('Erro ao excluir lançamento!', 'error');
        }
    }

    closeModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.editingEntry = null;
        console.log('Modal fechado');
    }

    // Relatórios
    generateReport() {
        console.log('Gerando relatório...');
        
        const reportStore = document.getElementById('reportStore')?.value;
        const reportMonth = document.getElementById('reportMonth')?.value;
        const resultsContainer = document.getElementById('reportResults');
        
        if (!resultsContainer) {
            console.warn('Container de resultados não encontrado');
            return;
        }
        
        if (!reportMonth) {
            this.showNotification('Selecione um mês para gerar o relatório!', 'error');
            return;
        }
        
        const [year, month] = reportMonth.split('-').map(Number);
        console.log(`Gerando relatório para ${month}/${year}, loja: ${reportStore}`);
        
        try {
            if (reportStore === 'all' && this.currentUser.segment === 'owner') {
                this.generateOwnerReport(month, year, resultsContainer);
            } else {
                this.generateSegmentReport(reportStore, month, year, resultsContainer);
            }
            console.log('Relatório gerado com sucesso');
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            this.showNotification('Erro ao gerar relatório!', 'error');
            resultsContainer.innerHTML = '<p>Erro ao gerar relatório.</p>';
        }
    }

    generateOwnerReport(month, year, container) {
        const segments = ['conveniences', 'petiscarias', 'diskChopp'];
        const segmentNames = {
            conveniences: 'Conveniências',
            petiscarias: 'Petiscarias',
            diskChopp: 'Disk Chopp'
        };
        
        let totalGeral = 0;
        let reportHtml = `<h3>Relatório Geral - ${this.getMonthName(month)}/${year}</h3>`;
        
        segments.forEach(segment => {
            const segmentTotal = this.calculateSegmentTotal(segment, month, year);
            const segmentAverage = this.calculateSegmentDailyAverage(segment, month, year);
            const segmentProjection = this.calculateMonthlyProjection(segmentAverage, month, year);
            
            totalGeral += segmentTotal;
            
            reportHtml += `
                <div class="report-segment" style="margin-bottom: 2rem;">
                    <h4 style="color: var(--royal-blue); margin-bottom: 1rem;">${segmentNames[segment]}</h4>
                    <div class="report-summary">
                        <div class="report-item">
                            <div class="report-value">R$ ${this.formatCurrency(segmentTotal)}</div>
                            <div class="report-label">Total do Período</div>
                        </div>
                        <div class="report-item">
                            <div class="report-value">R$ ${this.formatCurrency(segmentAverage)}</div>
                            <div class="report-label">Média Diária</div>
                        </div>
                        <div class="report-item">
                            <div class="report-value">R$ ${this.formatCurrency(segmentProjection)}</div>
                            <div class="report-label">Projeção Mensal</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Resumo geral
        const currentDay = new Date().getDate();
        const geralAverage = totalGeral > 0 ? totalGeral / currentDay : 0;
        const geralProjection = this.calculateMonthlyProjection(geralAverage, month, year);
        
        reportHtml = `
            <div class="report-summary">
                <div class="report-item">
                    <div class="report-value">R$ ${this.formatCurrency(totalGeral)}</div>
                    <div class="report-label">Total Geral</div>
                </div>
                <div class="report-item">
                    <div class="report-value">R$ ${this.formatCurrency(geralAverage)}</div>
                    <div class="report-label">Média Diária Geral</div>
                </div>
                <div class="report-item">
                    <div class="report-value">R$ ${this.formatCurrency(geralProjection)}</div>
                    <div class="report-label">Projeção Mensal Geral</div>
                </div>
            </div>
            <hr style="margin: 2rem 0; border: 1px solid var(--gray-200);">
        ` + reportHtml;
        
        container.innerHTML = reportHtml;
    }

    generateSegmentReport(storeValue, month, year, container) {
        if (!storeValue) {
            container.innerHTML = '<p>Selecione um segmento/loja.</p>';
            return;
        }
        
        const [segment, store] = storeValue.split('-');
        
        let entries = [];
        if (segment === 'diskChopp') {
            const diskData = this.billingData.diskChopp || [];
            entries = diskData.filter(entry => {
                return this.isEntryInMonth(entry, month, year);
            });
        } else {
            const segmentData = this.billingData[segment] || {};
            const storeData = segmentData[store] || [];
            entries = storeData.filter(entry => {
                return this.isEntryInMonth(entry, month, year);
            });
        }
        
        const total = entries.reduce((sum, entry) => sum + this.calculateEntryAmountForMonth(entry, month, year), 0);
        let totalDays = 0;
        
        entries.forEach(entry => {
            const entryStart = this.parseLocalDate(entry.startDate);
            const entryEnd = this.parseLocalDate(entry.endDate);
            
            if (!entryStart || !entryEnd) return;
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            const intersectionStart = entryStart < monthStart ? monthStart : entryStart;
            const intersectionEnd = entryEnd > monthEnd ? monthEnd : entryEnd;
            
            totalDays += Math.ceil((intersectionEnd - intersectionStart) / (1000 * 60 * 60 * 24)) + 1;
        });
        
        const dailyAverage = totalDays > 0 ? total / totalDays : 0;
        const monthlyProjection = this.calculateMonthlyProjection(dailyAverage, month, year);
        
        // Buscar meta
        const goalKey = `${segment}-${month}-${year}`;
        const goal = this.monthlyGoals[goalKey] || 0;
        const goalProgress = goal > 0 ? (total / goal * 100) : 0;
        
        container.innerHTML = `
            <h3>Relatório - ${this.getStoreName(segment, store)} - ${this.getMonthName(month)}/${year}</h3>
            
            <div class="report-summary">
                <div class="report-item">
                    <div class="report-value">R$ ${this.formatCurrency(total)}</div>
                    <div class="report-label">Total do Período</div>
                </div>
                <div class="report-item">
                    <div class="report-value">R$ ${this.formatCurrency(dailyAverage)}</div>
                    <div class="report-label">Média Diária</div>
                </div>
                <div class="report-item">
                    <div class="report-value">R$ ${this.formatCurrency(monthlyProjection)}</div>
                    <div class="report-label">Projeção Mensal</div>
                </div>
                <div class="report-item">
                    <div class="report-value">${goalProgress.toFixed(1)}%</div>
                    <div class="report-label">Progresso da Meta</div>
                </div>
            </div>
            
            <h4 style="margin-top: 2rem; margin-bottom: 1rem;">Lançamentos do Período</h4>
            <div class="billing-history">
                ${entries.length > 0 ? entries.map(entry => `
                    <div class="billing-item">
                        <div class="billing-info">
                            <div class="billing-amount">R$ ${this.formatCurrency(parseFloat(entry.amount) || 0)}</div>
                            <div class="billing-period">${this.formatDate(entry.startDate)} a ${this.formatDate(entry.endDate)}</div>
                            ${entry.description ? `<div class="billing-store">${entry.description}</div>` : ''}
                        </div>
                    </div>
                `).join('') : '<p>Nenhum lançamento encontrado no período.</p>'}
            </div>
        `;
    }

    // Metas
    saveGoal() {
        console.log('Salvando meta...');
        
        const goalStoreEl = document.getElementById('goalStore');
        const goalMonthEl = document.getElementById('goalMonth');
        const goalAmountEl = document.getElementById('goalAmount');
        
        if (!goalStoreEl || !goalMonthEl || !goalAmountEl) {
            console.error('Elementos de meta não encontrados');
            this.showNotification('Erro: Elementos do formulário não encontrados!', 'error');
            return;
        }
        
        const goalStore = goalStoreEl.value;
        const goalMonth = goalMonthEl.value;
        const goalAmountValue = goalAmountEl.value;
        
        if (!goalStore || !goalMonth || !goalAmountValue) {
            this.showNotification('Preencha todos os campos da meta!', 'error');
            return;
        }
        
        const goalAmount = parseFloat(goalAmountValue);
        if (isNaN(goalAmount) || goalAmount <= 0) {
            this.showNotification('Digite um valor válido para a meta!', 'error');
            return;
        }
        
        try {
            const [year, month] = goalMonth.split('-').map(Number);
            const [segment] = goalStore.split('-');
            const goalKey = `${segment}-${month}-${year}`;
            
            this.monthlyGoals[goalKey] = goalAmount;
            this.saveData('monthlyGoals', this.monthlyGoals);
            
            console.log(`Meta salva: ${goalKey} = R$ ${goalAmount}`);
            
            this.loadGoals();
            this.updateDashboard();
            
            // Limpar formulário
            goalAmountEl.value = '';
            
            this.showNotification('Meta salva com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar meta:', error);
            this.showNotification('Erro ao salvar meta!', 'error');
        }
    }

    loadGoals() {
        console.log('Carregando metas...');
        
        const goalsList = document.getElementById('goalsList');
        if (!goalsList) {
            console.warn('Lista de metas não encontrada');
            return;
        }
        
        const segment = this.currentUser?.segment;
        if (!segment) {
            console.warn('Segmento do usuário não definido');
            return;
        }
        
        let relevantGoals = [];
        
        try {
            if (segment === 'owner') {
                relevantGoals = Object.entries(this.monthlyGoals);
            } else {
                relevantGoals = Object.entries(this.monthlyGoals).filter(([key]) => 
                    key.startsWith(segment)
                );
            }
            
            console.log(`${relevantGoals.length} metas encontradas para ${segment}`);
            
            if (relevantGoals.length === 0) {
                goalsList.innerHTML = '<p>Nenhuma meta cadastrada.</p>';
                return;
            }
            
            goalsList.innerHTML = relevantGoals.map(([key, goalAmount]) => {
                const [goalSegment, month, year] = key.split('-');
                const actualAmount = this.calculateSegmentTotal(goalSegment, parseInt(month), parseInt(year));
                const progress = goalAmount > 0 ? (actualAmount / goalAmount * 100) : 0;
                
                return `
                    <div class="goal-item">
                        <div class="goal-header">
                            <div class="goal-title">
                                ${this.getSegmentName(goalSegment)} - ${this.getMonthName(parseInt(month))}/${year}
                            </div>
                            <button class="btn-delete" onclick="app.deleteGoal('${key}')">🗑️</button>
                        </div>
                        <div class="goal-progress">
                            <div class="goal-progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
                        </div>
                        <div class="goal-stats">
                            <span>R$ ${this.formatCurrency(actualAmount)} / R$ ${this.formatCurrency(goalAmount)}</span>
                            <span>${progress.toFixed(1)}%</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            console.log('Metas carregadas com sucesso');
        } catch (error) {
            console.error('Erro ao carregar metas:', error);
            goalsList.innerHTML = '<p>Erro ao carregar metas.</p>';
        }
    }

    deleteGoal(key) {
        if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
        
        try {
            delete this.monthlyGoals[key];
            this.saveData('monthlyGoals', this.monthlyGoals);
            this.loadGoals();
            this.updateDashboard();
            
            console.log(`Meta excluída: ${key}`);
            this.showNotification('Meta excluída com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao excluir meta:', error);
            this.showNotification('Erro ao excluir meta!', 'error');
        }
    }

    // Navegação
    showSection(section) {
        console.log('Mostrando seção:', section);
        
        // Atualizar navegação
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            if (btn && btn.classList) {
                btn.classList.remove('active');
            }
        });
        
        const activeBtn = document.querySelector(`[data-section="${section}"]`);
        if (activeBtn && activeBtn.classList) {
            activeBtn.classList.add('active');
        }
        
        // Mostrar seção
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(sec => {
            if (sec && sec.classList) {
                sec.classList.remove('active');
            }
        });
        
        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection && targetSection.classList) {
            targetSection.classList.add('active');
        }
        
        // Carregar dados específicos da seção
        if (section === 'reports') {
            this.initReportsSection();
        } else if (section === 'goals') {
            this.loadGoals();
        } else if (section === 'billing') {
            this.initBillingSection();
        } else if (section === 'dashboard') {
            this.updateDashboard();
        }
    }

    initReportsSection() {
        console.log('Inicializando seção de relatórios...');
        
        try {
            const currentDate = new Date();
            const monthInput = document.getElementById('reportMonth');
            if (monthInput) {
                const monthValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                monthInput.value = monthValue;
                console.log('Mês padrão definido:', monthValue);
            } else {
                console.warn('Campo reportMonth não encontrado');
            }
        } catch (error) {
            console.error('Erro ao inicializar seção de relatórios:', error);
        }
    }

    initBillingSection() {
        console.log('Inicializando seção de faturamento...');
        
        try {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            const startDateEl = document.getElementById('startDate');
            const endDateEl = document.getElementById('endDate');
            
            if (startDateEl) {
                startDateEl.value = weekStart.toISOString().split('T')[0];
                console.log('Data início definida:', startDateEl.value);
            } else {
                console.warn('Campo startDate não encontrado');
            }
            
            if (endDateEl) {
                endDateEl.value = weekEnd.toISOString().split('T')[0];
                console.log('Data fim definida:', endDateEl.value);
            } else {
                console.warn('Campo endDate não encontrado');
            }
            
            // Carregar histórico
            this.loadBillingHistory();
            
        } catch (error) {
            console.error('Erro ao inicializar seção de faturamento:', error);
        }
    }

    // NOVO: Métodos de gerenciamento usando storage robusto
    exportData() {
        this.storage.exportData();
        this.showNotification('Dados exportados com sucesso!', 'success');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.storage.importData(e.target.result)) {
                // Recarregar dados
                this.billingData = this.storage.loadData('billingData') || this.billingData;
                this.monthlyGoals = this.storage.loadData('monthlyGoals') || this.monthlyGoals;
                
                // Atualizar interface
                this.updateDashboard();
                this.loadBillingHistory();
                this.loadGoals();
                
                this.showNotification('Dados importados com sucesso!', 'success');
            } else {
                this.showNotification('Erro ao importar dados!', 'error');
            }
        };
        reader.readAsText(file);
    }

    createManualBackup() {
        this.storage.createBackup();
        this.showNotification('Backup criado com sucesso!', 'success');
    }

    showStorageStats() {
        const stats = this.storage.debugInfo();
        
        const statsHtml = `
            <div class="storage-stats-modal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 1000;
                display: flex; align-items: center; justify-content: center;
            ">
                <div style="
                    background: white; padding: 30px; border-radius: 12px; 
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 600px; width: 90%;
                    max-height: 80vh; overflow-y: auto;
                ">
                    <h3 style="margin-top: 0; color: #2196F3; text-align: center;">📊 Estatísticas do Sistema de Armazenamento</h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0;">
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #2196F3, #21CBF3); color: white; border-radius: 8px;">
                            <div style="font-size: 1.8em; font-weight: bold;">${this.storage.formatBytes(stats.usage)}</div>
                            <div style="font-size: 0.9em; opacity: 0.9;">Espaço Usado</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, ${stats.usagePercentage > 80 ? '#f44336, #ff5722' : '#4CAF50, #8BC34A'}); color: white; border-radius: 8px;">
                            <div style="font-size: 1.8em; font-weight: bold;">${stats.usagePercentage.toFixed(1)}%</div>
                            <div style="font-size: 0.9em; opacity: 0.9;">Capacidade</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #FF9800, #FFC107); color: white; border-radius: 8px;">
                            <div style="font-size: 1.8em; font-weight: bold;">${stats.totalEntries}</div>
                            <div style="font-size: 0.9em; opacity: 0.9;">Lançamentos</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #9C27B0, #E91E63); color: white; border-radius: 8px;">
                            <div style="font-size: 1.8em; font-weight: bold;">${stats.backupCount}</div>
                            <div style="font-size: 0.9em; opacity: 0.9;">Backups</div>
                        </div>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #555;">🔧 Informações Técnicas</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9em;">
                            <div><strong>Versão:</strong> ${stats.version}</div>
                            <div><strong>Compressão:</strong> ${stats.compressionEnabled ? 'Ativa' : 'Desativa'}</div>
                            <div><strong>Arquivos:</strong> ${stats.archiveCount}</div>
                            <div><strong>Último Backup:</strong> ${stats.lastBackup ? new Date(parseInt(stats.lastBackup)).toLocaleString('pt-BR') : 'Nunca'}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px; flex-wrap: wrap;">
                        <button onclick="app.exportData()" style="
                            padding: 12px 20px; background: #2196F3; color: white; border: none; 
                            border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.3s;
                        " onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">
                            📤 Exportar Dados
                        </button>
                        <button onclick="app.createManualBackup()" style="
                            padding: 12px 20px; background: #4CAF50; color: white; border: none; 
                            border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.3s;
                        " onmouseover="this.style.background='#388E3C'" onmouseout="this.style.background='#4CAF50'">
                            💾 Criar Backup
                        </button>
                        <button onclick="app.storage.cleanupStorage(); app.showNotification('Limpeza concluída!', 'success')" style="
                            padding: 12px 20px; background: #FF9800; color: white; border: none; 
                            border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.3s;
                        " onmouseover="this.style.background='#F57C00'" onmouseout="this.style.background='#FF9800'">
                            🧹 Limpar Cache
                        </button>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                            padding: 12px 20px; background: #f44336; color: white; border: none; 
                            border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.3s;
                        " onmouseover="this.style.background='#D32F2F'" onmouseout="this.style.background='#f44336'">
                            ✖ Fechar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', statsHtml);
    }

    // Utilitários
    formatCurrency(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return '0,00';
        }
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    // CORREÇÃO: Formatação de datas consistente
    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = this.parseLocalDate(dateStr);
            if (!date || isNaN(date.getTime())) return '';
            return date.toLocaleDateString('pt-BR');
        } catch (error) {
            console.warn('Erro ao formatar data:', dateStr, error);
            return '';
        }
    }

    getMonthName(month) {
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return monthNames[month - 1] || '';
    }

    getSegmentName(segment) {
        const names = {
            conveniences: 'Conveniências',
            petiscarias: 'Petiscarias',
            diskChopp: 'Disk Chopp'
        };
        return names[segment] || segment;
    }

    getStoreName(segment, store) {
        if (segment === 'diskChopp') return 'Disk Chopp - Delivery';
        
        const storeIndex = parseInt(store.replace('loja', '')) - 1;
        const segmentName = this.getSegmentName(segment);
        const storeName = this.storeConfig[segment] ? this.storeConfig[segment][storeIndex] : store;
        
        return `${segmentName} - ${storeName || store}`;
    }

    updateCurrentDate() {
        try {
            const now = new Date();
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'America/Sao_Paulo'
            };
            
            const dateElement = document.getElementById('currentDate');
            if (dateElement) {
                dateElement.textContent = now.toLocaleDateString('pt-BR', options);
            }
            
            // Atualizar a cada minuto
            setTimeout(() => this.updateCurrentDate(), 60000);
        } catch (error) {
            console.error('Erro ao atualizar data:', error);
        }
    }

    // Notificações
    showNotification(message, type = 'success') {
        console.log(`Notificação (${type}): ${message}`);
        
        try {
            const container = document.getElementById('notifications');
            if (!container) {
                console.warn('Container de notificações não encontrado');
                return;
            }
            
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            const content = document.createElement('div');
            content.className = 'notification-content';
            content.textContent = message;
            
            notification.appendChild(content);
            container.appendChild(notification);
            
            // Mostrar animação
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            // Remover após 4 segundos
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 400);
            }, 4000);
            
        } catch (error) {
            console.error('Erro ao mostrar notificação:', error);
            // Fallback para alert
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    // MODIFICADO: Usar sistema robusto
    saveData(key, data) {
        return this.storage.saveData(key, data);
    }

    loadData(key) {
        return this.storage.loadData(key);
    }

    // CORREÇÃO: Validação de datas aprimorada
    validateDateRange(startDate = null, endDate = null) {
        try {
            const start = startDate || document.getElementById('startDate')?.value;
            const end = endDate || document.getElementById('endDate')?.value;
            
            if (!start || !end) {
                console.warn('Datas não fornecidas para validação');
                return false;
            }
            
            const startDateObj = this.parseLocalDate(start);
            const endDateObj = this.parseLocalDate(end);
            const minDate = new Date(2025, 5, 1); // 01/06/2025 (mês 5 = junho)
            const maxDate = new Date(2028, 11, 31); // 31/12/2028
            
            // Verificar se as datas são válidas
            if (!startDateObj || !endDateObj || isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                console.warn('Datas inválidas:', {start, end});
                return false;
            }
            
            // Verificar limites do sistema
            if (startDateObj < minDate || endDateObj > maxDate) {
                console.warn('Datas fora do limite permitido:', {start, end, minDate, maxDate});
                return false;
            }
            
            // Verificar se data inicial é menor ou igual à final
            if (startDateObj > endDateObj) {
                console.warn('Data inicial maior que data final:', {start, end});
                return false;
            }
            
            // Verificar se o período não é muito longo (máximo 1 ano)
            const diffTime = endDateObj.getTime() - startDateObj.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 365) {
                console.warn('Período muito longo:', diffDays, 'dias');
                return false;
            }
            
            console.log('Validação de datas aprovada:', {start, end, diffDays});
            return true;
            
        } catch (error) {
            console.error('Erro na validação de datas:', error);
            return false;
        }
    }
}

// Inicializar aplicação
let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Ice Beer Management com sistema robusto...');
    try {
        app = new IceBeerManagement();
        console.log('✅ Sistema inicializado com sucesso');
        
        // Exibir estatísticas iniciais após 2 segundos
        setTimeout(() => {
            console.log('📊 Estatísticas do sistema:');
            app.storage.debugInfo();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Erro ao inicializar:', error);
        alert('Erro ao inicializar sistema. Verifique o console.');
    }
});

// NOVO: Funções globais para debug e gerenciamento
window.iceDebug = {
    stats: () => app?.storage?.debugInfo(),
    export: () => app?.exportData(),
    backup: () => app?.createManualBackup(),
    cleanup: () => app?.storage?.cleanupStorage(),
    showStats: () => app?.showStorageStats(),
    archive: () => app?.storage?.archiveOldData()
};