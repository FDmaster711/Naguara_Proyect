class ProductosManager {
    constructor() {
        this.productos = [];
        this.categorias = [];
        this.tasasIva = [];
        this.proveedores = [];
        this.filtros = {
            categoria: '',
            stock: '',
            busqueda: ''
        };
        this.pagination = {
            currentPage: 1,
            totalPages: 1,
            totalProducts: 0,
            limit: 10
        };
        this.init();
    }

    async init() {
        try {
            await this.cargarDatosIniciales();
            this.setupEventListeners();
            this.actualizarResumen();
            console.log('✅ Sistema de productos inicializado');
        } catch (error) {
            console.error('Error inicializando productos:', error);
            this.mostrarError('Error al inicializar el sistema de productos');
        }
    }

    async cargarDatosIniciales() {
        try {
            const [productos, categorias, tasasIva] = await Promise.allSettled([
                this.cargarProductos(1, 10),
                this.cargarCategorias(),
                this.cargarTasasIva()
            ]);

            if (productos.status === 'rejected') {
                console.error('Error cargando productos:', productos.reason);
            }
            if (categorias.status === 'rejected') {
                console.error('Error cargando categorías:', categorias.reason);
            }
            if (tasasIva.status === 'rejected') {
                console.error('Error cargando tasas IVA:', tasasIva.reason);
            }

        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            throw error;
        }
    }

    async cargarProductos(page = 1, limit = 10) {
        try {
            console.log(`📦 Cargando productos página ${page}, límite ${limit}...`);
            
            const url = new URL('/api/productos', window.location.origin);
            url.searchParams.append('page', page);
            url.searchParams.append('limit', limit);
            url.searchParams.append('include_zero_stock', 'true');

            if (this.filtros.categoria) {
                url.searchParams.append('categoria_id', this.filtros.categoria);
            }
            if (this.filtros.busqueda) {
                url.searchParams.append('search', this.filtros.busqueda);
            }
            if (this.filtros.stock === 'bajo') {
                url.searchParams.append('stock_alerts', 'true');
            } else if (this.filtros.stock === 'disponible') {
                url.searchParams.append('include_zero_stock', 'false');
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            this.productos = data.productos.map(producto => ({
                ...producto,
                precio_venta: this.parseNumber(producto.precio_venta),
                precio_dolares: this.parseNumber(producto.precio_dolares),
                stock: this.parseNumber(producto.stock),
                stock_minimo: this.parseNumber(producto.stock_minimo),
                costo_compra: this.parseNumber(producto.costo_compra),
                tasa_iva: this.parseNumber(producto.tasa_iva)
            }));

            this.pagination = {
                currentPage: data.pagination.page,
                totalPages: data.pagination.totalPages,
                totalProducts: data.pagination.total,
                limit: data.pagination.limit,
                hasNext: data.pagination.hasNext,
                hasPrev: data.pagination.hasPrev
            };

            console.log(`✅ ${this.productos.length} productos cargados (Página ${this.pagination.currentPage} de ${this.pagination.totalPages})`);
            this.renderizarProductos();
            this.renderizarPaginacion();
            this.actualizarResumen();
            
            return this.productos;
        } catch (error) {
            console.error('❌ Error cargando productos:', error);
            this.mostrarError('Error al cargar los productos: ' + error.message);
            
            const tbody = document.querySelector('.table-container tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 20px; color: #dc3545;">
                            <i class="fa-solid fa-exclamation-triangle"></i><br>
                            Error al cargar productos<br>
                            <small>${error.message}</small>
                        </td>
                    </tr>
                `;
            }
            throw error;
        }
    }

    async cargarCategorias() {
        try {
            console.log('📂 Cargando categorías...');
            const response = await fetch('/api/categorias', {
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            this.categorias = await response.json();
            console.log(`✅ ${this.categorias.length} categorías cargadas`);
            this.actualizarSelectCategorias();
            
            return this.categorias;
        } catch (error) {
            console.error('❌ Error cargando categorías:', error);
            this.mostrarError('Error al cargar las categorías');
            throw error;
        }
    }

    async cargarTasasIva() {
        try {
            console.log('🏷️ Cargando tasas IVA...');
            const response = await fetch('/api/tasas-iva', {
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            this.tasasIva = await response.json();
            console.log(`✅ ${this.tasasIva.length} tasas IVA cargadas`);
            this.actualizarSelectTasasIva();
            
            return this.tasasIva;
        } catch (error) {
            console.error('❌ Error cargando tasas IVA:', error);
            this.mostrarError('Error al cargar las tasas de IVA');
            throw error;
        }
    }

    actualizarSelectCategorias() {
        const selectFiltro = document.querySelector('#filtro-categoria');
        const selectFormulario = document.querySelector('#product-category');
        
        const options = '<option value="">Seleccionar categoría</option>' +
            this.categorias.map(cat => 
                `<option value="${cat.id}">${this.escapeHtml(cat.nombre)}</option>`
            ).join('');

        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="">Todas las categorías</option>' +
                this.categorias.map(cat => 
                    `<option value="${cat.id}">${this.escapeHtml(cat.nombre)}</option>`
                ).join('');
        }

        if (selectFormulario) {
            selectFormulario.innerHTML = options;
        }
    }

    actualizarSelectTasasIva() {
        const selectTasaIva = document.querySelector('#product-tasa-iva');
        if (selectTasaIva && this.tasasIva.length > 0) {
            selectTasaIva.innerHTML = '<option value="">Seleccionar tasa IVA</option>' +
                this.tasasIva.map(tasa => 
                    `<option value="${tasa.id}">${this.escapeHtml(tasa.descripcion)} (${tasa.tasa}%)</option>`
                ).join('');
            
            const tasaGeneral = this.tasasIva.find(t => t.tipo === 'general') || this.tasasIva[0];
            if (tasaGeneral) {
                selectTasaIva.value = tasaGeneral.id;
            }
        }
    }

    renderizarProductos() {
        const tbody = document.querySelector('.table-container tbody');
        if (!tbody) {
            console.error('❌ No se encontró el tbody de la tabla');
            return;
        }

        if (this.productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 20px;">
                        <i class="fa-solid fa-inbox"></i><br>
                        No se encontraron productos
                        ${Object.values(this.filtros).some(f => f) ? 'con los filtros aplicados' : ''}
                    </td>
                </tr>
            `;
            this.actualizarContadorProductos();
            return;
        }

        tbody.innerHTML = this.productos.map(producto => {
            const precioVenta = this.parseNumber(producto.precio_venta);
            const precioDolares = this.parseNumber(producto.precio_dolares);
            const stock = this.parseNumber(producto.stock);
            const stockMinimo = this.parseNumber(producto.stock_minimo);

            return `
            <tr data-product-id="${producto.id}">
                <td><span class="product-code">#${producto.id}</span></td>
                <td>
                    <div class="product-info">
                        <div class="product-image">
                            <i class="${this.getProductIcon(producto.categoria)}"></i>
                        </div>
                        <div class="product-details">
                            <strong>${this.escapeHtml(producto.nombre)}</strong>
                            <small>${this.getProductDescription(producto)}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="category-tag">${this.escapeHtml(producto.categoria || 'Sin categoría')}</span>
                </td>
                <td>
                    <span class="price">Bs ${precioVenta.toFixed(2)}</span>
                    <small class="text-muted">$${precioDolares.toFixed(2)}</small>
                </td>
                <td>
                    <div class="stock-info">
                        <span class="stock-value ${stock === 0 ? 'text-danger' : stock <= stockMinimo ? 'text-warning' : ''}">
                            ${stock}
                        </span>
                        <div class="stock-bar">
                            <div class="stock-fill ${this.getStockLevel(producto)}"></div>
                        </div>
                    </div>
                </td>
                <td>${stockMinimo}</td>
                <td><span class="badge">${this.escapeHtml(producto.unidad_medida)}</span></td>
                <td>${this.getEstadoBadge(producto)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-edit" title="Editar" onclick="productosManager.editarProducto(${producto.id})">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-warning btn-stock" title="Ajustar Stock" onclick="productosManager.ajustarStock(${producto.id})">
                            <i class="fa-solid fa-boxes-stacked"></i>
                        </button>
                        <button class="btn btn-sm btn-info btn-view" title="Ver Detalles" onclick="productosManager.verDetalles(${producto.id})">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        this.actualizarContadorProductos();
    }

    renderizarPaginacion() {
        const paginationContainer = document.querySelector('.pagination');
        if (!paginationContainer) return;

        const { currentPage, totalPages, hasNext, hasPrev } = this.pagination;

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        paginationHTML += `
            <button class="btn btn-sm ${!hasPrev ? 'disabled' : ''}" 
                    ${!hasPrev ? 'disabled' : ''} 
                    onclick="productosManager.cambiarPagina(${currentPage - 1})">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
        `;

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="btn btn-sm" onclick="productosManager.cambiarPagina(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="btn btn-sm ${i === currentPage ? 'active' : ''}" 
                        onclick="productosManager.cambiarPagina(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHTML += `<button class="btn btn-sm" onclick="productosManager.cambiarPagina(${totalPages})">${totalPages}</button>`;
        }

        paginationHTML += `
            <button class="btn btn-sm ${!hasNext ? 'disabled' : ''}" 
                    ${!hasNext ? 'disabled' : ''} 
                    onclick="productosManager.cambiarPagina(${currentPage + 1})">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += `
            <div class="pagination-info">
                Página ${currentPage} de ${totalPages} • 
                ${this.pagination.totalProducts} productos totales
            </div>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    cambiarPagina(nuevaPagina) {
        if (nuevaPagina < 1 || nuevaPagina > this.pagination.totalPages) return;
        this.cargarProductos(nuevaPagina, this.pagination.limit);
    }

    actualizarContadorProductos() {
        const contador = document.querySelector('.table-header h2');
        if (contador) {
            const { currentPage, totalPages, totalProducts } = this.pagination;
            contador.innerHTML = `
                <i class="fa-solid fa-list"></i> Lista de Productos 
                <small>(${totalProducts} productos totales - Página ${currentPage} de ${totalPages})</small>
            `;
        }
    }

    getStockLevel(producto) {
        const stock = this.parseNumber(producto.stock);
        const stockMinimo = this.parseNumber(producto.stock_minimo);
        
        if (stock === 0) return 'empty';
        if (stockMinimo === 0) return 'high';
        
        const ratio = stock / stockMinimo;
        if (ratio >= 2) return 'high';
        if (ratio >= 1) return 'medium';
        return 'low';
    }

    getEstadoBadge(producto) {
        const stock = this.parseNumber(producto.stock);
        const stockMinimo = this.parseNumber(producto.stock_minimo);
        
        if (stock === 0) {
            return '<span class="badge badge-danger">Agotado</span>';
        } else if (stock <= stockMinimo) {
            return '<span class="badge badge-warning">Bajo Stock</span>';
        } else {
            return '<span class="badge badge-success">Disponible</span>';
        }
    }

    getProductIcon(categoria) {
        const categoriaLower = (categoria || '').toLowerCase();
        if (categoriaLower.includes('pollo')) return 'fa-solid fa-drumstick-bite';
        if (categoriaLower.includes('milanesa')) return 'fa-solid fa-bacon';
        if (categoriaLower.includes('aliño') || categoriaLower.includes('adobo')) return 'fa-solid fa-mortar-pestle';
        if (categoriaLower.includes('embutido')) return 'fa-solid fa-hotdog';
        return 'fa-solid fa-box';
    }

    getProductDescription(producto) {
        const stock = this.parseNumber(producto.stock);
        const stockMinimo = this.parseNumber(producto.stock_minimo);
        
        if (stock === 0) return 'Producto agotado';
        if (stock <= stockMinimo) return 'Stock bajo - Reponer';
        return 'Disponible en inventario';
    }

    async crearProducto(productoData) {
        try {
            console.log('📝 Creando producto:', productoData);

            if (!this.validarDatosProducto(productoData)) {
                return;
            }

            const response = await fetch('/api/productos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify(productoData)
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || `Error ${response.status}: ${response.statusText}`);
            }

            this.productos.push({
                ...responseData,
                precio_venta: this.parseNumber(responseData.precio_venta),
                precio_dolares: this.parseNumber(responseData.precio_dolares),
                stock: this.parseNumber(responseData.stock),
                stock_minimo: this.parseNumber(responseData.stock_minimo)
            });
            
            this.renderizarProductos();
            this.actualizarResumen();
            this.mostrarExito('✅ Producto creado exitosamente');

            return responseData;
        } catch (error) {
            console.error('❌ Error creando producto:', error);
            this.mostrarError('❌ Error al crear producto: ' + error.message);
            throw error;
        }
    }

    validarDatosProducto(data) {
        const errors = [];

        if (!data.nombre || data.nombre.trim().length === 0) {
            errors.push('El nombre del producto es obligatorio');
        }

        if (!data.precio_venta || isNaN(data.precio_venta) || data.precio_venta < 0) {
            errors.push('El precio de venta debe ser un número positivo');
        }

        if (data.costo_compra && (isNaN(data.costo_compra) || data.costo_compra < 0)) {
            errors.push('El costo de compra debe ser un número positivo');
        }

        if (!data.categoria_id || isNaN(data.categoria_id)) {
            errors.push('La categoría es obligatoria');
        }

        if (!data.unidad_medida) {
            errors.push('La unidad de medida es obligatoria');
        }

        if (!data.id_tasa_iva || isNaN(data.id_tasa_iva)) {
            errors.push('La tasa de IVA es obligatoria');
        }

        if (errors.length > 0) {
            this.mostrarError('Errores en el formulario:<br>' + errors.join('<br>'));
            return false;
        }

        return true;
    }

    async editarProducto(id) {
        try {
            const producto = this.productos.find(p => p.id === id);
            if (!producto) {
                this.mostrarError('❌ Producto no encontrado');
                return;
            }

            this.llenarFormularioEdicion(producto);
            
            const submitButton = document.querySelector('#product-form button[type="submit"]');
            if (submitButton) {
                submitButton.innerHTML = '<i class="fa-solid fa-sync"></i> Actualizar Producto';
                submitButton.dataset.modo = 'edicion';
                submitButton.dataset.productoId = id;
            }

            document.querySelector('.form-section').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });

            this.mostrarExito(`✏️ Editando producto: ${producto.nombre}`);
        } catch (error) {
            console.error('❌ Error en editarProducto:', error);
            this.mostrarError('❌ Error al preparar la edición del producto');
        }
    }

    llenarFormularioEdicion(producto) {
        document.querySelector('#product-id').value = producto.id;
        document.querySelector('#product-name').value = producto.nombre || '';
        document.querySelector('#product-category').value = producto.categoria_id || '';
        document.querySelector('#product-price').value = this.parseNumber(producto.precio_venta) || 0;
        document.querySelector('#product-cost').value = this.parseNumber(producto.costo_compra) || '';
        document.querySelector('#product-stock').value = this.parseNumber(producto.stock) || 0;
        document.querySelector('#product-min-stock').value = this.parseNumber(producto.stock_minimo) || 10;
        document.querySelector('#product-unit').value = producto.unidad_medida || 'unidad';
        document.querySelector('#product-tasa-iva').value = producto.id_tasa_iva || 1;
    }

    async actualizarProducto(id, productoData) {
        try {
            console.log('📝 Iniciando actualización del producto:', id);
            console.log('📦 Datos del formulario:', productoData);

            const productId = parseInt(id);
            if (isNaN(productId)) {
                throw new Error('ID de producto inválido');
            }

            if (!productoData.nombre || productoData.nombre.trim() === '') {
                throw new Error('El nombre del producto es obligatorio');
            }

            if (!this.validarDatosProducto(productoData)) {
                return;
            }

            const datosParaEnviar = {
                nombre: productoData.nombre.trim(),
                precio_venta: parseFloat(productoData.precio_venta) || 0,
                costo_compra: productoData.costo_compra && productoData.costo_compra !== '' 
                    ? parseFloat(productoData.costo_compra) 
                    : null,
                stock: parseFloat(productoData.stock) || 0,
                unidad_medida: productoData.unidad_medida || 'unidad',
                categoria_id: parseInt(productoData.categoria_id) || 1,
                stock_minimo: parseFloat(productoData.stock_minimo) || 10,
                id_tasa_iva: parseInt(productoData.id_tasa_iva) || 1,
                id_provedores: null
            };

            console.log('📤 Datos procesados para enviar:', datosParaEnviar);

            if (datosParaEnviar.precio_venta < 0) {
                throw new Error('El precio de venta debe ser positivo');
            }

            if (datosParaEnviar.stock < 0) {
                throw new Error('El stock no puede ser negativo');
            }

            const response = await fetch(`/api/productos/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify(datosParaEnviar)
            });

            console.log('📡 Estado de la respuesta:', response.status, response.statusText);

            let responseData;
            const responseText = await response.text();
            
            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (parseError) {
                console.error('❌ Error parseando respuesta JSON:', parseError);
                throw new Error(`Error ${response.status}: ${response.statusText} - ${responseText}`);
            }

            if (!response.ok) {
                console.error('❌ Error del servidor:', responseData);
                throw new Error(responseData.error || `Error ${response.status}: ${response.statusText}`);
            }

            console.log('✅ Respuesta del servidor:', responseData);

            const index = this.productos.findIndex(p => p.id === productId);
            if (index !== -1) {
                this.productos[index] = {
                    ...responseData,
                    precio_venta: this.parseNumber(responseData.precio_venta),
                    precio_dolares: this.parseNumber(responseData.precio_dolares),
                    stock: this.parseNumber(responseData.stock),
                    stock_minimo: this.parseNumber(responseData.stock_minimo)
                };
            } else {
                console.warn('⚠️ Producto no encontrado en lista local, recargando...');
                await this.cargarProductos(this.pagination.currentPage, this.pagination.limit);
            }

            this.renderizarProductos();
            this.actualizarResumen();
            this.mostrarExito('✅ Producto actualizado exitosamente');

            return responseData;

        } catch (error) {
            console.error('❌ Error actualizando producto:', error);
            
            let mensajeError = '❌ Error al actualizar producto';
            if (error.message.includes('ID de producto inválido')) {
                mensajeError = '❌ ID de producto inválido';
            } else if (error.message.includes('nombre del producto')) {
                mensajeError = '❌ El nombre del producto es obligatorio';
            } else if (error.message.includes('precio de venta')) {
                mensajeError = '❌ El precio de venta debe ser positivo';
            } else if (error.message.includes('stock no puede ser negativo')) {
                mensajeError = '❌ El stock no puede ser negativo';
            } else if (error.message.includes('Error 400')) {
                mensajeError = '❌ Error en los datos enviados: ' + error.message;
            } else if (error.message.includes('Error 500')) {
                mensajeError = '❌ Error del servidor. Por favor, contacta al administrador.';
            } else {
                mensajeError = '❌ ' + error.message;
            }
            
            this.mostrarError(mensajeError);
            throw error;
        }
    }

    async ajustarStock(id) {
        try {
            const producto = this.productos.find(p => p.id === id);
            if (!producto) {
                this.mostrarError('❌ Producto no encontrado');
                return;
            }

            const nuevaCantidad = prompt(
                `Ajustar stock de "${producto.nombre}"\n\nStock actual: ${producto.stock} ${producto.unidad_medida}\nStock mínimo: ${producto.stock_minimo} ${producto.unidad_medida}\n\nIngrese la nueva cantidad:`,
                producto.stock
            );
            
            if (nuevaCantidad === null) return;

            const cantidadNum = parseFloat(nuevaCantidad);
            if (isNaN(cantidadNum) || cantidadNum < 0) {
                this.mostrarError('❌ La cantidad debe ser un número positivo');
                return;
            }

            const response = await fetch(`/api/productos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify({
                    stock: cantidadNum
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            await this.cargarProductos(this.pagination.currentPage, this.pagination.limit);
            this.mostrarExito('✅ Stock actualizado correctamente');
        } catch (error) {
            console.error('❌ Error ajustando stock:', error);
            this.mostrarError('❌ Error al actualizar stock: ' + error.message);
        }
    }

    verDetalles(id) {
        const producto = this.productos.find(p => p.id === id);
        if (!producto) {
            this.mostrarError('❌ Producto no encontrado');
            return;
        }

        const detalles = `
📦 <strong>${this.escapeHtml(producto.nombre)}</strong>
🆔 ID: ${producto.id}
📂 Categoría: ${this.escapeHtml(producto.categoria || 'Sin categoría')}
💰 Precio: Bs ${this.parseNumber(producto.precio_venta).toFixed(2)} ($${this.parseNumber(producto.precio_dolares).toFixed(2)})
📊 Stock: ${this.parseNumber(producto.stock)} ${producto.unidad_medida}
⚠️ Stock mínimo: ${this.parseNumber(producto.stock_minimo)} ${producto.unidad_medida}
🏷️ IVA: ${this.parseNumber(producto.tasa_iva)}%
${producto.proveedor ? `🏢 Proveedor: ${this.escapeHtml(producto.proveedor)}` : ''}
        `.trim();

        alert(detalles);
    }

    async procesarFormulario(event) {
        if (event) event.preventDefault();

        const submitButton = document.querySelector('#product-form button[type="submit"]');
        const originalText = submitButton.innerHTML;
        
        try {
            submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
            submitButton.disabled = true;

            const getFormValue = (selector, defaultValue = '') => {
                const element = document.querySelector(selector);
                return element ? (element.value || defaultValue) : defaultValue;
            };

            const formData = {
                nombre: getFormValue('#product-name'),
                precio_venta: getFormValue('#product-price', '0'),
                costo_compra: getFormValue('#product-cost', ''),
                stock: getFormValue('#product-stock', '0'),
                unidad_medida: getFormValue('#product-unit'),
                categoria_id: getFormValue('#product-category'),
                stock_minimo: getFormValue('#product-min-stock', '10'),
                id_tasa_iva: getFormValue('#product-tasa-iva', '1')
            };

            console.log('📝 Datos del formulario recogidos:', formData);

            if (!formData.nombre || formData.nombre.trim() === '') {
                throw new Error('El nombre del producto es obligatorio');
            }

            if (!formData.precio_venta || parseFloat(formData.precio_venta) <= 0) {
                throw new Error('El precio de venta debe ser mayor a 0');
            }

            if (!formData.categoria_id) {
                throw new Error('Debe seleccionar una categoría');
            }

            if (!formData.unidad_medida) {
                throw new Error('Debe seleccionar una unidad de medida');
            }

            const productoId = document.querySelector('#product-id').value;
            const isEdicion = submitButton?.dataset.modo === 'edicion' && productoId;

            if (isEdicion) {
                await this.actualizarProducto(productoId, formData);
                this.limpiarFormulario();
            } else {
                await this.crearProducto(formData);
                this.limpiarFormulario();
            }

        } catch (error) {
            console.error('❌ Error procesando formulario:', error);
            this.mostrarError(error.message);
        } finally {
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    }

    limpiarFormulario() {
        document.querySelector('#product-form').reset();
        document.querySelector('#product-id').value = '';
        
        const submitButton = document.querySelector('#product-form button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Producto';
            delete submitButton.dataset.modo;
            delete submitButton.dataset.productoId;
        }
        
        document.querySelector('#product-min-stock').value = 10;
        
        const tasaGeneral = this.tasasIva.find(t => t.tipo === 'general') || this.tasasIva[0];
        if (tasaGeneral) {
            document.querySelector('#product-tasa-iva').value = tasaGeneral.id;
        }
    }

    actualizarResumen() {
        const totalProductos = this.pagination.totalProducts;
        const productosActivos = this.productos.filter(p => this.parseNumber(p.stock) > 0).length;
        const productosInactivos = totalProductos - productosActivos;
        const totalCategorias = new Set(this.productos.map(p => p.categoria_id).filter(id => id)).size;

        this.actualizarCard('.card:nth-child(1) h3', totalProductos);
        this.actualizarCard('.card:nth-child(2) h3', productosActivos);
        this.actualizarCard('.card:nth-child(3) h3', productosInactivos);
        this.actualizarCard('.card:nth-child(4) h3', totalCategorias);
    }

    actualizarCard(selector, valor) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = valor;
            element.style.transform = 'scale(1.1)';
            setTimeout(() => element.style.transform = 'scale(1)', 300);
        }
    }

    setupEventListeners() {
        // Filtros
        document.querySelector('#filtro-categoria')?.addEventListener('change', (e) => {
            this.filtros.categoria = e.target.value;
            this.cargarProductos(1, this.pagination.limit);
        });

        document.querySelector('#filtro-stock')?.addEventListener('change', (e) => {
            this.filtros.stock = e.target.value;
            this.cargarProductos(1, this.pagination.limit);
        });

        // Búsqueda
        const searchInput = document.querySelector('#search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filtros.busqueda = e.target.value;
                    this.cargarProductos(1, this.pagination.limit);
                }, 300);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.filtros.busqueda = '';
                    this.cargarProductos(1, this.pagination.limit);
                }
            });
        }

        // Items por página
        const itemsPerPageSelect = document.querySelector('#items-per-page');
        if (itemsPerPageSelect) {
            itemsPerPageSelect.addEventListener('change', (e) => {
                const newLimit = parseInt(e.target.value);
                this.pagination.limit = newLimit;
                this.cargarProductos(1, newLimit);
            });
        }

        // Formulario
        document.querySelector('#product-form')?.addEventListener('submit', (e) => {
            this.procesarFormulario(e);
        });

        // Botón cancelar
        document.querySelector('.btn-cancelar')?.addEventListener('click', () => {
            this.limpiarFormulario();
            this.mostrarExito('Formulario limpiado');
        });

        // Botones de acción
        document.querySelector('.btn-actualizar')?.addEventListener('click', () => {
            this.cargarProductos(this.pagination.currentPage, this.pagination.limit);
            this.mostrarExito('🔄 Datos actualizados');
        });

        document.querySelector('.btn-nuevo-producto')?.addEventListener('click', () => {
            this.limpiarFormulario();
            document.querySelector('.form-section').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
            this.mostrarExito('✏️ Modo creación de producto');
        });

        // Efectos hover en tarjetas
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-5px)';
                this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            });
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            });
        });

        // Teclas rápidas
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && 
                e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                document.querySelector('#search-input')?.focus();
            }

            if (e.key === 'Escape' && 
                e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'TEXTAREA') {
                this.limpiarFiltros();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && 
                e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                document.querySelector('.btn-nuevo-producto')?.click();
            }
        });

        // Ajustar tabla en responsive
        window.addEventListener('resize', () => {
            this.ajustarTablaResponsive();
        });

        setTimeout(() => {
            this.ajustarTablaResponsive();
        }, 100);

        console.log('✅ Event listeners configurados correctamente');
    }

    limpiarFiltros() {
        document.querySelector('#filtro-categoria').value = '';
        document.querySelector('#filtro-stock').value = '';
        document.querySelector('#search-input').value = '';
        
        this.filtros = {
            categoria: '',
            stock: '',
            busqueda: ''
        };
        
        this.cargarProductos(1, this.pagination.limit);
        this.mostrarExito('🧹 Filtros limpiados');
    }

    ajustarTablaResponsive() {
        const tableContainer = document.querySelector('.table-container');
        const table = tableContainer?.querySelector('table');
        
        if (!table || !tableContainer) return;
        
        const containerWidth = tableContainer.clientWidth;
        const tableWidth = table.scrollWidth;
        
        if (tableWidth > containerWidth) {
            tableContainer.style.overflowX = 'auto';
            tableContainer.style.position = 'relative';
            tableContainer.style.boxShadow = 'inset -10px 0 10px -10px rgba(0,0,0,0.1)';
        } else {
            tableContainer.style.overflowX = 'visible';
            tableContainer.style.boxShadow = 'none';
        }
    }

    parseNumber(value) {
        if (value === null || value === undefined) return 0;
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }

    getToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || 'demo-token';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    mostrarExito(mensaje) {
        this.mostrarNotificacion(mensaje, 'success');
    }

    mostrarError(mensaje) {
        this.mostrarNotificacion(mensaje, 'error');
    }

    mostrarNotificacion(mensaje, tipo = 'info') {
        document.querySelectorAll('.toast').forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast toast-${tipo}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid fa-${tipo === 'success' ? 'check' : 'exclamation-triangle'}"></i>
                <span>${this.escapeHtml(mensaje)}</span>
            </div>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.productosManager = new ProductosManager();
});