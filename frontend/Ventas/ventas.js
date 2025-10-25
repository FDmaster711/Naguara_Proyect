 // Simulación de Base de Datos
        let clientesDB = [
            { id: 'V-12345678', nombre: 'Fabián Da Cal', telefono: '0412-550-0956', direccion: 'Calle 15 entre carreras 4 y 5, Pueblo Nuevo. #123, Barquisimeto' },
            { id: 'V-31544532', nombre: 'Jesús Camacho', telefono: '0412-266-5517', direccion: 'Calle 17 entre carrera 5 y 6, Pueblo Nuevo #456, Barquisimeto' },
            { id: 'V-98765432', nombre: 'Carlos Mendoza', telefono: '0424-555-0123', direccion: 'Urb. Los Rosales, Casa 789' }
        ];

        let productosDB = [
            { codigo: 'P001', nombre: 'Pollo Entero Fresco', precio: 893.93, stock: 25, tipo: 'peso' },
            { codigo: 'P002', nombre: 'Pechuga de Pollo', precio: 1143.39, stock: 50, tipo: 'peso' },
            { codigo: 'P003', nombre: 'Muslos de Pollo', precio: 1309.71, stock: 30, tipo: 'peso' },
            { codigo: 'M001', nombre: 'Milanesa de Pechuga', precio: 1868.93, stock: 20, tipo: 'peso' },
            { codigo: 'M002', nombre: 'Milanesa de Muslo', precio: 1400.50, stock: 18, tipo: 'peso' },
            { codigo: 'A001', nombre: 'Aliño Completo', precio: 207.89, stock: 50, tipo: 'unidad' }
        ];

 let ventasDB = [];
        let currentSale = {
            numero: 'VEN-000001',
            cliente: null,
            productos: [],
            metodoPago: null,
            subtotal: 0,
            impuesto: 0,
            total: 0,
            fecha: new Date()
        };

        // Constantes
        const EXCHANGE_RATE = 207.89;
        const IVA_RATE = 0.16;
        let saleCounter = 1;

        // Inicialización
        document.addEventListener('DOMContentLoaded', function() {
            initializeApp();
            setupEventListeners();
        });

        function initializeApp() {
            // Actualizar fecha actual en formato DD/MM/AAAA
            const today = new Date();
            const day = String(today.getDate()).padStart(2, '0');
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const year = today.getFullYear();
            document.getElementById('current-date').textContent = `${day}/${month}/${year}`;
            focusCustomerInput();
        }

        function setupEventListeners() {
            // Paso 1: Cliente
            document.getElementById('customer-id').addEventListener('blur', searchCustomer);
            document.getElementById('save-customer').addEventListener('click', saveNewCustomer);
            document.getElementById('continue-to-products').addEventListener('click', () => showStep(2));

            // Paso 2: Productos
            document.getElementById('product-search').addEventListener('input', searchProducts);
            document.getElementById('product-search').addEventListener('keydown', handleProductKeydown);
            document.getElementById('continue-to-review').addEventListener('click', () => showStep(3));
            document.getElementById('back-to-customer').addEventListener('click', () => showStep(1));

            // Paso 4: Método de Pago
            document.querySelectorAll('.payment-btn').forEach(btn => {
                btn.addEventListener('click', selectPaymentMethod);
            });

            // Navegación entre pasos
            document.getElementById('continue-to-payment').addEventListener('click', showPaymentMethods);
            document.getElementById('back-to-products').addEventListener('click', () => showStep(2));
            document.getElementById('back-to-review').addEventListener('click', () => showStep(3));
            document.getElementById('back-to-payment-method').addEventListener('click', () => showStep(4));

        // Botones principales
            document.getElementById('process-sale').addEventListener('click', processSale);
            document.getElementById('new-sale').addEventListener('click', startNewSale);
            document.getElementById('cancel-sale').addEventListener('click', cancelSale);
            document.getElementById('close-cash-register').addEventListener('click', showCashRegisterClosure);

            // Modal
            document.getElementById('close-invoice').addEventListener('click', closeInvoiceModal);
            document.getElementById('print-invoice').addEventListener('click', printInvoice);
            document.getElementById('new-sale-after-invoice').addEventListener('click', startNewSaleFromInvoice);
        }

        // PASO 1: Búsqueda de Cliente
        function searchCustomer() {
            const customerId = document.getElementById('customer-id').value.trim().toUpperCase();
            
            if (!customerId) return;

            // Simular consulta SQL: SELECT * FROM clientes WHERE id = ?
            const customer = clientesDB.find(c => c.id === customerId);

            if (customer) {
                showExistingCustomer(customer);
            } else {
                showNewCustomerForm();
            }
        }

        function showExistingCustomer(customer) {
            currentSale.cliente = customer;
            
            document.getElementById('customer-form').classList.add('hidden');
            document.getElementById('customer-info').classList.remove('hidden');
            document.getElementById('customer-details').innerHTML = `
                <p><strong>ID:</strong> ${customer.id}</p>
                <p><strong>Nombre:</strong> ${customer.nombre}</p>
                <p><strong>Teléfono:</strong> ${customer.telefono}</p>
                <p><strong>Dirección:</strong> ${customer.direccion}</p>
            `;

            updateCurrentCustomerInfo(customer);
            completeStep(1);
        }

        function showNewCustomerForm() {
            document.getElementById('customer-info').classList.add('hidden');
            document.getElementById('customer-form').classList.remove('hidden');
            document.getElementById('customer-name').focus();
        }

        function saveNewCustomer() {
            const customerId = document.getElementById('customer-id').value.trim().toUpperCase();
            const customerName = document.getElementById('customer-name').value.trim();
            const customerPhone = document.getElementById('customer-phone').value.trim();
            const customerAddress = document.getElementById('customer-address').value.trim();

            if (!customerName || !customerPhone || !customerAddress) {
                alert('Por favor complete todos los campos obligatorios');
                return;
            }

            const newCustomer = {
                id: customerId,
                nombre: customerName,
                telefono: customerPhone,
                direccion: customerAddress
            };

            // Simular INSERT INTO clientes
            clientesDB.push(newCustomer);
            currentSale.cliente = newCustomer;

            showExistingCustomer(newCustomer);
        }

        // PASO 2: Búsqueda de Productos
        function searchProducts() {
            const query = document.getElementById('product-search').value.toLowerCase().trim();
            const suggestionsDiv = document.getElementById('product-suggestions');

            if (query.length < 1) {
                suggestionsDiv.classList.add('hidden');
                return;
            }

            // Simular consulta SQL: SELECT * FROM productos WHERE codigo LIKE ? OR nombre LIKE ?
            const filteredProducts = productosDB.filter(product => 
                product.codigo.toLowerCase().includes(query) || 
                product.nombre.toLowerCase().includes(query)
            );

            if (filteredProducts.length > 0) {
                suggestionsDiv.innerHTML = filteredProducts.map(product => `
                    <div class="autocomplete-item" data-codigo="${product.codigo}">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-mono text-sm text-purple-600">${product.codigo}</span>
                                <span class="ml-2 font-medium">${product.nombre}</span>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-semibold">Bs. ${product.precio.toFixed(2)}${product.tipo === 'peso' ? '/kg' : ''}</div>
                                <div class="text-xs text-gray-500">Stock: ${product.stock}${product.tipo === 'peso' ? ' kg' : ' unid'}</div>
                            </div>
                        </div>
                    </div>
                `).join('');

                suggestionsDiv.classList.remove('hidden');

                // Agregar event listeners
                suggestionsDiv.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('click', function() {
                        addProductToCart(this.dataset.codigo);
                    });
                });
            } else {
                suggestionsDiv.classList.add('hidden');
            }
        }

        function handleProductKeydown(e) {
            const suggestions = document.querySelectorAll('.autocomplete-item');
            const selected = document.querySelector('.autocomplete-item.selected');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (selected) {
                    selected.classList.remove('selected');
                    const next = selected.nextElementSibling || suggestions[0];
                    next.classList.add('selected');
                } else if (suggestions.length > 0) {
                    suggestions[0].classList.add('selected');
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (selected) {
                    selected.classList.remove('selected');
                    const prev = selected.previousElementSibling || suggestions[suggestions.length - 1];
                    prev.classList.add('selected');
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selected) {
                    addProductToCart(selected.dataset.codigo);
                } else if (suggestions.length > 0) {
                    addProductToCart(suggestions[0].dataset.codigo);
                }
            } else if (e.key === 'Escape') {
                document.getElementById('product-suggestions').classList.add('hidden');
            }
        }

        function addProductToCart(codigo) {
            // Simular consulta SQL: SELECT * FROM productos WHERE codigo = ?
            const product = productosDB.find(p => p.codigo === codigo);
            if (!product) return;

            if (product.stock <= 0) {
                showAlert('Producto sin stock disponible');
                return;
            }

            // Verificar si ya existe en el carrito
            const existingItem = currentSale.productos.find(p => p.codigo === codigo);
            
            if (existingItem) {
                // Para productos por peso, preguntar cantidad
                if (product.tipo === 'peso') {
                    showWeightModal(product.nombre, existingItem.cantidad.toString(), (peso) => {
                        if (peso && !isNaN(peso) && parseFloat(peso) > 0) {
                            const nuevoPeso = parseFloat(peso);
                            if (nuevoPeso <= product.stock) {
                                existingItem.cantidad = nuevoPeso;
                                updateCartDisplay();
                                updateTotals();
                                clearProductSearch();
                            } else {
                                showAlert('No hay suficiente stock disponible');
                            }
                        }
                    });
                    return;
                } else {
                    if (existingItem.cantidad < product.stock) {
                        existingItem.cantidad++;
                        updateCartDisplay();
                        updateTotals();
                        clearProductSearch();
                    } else {
                        showAlert('No hay suficiente stock disponible');
                        return;
                    }
                }
            } else {
                // Para productos por peso, preguntar cantidad
                if (product.tipo === 'peso') {
                    showWeightModal(product.nombre, '1.0', (peso) => {
                        if (peso && !isNaN(peso) && parseFloat(peso) > 0) {
                            const cantidad = parseFloat(peso);
                            if (cantidad > product.stock) {
                                showAlert('No hay suficiente stock disponible');
                                return;
                            }
                            
                            currentSale.productos.push({
                                codigo: product.codigo,
                                nombre: product.nombre,
                                precio: product.precio,
                                cantidad: cantidad,
                                tipo: product.tipo
                            });

                            updateCartDisplay();
                            updateTotals();
                            clearProductSearch();
                            showContinueButton();
                        }
                    });
                    return;
                } else {
                    currentSale.productos.push({
                        codigo: product.codigo,
                        nombre: product.nombre,
                        precio: product.precio,
                        cantidad: 1,
                        tipo: product.tipo
                    });
                    
                    updateCartDisplay();
                    updateTotals();
                    clearProductSearch();
                }
            }

            showContinueButton();
        }

        function showContinueButton() {
            if (currentSale.productos.length > 0) {
                document.getElementById('continue-to-review').classList.remove('hidden');
            }
        }

        function updateCartDisplay() {
            const tbody = document.getElementById('cart-items');
            const emptyRow = document.getElementById('empty-cart');

            if (currentSale.productos.length === 0) {
                emptyRow.style.display = 'table-row';
                return;
            }

            emptyRow.style.display = 'none';
            
            tbody.innerHTML = currentSale.productos.map((item, index) => `
                <tr>
                    <td class="font-mono text-sm">${item.codigo}</td>
                    <td class="font-medium">${item.nombre}</td>
                    <td class="text-center">
                        <div class="flex items-center justify-center space-x-2">
                            ${item.tipo === 'peso' ? 
                                `<button onclick="editWeight(${index})" class="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 flex items-center">
                                    <i class="fas fa-edit mr-1"></i>
                                    ${item.cantidad} kg
                                </button>` :
                                `<button onclick="decreaseQuantity(${index})" class="w-7 h-7 bg-red-500 text-white rounded text-xs hover:bg-red-600 flex items-center justify-center">-</button>
                                <span class="w-10 text-center font-semibold">${item.cantidad}</span>
                                <button onclick="increaseQuantity(${index})" class="w-7 h-7 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex items-center justify-center">+</button>`
                            }
                        </div>
                    </td>
                    <td class="text-right">Bs. ${item.precio.toFixed(2)}${item.tipo === 'peso' ? '/kg' : ''}</td>
                    <td class="text-right font-semibold">Bs. ${(item.cantidad * item.precio).toFixed(2)}</td>
                    <td class="text-center">
                        <button onclick="removeFromCart(${index})" class="w-8 h-8 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center transition-all">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        function increaseQuantity(index) {
            const item = currentSale.productos[index];
            const product = productosDB.find(p => p.codigo === item.codigo);
            
            if (item.cantidad < product.stock) {
                item.cantidad++;
                updateCartDisplay();
                updateTotals();
            } else {
                alert('No hay suficiente stock disponible');
            }
        }

        function decreaseQuantity(index) {
            const item = currentSale.productos[index];
            
            if (item.cantidad > 1) {
                item.cantidad--;
                updateCartDisplay();
                updateTotals();
            }
        }

        function editWeight(index) {
            const item = currentSale.productos[index];
            const product = productosDB.find(p => p.codigo === item.codigo);
            
            showWeightModal(item.nombre, item.cantidad.toString(), (peso) => {
                if (peso && !isNaN(peso) && parseFloat(peso) > 0) {
                    const nuevoPeso = parseFloat(peso);
                    if (nuevoPeso <= product.stock) {
                        item.cantidad = nuevoPeso;
                        updateCartDisplay();
                        updateTotals();
                    } else {
                        showAlert('No hay suficiente stock disponible');
                    }
                }
            });
        }

        function removeFromCart(index) {
            const product = currentSale.productos[index];
            showConfirmModal(
                `¿Eliminar ${product.nombre} del carrito?`,
                'Esta acción no se puede deshacer.',
                () => {
                    currentSale.productos.splice(index, 1);
                    updateCartDisplay();
                    updateTotals();
                    
                    if (currentSale.productos.length === 0) {
                        document.getElementById('continue-to-review').classList.add('hidden');
                    }
                }
            );
        }

        function updateTotals() {
            currentSale.subtotal = currentSale.productos.reduce((sum, item) => 
                sum + (item.cantidad * item.precio), 0);
            currentSale.impuesto = currentSale.subtotal * IVA_RATE;
            currentSale.total = currentSale.subtotal + currentSale.impuesto;

            document.getElementById('subtotal-amount').textContent = `Bs. ${currentSale.subtotal.toFixed(2)}`;
            document.getElementById('tax-amount').textContent = `Bs. ${currentSale.impuesto.toFixed(2)}`;
            document.getElementById('total-bs').textContent = `Bs. ${currentSale.total.toFixed(2)}`;
            document.getElementById('total-usd').textContent = `$ ${(currentSale.total / EXCHANGE_RATE).toFixed(2)}`;
        }

        function clearProductSearch() {
            document.getElementById('product-search').value = '';
            document.getElementById('product-suggestions').classList.add('hidden');
            document.getElementById('product-search').focus();
        }

        // PASO 4: Método de Pago
        function showPaymentMethods() {
            completeStep(3);
            showStep(4);
        }

        function selectPaymentMethod() {
            if (currentSale.productos.length === 0) {
                showAlert('Debe agregar al menos un producto antes de seleccionar el método de pago');
                return;
            }

            // Remover selección anterior
            document.querySelectorAll('.payment-btn').forEach(btn => {
                btn.classList.remove('selected');
            });

            // Seleccionar método actual
            this.classList.add('selected');
            const method = this.dataset.method;

            // Manejar métodos especiales que requieren información adicional
            if (method === 'transferencia' || method === 'pago_movil') {
                showTransferDetailsModal(method);
            } else if (method === 'mixto') {
                showMixedPaymentModal();
            } else {
                currentSale.metodoPago = method;
                currentSale.paymentDetails = null;
                completeStep(4);
                showPaymentProcessing();
                // Mostrar botón de procesar venta para todos los métodos
                document.getElementById('process-sale').classList.remove('hidden');
            }
        }

        // PASO 5: Procesar Pago
        function showPaymentProcessing() {
            showStep(5);
            const paymentDetails = document.getElementById('payment-details');
            const method = currentSale.metodoPago;

            let content = '';

            switch(method) {
                case 'efectivo_bs':
                    content = `
                        <div class="space-y-4">
                            <h3 class="font-semibold text-lg">Pago en Efectivo (Bolívares)</h3>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Total a Pagar:</label>
                                <div class="text-2xl font-bold text-purple-600">Bs. ${currentSale.total.toFixed(2)}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Monto Recibido (Bs):</label>
                                <input type="number" id="amount-received" class="input-field w-full text-lg" 
                                       placeholder="0.00" step="0.01" min="0">
                            </div>
                            <div id="change-display" class="hidden">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Cambio a Devolver:</label>
                                <div id="change-amount" class="text-xl font-bold text-green-600"></div>
                            </div>
                        </div>
                    `;
                    break;

                case 'efectivo_usd':
                    content = `
                        <div class="space-y-4">
                            <h3 class="font-semibold text-lg">Pago en Efectivo (Dólares)</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Total (Bs):</label>
                                    <div class="text-lg font-bold text-purple-600">Bs. ${currentSale.total.toFixed(2)}</div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Total (USD):</label>
                                    <div class="text-lg font-bold text-green-600">$ ${(currentSale.total / EXCHANGE_RATE).toFixed(2)}</div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Monto Recibido (USD):</label>
                                <input type="number" id="amount-received-usd" class="input-field w-full text-lg" 
                                       placeholder="0.00" step="0.01" min="0">
                            </div>
                            <div id="change-display-usd" class="hidden">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Cambio a Devolver:</label>
                                <div id="change-amount-usd" class="text-xl font-bold text-green-600"></div>
                            </div>
                            <div class="text-xs text-gray-500">
                                Tasa de cambio: 1 USD = ${EXCHANGE_RATE} Bs
                            </div>
                        </div>
                    `;
                    break;

                default:
                    content = `
                        <div class="space-y-4">
                            <h3 class="font-semibold text-lg">Pago por ${getPaymentMethodName(method)}</h3>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Total a Pagar:</label>
                                <div class="text-2xl font-bold text-purple-600">Bs. ${currentSale.total.toFixed(2)}</div>
                            </div>
                            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p class="text-green-800">
                                    <i class="fas fa-check-circle mr-2"></i>
                                    Confirme el pago en el dispositivo/aplicación correspondiente
                                </p>
                            </div>
                        </div>
                    `;
            }

            paymentDetails.innerHTML = content;

            // Agregar event listeners para cálculo de cambio
            if (method === 'efectivo_bs') {
                document.getElementById('amount-received').addEventListener('input', calculateChange);
            } else if (method === 'efectivo_usd') {
                document.getElementById('amount-received-usd').addEventListener('input', calculateChangeUSD);
            }

            document.getElementById('process-sale').classList.remove('hidden');
        }

        function calculateChange() {
            const received = parseFloat(document.getElementById('amount-received').value) || 0;
            const total = currentSale.total;
            const change = received - total;

            const changeDisplay = document.getElementById('change-display');
            const changeAmount = document.getElementById('change-amount');

            if (received >= total) {
                changeDisplay.classList.remove('hidden');
                changeAmount.textContent = `Bs. ${change.toFixed(2)}`;
                changeAmount.className = change > 0 ? 'text-xl font-bold text-green-600' : 'text-xl font-bold text-gray-600';
            } else {
                changeDisplay.classList.add('hidden');
            }
        }

        function calculateChangeUSD() {
            const receivedUSD = parseFloat(document.getElementById('amount-received-usd').value) || 0;
            const totalUSD = currentSale.total / EXCHANGE_RATE;
            const changeUSD = receivedUSD - totalUSD;

            const changeDisplay = document.getElementById('change-display-usd');
            const changeAmount = document.getElementById('change-amount-usd');

            if (receivedUSD >= totalUSD) {
                changeDisplay.classList.remove('hidden');
                changeAmount.textContent = `$ ${changeUSD.toFixed(2)} (Bs. ${(changeUSD * EXCHANGE_RATE).toFixed(2)})`;
                changeAmount.className = changeUSD > 0 ? 'text-xl font-bold text-green-600' : 'text-xl font-bold text-gray-600';
            } else {
                changeDisplay.classList.add('hidden');
            }
        }

        function getPaymentMethodName(method) {
            const names = {
                'punto_venta': 'Punto de Venta',
                'transferencia': 'Transferencia Bancaria',
                'pago_movil': 'Pago Móvil',
                'mixto': 'Pago Mixto'
            };
            return names[method] || method;
        }

        // PASO 6: Procesar Venta
        function processSale() {
            // Validar pago
            if (currentSale.metodoPago === 'efectivo_bs') {
                const received = parseFloat(document.getElementById('amount-received').value) || 0;
                if (received < currentSale.total) {
                    showAlert('El monto recibido es insuficiente para completar la venta');
                    return;
                }
            } else if (currentSale.metodoPago === 'efectivo_usd') {
                const receivedUSD = parseFloat(document.getElementById('amount-received-usd').value) || 0;
                const totalUSD = currentSale.total / EXCHANGE_RATE;
                if (receivedUSD < totalUSD) {
                    showAlert('El monto recibido en USD es insuficiente para completar la venta');
                    return;
                }
            }

            // Simular transacciones de base de datos
            try {
                // 1. INSERT INTO ventas
                const saleRecord = {
                    id: currentSale.numero,
                    cliente_id: currentSale.cliente.id,
                    fecha: currentSale.fecha,
                    subtotal: currentSale.subtotal,
                    impuesto: currentSale.impuesto,
                    total: currentSale.total,
                    metodo_pago: currentSale.metodoPago,
                    productos: [...currentSale.productos]
                };
                ventasDB.push(saleRecord);

                // 2. UPDATE productos SET stock = stock - cantidad
                currentSale.productos.forEach(item => {
                    const product = productosDB.find(p => p.codigo === item.codigo);
                    if (product) {
                        product.stock -= item.cantidad;
                    }
                });

                // 3. Generar factura
                completeStep(5);
                completeStep(6);
                generateInvoice();

            } catch (error) {
                alert('Error al procesar la venta: ' + error.message);
            }
        }

        function generateInvoice() {
            const invoiceContent = document.getElementById('invoice-content');
            
            // Formatear fecha y hora
            const fechaFactura = currentSale.fecha.toLocaleDateString('es-VE', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            });
            const horaFactura = currentSale.fecha.toLocaleTimeString('es-VE', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            invoiceContent.innerHTML = `
                <div class="bg-white text-sm">
                    <!-- Header SENIAT -->
                    <div class="text-center mb-4">
                        <p class="font-bold text-lg">SENIAT</p>
                        <p class="text-xs">RIF J-085030140</p>
                    </div>

                    <!-- Información de la Empresa -->
                    <div class="text-center border-b-2 border-black pb-3 mb-4">
                        <h1 class="font-bold text-base">ORGANISMO DE INTEGRACIÓN COOPERATIVA CECOSESOLA, R.L</h1>
                        <h2 class="font-bold text-sm">(CECOSESOLA)</h2>
                        <p class="text-xs mt-2">AV. LOS HORCONES - AL FINAL CASA NRO S/N</p>
                        <p class="text-xs">SECTOR RUIZ PINEDA I BARQUISIMETO</p>
                        <p class="text-xs">ESTADO LARA, ZONA POSTAL 3001</p>
                    </div>

                    <!-- Información del Cliente -->
                    <div class="mb-4 text-xs">
                        <p><strong>RIF/C.I.:</strong> ${currentSale.cliente.id}</p>
                        <p><strong>Razón Social:</strong> ${currentSale.cliente.nombre}</p>
                        <p><strong>Dirección:</strong> ${currentSale.cliente.direccion}</p>
                        <p><strong>Teléfono:</strong> ${currentSale.cliente.telefono}</p>
                        <p><strong>Cajero:</strong> Sistema Na'Guara</p>
                    </div>

                    <!-- Información de la Factura -->
                    <div class="text-center mb-4">
                        <h2 class="font-bold text-lg">FACTURA</h2>
                        <div class="flex justify-between text-xs mt-2">
                            <span><strong>Factura:</strong> ${currentSale.numero}</span>
                            <span><strong>Fecha:</strong> ${fechaFactura}</span>
                            <span><strong>Hora:</strong> ${horaFactura}</span>
                        </div>
                    </div>

                    <!-- Productos Comprados -->
                    <div class="mb-4">
                        <h3 class="font-bold text-center mb-2">PRODUCTOS COMPRADOS</h3>
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="border-b border-black">
                                    <th class="text-left py-1">Producto</th>
                                    <th class="text-center py-1">Cant.</th>
                                    <th class="text-right py-1">Precio</th>
                                    <th class="text-right py-1">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${currentSale.productos.map(item => `
                                    <tr class="border-b border-gray-300">
                                        <td class="py-1">${item.nombre}</td>
                                        <td class="text-center py-1">${item.cantidad}${item.tipo === 'peso' ? ' kg' : ''}</td>
                                        <td class="text-right py-1">Bs. ${item.precio.toFixed(2)}</td>
                                        <td class="text-right py-1">Bs. ${(item.cantidad * item.precio).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Totales -->
                    <div class="border-t-2 border-black pt-2 mb-4">
                        <div class="text-xs space-y-1">
                            <div class="flex justify-between">
                                <span>Subtotal:</span>
                                <span>Bs. ${currentSale.subtotal.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>IVA (16%):</span>
                                <span>Bs. ${currentSale.impuesto.toFixed(2)}</span>
                            </div>
                            ${currentSale.metodoPago !== 'efectivo_bs' && currentSale.metodoPago !== 'efectivo_usd' ? `
                            <div class="flex justify-between">
                                <span>${getPaymentMethodName(currentSale.metodoPago)}:</span>
                                <span>Bs. ${currentSale.total.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="flex justify-between font-bold text-base border-t border-black pt-1">
                                <span>TOTAL:</span>
                                <span>Bs. ${currentSale.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="text-center mt-6 pt-3 border-t border-gray-400">
                        <p class="text-xs font-bold">¡GRACIAS POR SU COMPRA!</p>
                        <p class="text-xs mt-1">Tasa de cambio: 1 USD = ${EXCHANGE_RATE} Bs</p>
                        <p class="text-xs mt-1">Sistema Na'Guara - CECOSESOLA</p>
                    </div>
                </div>
            `;

            document.getElementById('invoice-modal').classList.remove('hidden');
        }

        // Funciones de utilidad
        function showStep(stepNumber) {
            // Ocultar todos los contenidos de pasos
            for (let i = 1; i <= 6; i++) {
                const stepContent = document.getElementById(`step-${i}-content`);
                if (stepContent) {
                    stepContent.classList.add('hidden');
                }
            }

            // Mostrar el paso actual
            const currentStepContent = document.getElementById(`step-${stepNumber}-content`);
            if (currentStepContent) {
                currentStepContent.classList.remove('hidden');
                currentStepContent.classList.add('fade-in');
            }

            // Mostrar/ocultar botones de navegación según el paso
            updateNavigationButtons(stepNumber);

            // Actualizar indicador de paso activo
            updateStepIndicator(stepNumber);
        }

        function updateNavigationButtons(stepNumber) {
            // Paso 3: Mostrar botón de volver a productos cuando hay productos
            if (stepNumber === 3 && currentSale.productos.length > 0) {
                document.getElementById('back-to-products').classList.remove('hidden');
                document.getElementById('continue-to-payment').classList.remove('hidden');
            }
        }

        function completeStep(stepNumber) {
            const step = document.getElementById(`step-${stepNumber}`);
            if (step) {
                step.classList.remove('pending', 'active');
                step.classList.add('completed');
            }
        }

        function updateStepIndicator(activeStep) {
            for (let i = 1; i <= 6; i++) {
                const step = document.getElementById(`step-${i}`);
                if (step) {
                    step.classList.remove('active');
                    if (i === activeStep && !step.classList.contains('completed')) {
                        step.classList.add('active');
                    }
                }
            }
        }

        function updateCurrentCustomerInfo(customer) {
            const customerInfo = document.getElementById('current-customer-info');
            const customerDetails = document.getElementById('current-customer-details');
            
            customerDetails.innerHTML = `
                <p class="text-gray-600"><strong>ID:</strong> ${customer.id}</p>
                <p class="text-gray-800"><strong>Nombre:</strong> ${customer.nombre}</p>
                <p class="text-gray-600"><strong>Teléfono:</strong> ${customer.telefono}</p>
            `;
            
            customerInfo.style.display = 'block';
        }

        function focusCustomerInput() {
            document.getElementById('customer-id').focus();
        }

        function startNewSale() {
            // Reiniciar venta actual
            saleCounter++;
            currentSale = {
                numero: `VEN-${String(saleCounter).padStart(6, '0')}`,
                cliente: null,
                productos: [],
                metodoPago: null,
                subtotal: 0,
                impuesto: 0,
                total: 0,
                fecha: new Date()
            };

            // Actualizar número de venta
            document.getElementById('sale-number').textContent = currentSale.numero;

            // Reiniciar interfaz
            resetInterface();
            showStep(1);
            focusCustomerInput();
        }

        function cancelSale() {
            showConfirmModal(
                '¿Cancelar la venta actual?',
                'Se perderán todos los datos ingresados. Esta acción no se puede deshacer.',
                () => {
                    startNewSale();
                }
            );
        }

        function resetInterface() {
            // Limpiar formularios
            document.getElementById('customer-id').value = '';
            document.getElementById('customer-name').value = '';
            document.getElementById('customer-phone').value = '';
            document.getElementById('customer-address').value = '';
            document.getElementById('product-search').value = '';

            // Ocultar elementos
            document.getElementById('customer-form').classList.add('hidden');
            document.getElementById('customer-info').classList.add('hidden');
            document.getElementById('current-customer-info').style.display = 'none';
            document.getElementById('continue-to-review').classList.add('hidden');
            document.getElementById('continue-to-payment').classList.add('hidden');
            document.getElementById('back-to-products').classList.add('hidden');
            document.getElementById('process-sale').classList.add('hidden');
            document.getElementById('product-suggestions').classList.add('hidden');

            // Reiniciar pasos
            for (let i = 1; i <= 6; i++) {
                const step = document.getElementById(`step-${i}`);
                if (step) {
                    step.classList.remove('active', 'completed');
                    step.classList.add('pending');
                }
            }
            document.getElementById('step-1').classList.remove('pending');
            document.getElementById('step-1').classList.add('active');

            // Reiniciar carrito
            updateCartDisplay();
            updateTotals();

            // Remover selección de métodos de pago
            document.querySelectorAll('.payment-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
        }

        function closeInvoiceModal() {
            document.getElementById('invoice-modal').classList.add('hidden');
        }

        function printInvoice() {
            const invoiceContent = document.getElementById('invoice-content').innerHTML;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Factura ${currentSale.numero}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .text-center { text-align: center; }
                            .text-right { text-align: right; }
                            .font-bold { font-weight: bold; }
                            .text-purple-600 { color: #7c3aed; }
                        </style>
                    </head>
                    <body>
                        ${invoiceContent}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }

        function startNewSaleFromInvoice() {
            closeInvoiceModal();
            startNewSale();
        }

        // Funciones para modales personalizados
        function showConfirmModal(title, message, callback) {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            modal.classList.remove('hidden');
            
            const acceptBtn = document.getElementById('accept-confirm');
            const cancelBtn = document.getElementById('cancel-confirm');
            const closeBtn = document.getElementById('close-confirm-modal');
            
            const handleAccept = () => {
                modal.classList.add('hidden');
                callback();
                cleanup();
            };
            
            const handleCancel = () => {
                modal.classList.add('hidden');
                cleanup();
            };
            
            const cleanup = () => {
                acceptBtn.removeEventListener('click', handleAccept);
                cancelBtn.removeEventListener('click', handleCancel);
                closeBtn.removeEventListener('click', handleCancel);
            };
            
            acceptBtn.addEventListener('click', handleAccept);
            cancelBtn.addEventListener('click', handleCancel);
            closeBtn.addEventListener('click', handleCancel);
        }

        function showWeightModal(productName, defaultWeight, callback) {
            const modal = document.getElementById('weight-modal');
            const productNameEl = document.getElementById('weight-product-name');
            const weightInput = document.getElementById('weight-input');
            const calcDiv = document.getElementById('weight-calculation');
            
            productNameEl.textContent = `¿Cuántos kilogramos de ${productName}?`;
            weightInput.value = defaultWeight;
            calcDiv.classList.add('hidden');
            
            // Encontrar el producto para mostrar el precio
            const product = productosDB.find(p => p.nombre === productName);
            if (product) {
                weightInput.addEventListener('input', function() {
                    const weight = parseFloat(this.value) || 0;
                    if (weight > 0) {
                        const total = weight * product.precio;
                        document.getElementById('calc-weight').textContent = weight.toFixed(2);
                        document.getElementById('calc-price').textContent = product.precio.toFixed(2);
                        document.getElementById('calc-total').textContent = total.toFixed(2);
                        calcDiv.classList.remove('hidden');
                    } else {
                        calcDiv.classList.add('hidden');
                    }
                });
            }
            
            modal.classList.remove('hidden');
            weightInput.focus();
            weightInput.select();
            
            // Event listeners
            const confirmBtn = document.getElementById('confirm-weight');
            const cancelBtn = document.getElementById('cancel-weight');
            const closeBtn = document.getElementById('close-weight-modal');
            
            const handleConfirm = () => {
                const weight = weightInput.value;
                modal.classList.add('hidden');
                callback(weight);
                cleanup();
            };
            
            const handleCancel = () => {
                modal.classList.add('hidden');
                cleanup();
            };
            
            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                closeBtn.removeEventListener('click', handleCancel);
                weightInput.removeEventListener('keydown', handleKeydown);
            };
            
            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            closeBtn.addEventListener('click', handleCancel);
            weightInput.addEventListener('keydown', handleKeydown);
        }

        function showAlert(message) {
            const modal = document.getElementById('alert-modal');
            const messageEl = document.getElementById('alert-message');

            messageEl.textContent = message;
            modal.classList.remove('hidden');

            const confirmBtn = document.getElementById('confirm-alert');
            const closeBtn = document.getElementById('close-alert-modal');

            const handleClose = () => {
                modal.classList.add('hidden');
                confirmBtn.removeEventListener('click', handleClose);
                closeBtn.removeEventListener('click', handleClose);
            };

            confirmBtn.addEventListener('click', handleClose);
            closeBtn.addEventListener('click', handleClose);
        }

        // Funciones para métodos de pago avanzados
        function showTransferDetailsModal(method) {
            const modal = document.getElementById('transfer-details-modal');
            const titleEl = document.getElementById('transfer-title');
            const detailsEl = document.getElementById('transfer-details');

            if (method === 'transferencia') {
                titleEl.textContent = 'Detalles de Transferencia Bancaria';
                detailsEl.innerHTML = `
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Banco Destino:</label>
                            <select id="transfer-bank" class="input-field w-full">
                                <option value="">Seleccionar banco...</option>
                                <option value="banco_venezuela">Banco de Venezuela</option>
                                <option value="banco_nacional">Banco Nacional de Crédito</option>
                                <option value="banco_mercantil">Banco Mercantil</option>
                                <option value="banco_banesco">Banesco</option>
                                <option value="banco_provincial">Banco Provincial</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Número de Cuenta:</label>
                            <input type="text" id="transfer-account" class="input-field w-full" placeholder="Ej: 0102-1234-5678-9012">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Titular de la Cuenta:</label>
                            <input type="text" id="transfer-holder" class="input-field w-full" placeholder="Nombre del titular">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Referencia de Pago:</label>
                            <input type="text" id="transfer-reference" class="input-field w-full" placeholder="Número de referencia">
                        </div>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p class="text-blue-800 text-sm">
                                <i class="fas fa-info-circle mr-2"></i>
                                El cliente debe realizar la transferencia bancaria por el monto total de Bs. ${currentSale.total.toFixed(2)}
                            </p>
                        </div>
                    </div>
                `;
            } else if (method === 'pago_movil') {
                titleEl.textContent = 'Detalles de Pago Móvil';
                detailsEl.innerHTML = `
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Banco:</label>
                            <select id="pago-movil-bank" class="input-field w-full">
                                <option value="">Seleccionar banco...</option>
                                <option value="banco_venezuela">Banco de Venezuela</option>
                                <option value="banco_nacional">Banco Nacional de Crédito</option>
                                <option value="banco_mercantil">Banco Mercantil</option>
                                <option value="banco_banesco">Banesco</option>
                                <option value="banco_provincial">Banco Provincial</option>
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Teléfono:</label>
                                <input type="tel" id="pago-movil-phone" class="input-field w-full" placeholder="0412-123-4567">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Cédula:</label>
                                <input type="text" id="pago-movil-id" class="input-field w-full" placeholder="V-12345678">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Referencia de Pago:</label>
                            <input type="text" id="pago-movil-reference" class="input-field w-full" placeholder="Número de referencia">
                        </div>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p class="text-blue-800 text-sm">
                                <i class="fas fa-info-circle mr-2"></i>
                                El cliente debe realizar el pago móvil por el monto total de Bs. ${currentSale.total.toFixed(2)}
                            </p>
                        </div>
                    </div>
                `;
            }

            modal.classList.remove('hidden');

            const confirmBtn = document.getElementById('confirm-transfer');
            const cancelBtn = document.getElementById('cancel-transfer');
            const closeBtn = document.getElementById('close-transfer-modal');

            const handleConfirm = () => {
                // Validar campos requeridos
                let isValid = true;
                let paymentDetails = {};

                if (method === 'transferencia') {
                    const bank = document.getElementById('transfer-bank').value;
                    const account = document.getElementById('transfer-account').value.trim();
                    const holder = document.getElementById('transfer-holder').value.trim();
                    const reference = document.getElementById('transfer-reference').value.trim();

                    if (!bank || !account || !holder || !reference) {
                        showAlert('Por favor complete todos los campos requeridos para la transferencia');
                        return;
                    }

                    paymentDetails = {
                        tipo: 'transferencia',
                        banco: bank,
                        cuenta: account,
                        titular: holder,
                        referencia: reference
                    };
                } else if (method === 'pago_movil') {
                    const bank = document.getElementById('pago-movil-bank').value;
                    const phone = document.getElementById('pago-movil-phone').value.trim();
                    const id = document.getElementById('pago-movil-id').value.trim();
                    const reference = document.getElementById('pago-movil-reference').value.trim();

                    if (!bank || !phone || !id || !reference) {
                        showAlert('Por favor complete todos los campos requeridos para el pago móvil');
                        return;
                    }

                    paymentDetails = {
                        tipo: 'pago_movil',
                        banco: bank,
                        telefono: phone,
                        cedula: id,
                        referencia: reference
                    };
                }

                modal.classList.add('hidden');
                currentSale.metodoPago = method;
                currentSale.paymentDetails = paymentDetails;
                completeStep(4);
                showPaymentProcessing();
                document.getElementById('process-sale').classList.remove('hidden');
                cleanup();
            };

            const handleCancel = () => {
                modal.classList.add('hidden');
                cleanup();
            };

            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                closeBtn.removeEventListener('click', handleCancel);
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            closeBtn.addEventListener('click', handleCancel);
        }

        // Función para cerrar caja
        function showCashRegisterClosure() {
            if (ventasDB.length === 0) {
                showAlert('No hay ventas registradas para cerrar la caja');
                return;
            }

            // Calcular totales del día
            const today = new Date();
            const todayString = today.toDateString();

            const todaySales = ventasDB.filter(sale => {
                const saleDate = new Date(sale.fecha).toDateString();
                return saleDate === todayString;
            });

            if (todaySales.length === 0) {
                showAlert('No hay ventas registradas para hoy');
                return;
            }

            const totalVentas = todaySales.reduce((sum, sale) => sum + sale.total, 0);
            const totalIVA = todaySales.reduce((sum, sale) => sum + sale.impuesto, 0);
            const totalSubtotal = todaySales.reduce((sum, sale) => sum + sale.subtotal, 0);

            // Contar métodos de pago
            const paymentMethods = {};
            todaySales.forEach(sale => {
                const method = sale.metodo_pago;
                if (!paymentMethods[method]) {
                    paymentMethods[method] = { count: 0, total: 0 };
                }
                paymentMethods[method].count++;
                paymentMethods[method].total += sale.total;
            });

            // Crear contenido del modal de cierre de caja
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.id = 'cash-closure-modal';

            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-800">Cierre de Caja</h2>
                            <button id="close-cash-closure-modal" class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        <div class="space-y-6">
                            <!-- Información del día -->
                            <div class="bg-gray-50 rounded-lg p-4">
                                <h3 class="font-semibold text-lg mb-3">Resumen del Día</h3>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="font-medium">Fecha:</span>
                                        <span>${today.toLocaleDateString('es-VE')}</span>
                                    </div>
                                    <div>
                                        <span class="font-medium">Total Ventas:</span>
                                        <span>${todaySales.length}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Resumen financiero -->
                            <div class="bg-blue-50 rounded-lg p-4">
                                <h3 class="font-semibold text-lg mb-3">Resumen Financiero</h3>
                                <div class="space-y-2">
                                    <div class="flex justify-between">
                                        <span>Subtotal:</span>
                                        <span class="font-semibold">Bs. ${totalSubtotal.toFixed(2)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span>IVA (16%):</span>
                                        <span class="font-semibold">Bs. ${totalIVA.toFixed(2)}</span>
                                    </div>
                                    <div class="flex justify-between text-lg font-bold border-t pt-2">
                                        <span>Total:</span>
                                        <span>Bs. ${totalVentas.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Métodos de pago -->
                            <div class="bg-green-50 rounded-lg p-4">
                                <h3 class="font-semibold text-lg mb-3">Métodos de Pago</h3>
                                <div class="space-y-2">
                                    ${Object.entries(paymentMethods).map(([method, data]) => `
                                        <div class="flex justify-between">
                                            <span>${getPaymentMethodName(method)} (${data.count} ventas):</span>
                                            <span class="font-semibold">Bs. ${data.total.toFixed(2)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Lista de ventas -->
                            <div class="bg-white border rounded-lg p-4">
                                <h3 class="font-semibold text-lg mb-3">Detalle de Ventas</h3>
                                <div class="max-h-60 overflow-y-auto">
                                    <table class="w-full text-sm">
                                        <thead>
                                            <tr class="border-b">
                                                <th class="text-left py-2">Factura</th>
                                                <th class="text-left py-2">Cliente</th>
                                                <th class="text-right py-2">Total</th>
                                                <th class="text-center py-2">Método</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${todaySales.map(sale => `
                                                <tr class="border-b">
                                                    <td class="py-2">${sale.id}</td>
                                                    <td class="py-2">${sale.cliente_id}</td>
                                                    <td class="text-right py-2 font-semibold">Bs. ${sale.total.toFixed(2)}</td>
                                                    <td class="text-center py-2">${getPaymentMethodName(sale.metodo_pago)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-end space-x-3 mt-6">
                            <button id="print-cash-closure" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                                <i class="fas fa-print mr-2"></i>Imprimir Reporte
                            </button>
                            <button id="confirm-cash-closure" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                                <i class="fas fa-check mr-2"></i>Confirmar Cierre
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Event listeners
            document.getElementById('close-cash-closure-modal').addEventListener('click', () => {
                modal.remove();
            });

            document.getElementById('print-cash-closure').addEventListener('click', () => {
                printCashClosureReport(todaySales, totalSubtotal, totalIVA, totalVentas, paymentMethods);
            });

            document.getElementById('confirm-cash-closure').addEventListener('click', () => {
                showConfirmModal(
                    '¿Confirmar cierre de caja?',
                    'Esta acción registrará el cierre de caja del día. ¿Desea continuar?',
                    () => {
                        // Aquí se podría guardar el cierre de caja en una base de datos
                        showAlert('Caja cerrada exitosamente');
                        modal.remove();
                        // Reiniciar ventas del día (opcional)
                        // ventasDB = ventasDB.filter(sale => new Date(sale.fecha).toDateString() !== todayString);
                    }
                );
            });
        }

        function printCashClosureReport(sales, subtotal, iva, total, paymentMethods) {
            const printWindow = window.open('', '_blank');
            const today = new Date();

            printWindow.document.write(`
                <html>
                    <head>
                        <title>Reporte de Cierre de Caja</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; }
                            .header { text-align: center; margin-bottom: 30px; }
                            .section { margin-bottom: 20px; }
                            .total { font-weight: bold; font-size: 18px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .text-right { text-align: right; }
                            .text-center { text-align: center; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>REPORTE DE CIERRE DE CAJA</h1>
                            <h2>CECOSESOLA</h2>
                            <p>Fecha: ${today.toLocaleDateString('es-VE')}</p>
                        </div>

                        <div class="section">
                            <h3>Resumen Financiero</h3>
                            <p>Subtotal: Bs. ${subtotal.toFixed(2)}</p>
                            <p>IVA (16%): Bs. ${iva.toFixed(2)}</p>
                            <p class="total">Total: Bs. ${total.toFixed(2)}</p>
                        </div>

                        <div class="section">
                            <h3>Métodos de Pago</h3>
                            ${Object.entries(paymentMethods).map(([method, data]) => `
                                <p>${getPaymentMethodName(method)}: ${data.count} ventas - Bs. ${data.total.toFixed(2)}</p>
                            `).join('')}
                        </div>

                        <div class="section">
                            <h3>Detalle de Ventas</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Factura</th>
                                        <th>Cliente</th>
                                        <th class="text-right">Total</th>
                                        <th class="text-center">Método</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sales.map(sale => `
                                        <tr>
                                            <td>${sale.id}</td>
                                            <td>${sale.cliente_id}</td>
                                            <td class="text-right">Bs. ${sale.total.toFixed(2)}</td>
                                            <td class="text-center">${getPaymentMethodName(sale.metodo_pago)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div class="section" style="text-align: center; margin-top: 50px;">
                            <p>______________________________</p>
                            <p>Firma del Cajero</p>
                        </div>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }


