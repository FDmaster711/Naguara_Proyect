// Ventasss.js - Sistema de Ventas Paso a Paso Mejorado
class VentasManager {
    constructor() {
        this.currentCustomer = null;
        this.cart = [];
        this.products = [];
        this.selectedPaymentMethod = null;
        this.lastSaleId = null;
        this.empresaData = null;
        this.tasaCambio = 216.37;
        this.currentStep = 1;
        this.paymentDetails = {};
        
        this.init();
    }

    init() {
        console.log('🚀 Inicializando módulo de ventas paso a paso...');
        this.setCurrentDate();
        this.setupEventListeners();
        this.checkAuthentication();
        this.loadTasaCambio();
        this.loadProducts();
        this.updateStepIndicator();
        this.loadEmpresaData();
    }

    async loadTasaCambio() {
    try {
        console.log('💰 Cargando tasa de cambio...');
        const response = await fetch('/api/tasa-cambio/actual');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        this.tasaCambio = parseFloat(data.tasa_bs);
        
        this.updateTasaDisplay();
        console.log('✅ Tasa de cambio cargada:', this.tasaCambio);
        
    } catch (error) {
        console.error('❌ Error cargando tasa:', error);
        this.tasaCambio = 216.37; // Fallback
        this.updateTasaDisplay();
    }
}

updateTasaDisplay() {
    // Intentar diferentes IDs posibles
    const possibleIds = ['tasa-display', 'tasa-actual', 'exchange-rate'];
    
    for (const id of possibleIds) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = this.tasaCambio.toFixed(2);
            console.log(`✅ Tasa mostrada en elemento: #${id}`);
            return;
        }
    }
    
    console.warn('⚠️ No se encontró ningún elemento para mostrar la tasa de cambio');
}

    bsToUsd(amountBs) {
        return parseFloat((amountBs / this.tasaCambio).toFixed(2));
    }

    usdToBs(amountUsd) {
        return parseFloat((amountUsd * this.tasaCambio).toFixed(2));
    }

    async loadEmpresaData() {
        try {
            const response = await fetch('/api/empresa', {
                credentials: 'include'
            });
            if (response.ok) {
                this.empresaData = await response.json();
                console.log('🏢 Datos de empresa cargados:', this.empresaData);
            }
        } catch (error) {
            console.error('Error cargando datos empresa:', error);
            this.empresaData = {
                nombre_empresa: "Na'Guara",
                rif: "J-123456789",
                telefono: "(0412) 123-4567",
                direccion: "Barquisimeto, Venezuela",
                mensaje_factura: "¡Gracias por su compra!"
            };
        }
    }

    checkAuthentication() {
        fetch('/api/me')
            .then(response => {
                if (!response.ok) {
                    window.location.href = '/login.html';
                }
            })
            .catch(error => {
                console.error('Error de autenticación:', error);
                window.location.href = '/login.html';
            });
    }

    setCurrentDate() {
        const now = new Date();
        const formattedDate = now.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        document.getElementById('current-date').textContent = formattedDate;
        
        const saleNumber = 'VEN-' + now.getTime().toString().slice(-6);
        document.getElementById('sale-number').textContent = saleNumber;
    }

    setupEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        // Paso 1: Identificación del Cliente
        const customerIdInput = document.getElementById('customer-id');
        if (customerIdInput) {
            customerIdInput.addEventListener('blur', (e) => this.searchCustomer(e.target.value));
            customerIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchCustomer(e.target.value);
            });
            customerIdInput.addEventListener('input', (e) => this.validateCedulaFormat(e.target.value));
        }

        document.getElementById('save-customer')?.addEventListener('click', () => this.saveCustomer());

        // Paso 2: Búsqueda de Productos
        const productSearch = document.getElementById('product-search');
        if (productSearch) {
            productSearch.addEventListener('input', (e) => {
                this.searchProducts(e.target.value);
            });
            
            productSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    this.handleProductSearch(e.target.value);
                }
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.autocomplete-container')) {
                    document.getElementById('product-suggestions').classList.add('hidden');
                }
            });
        }

        // Paso 3: Métodos de Pago
        this.setupPaymentMethods();

        // Botones de Acción
        document.getElementById('process-sale')?.addEventListener('click', () => this.processSale());
        document.getElementById('new-sale')?.addEventListener('click', () => this.newSale());
        document.getElementById('cancel-sale')?.addEventListener('click', () => this.cancelSale());
        document.getElementById('close-cash-register')?.addEventListener('click', () => this.openCashClose());

        // Modales de Pago
        this.setupPaymentModals();

        // Modales Generales
        this.setupModalEvents();

          document.getElementById('close-cash-register')?.addEventListener('click', () => this.openCashClose());
    document.getElementById('close-cash-register-modal')?.addEventListener('click', () => this.hideModal('cash-register-modal'));
    document.getElementById('calculate-close')?.addEventListener('click', () => this.calculateCashClose());
    document.getElementById('process-close')?.addEventListener('click', () => this.processCashClose());
    
    // Calcular diferencia en tiempo real
    document.getElementById('initial-cash')?.addEventListener('input', () => this.calculateDifference());
    document.getElementById('final-cash-counted')?.addEventListener('input', () => this.calculateDifference());

        console.log('✅ Event listeners configurados');
    }

    setupPaymentMethods() {
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const method = e.currentTarget.dataset.method;
                this.selectPaymentMethod(method);
            });
        });
    }

    selectPaymentMethod(method) {
        console.log('💳 Método de pago seleccionado:', method);
        this.selectedPaymentMethod = method;
        
        // Remover clases activas de todos los botones
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-purple-100', 'border-purple-300', 'ring-2', 'ring-purple-500');
        });
        
        // Activar botón seleccionado
        const selectedBtn = document.querySelector(`[data-method="${method}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active', 'bg-purple-100', 'border-purple-300', 'ring-2', 'ring-purple-500');
        }

        // Mostrar detalles del método de pago
        this.showPaymentDetails(method);
        
        // Avanzar al siguiente paso si hay productos en el carrito
        if (this.cart.length > 0) {
            this.goToStep(4);
        }
    }

    calculateCashClose() {
    this.updateCloseCashDisplay();
    this.showAlert('Cálculo completado', 'success');
}

calculateDifference() {
    const initialCash = parseFloat(document.getElementById('initial-cash').value) || 0;
    const finalCashCounted = parseFloat(document.getElementById('final-cash-counted').value) || 0;
    const expectedCash = initialCash + (this.dailySalesSummary?.efectivo || 0);
    const difference = finalCashCounted - expectedCash;

    const differenceElement = document.getElementById('close-difference');
    const container = document.getElementById('close-difference-container');

    differenceElement.textContent = `Bs. ${difference.toFixed(2)}`;

    // Aplicar estilos según la diferencia
    container.className = 'flex justify-between font-bold text-lg';
    if (difference > 0) {
        differenceElement.className = 'text-green-600';
    } else if (difference < 0) {
        differenceElement.className = 'text-red-600';
    } else {
        differenceElement.className = 'text-gray-600';
    }
}

async processCashClose() {
    try {
        const initialCash = parseFloat(document.getElementById('initial-cash')?.value) || 0;
        const finalCashCounted = parseFloat(document.getElementById('final-cash-counted')?.value) || 0;
        const fecha = document.getElementById('close-date').value;

        // Validaciones
        if (!fecha) {
            this.showAlert('Debe seleccionar una fecha');
            return;
        }

        if (finalCashCounted === 0) {
            this.showAlert('Debe ingresar el efectivo final contado');
            return;
        }

        const expectedCash = initialCash + (this.dailySalesSummary?.efectivo || 0);
        const diferencia = finalCashCounted - expectedCash;

        console.log('💳 Procesando cierre de caja...');

        const closeData = {
            fecha: fecha,
            usuario_id: await this.getCurrentUserId(),
            efectivo_inicial: initialCash,
            efectivo_final: finalCashCounted,
            total_ventas: this.dailySalesSummary?.total || 0,
            total_ventas_efectivo: this.dailySalesSummary?.efectivo || 0,
            total_ventas_tarjeta: this.dailySalesSummary?.tarjeta || 0,
            total_ventas_transferencia: this.dailySalesSummary?.transferencia || 0,
            total_ventas_pago_movil: this.dailySalesSummary?.pago_movil || 0,
            diferencia: diferencia
        };

        const response = await fetch('/api/cierre-caja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(closeData)
        });

        if (response.ok) {
            const result = await response.json();
            this.showAlert('✅ Cierre de caja procesado exitosamente!', 'success');
            this.hideModal('cash-register-modal');
            
            // Limpiar formulario
            document.getElementById('initial-cash').value = '';
            document.getElementById('final-cash-counted').value = '';
            
        } else if (response.status === 409) {
            const error = await response.json();
            this.showAlert(
                `❌ Ya existe un cierre de caja para hoy.\n\n` +
                `No puedes realizar más de un cierre por día.`,
                'warning'
            );
        } else {
            const error = await response.json();
            this.showAlert(error.error || 'Error al procesar el cierre de caja');
        }
    } catch (error) {
        console.error('Error procesando cierre de caja:', error);
        this.showAlert('Error de conexión al procesar el cierre de caja');
    }
}

async getCurrentUserId() {
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
            const user = await response.json();
            return user.id;
        }
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
    }
    return 1; // Fallback
}

    showPaymentDetails(method) {
        const paymentDetails = document.getElementById('payment-details');
        
        switch(method) {
            case 'efectivo_bs':
                paymentDetails.innerHTML = `
                    <div class="text-center p-4 bg-green-50 rounded-lg">
                        <i class="fas fa-money-bill-wave text-3xl text-green-600 mb-2"></i>
                        <p class="font-semibold text-green-800">Pago en Efectivo (Bolívares)</p>
                        <p class="text-sm text-green-600 mt-2">El cliente pagará en efectivo en bolívares</p>
                        <button onclick="ventasManager.openEfectivoBsModal()" class="mt-3 btn-primary">
                            <i class="fas fa-calculator mr-2"></i>Calcular Cambio
                        </button>
                    </div>
                `;
                break;
                
            case 'efectivo_usd':
                paymentDetails.innerHTML = `
                    <div class="text-center p-4 bg-blue-50 rounded-lg">
                        <i class="fas fa-dollar-sign text-3xl text-blue-600 mb-2"></i>
                        <p class="font-semibold text-blue-800">Pago en Efectivo (Dólares)</p>
                        <p class="text-sm text-blue-600 mt-2">El cliente pagará en efectivo en dólares</p>
                        <button onclick="ventasManager.openEfectivoUsdModal()" class="mt-3 btn-primary">
                            <i class="fas fa-calculator mr-2"></i>Calcular Cambio
                        </button>
                    </div>
                `;
                break;
                
            case 'punto_venta':
                paymentDetails.innerHTML = `
                    <div class="text-center p-4 bg-purple-50 rounded-lg">
                        <i class="fas fa-credit-card text-3xl text-purple-600 mb-2"></i>
                        <p class="font-semibold text-purple-800">Pago con Tarjeta/Punto de Venta</p>
                        <p class="text-sm text-purple-600 mt-2">Transacción con tarjeta de débito/crédito</p>
                        <button onclick="ventasManager.openPuntoVentaModal()" class="mt-3 btn-primary">
                            <i class="fas fa-credit-card mr-2"></i>Ingresar Datos
                        </button>
                    </div>
                `;
                break;
                
            case 'transferencia':
            case 'pago_movil':
                paymentDetails.innerHTML = `
                    <div class="text-center p-4 bg-indigo-50 rounded-lg">
                        <i class="fas fa-university text-3xl text-indigo-600 mb-2"></i>
                        <p class="font-semibold text-indigo-800">Pago por ${method === 'transferencia' ? 'Transferencia' : 'Pago Móvil'}</p>
                        <p class="text-sm text-indigo-600 mt-2">Transacción bancaria electrónica</p>
                        <button onclick="ventasManager.openTransferModal('${method}')" class="mt-3 btn-primary">
                            <i class="fas fa-university mr-2"></i>Ingresar Datos
                        </button>
                    </div>
                `;
                break;
                
            case 'mixto':
                paymentDetails.innerHTML = `
                    <div class="text-center p-4 bg-yellow-50 rounded-lg">
                        <i class="fas fa-coins text-3xl text-yellow-600 mb-2"></i>
                        <p class="font-semibold text-yellow-800">Pago Mixto</p>
                        <p class="text-sm text-yellow-600 mt-2">Combinación de varios métodos de pago</p>
                        <button onclick="ventasManager.openMixedPaymentModal()" class="mt-3 btn-primary">
                            <i class="fas fa-cog mr-2"></i>Configurar Pagos
                        </button>
                    </div>
                `;
                break;
                
            default:
                paymentDetails.innerHTML = `
                    <div class="text-center text-gray-500 py-8">
                        <i class="fas fa-hand-pointer text-4xl mb-2"></i>
                        <p>Seleccione un método de pago para continuar</p>
                    </div>
                `;
        }
    }

    setupPaymentModals() {
        // Modal Efectivo BS
        document.getElementById('confirm-ef-b')?.addEventListener('click', () => this.confirmEfectivoBs());
        document.getElementById('cancel-ef-b')?.addEventListener('click', () => this.hideModal('efectivo-bs-modal'));
        document.getElementById('close-efectivo-bs')?.addEventListener('click', () => this.hideModal('efectivo-bs-modal'));
        
        document.getElementById('ef-bs-received')?.addEventListener('input', (e) => {
            this.calculateEfectivoBsChange(e.target.value);
        });

        // Modal Efectivo USD
        document.getElementById('confirm-ef-usd')?.addEventListener('click', () => this.confirmEfectivoUsd());
        document.getElementById('cancel-ef-usd')?.addEventListener('click', () => this.hideModal('efectivo-usd-modal'));
        document.getElementById('close-efectivo-usd')?.addEventListener('click', () => this.hideModal('efectivo-usd-modal'));
        
        document.getElementById('ef-usd-received')?.addEventListener('input', (e) => {
            this.calculateEfectivoUsdChange(e.target.value);
        });

        // Modal Punto de Venta
        document.getElementById('confirm-pv')?.addEventListener('click', () => this.confirmPuntoVenta());
        document.getElementById('cancel-pv')?.addEventListener('click', () => this.hideModal('punto-venta-modal'));
        document.getElementById('close-punto')?.addEventListener('click', () => this.hideModal('punto-venta-modal'));

        // Modal Transferencia/Pago Móvil
        document.getElementById('confirm-transfer')?.addEventListener('click', () => this.confirmTransfer());
        document.getElementById('cancel-transfer')?.addEventListener('click', () => this.hideModal('transfer-details-modal'));
        document.getElementById('close-transfer-modal')?.addEventListener('click', () => this.hideModal('transfer-details-modal'));

        // Modal Pago Mixto
        document.getElementById('confirm-mixed')?.addEventListener('click', () => this.confirmMixedPayment());
        document.getElementById('cancel-mixed')?.addEventListener('click', () => this.hideModal('mixed-payment-modal'));
        document.getElementById('close-mixed-modal')?.addEventListener('click', () => this.hideModal('mixed-payment-modal'));
    }

    setupModalEvents() {
        // Modal de Alertas
        document.getElementById('close-alert-modal')?.addEventListener('click', () => {
            this.hideModal('alert-modal');
        });

        document.getElementById('confirm-alert')?.addEventListener('click', () => {
            this.hideModal('alert-modal');
        });

        // Modal de Confirmación
        document.getElementById('close-confirm-modal')?.addEventListener('click', () => {
            this.hideModal('confirm-modal');
        });

        document.getElementById('cancel-confirm')?.addEventListener('click', () => {
            this.hideModal('confirm-modal');
        });

        document.getElementById('accept-confirm')?.addEventListener('click', () => {
            this.executeConfirmedAction();
        });

        // Modal de Factura
        document.getElementById('close-invoice')?.addEventListener('click', () => this.hideModal('invoice-modal'));
        document.getElementById('print-invoice')?.addEventListener('click', () => this.printInvoice());
        document.getElementById('new-sale-after-invoice')?.addEventListener('click', () => this.newSale());

        // Cerrar modales al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });

        // Cerrar modales con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    // ==================== GESTIÓN DE PASOS ====================

    goToStep(step) {
        if (step < 1 || step > 5) return;
        
        this.currentStep = step;
        this.updateStepIndicator();
        
        // Aquí puedes agregar lógica específica para cada paso
        switch(step) {
            case 1:
                document.getElementById('customer-id').focus();
                break;
            case 2:
                document.getElementById('product-search').focus();
                break;
            case 3:
                this.updateSaleSummary();
                break;
            case 4:
                if (!this.selectedPaymentMethod) {
                    this.showAlert('Seleccione un método de pago');
                    return;
                }
                break;
            case 5:
                this.showProcessSaleButton();
                break;
        }
    }

    updateStepIndicator() {
        // Actualizar indicadores visuales
        for (let i = 1; i <= 5; i++) {
            const stepElement = document.getElementById(`step-${i}`);
            if (stepElement) {
                stepElement.classList.remove('active', 'completed', 'pending');
                if (i < this.currentStep) {
                    stepElement.classList.add('completed');
                } else if (i === this.currentStep) {
                    stepElement.classList.add('active');
                } else {
                    stepElement.classList.add('pending');
                }
            }
        }
    }

    // ==================== GESTIÓN DE CLIENTES (Mismo código que antes) ====================

    validateCedulaFormat(cedula) {
        if (!cedula || cedula.trim() === '') {
            this.clearValidationStyles();
            return false;
        }

        const cedulaPattern = /^[VEJGPvejgp]-?\d{7,9}$/;
        const input = document.getElementById('customer-id');
        const isValid = cedulaPattern.test(cedula);
        
        if (isValid) {
            input.classList.remove('border-red-500', 'bg-red-50');
            input.classList.add('border-green-500', 'bg-green-50');
        } else {
            input.classList.remove('border-green-500', 'bg-green-50');
            input.classList.add('border-red-500', 'bg-red-50');
        }
        
        return isValid;
    }

    clearValidationStyles() {
        const input = document.getElementById('customer-id');
        input.classList.remove('border-red-500', 'bg-red-50', 'border-green-500', 'bg-green-50');
    }

    formatCedula(cedula) {
        let cleaned = cedula.toUpperCase().replace(/\s/g, '');
        if (!cleaned.includes('-') && cleaned.length > 1) {
            cleaned = cleaned.charAt(0) + '-' + cleaned.slice(1);
        }
        return cleaned;
    }

    async searchCustomer(cedula) {
        if (!cedula || cedula.trim() === '') {
            this.clearValidationStyles();
            return;
        }

        if (!this.validateCedulaFormat(cedula)) {
            this.showAlert('Formato de cédula/RIF inválido. Formatos aceptados:\n\n• V-12345678 (Cédula venezolana)\n• E-12345678 (Extranjero)\n• J-123456789 (RIF jurídico)\n• G-123456789 (RIF gubernamental)');
            return;
        }

        const formattedCedula = this.formatCedula(cedula);
        document.getElementById('customer-id').value = formattedCedula;

        console.log('🔍 Buscando cliente:', formattedCedula);

        try {
            const response = await fetch(`/api/clientes/cedula/${encodeURIComponent(formattedCedula)}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const customer = await response.json();
                this.showCustomerInfo(customer);
                this.goToStep(2); // Avanzar al paso 2
            } else if (response.status === 404) {
                this.showCustomerForm();
            } else {
                this.showAlert('Error al buscar cliente');
            }
        } catch (error) {
            console.error('Error buscando cliente:', error);
            this.showAlert('Error de conexión al buscar cliente');
        }
    }

    showCustomerInfo(customer) {
        this.currentCustomer = customer;
        document.getElementById('customer-info').classList.remove('hidden');
        document.getElementById('customer-form').classList.add('hidden');
        
        const details = document.getElementById('customer-details');
        details.innerHTML = `
            <p><strong>${customer.nombre}</strong></p>
            <p class="text-gray-600">${customer.cedula_rif}</p>
            <p class="text-gray-600">${customer.telefono || 'Sin teléfono'}</p>
        `;
    }

    showCustomerForm() {
        document.getElementById('customer-info').classList.add('hidden');
        document.getElementById('customer-form').classList.remove('hidden');
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-phone').value = '';
        document.getElementById('customer-address').value = '';
        document.getElementById('customer-name').focus();
    }

    async saveCustomer() {
        const cedula = document.getElementById('customer-id').value;
        const nombre = document.getElementById('customer-name').value;
        const telefono = document.getElementById('customer-phone').value;
        const direccion = document.getElementById('customer-address').value;

        if (!nombre.trim()) {
            this.showAlert('Por favor ingrese el nombre del cliente');
            return;
        }

        if (!this.validateCedulaFormat(cedula)) {
            this.showAlert('Formato de cédula/RIF inválido. No se puede guardar el cliente.');
            return;
        }

        console.log('💾 Guardando cliente:', { cedula, nombre, telefono, direccion });

        try {
            const saveBtn = document.getElementById('save-customer');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Guardando...';
            saveBtn.disabled = true;

            const response = await fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ cedula_rif: cedula, nombre, telefono, direccion })
            });

            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;

            if (response.ok) {
                const customer = await response.json();
                this.showCustomerInfo(customer);
                this.showAlert('Cliente guardado exitosamente', 'success');
                this.goToStep(2); // Avanzar al paso 2
            } else {
                let errorMessage = 'Error al guardar cliente';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = `Error ${response.status}: ${response.statusText}`;
                }
                this.showAlert(errorMessage);
            }
        } catch (error) {
            const saveBtn = document.getElementById('save-customer');
            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Guardar Cliente';
            saveBtn.disabled = false;
            this.showAlert('Error de conexión: ' + error.message);
        }
    }

    // ==================== GESTIÓN DE PRODUCTOS (Mismo código que antes) ====================

    async loadProducts() {
        try {
            console.log('📦 Cargando productos...');
            const response = await fetch('/api/productos', { 
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const rawProducts = await response.json();
                console.log('📊 Productos recibidos (primeros 3):', rawProducts.slice(0, 3));
                
                this.products = rawProducts.map(product => ({
                    id: product.id,
                    nombre: product.nombre,
                    precio_bs: parseFloat(product.precio_venta) || 0,
                    precio_usd: parseFloat(product.precio_dolares) || this.bsToUsd(parseFloat(product.precio_venta) || 0),
                    stock: parseInt(product.stock) || 0,
                    unidad_medida: product.unidad_medida || 'unidad',
                    categoria: product.categoria || 'Sin categoría'
                }));
                
                console.log(`✅ ${this.products.length} productos formateados`);
            } else {
                console.error('❌ Error cargando productos:', response.status, response.statusText);
                this.showAlert('Error al cargar productos del servidor');
            }
        } catch (error) {
            console.error('❌ Error cargando productos:', error);
            this.showAlert('Error de conexión al cargar productos');
        }
    }

    searchProducts(query) {
        console.log('🔍 Buscando productos con:', query);
        
        if (!query || query.trim() === '') {
            document.getElementById('product-suggestions').classList.add('hidden');
            return;
        }

        if (!this.products || this.products.length === 0) {
            console.log('No hay productos cargados');
            return;
        }
        
        const suggestions = document.getElementById('product-suggestions');
        suggestions.innerHTML = '';
        
        const searchTerm = query.toLowerCase().trim();
        
        const filteredProducts = this.products.filter(product => {
            const nombreMatch = product.nombre && product.nombre.toLowerCase().includes(searchTerm);
            const idMatch = product.id && product.id.toString().includes(searchTerm);
            const categoriaMatch = product.categoria && product.categoria.toLowerCase().includes(searchTerm);
            
            return nombreMatch || idMatch || categoriaMatch;
        }).slice(0, 5);

        if (filteredProducts.length > 0) {
            filteredProducts.forEach(product => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.innerHTML = `
                    <div class="font-semibold text-gray-800">${product.nombre}</div>
                    <div class="text-sm text-gray-600">
                        Código: ${product.id} | 
                        <span class="text-purple-600">Bs. ${product.precio_bs.toFixed(2)}</span> | 
                        <span class="text-green-600">$ ${product.precio_usd.toFixed(2)}</span> | 
                        Stock: ${product.stock}
                    </div>
                `;
                div.addEventListener('click', () => {
                    console.log('Producto seleccionado:', product.nombre);
                    this.addProductToCart(product);
                });
                suggestions.appendChild(div);
            });
            suggestions.classList.remove('hidden');
        } else {
            suggestions.classList.add('hidden');
        }
    }

    handleProductSearch(query) {
        if (!query.trim()) return;
        
        const suggestions = document.getElementById('product-suggestions');
        const firstSuggestion = suggestions.querySelector('.autocomplete-item');
        
        if (firstSuggestion && !suggestions.classList.contains('hidden')) {
            console.log('Seleccionando primera sugerencia');
            firstSuggestion.click();
        } else {
            console.log('Buscando producto exacto:', query);
            const product = this.products.find(p => {
                const exactIdMatch = p.id && p.id.toString() === query;
                const exactNameMatch = p.nombre && p.nombre.toLowerCase() === query.toLowerCase();
                return exactIdMatch || exactNameMatch;
            });
            
            if (product) {
                console.log('Producto encontrado:', product.nombre);
                this.addProductToCart(product);
            } else {
                console.log('Producto no encontrado');
                this.showAlert('Producto no encontrado');
            }
        }
    }

    addProductToCart(product) {
        console.log('🛒 Agregando producto al carrito:', product);
        
        document.getElementById('product-suggestions').classList.add('hidden');
        document.getElementById('product-search').value = '';

        if (!product || !product.id) {
            this.showAlert('Error: Producto no válido');
            return;
        }

        if (!product.stock || product.stock <= 0) {
            this.showAlert('Producto sin stock disponible');
            return;
        }

        const existingItemIndex = this.cart.findIndex(item => item.id === product.id);
        
        if (existingItemIndex !== -1) {
            const existingItem = this.cart[existingItemIndex];
            
            if (existingItem.cantidad >= product.stock) {
                this.showAlert(`No hay suficiente stock. Stock disponible: ${product.stock}`);
                return;
            }
            
            this.cart[existingItemIndex].cantidad += 1;
            this.cart[existingItemIndex].subtotal_bs = (this.cart[existingItemIndex].cantidad * this.cart[existingItemIndex].precio_bs).toFixed(2);
            this.cart[existingItemIndex].subtotal_usd = this.bsToUsd(parseFloat(this.cart[existingItemIndex].subtotal_bs));
        } else {
            this.cart.push({
                id: product.id,
                nombre: product.nombre,
                precio_bs: parseFloat(product.precio_bs) || 0,
                precio_usd: parseFloat(product.precio_usd) || 0,
                categoria: product.categoria || 'Sin categoría',
                unidad_medida: product.unidad_medida || 'unidad',
                stock: product.stock || 0,
                cantidad: 1,
                subtotal_bs: (parseFloat(product.precio_bs) || 0).toFixed(2),
                subtotal_usd: parseFloat(product.precio_usd) || 0
            });
        }

        this.updateCart();
        this.showAlert(`"${product.nombre}" agregado al carrito`, 'success');
        
        // Avanzar al paso 3 si es el primer producto
        if (this.cart.length === 1) {
            this.goToStep(3);
        }
    }

    updateCart() {
        const cartItems = document.getElementById('cart-items');
        let emptyCart = document.getElementById('empty-cart');

        if (!cartItems) {
            console.error('❌ No se encontró #cart-items en el DOM.');
            return;
        }

        if (!emptyCart) {
            emptyCart = document.createElement('tr');
            emptyCart.id = 'empty-cart';
            emptyCart.innerHTML = `
                <td colspan="6" class="text-center text-gray-500 py-8">
                    <i class="fas fa-shopping-cart text-4xl mb-2"></i>
                    <p>No hay productos en el carrito</p>
                </td>
            `;
            cartItems.appendChild(emptyCart);
        }

        if (this.cart.length === 0) {
            cartItems.innerHTML = '';
            cartItems.appendChild(emptyCart);
            this.updateTotals();
            this.updateSaleSummary();
            return;
        }

        emptyCart.style.display = 'none';
        cartItems.innerHTML = '';

        this.cart.forEach((item, index) => {
            const step = (item.unidad_medida === 'kg' || item.unidad_medida === 'litro') ? '0.1' : '1';
            
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-200 hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-4 py-3">
                    <div class="font-semibold text-gray-600">${item.id}</div>
                </td>
                <td class="px-4 py-3">
                    <div class="font-semibold">${item.nombre}</div>
                    <div class="text-sm text-gray-600">${item.categoria}</div>
                </td>
                <td class="px-4 py-3">
                    <div class="flex items-center space-x-3">
                        <button class="decrease-btn w-8 h-8 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 transition-all" data-index="${index}">-</button>
                        <input 
                            type="number"
                            step="${step}"
                            min="0.1"
                            value="${item.cantidad}"
                            class="quantity-input w-16 text-center border rounded-md px-2 py-1 font-semibold"
                            data-index="${index}"
                        >
                        <span class="text-gray-500 text-sm ml-1">${item.unidad_medida}</span>
                        <button class="increase-btn w-8 h-8 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300 transition-all" data-index="${index}">+</button>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <div class="font-semibold text-purple-600">Bs. ${item.precio_bs.toFixed(2)}</div>
                    <div class="text-sm text-green-600">$ ${item.precio_usd.toFixed(2)}</div>
                </td>
                <td class="px-4 py-3">
                    <div class="font-semibold text-purple-600">Bs. ${item.subtotal_bs}</div>
                    <div class="text-sm text-green-600">$ ${item.subtotal_usd.toFixed(2)}</div>
                </td>
                <td class="px-4 py-3">
                    <button class="remove-btn text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-all" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            cartItems.appendChild(row);
        });

        this.setupCartEventListeners();
        this.updateTotals();
        this.updateSaleSummary();
    }

    setupCartEventListeners() {
        document.querySelectorAll('.increase-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.index);
                const item = this.cart[index];
                const step = (item.unidad_medida === 'kg' || item.unidad_medida === 'litro') ? 0.1 : 1;
                this.updateQuantity(index, 'increase', step);
            });
        });

        document.querySelectorAll('.decrease-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.index);
                const item = this.cart[index];
                const step = (item.unidad_medida === 'kg' || item.unidad_medida === 'litro') ? 0.1 : 1;
                this.updateQuantity(index, 'decrease', step);
            });
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.index);
                this.removeFromCart(index);
            });
        });

        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                let nuevaCantidad = parseFloat(e.target.value);

                if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) {
                    this.showAlert('Ingrese una cantidad válida');
                    e.target.value = this.cart[index].cantidad;
                    return;
                }

                const producto = this.products.find(p => p.id === this.cart[index].id);
                if (nuevaCantidad > producto.stock) {
                    this.showAlert(`Stock insuficiente. Disponible: ${producto.stock}`);
                    e.target.value = this.cart[index].cantidad;
                    return;
                }

                this.cart[index].cantidad = parseFloat(nuevaCantidad.toFixed(2));
                this.cart[index].subtotal_bs = (this.cart[index].cantidad * this.cart[index].precio_bs).toFixed(2);
                this.cart[index].subtotal_usd = this.bsToUsd(parseFloat(this.cart[index].subtotal_bs));
                this.updateCart();
            });
        });
    }

    updateQuantity(index, action) {
        console.log('Actualizando cantidad:', index, action);
        const item = this.cart[index];
        const originalProduct = this.products.find(p => p.id === item.id);
        
        if (!originalProduct) {
            this.showAlert('Error: Producto no encontrado');
            return;
        }

        const step = (item.unidad_medida === 'kg' || item.unidad_medida === 'litro') ? 0.1 : 1;

        if (action === 'increase') {
            if (item.cantidad + step > originalProduct.stock) {
                this.showAlert(`No hay suficiente stock. Stock disponible: ${originalProduct.stock}`);
                return;
            }
            item.cantidad = parseFloat((item.cantidad + step).toFixed(2));
        } else if (action === 'decrease') {
            if (item.cantidad > step) {
                item.cantidad = parseFloat((item.cantidad - step).toFixed(2));
            } else {
                this.removeFromCart(index);
                return;
            }
        }

        item.subtotal_bs = (item.cantidad * item.precio_bs).toFixed(2);
        item.subtotal_usd = this.bsToUsd(parseFloat(item.subtotal_bs));
        this.updateCart();
    }

    removeFromCart(index) {
        console.log('Eliminando producto del carrito:', index);
        if (index >= 0 && index < this.cart.length) {
            const productName = this.cart[index].nombre;
            this.cart.splice(index, 1);
            this.updateCart();
            this.showAlert(`"${productName}" eliminado del carrito`, 'success');
            
            // Si no hay productos, volver al paso 2
            if (this.cart.length === 0) {
                this.goToStep(2);
            }
        }
    }

    updateTotals() {
        const subtotal_bs = this.cart.reduce((sum, item) => sum + parseFloat(item.subtotal_bs), 0);
        const tax_bs = subtotal_bs * 0.16;
        const total_bs = subtotal_bs + tax_bs;

        const subtotal_usd = this.bsToUsd(subtotal_bs);
        const tax_usd = this.bsToUsd(tax_bs);
        const total_usd = this.bsToUsd(total_bs);

        document.getElementById('subtotal-amount').textContent = `Bs. ${subtotal_bs.toFixed(2)}`;
        document.getElementById('tax-amount').textContent = `Bs. ${tax_bs.toFixed(2)}`;
        document.getElementById('total-bs').textContent = `Bs. ${total_bs.toFixed(2)}`;
        document.getElementById('total-usd').textContent = `$ ${total_usd.toFixed(2)}`;
    }

    updateSaleSummary() {
        const summaryElement = document.getElementById('current-sale-summary');
        const productsCount = this.cart.reduce((sum, item) => sum + item.cantidad, 0);
        const total_bs = this.getTotalBs();

        if (this.cart.length > 0) {
            summaryElement.style.display = 'block';
            document.getElementById('summary-products').textContent = `${productsCount} items`;
            document.getElementById('summary-subtotal').textContent = `Bs. ${(total_bs / 1.16).toFixed(2)}`;
            document.getElementById('summary-total').textContent = `Bs. ${total_bs}`;
        } else {
            summaryElement.style.display = 'none';
        }
    }

    getTotalBs() {
        const subtotal = this.cart.reduce((sum, item) => sum + parseFloat(item.subtotal_bs), 0);
        const tax = subtotal * 0.16;
        return (subtotal + tax).toFixed(2);
    }

    // ==================== MÉTODOS DE PAGO ====================

    openEfectivoBsModal() {
        const total = this.getTotalBs();
        document.getElementById('ef-bs-total').textContent = `Bs. ${total}`;
        document.getElementById('ef-bs-received').value = '';
        document.getElementById('ef-bs-change-row').classList.add('hidden');
        this.showModal('efectivo-bs-modal');
        document.getElementById('ef-bs-received').focus();
    }

    calculateEfectivoBsChange(received) {
        const total = parseFloat(this.getTotalBs());
        const receivedAmount = parseFloat(received) || 0;
        const change = receivedAmount - total;

        const changeRow = document.getElementById('ef-bs-change-row');
        const changeElement = document.getElementById('ef-bs-change');

        if (receivedAmount > 0 && receivedAmount >= total) {
            changeElement.textContent = `Bs. ${change.toFixed(2)}`;
            changeRow.classList.remove('hidden');
        } else {
            changeRow.classList.add('hidden');
        }
    }

    confirmEfectivoBs() {
        const received = parseFloat(document.getElementById('ef-bs-received').value) || 0;
        const total = parseFloat(this.getTotalBs());

        if (received < total) {
            this.showAlert(`El monto recibido (Bs. ${received.toFixed(2)}) es menor al total (Bs. ${total})`);
            return;
        }

        this.paymentDetails = {
            method: 'efectivo_bs',
            received: received,
            change: received - total,
            total: total
        };

        this.hideModal('efectivo-bs-modal');
        this.showProcessSaleButton();
        this.goToStep(5);
    }

    openEfectivoUsdModal() {
        const total_bs = parseFloat(this.getTotalBs());
        const total_usd = this.bsToUsd(total_bs);
        
        document.getElementById('ef-usd-total-bs').textContent = `Bs. ${total_bs.toFixed(2)}`;
        document.getElementById('ef-usd-total-usd').textContent = `$ ${total_usd.toFixed(2)}`;
        document.getElementById('ef-usd-rate').textContent = this.tasaCambio.toFixed(2);
        document.getElementById('ef-usd-received').value = '';
        document.getElementById('ef-usd-change-row').classList.add('hidden');
        this.showModal('efectivo-usd-modal');
        document.getElementById('ef-usd-received').focus();
    }

    calculateEfectivoUsdChange(received) {
        const total_bs = parseFloat(this.getTotalBs());
        const total_usd = this.bsToUsd(total_bs);
        const receivedAmount = parseFloat(received) || 0;
        const change_usd = receivedAmount - total_usd;
        const change_bs = this.usdToBs(change_usd);

        const changeRow = document.getElementById('ef-usd-change-row');
        const changeElement = document.getElementById('ef-usd-change');

        if (receivedAmount > 0 && receivedAmount >= total_usd) {
            changeElement.textContent = `$ ${change_usd.toFixed(2)} (Bs. ${change_bs.toFixed(2)})`;
            changeRow.classList.remove('hidden');
        } else {
            changeRow.classList.add('hidden');
        }
    }

    confirmEfectivoUsd() {
        const received = parseFloat(document.getElementById('ef-usd-received').value) || 0;
        const total_usd = this.bsToUsd(parseFloat(this.getTotalBs()));

        if (received < total_usd) {
            this.showAlert(`El monto recibido ($${received.toFixed(2)}) es menor al total ($${total_usd.toFixed(2)})`);
            return;
        }

        this.paymentDetails = {
            method: 'efectivo_usd',
            received: received,
            change: received - total_usd,
            total: total_usd,
            tasa: this.tasaCambio
        };

        this.hideModal('efectivo-usd-modal');
        this.showProcessSaleButton();
        this.goToStep(5);
    }

    openPuntoVentaModal() {
        const total = this.getTotalBs();
        document.getElementById('pv-total').textContent = `Bs. ${total}`;
        document.getElementById('pv-reference').value = '';
        document.getElementById('pv-amount').value = total;
        this.showModal('punto-venta-modal');
        document.getElementById('pv-reference').focus();
    }

    confirmPuntoVenta() {
        const reference = document.getElementById('pv-reference').value.trim();
        const amount = parseFloat(document.getElementById('pv-amount').value) || 0;
        const total = parseFloat(this.getTotalBs());

        if (!reference) {
            this.showAlert('Ingrese la referencia o código de autorización');
            return;
        }

        if (amount !== total) {
            this.showAlert(`El monto acreditado (Bs. ${amount.toFixed(2)}) debe ser igual al total (Bs. ${total})`);
            return;
        }

        this.paymentDetails = {
            method: 'punto_venta',
            reference: reference,
            amount: amount,
            total: total
        };

        this.hideModal('punto-venta-modal');
        this.showProcessSaleButton();
        this.goToStep(5);
    }

    openTransferModal(method) {
        this.paymentMethod = method;
        document.getElementById('transfer-bank').value = '';
        document.getElementById('transfer-holder-id').value = '';
        document.getElementById('transfer-amount').value = this.getTotalBs();
        document.getElementById('transfer-reference').value = '';
        this.showModal('transfer-details-modal');
        document.getElementById('transfer-bank').focus();
    }

    confirmTransfer() {
        const bank = document.getElementById('transfer-bank').value;
        const holderId = document.getElementById('transfer-holder-id').value;
        const amount = parseFloat(document.getElementById('transfer-amount').value) || 0;
        const reference = document.getElementById('transfer-reference').value.trim();
        const total = parseFloat(this.getTotalBs());

        if (!bank) {
            this.showAlert('Seleccione el banco emisor');
            return;
        }

        if (!this.validateCedulaFormat(holderId)) {
            this.showAlert('Ingrese una cédula/RIF válido del titular');
            return;
        }

        if (amount !== total) {
            this.showAlert(`El monto de la transacción (Bs. ${amount.toFixed(2)}) debe ser igual al total (Bs. ${total})`);
            return;
        }

        if (!reference) {
            this.showAlert('Ingrese el número de referencia');
            return;
        }

        this.paymentDetails = {
            method: this.paymentMethod,
            bank: bank,
            holderId: this.formatCedula(holderId),
            amount: amount,
            reference: reference,
            total: total
        };

        this.hideModal('transfer-details-modal');
        this.showProcessSaleButton();
        this.goToStep(5);
    }

    openMixedPaymentModal() {
        const total = parseFloat(this.getTotalBs());
        document.getElementById('mixed-total').textContent = `Bs. ${total.toFixed(2)}`;
        
        const methodsContainer = document.getElementById('mixed-payment-methods');
        methodsContainer.innerHTML = `
            <div class="grid grid-cols-1 gap-4">
                <div class="mixed-method">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Efectivo (Bs)</label>
                    <input type="number" class="mixed-amount input-field" data-method="efectivo_bs" placeholder="0.00" step="0.01" min="0">
                </div>
                <div class="mixed-method">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Efectivo (USD)</label>
                    <input type="number" class="mixed-amount input-field" data-method="efectivo_usd" placeholder="0.00" step="0.01" min="0">
                </div>
                <div class="mixed-method">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Punto de Venta</label>
                    <input type="number" class="mixed-amount input-field" data-method="punto_venta" placeholder="0.00" step="0.01" min="0">
                </div>
                <div class="mixed-method">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Transferencia</label>
                    <input type="number" class="mixed-amount input-field" data-method="transferencia" placeholder="0.00" step="0.01" min="0">
                </div>
                <div class="mixed-method">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Pago Móvil</label>
                    <input type="number" class="mixed-amount input-field" data-method="pago_movil" placeholder="0.00" step="0.01" min="0">
                </div>
            </div>
        `;

        // Agregar event listeners a los inputs
        methodsContainer.querySelectorAll('.mixed-amount').forEach(input => {
            input.addEventListener('input', () => this.calculateMixedTotal());
        });

        this.calculateMixedTotal();
        this.showModal('mixed-payment-modal');
    }

    calculateMixedTotal() {
        let assignedTotal = 0;
        const total = parseFloat(this.getTotalBs());
        
        document.querySelectorAll('.mixed-amount').forEach(input => {
            const amount = parseFloat(input.value) || 0;
            assignedTotal += amount;
        });

        const remaining = total - assignedTotal;
        
        document.getElementById('mixed-assigned-total').textContent = `Bs. ${assignedTotal.toFixed(2)}`;
        document.getElementById('mixed-remaining').textContent = `Bs. ${remaining.toFixed(2)}`;
        
        const confirmBtn = document.getElementById('confirm-mixed');
        confirmBtn.disabled = Math.abs(remaining) > 0.01; // Permitir pequeñas diferencias por redondeo

        if (remaining > 0) {
            document.getElementById('mixed-remaining').classList.add('text-red-600');
        } else if (remaining < 0) {
            document.getElementById('mixed-remaining').classList.add('text-orange-600');
        } else {
            document.getElementById('mixed-remaining').classList.remove('text-red-600', 'text-orange-600');
            document.getElementById('mixed-remaining').classList.add('text-green-600');
        }
    }

    confirmMixedPayment() {
        const mixedPayments = [];
        let totalAssigned = 0;

        document.querySelectorAll('.mixed-amount').forEach(input => {
            const amount = parseFloat(input.value) || 0;
            if (amount > 0) {
                mixedPayments.push({
                    method: input.dataset.method,
                    amount: amount
                });
                totalAssigned += amount;
            }
        });

        const total = parseFloat(this.getTotalBs());
        
        if (Math.abs(totalAssigned - total) > 0.01) {
            this.showAlert('El total asignado no coincide con el total de la venta');
            return;
        }

        this.paymentDetails = {
            method: 'mixto',
            payments: mixedPayments,
            total: total
        };

        this.hideModal('mixed-payment-modal');
        this.showProcessSaleButton();
        this.goToStep(5);
    }

    showProcessSaleButton() {
        document.getElementById('process-sale').classList.remove('hidden');
    }

    // ==================== PROCESAR VENTA ====================

    async processSale() {
        if (this.cart.length === 0) {
            this.showAlert('El carrito está vacío');
            return;
        }

        if (!this.currentCustomer) {
            this.showAlert('Debe seleccionar un cliente');
            return;
        }

        if (!this.selectedPaymentMethod || !this.paymentDetails) {
            this.showAlert('Debe completar la información de pago');
            return;
        }

        console.log('💳 Procesando venta...', {
            customer: this.currentCustomer,
            cart: this.cart,
            payment: this.paymentDetails
        });

        try {
            const saleData = {
                id_cliente: this.currentCustomer.id,
                detalles: this.cart.map(item => ({
                    id_producto: item.id,
                    cantidad: parseFloat(item.cantidad),
                    precio_unitario: parseFloat(item.precio_bs)
                })),
                metodo_pago: this.selectedPaymentMethod,
                payment_details: this.paymentDetails
            };

            const response = await fetch('/api/ventas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(saleData)
            });

            if (response.ok) {
                const result = await response.json();
                this.lastSaleId = result.venta.id;
                
                this.showAlert(`Venta #${result.venta.id} procesada exitosamente! Total: Bs. ${this.getTotalBs()}`, 'success');
                this.viewInvoice();
            } else {
                const error = await response.json();
                this.showAlert(error.error || 'Error al procesar la venta');
            }
        } catch (error) {
            console.error('Error procesando venta:', error);
            this.showAlert('Error de conexión al procesar la venta');
        }
    }

    // ==================== FACTURA (Mismo código que antes) ====================

    async viewInvoice() {
        if (!this.lastSaleId) {
            this.showAlert('No hay una venta reciente para mostrar');
            return;
        }

        try {
            console.log('📋 Cargando factura para venta:', this.lastSaleId);
            const response = await fetch(`/api/ventas/${this.lastSaleId}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const ventaData = await response.json();
                this.generateInvoiceHTML(ventaData);
                this.showModal('invoice-modal');
            } else {
                this.showAlert('Error al cargar los datos de la factura');
            }
        } catch (error) {
            console.error('Error cargando factura:', error);
            this.showAlert('Error de conexión al cargar la factura');
        }
    }

    generateInvoiceHTML(ventaData) {
        const invoiceContent = document.getElementById('invoice-content');
        const subtotal_bs = this.cart.reduce((sum, item) => sum + parseFloat(item.subtotal_bs), 0);
        const tax_bs = subtotal_bs * 0.16;
        const total_bs = subtotal_bs + tax_bs;

        const subtotal_usd = this.bsToUsd(subtotal_bs);
        const tax_usd = this.bsToUsd(tax_bs);
        const total_usd = this.bsToUsd(total_bs);

        const empresa = this.empresaData || {
            nombre_empresa: "Na'Guara",
            rif: "J-123456789",
            telefono: "(0412) 123-4567",
            direccion: "Barquisimeto, Venezuela",
            mensaje_factura: "¡Gracias por su compra!"
        };

        const invoiceHTML = `
            <div class="invoice-container">
                <!-- Encabezado -->
                <div class="grid grid-cols-2 gap-6 mb-8">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${empresa.nombre_empresa}</h3>
                        <p class="text-gray-600">Sistema de Venta Rápida</p>
                        <p class="text-gray-600">RIF: ${empresa.rif}</p>
                        <p class="text-gray-600">Teléfono: ${empresa.telefono}</p>
                        <p class="text-gray-600">${empresa.direccion}</p>
                    </div>
                    <div class="text-right">
                        <h3 class="text-xl font-bold text-purple-600">FACTURA #${ventaData.id}</h3>
                        <p class="text-gray-600">Fecha: ${new Date(ventaData.fecha_venta).toLocaleDateString('es-ES')}</p>
                        <p class="text-gray-600">Hora: ${new Date(ventaData.fecha_venta).toLocaleTimeString('es-ES')}</p>
                        <p class="text-gray-600 text-sm">Tasa: ${this.tasaCambio.toFixed(2)} Bs/$</p>
                    </div>
                </div>

                <!-- Información del Cliente -->
                <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 class="font-bold text-gray-800 mb-2">INFORMACIÓN DEL CLIENTE</h4>
                    <p><strong>Nombre:</strong> ${this.currentCustomer.nombre}</p>
                    <p><strong>Cédula/RIF:</strong> ${this.currentCustomer.cedula_rif}</p>
                    <p><strong>Teléfono:</strong> ${this.currentCustomer.telefono || 'No especificado'}</p>
                    <p><strong>Dirección:</strong> ${this.currentCustomer.direccion || 'No especificada'}</p>
                </div>

                <!-- Detalles de la Venta -->
                <div class="mb-6">
                    <h4 class="font-bold text-gray-800 mb-3">DETALLES DE LA VENTA</h4>
                    <table class="w-full border-collapse border border-gray-300">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="border border-gray-300 p-3 text-left">Producto</th>
                                <th class="border border-gray-300 p-3 text-center">Cantidad</th>
                                <th class="border border-gray-300 p-3 text-right">Precio Unitario</th>
                                <th class="border border-gray-300 p-3 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.cart.map(item => `
                                <tr>
                                    <td class="border border-gray-300 p-3">${item.nombre}</td>
                                    <td class="border border-gray-300 p-3 text-center">${item.cantidad} ${item.unidad_medida}</td>
                                    <td class="border border-gray-300 p-3 text-right">
                                        <div>Bs. ${item.precio_bs.toFixed(2)}</div>
                                        <div class="text-sm text-green-600">$ ${item.precio_usd.toFixed(2)}</div>
                                    </td>
                                    <td class="border border-gray-300 p-3 text-right">
                                        <div>Bs. ${item.subtotal_bs}</div>
                                        <div class="text-sm text-green-600">$ ${item.subtotal_usd.toFixed(2)}</div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Resumen -->
                <div class="grid grid-cols-2 gap-6">
                    <div class="p-4 bg-purple-50 rounded-lg">
                        <h4 class="font-bold text-purple-800 mb-2">MÉTODO DE PAGO</h4>
                        <p class="text-purple-700 font-semibold">${this.selectedPaymentMethod.toUpperCase()}</p>
                        ${this.paymentDetails.method === 'mixto' ? `
                            <div class="mt-2 text-sm">
                                ${this.paymentDetails.payments.map(p => `
                                    <div>${p.method}: Bs. ${p.amount.toFixed(2)}</div>
                                `).join('')}
                            </div>
                        ` : ''}
                        <p class="text-sm text-purple-600 mt-2">Tasa de cambio: ${this.tasaCambio.toFixed(2)} Bs/$</p>
                    </div>
                    <div class="p-4 bg-gray-50 rounded-lg">
                        <h4 class="font-bold text-gray-800 mb-2">RESUMEN</h4>
                        <div class="flex justify-between mb-1">
                            <span>Subtotal:</span>
                            <div class="text-right">
                                <div>Bs. ${subtotal_bs.toFixed(2)}</div>
                                <div class="text-sm text-green-600">$ ${subtotal_usd.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="flex justify-between mb-1">
                            <span>IVA (16%):</span>
                            <div class="text-right">
                                <div>Bs. ${tax_bs.toFixed(2)}</div>
                                <div class="text-sm text-green-600">$ ${tax_usd.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="flex justify-between font-bold text-lg border-t border-gray-300 pt-2 mt-2">
                            <span>TOTAL:</span>
                            <div class="text-right">
                                <div class="text-purple-600">Bs. ${total_bs.toFixed(2)}</div>
                                <div class="text-green-600 text-sm">$ ${total_usd.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pie de página -->
                <div class="mt-8 text-center text-gray-500 text-sm">
                    <p>${empresa.mensaje_factura}</p>
                    <p>${empresa.nombre_empresa} - Sistema de Venta Rápida</p>
                    <p>Factura generada el ${new Date().toLocaleString('es-ES')}</p>
                </div>
            </div>
        `;

        invoiceContent.innerHTML = invoiceHTML;
    }

    printInvoice() {
        const invoiceContent = document.getElementById('invoice-content').innerHTML;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Factura - Na'Guara</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
                    .invoice-container { max-width: 800px; margin: 0 auto; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: bold; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .bg-gray-100 { background-color: #f7fafc; }
                    .bg-purple-50 { background-color: #faf5ff; }
                    .bg-gray-50 { background-color: #f9fafb; }
                    .border { border: 1px solid #e5e7eb; }
                    .border-gray-300 { border-color: #d1d5db; }
                    .rounded-lg { border-radius: 8px; }
                    .p-3 { padding: 12px; }
                    .p-4 { padding: 16px; }
                    .p-6 { padding: 24px; }
                    .mb-2 { margin-bottom: 8px; }
                    .mb-3 { margin-bottom: 12px; }
                    .mb-6 { margin-bottom: 24px; }
                    .mb-8 { margin-bottom: 32px; }
                    .mt-2 { margin-top: 8px; }
                    .mt-8 { margin-top: 32px; }
                    .grid { display: grid; }
                    .grid-cols-2 { grid-template-columns: 1fr 1fr; }
                    .gap-6 { gap: 24px; }
                    .font-bold { font-weight: bold; }
                    .font-semibold { font-weight: 600; }
                    .text-xl { font-size: 1.25rem; }
                    .text-lg { font-size: 1.125rem; }
                    .text-sm { font-size: 0.875rem; }
                    .text-gray-800 { color: #1f2937; }
                    .text-gray-600 { color: #4b5563; }
                    .text-gray-500 { color: #6b7280; }
                    .text-purple-600 { color: #8b5cf6; }
                    .text-purple-700 { color: #7c3aed; }
                    .text-purple-800 { color: #6d28d9; }
                    .text-green-600 { color: #059669; }
                    @media print {
                        body { margin: 0; }
                        .invoice-container { max-width: 100%; }
                    }
                </style>
            </head>
            <body>
                ${invoiceContent}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    }
                <\/script>
            </body>
            </html>
        `);
        
        printWindow.document.close();
    }

    // ==================== NUEVA VENTA ====================

    newSale() {
        console.log('🔄 Iniciando nueva venta...');
        this.currentCustomer = null;
        this.cart = [];
        this.lastSaleId = null;
        this.selectedPaymentMethod = null;
        this.paymentDetails = {};
        this.currentStep = 1;
        
        // Limpiar formularios
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-info').classList.add('hidden');
        document.getElementById('customer-form').classList.add('hidden');
        document.getElementById('product-search').value = '';
        document.getElementById('product-suggestions').classList.add('hidden');
        this.clearValidationStyles();
        
        // Limpiar métodos de pago
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-purple-100', 'border-purple-300', 'ring-2', 'ring-purple-500');
        });
        
        document.getElementById('payment-details').innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-hand-pointer text-4xl mb-2"></i>
                <p>Seleccione un método de pago para continuar</p>
            </div>
        `;
        
        document.getElementById('process-sale').classList.add('hidden');
        
        this.updateCart();
        this.updateStepIndicator();
        this.hideModal('invoice-modal');
        document.getElementById('customer-id').focus();
        
        this.showAlert('Nueva venta iniciada', 'success');
    }

    cancelSale() {
        this.showConfirm(
            'Cancelar Venta',
            '¿Está seguro de que desea cancelar esta venta? Se perderán todos los datos ingresados.',
            () => {
                this.newSale();
            }
        );
    }

    // ==================== UTILIDADES ====================

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    }

    showAlert(message, type = 'error') {
        const alertModal = document.getElementById('alert-modal');
        const alertMessage = document.getElementById('alert-message');
        
        if (alertModal && alertMessage) {
            alertMessage.textContent = message;
            const title = alertModal.querySelector('h2');
            if (title) {
                if (type === 'success') {
                    title.className = 'text-xl font-bold text-green-600';
                    title.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Éxito';
                } else {
                    title.className = 'text-xl font-bold text-red-600';
                    title.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>Atención';
                }
            }
            this.showModal('alert-modal');
        }
    }

    showConfirm(title, message, callback) {
        const confirmTitle = document.getElementById('confirm-title');
        const confirmMessage = document.getElementById('confirm-message');
        
        if (confirmTitle && confirmMessage) {
            confirmTitle.textContent = title;
            confirmMessage.textContent = message;
            this.confirmCallback = callback;
            this.showModal('confirm-modal');
        }
    }

    executeConfirmedAction() {
        if (this.confirmCallback) this.confirmCallback();
        this.hideModal('confirm-modal');
    }

    // ==================== CIERRE DE CAJA (Implementación básica) ====================

    async openCashClose() {
    try {
        console.log('💰 Verificando cierre de caja...');
        
        const today = new Date().toISOString().split('T')[0];
        const usuarioId = await this.getCurrentUserId();

        // ✅ PRIMERO: Verificar si ya existe cierre de caja para hoy
        const verifyResponse = await fetch(`/api/cierre-caja/verificar?fecha=${today}&usuario_id=${usuarioId}`);
        
        if (verifyResponse.status === 409) {
            const errorData = await verifyResponse.json();
            this.showAlert(
                `Ya realizaste el cierre de caja hoy.\n\n` +
                `Fecha: ${today}\n` +
                `No puedes realizar más de un cierre por día.`,
                'warning'
            );
            return;
        }

        if (!verifyResponse.ok) {
            throw new Error('Error al verificar cierre de caja');
        }

        // ✅ SEGUNDO: Cargar resumen del día
        console.log('📊 Cargando resumen del día...');
        const resumenResponse = await fetch(`/api/ventas/resumen-diario?fecha=${today}`);
        
        if (!resumenResponse.ok) {
            throw new Error('Error al cargar resumen de ventas');
        }
        
        const resumen = await resumenResponse.json();
        console.log('📈 Resumen del día:', resumen);
        
        // ✅ TERCERO: Actualizar y mostrar modal
        this.updateCashCloseModal(resumen);
        this.showModal('cash-register-modal');
        
        console.log('✅ Modal de cierre de caja abierto');

    } catch (error) {
        console.error('❌ Error abriendo cierre de caja:', error);
        this.showAlert(`Error: ${error.message}`);
    }
}


updateCashCloseModal(resumen) {
    console.log('📊 Actualizando modal con resumen REAL del USUARIO:', resumen);
    
    // Calcular totales
    const totalVentas = resumen.total || 0;
    const efectivoTotal = (resumen.efectivo || 0) + (resumen.efectivo_bs || 0);
    const tarjetaPunto = (resumen.punto_venta || 0) + (resumen.tarjeta || 0);
    const transferencia = resumen.transferencia || 0;
    const pagoMovil = resumen.pago_movil || 0;

    // Función helper para actualizar elementos
    const updateElement = (id, text) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    };

    // RESUMEN PRINCIPAL
    updateElement('close-total-sales', `Bs. ${totalVentas.toFixed(2)}`);
    updateElement('close-cash-sales', `Bs. ${efectivoTotal.toFixed(2)}`);
    updateElement('close-card-sales', `Bs. ${tarjetaPunto.toFixed(2)}`);
    updateElement('close-transfer-sales', `Bs. ${transferencia.toFixed(2)}`);
    updateElement('close-mobile-sales', `Bs. ${pagoMovil.toFixed(2)}`);
    updateElement('close-expected-cash', `Bs. ${efectivoTotal.toFixed(2)}`);

    // DETALLES POR MÉTODO DE PAGO
    updateElement('detail-cash-bs', `Bs. ${(resumen.efectivo_bs || 0).toFixed(2)}`);
    updateElement('detail-cash-usd', `Bs. ${(resumen.efectivo_usd || 0).toFixed(2)}`);
    updateElement('detail-punto-venta', `Bs. ${(resumen.punto_venta || 0).toFixed(2)}`);
    updateElement('detail-transferencia', `Bs. ${(resumen.transferencia || 0).toFixed(2)}`);
    updateElement('detail-pago-movil', `Bs. ${(resumen.pago_movil || 0).toFixed(2)}`);
    updateElement('detail-mixto', `${resumen.mixto || 0} ventas`); // Cambiado a cantidad de ventas
    updateElement('detail-tarjeta', `Bs. ${(resumen.tarjeta || 0).toFixed(2)}`);
    updateElement('detail-efectivo', `Bs. ${(resumen.efectivo || 0).toFixed(2)}`);

    // RESUMEN DE TRANSACCIONES - CON DATOS REALES
    const totalTransacciones = resumen.total_ventas_count || 0;
    const montoPromedio = totalTransacciones > 0 ? (totalVentas / totalTransacciones) : 0;
    
    // Formatear horas
    const formatHora = (fecha) => {
        if (!fecha) return '--:--';
        return new Date(fecha).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    updateElement('total-transacciones', totalTransacciones);
    updateElement('monto-promedio', `Bs. ${montoPromedio.toFixed(2)}`);
    updateElement('primera-venta', formatHora(resumen.primera_venta));
    updateElement('ultima-venta', formatHora(resumen.ultima_venta));

    // ACTUALIZAR INFORMACIÓN DEL USUARIO
    this.updateUserInfo().catch(error => {
        console.warn('No se pudo cargar información del usuario:', error);
    });

    // FECHA ACTUAL
    const dateInput = document.getElementById('close-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // LIMPIAR CAMPOS
    const initialCash = document.getElementById('initial-cash');
    const finalCash = document.getElementById('final-cash-counted');
    if (initialCash) initialCash.value = '';
    if (finalCash) finalCash.value = '';

    // RESETEAR DIFERENCIA
    const differenceElement = document.getElementById('close-difference');
    const container = document.getElementById('close-difference-container');
    if (differenceElement) {
        differenceElement.textContent = 'Bs. 0.00';
        differenceElement.className = 'text-gray-600';
    }
    if (container) {
        container.className = 'flex justify-between font-bold text-lg';
    }

    // GUARDAR RESUMEN
    this.dailySalesSummary = {
        total: totalVentas,
        efectivo: efectivoTotal,
        tarjeta: tarjetaPunto,
        transferencia: transferencia,
        pago_movil: pagoMovil,
        mixto: resumen.mixto || 0,
        efectivo_usd: resumen.efectivo_usd || 0,
        usuario: resumen.usuario
    };

    console.log('✅ Modal actualizado con datos REALES del usuario:', {
        usuario: resumen.usuario,
        transacciones: totalTransacciones,
        totalVentas: totalVentas,
        montoPromedio: montoPromedio,
        primeraVenta: formatHora(resumen.primera_venta),
        ultimaVenta: formatHora(resumen.ultima_venta)
    });
}

// Método auxiliar para actualizar información del usuario
async updateUserInfo() {
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
            const user = await response.json();
            
            // Actualizar información del usuario en el modal
            const usuarioInfo = document.getElementById('usuario-cierre-info');
            if (usuarioInfo) {
                usuarioInfo.textContent = `Vendedor: ${user.nombre || 'Usuario'}`;
            }

            // Actualizar título si es necesario
            const titulo = document.querySelector('#cash-register-modal h2');
            if (titulo) {
                titulo.innerHTML = `
                    <i class="fas fa-calculator mr-2"></i>
                    Cierre de Caja - ${user.nombre || 'Usuario'}
                `;
            }
        }
    } catch (error) {
        console.error('Error obteniendo información del usuario:', error);
    }
}


}



// Inicializar el sistema
console.log('🚀 INICIANDO MÓDULO DE VENTAS PASO A PASO...');
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.ventasManager = new VentasManager();
        console.log('✅ Módulo de ventas inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando módulo de ventas:', error);
    }
});