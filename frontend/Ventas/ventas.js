// ventas.js - Punto de Venta Completo con Dólares y Bolívares
class VentasManager {
    constructor() {
        this.currentCustomer = null;
        this.cart = [];
        this.products = [];
        this.selectedPaymentMethod = 'efectivo';
        this.lastSaleId = null;
        this.empresaData = null;
        this.tasaCambio = 216.37;
        
        this.init();
    }

    init() {
        console.log('🚀 Inicializando punto de venta...');
        this.setCurrentDate();
        this.setupEventListeners();
        this.checkAuthentication();
        this.loadTasaCambio();
        this.loadProducts();
        this.setupPaymentMethods();
        this.hideInvoiceButtons();
        this.loadEmpresaData();
    }

    async loadTasaCambio() {
        try {
            console.log('💰 Cargando tasa de cambio...');
            const response = await fetch('/api/tasa-cambio/actual');
            if (response.ok) {
                const data = await response.json();
                this.tasaCambio = parseFloat(data.tasa_bs);
                document.getElementById('tasa-actual').textContent = this.tasaCambio.toFixed(2);
                console.log('✅ Tasa de cambio cargada:', this.tasaCambio);
            } else {
                throw new Error('No se pudo cargar la tasa');
            }
        } catch (error) {
            console.error('❌ Error cargando tasa:', error);
            document.getElementById('tasa-actual').textContent = '216.37';
            this.tasaCambio = 216.37;
        }
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
        
        const productSearch = document.getElementById('product-search');
        if (productSearch) {
            productSearch.addEventListener('input', (e) => {
                console.log('Búsqueda:', e.target.value);
                this.searchProducts(e.target.value);
            });
            
            productSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    console.log('Enter presionado:', e.target.value);
                    this.handleProductSearch(e.target.value);
                }
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.autocomplete-container')) {
                    document.getElementById('product-suggestions').classList.add('hidden');
                }
            });
        }

        document.getElementById('customer-id').addEventListener('blur', (e) => this.searchCustomer(e.target.value));
        document.getElementById('customer-id').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCustomer(e.target.value);
        });
        document.getElementById('customer-id').addEventListener('input', (e) => this.validateCedulaFormat(e.target.value));
        
        document.getElementById('save-customer').addEventListener('click', () => this.saveCustomer());

        document.getElementById('process-sale').addEventListener('click', () => this.processSale());
        document.getElementById('new-sale').addEventListener('click', () => this.newSale());
        document.getElementById('cancel-sale').addEventListener('click', () => this.cancelSale());
        
        document.getElementById('view-invoice').addEventListener('click', () => this.viewInvoice());
        document.getElementById('quick-invoice-btn').addEventListener('click', () => this.viewInvoice());
        document.getElementById('print-invoice').addEventListener('click', () => this.printInvoice());
        document.getElementById('close-invoice').addEventListener('click', () => this.hideModal('invoice-modal'));

        this.setupModalEvents();
    }

    setupModalEvents() {
        document.getElementById('close-alert-modal').addEventListener('click', () => {
            this.hideModal('alert-modal');
        });

        document.getElementById('confirm-alert').addEventListener('click', () => {
            this.hideModal('alert-modal');
        });

        document.getElementById('close-confirm-modal').addEventListener('click', () => {
            this.hideModal('confirm-modal');
        });

        document.getElementById('cancel-confirm').addEventListener('click', () => {
            this.hideModal('confirm-modal');
        });

        document.getElementById('accept-confirm').addEventListener('click', () => {
            this.executeConfirmedAction();
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModal('alert-modal');
                this.hideModal('confirm-modal');
                this.hideModal('invoice-modal');
            }
        });
    }

    setupPaymentMethods() {
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active', 'bg-purple-100', 'border-purple-300'));
                e.currentTarget.classList.add('active', 'bg-purple-100', 'border-purple-300');
                this.selectedPaymentMethod = e.currentTarget.dataset.method;
                console.log('Método de pago seleccionado:', this.selectedPaymentMethod);
            });
        });
    }

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
                <td colspan="5" class="text-center text-gray-500 py-8">
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
        }
    }

    updateTotals() {
        const subtotal_bs = this.cart.reduce((sum, item) => sum + parseFloat(item.subtotal_bs), 0);
        const tax_bs = subtotal_bs * 0.16;
        const total_bs = subtotal_bs + tax_bs;

        const subtotal_usd = this.bsToUsd(subtotal_bs);
        const tax_usd = this.bsToUsd(tax_bs);
        const total_usd = this.bsToUsd(total_bs);

        document.getElementById('subtotal-bs').textContent = `Bs. ${subtotal_bs.toFixed(2)}`;
        document.getElementById('subtotal-usd').textContent = `$ ${subtotal_usd.toFixed(2)}`;
        
        document.getElementById('tax-bs').textContent = `Bs. ${tax_bs.toFixed(2)}`;
        document.getElementById('tax-usd').textContent = `$ ${tax_usd.toFixed(2)}`;
        
        document.getElementById('total-bs').textContent = `Bs. ${total_bs.toFixed(2)}`;
        document.getElementById('total-usd').textContent = `$ ${total_usd.toFixed(2)}`;
    }

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

    async processSale() {
        if (this.cart.length === 0) {
            this.showAlert('El carrito está vacío');
            return;
        }

        if (!this.currentCustomer) {
            this.showAlert('Debe seleccionar un cliente');
            return;
        }

        console.log('💳 Procesando venta...', {
            customer: this.currentCustomer,
            cart: this.cart,
            payment: this.selectedPaymentMethod
        });

        try {
            const saleData = {
                id_cliente: this.currentCustomer.id,
                detalles: this.cart.map(item => ({
                    id_producto: item.id,
                    cantidad: parseFloat(item.cantidad),
                    precio_unitario: parseFloat(item.precio_bs)
                })),
                metodo_pago: this.selectedPaymentMethod
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
                this.showInvoiceButtons();
            } else {
                const error = await response.json();
                this.showAlert(error.error || 'Error al procesar la venta');
            }
        } catch (error) {
            console.error('Error procesando venta:', error);
            this.showAlert('Error de conexión al procesar la venta');
        }
    }

    getTotalBs() {
        const subtotal = this.cart.reduce((sum, item) => sum + parseFloat(item.subtotal_bs), 0);
        const tax = subtotal * 0.16;
        return (subtotal + tax).toFixed(2);
    }

    showInvoiceButtons() {
        document.getElementById('view-invoice').classList.remove('hidden');
        document.getElementById('quick-invoice-btn').classList.remove('hidden');
        document.getElementById('process-sale').classList.add('hidden');
    }

    hideInvoiceButtons() {
        document.getElementById('view-invoice').classList.add('hidden');
        document.getElementById('quick-invoice-btn').classList.add('hidden');
        document.getElementById('process-sale').classList.remove('hidden');
    }

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

    newSale() {
        console.log('🔄 Iniciando nueva venta...');
        this.currentCustomer = null;
        this.cart = [];
        this.lastSaleId = null;
        
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-info').classList.add('hidden');
        document.getElementById('customer-form').classList.add('hidden');
        document.getElementById('product-search').value = '';
        document.getElementById('product-suggestions').classList.add('hidden');
        this.clearValidationStyles();
        
        this.hideInvoiceButtons();
        this.updateCart();
        document.getElementById('customer-id').focus();
    }

    cancelSale() {
        this.showConfirm(
            'Cancelar Venta',
            '¿Está seguro de que desea cancelar esta venta? Se perderán todos los datos ingresados.',
            () => {
                this.newSale();
                this.showAlert('Venta cancelada', 'success');
            }
        );
    }

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
}

// Inicializar el sistema
console.log('🚀 INICIANDO PUNTO DE VENTA...');
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.ventasManager = new VentasManager();
        console.log('✅ Punto de venta inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando punto de venta:', error);
    }
});