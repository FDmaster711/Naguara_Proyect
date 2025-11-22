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
            // Cargar catálogos y productos en paralelo
            const [productos, categorias, tasasIva] = await Promise.allSettled([
                this.cargarProductos(1, 10),
                this.cargarCategorias(),
                this.cargarTasasIva()
            ]);

            if (productos.status === 'rejected') console.error('Error cargando productos:', productos.reason);
            if (categorias.status === 'rejected') console.error('Error cargando categorías:', categorias.reason);
            if (tasasIva.status === 'rejected') console.error('Error cargando tasas IVA:', tasasIva.reason);

        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
        }
    }

    async cargarProductos(page = 1, limit = 10) {
        try {
            console.log(`📦 Cargando productos página ${page}, límite ${limit}...`);
            
            const url = new URL('/api/productos', window.location.origin);
            url.searchParams.append('page', page);
            url.searchParams.append('limit', limit);
            url.searchParams.append('include_zero_stock', 'true');

            // Aplicar filtros
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
            
            // Manejar si el backend devuelve array directo o estructura paginada
            const listaProductos = data.productos || (Array.isArray(data) ? data : []);

            this.productos = listaProductos.map(producto => ({
                ...producto,
                precio_venta: this.parseNumber(producto.precio_venta),
                precio_dolares: this.parseNumber(producto.precio_dolares),
                stock: this.parseNumber(producto.stock),
                stock_minimo: this.parseNumber(producto.stock_minimo),
                costo_compra: this.parseNumber(producto.costo_compra),
                tasa_iva: this.parseNumber(producto.tasa_iva)
            }));

            // Configurar paginación
            if (data.pagination) {
                this.pagination = {
                    currentPage: data.pagination.page,
                    totalPages: data.pagination.totalPages,
                    totalProducts: data.pagination.total,
                    limit: data.pagination.limit,
                    hasNext: data.pagination.hasNext,
                    hasPrev: data.pagination.hasPrev
                };
            } else {
                this.pagination.totalProducts = this.productos.length;
                // Simular paginación si el backend devuelve todo
                this.pagination.totalPages = Math.ceil(this.productos.length / limit);
            }

            this.renderizarProductos();
            this.renderizarPaginacion();
            this.actualizarResumen();
            
            return this.productos;
        } catch (error) {
            console.error('❌ Error cargando productos:', error);
            this.mostrarError('Error al cargar los productos');
        }
    }

    async cargarCategorias() {
        try {
            const response = await fetch('/api/categorias', {
                headers: { 'Authorization': `Bearer ${this.getToken()}` }
            });
            if (!response.ok) throw new Error('Error al cargar categorías');
            this.categorias = await response.json();
            this.actualizarSelectCategorias();
        } catch (error) {
            console.error('❌ Error:', error);
        }
    }

    async cargarTasasIva() {
        try {
            const response = await fetch('/api/tasas-iva', {
                headers: { 'Authorization': `Bearer ${this.getToken()}` }
            });
            if (!response.ok) throw new Error('Error al cargar tasas');
            this.tasasIva = await response.json();
            this.actualizarSelectTasasIva();
        } catch (error) {
            console.error('❌ Error:', error);
        }
    }

    actualizarSelectCategorias() {
        // Actualizar filtro
        const selectFiltro = document.querySelector('#filtro-categoria');
        const optionsFiltro = '<option value="">Todas las categorías</option>' +
            this.categorias.map(cat => `<option value="${cat.id}">${this.escapeHtml(cat.nombre)}</option>`).join('');
        
        if (selectFiltro) selectFiltro.innerHTML = optionsFiltro;

        // Actualizar formulario
        const selectForm = document.querySelector('#product-category');
        const optionsForm = '<option value="">Seleccionar categoría</option>' +
            this.categorias.map(cat => `<option value="${cat.id}">${this.escapeHtml(cat.nombre)}</option>`).join('');
        
        if (selectForm) selectForm.innerHTML = optionsForm;
    }

    actualizarSelectTasasIva() {
        const selectTasaIva = document.querySelector('#product-tasa-iva');
        if (selectTasaIva && this.tasasIva.length > 0) {
            selectTasaIva.innerHTML = '<option value="">Seleccionar tasa IVA</option>' +
                this.tasasIva.map(tasa => 
                    `<option value="${tasa.id}">${this.escapeHtml(tasa.descripcion)} (${tasa.tasa}%)</option>`
                ).join('');
            
            // Seleccionar tasa general por defecto
            const tasaGeneral = this.tasasIva.find(t => t.tipo === 'general') || this.tasasIva[0];
            if (tasaGeneral) selectTasaIva.value = tasaGeneral.id;
        }
    }

    // ==================== RENDERIZADO ====================

    renderizarProductos() {
        const tbody = document.querySelector('.table-container tbody');
        if (!tbody) return;

        if (this.productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;"><div class="loading-spinner"><i class="fa-solid fa-inbox"></i> No se encontraron productos</div></td></tr>`;
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
                        <div class="product-image"><i class="${this.getProductIcon(producto.categoria)}"></i></div>
                        <div class="product-details">
                            <strong>${this.escapeHtml(producto.nombre)}</strong>
                            <small>${this.getProductDescription(producto)}</small>
                        </div>
                    </div>
                </td>
                <td><span class="category-tag">${this.escapeHtml(producto.categoria || 'Sin categoría')}</span></td>
                <td><span class="price">Bs ${precioVenta.toFixed(2)}</span><br><small class="text-muted">$${precioDolares.toFixed(2)}</small></td>
                <td>
                    <div class="stock-info">
                        <span class="stock-value ${stock === 0 ? 'text-danger' : stock <= stockMinimo ? 'text-warning' : ''}">${stock}</span>
                        <div class="stock-bar"><div class="stock-fill ${this.getStockLevel(producto)}"></div></div>
                    </div>
                </td>
                <td>${stockMinimo}</td>
                <td><span class="badge">${this.escapeHtml(producto.unidad_medida)}</span></td>
                <td>${this.getEstadoBadge(producto)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-edit" title="Editar" onclick="productosManager.editarProducto(${producto.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-warning btn-stock" title="Ajustar Stock" onclick="productosManager.ajustarStock(${producto.id})"><i class="fa-solid fa-boxes-stacked"></i></button>
                        <button class="btn btn-sm btn-info btn-view" title="Ver Detalles" onclick="productosManager.verDetalles(${producto.id})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn btn-sm btn-danger" title="Eliminar" onclick="productosManager.deleteProduct(${producto.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        this.actualizarContadorProductos();
    }

    renderizarPaginacion() {
        const paginationContainer = document.querySelector('.pagination');
        if (!paginationContainer) return;

        const { currentPage, totalPages, hasPrev, hasNext } = this.pagination;

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = `<button class="btn ${!hasPrev ? 'disabled' : ''}" onclick="productosManager.cambiarPagina(${currentPage - 1})" ${!hasPrev ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;

        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="btn ${i === currentPage ? 'active' : ''}" onclick="productosManager.cambiarPagina(${i})">${i}</button>`;
        }

        html += `<button class="btn ${!hasNext ? 'disabled' : ''}" onclick="productosManager.cambiarPagina(${currentPage + 1})" ${!hasNext ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;

        paginationContainer.innerHTML = html;
    }

    // ==================== EVENT LISTENERS ====================

    setupEventListeners() {
        // Filtro Categoría
        document.querySelector('#filtro-categoria')?.addEventListener('change', (e) => {
            this.filtros.categoria = e.target.value;
            this.cargarProductos(1, this.pagination.limit);
        });

        // Filtro Stock
        document.querySelector('#filtro-stock')?.addEventListener('change', (e) => {
            this.filtros.stock = e.target.value;
            this.cargarProductos(1, this.pagination.limit);
        });

        // Búsqueda
        const searchInput = document.querySelector('#search-input');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.filtros.busqueda = e.target.value;
                    this.cargarProductos(1, this.pagination.limit);
                }, 300);
            });
        }

        // Items por página
        document.querySelector('#items-per-page')?.addEventListener('change', (e) => {
            this.pagination.limit = parseInt(e.target.value);
            this.cargarProductos(1, this.pagination.limit);
        });

        // Botón Nuevo Producto
        document.querySelector('.btn-nuevo-producto')?.addEventListener('click', () => {
            this.limpiarFormulario();
            document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
            document.getElementById('product-name').focus();
        });

        // Botón Actualizar
        document.querySelector('.btn-actualizar')?.addEventListener('click', () => {
            this.cargarProductos(this.pagination.currentPage, this.pagination.limit);
            this.mostrarExito('Lista actualizada');
        });

        // Formulario Submit
        document.querySelector('#product-form')?.addEventListener('submit', (e) => this.procesarFormulario(e));

        // Botón Cancelar Formulario
        document.querySelector('.btn-cancelar')?.addEventListener('click', () => this.limpiarFormulario());
    }

    // ==================== GESTIÓN DE PRODUCTOS ====================

    async procesarFormulario(event) {
        event.preventDefault();
        const submitButton = document.querySelector('#product-form button[type="submit"]');
        const originalText = submitButton.innerHTML;

        try {
            submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
            submitButton.disabled = true;

            // Usar los IDs exactos del HTML
            const formData = {
                nombre: document.getElementById('product-name').value.trim(),
                categoria_id: document.getElementById('product-category').value,
                precio_venta: parseFloat(document.getElementById('product-price').value) || 0,
                costo_compra: parseFloat(document.getElementById('product-cost').value) || 0,
                stock: parseFloat(document.getElementById('product-stock').value) || 0,
                stock_minimo: parseFloat(document.getElementById('product-min-stock').value) || 10,
                unidad_medida: document.getElementById('product-unit').value,
                id_tasa_iva: document.getElementById('product-tasa-iva').value || 1,
                // Capturar el motivo del input correcto
                motivo_ajuste: document.getElementById('product-reason').value.trim()
            };

            // Validación básica
            if (!formData.nombre) throw new Error('El nombre es obligatorio');
            if (!formData.categoria_id) throw new Error('Seleccione una categoría');
            
            const productoId = document.getElementById('product-id').value;
            const isEdicion = !!productoId;

            // Si es edición, el motivo es obligatorio
            if (isEdicion && !formData.motivo_ajuste) {
                throw new Error('Debe indicar un motivo para actualizar el inventario');
            }

            const url = isEdicion ? `/api/productos/${productoId}` : '/api/productos';
            const method = isEdicion ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar');
            }

            this.mostrarExito(isEdicion ? 'Producto actualizado' : 'Producto creado');
            this.limpiarFormulario();
            await this.cargarProductos(this.pagination.currentPage, this.pagination.limit);

        } catch (error) {
            this.mostrarError(error.message);
        } finally {
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    }

    editarProducto(id) {
        const producto = this.productos.find(p => p.id === id);
        if (!producto) return;

        console.log('✏️ Editando:', producto.nombre);

        // Llenar formulario con los IDs correctos
        document.getElementById('product-id').value = producto.id;
        document.getElementById('product-name').value = producto.nombre;
        document.getElementById('product-category').value = producto.categoria_id || "";
        document.getElementById('product-price').value = producto.precio_venta;
        document.getElementById('product-cost').value = producto.costo_compra;
        document.getElementById('product-stock').value = producto.stock;
        document.getElementById('product-min-stock').value = producto.stock_minimo;
        document.getElementById('product-unit').value = producto.unidad_medida;
        document.getElementById('product-tasa-iva').value = producto.id_tasa_iva;

        // Mostrar campo Motivo (Obligatorio en edición)
        const containerReason = document.getElementById('container-reason');
        const inputReason = document.getElementById('product-reason');
        if (containerReason) containerReason.style.display = 'block';
        if (inputReason) {
            inputReason.required = true;
            inputReason.value = '';
        }

        // Cambiar interfaz
        document.querySelector('.form-section h2').innerHTML = `<i class="fa-solid fa-pen"></i> Editar Producto #${id}`;
        document.querySelector('.btn-cancelar').style.display = 'inline-block';
        const btnSave = document.querySelector('#product-form button[type="submit"]');
        btnSave.innerHTML = '<i class="fa-solid fa-sync"></i> Actualizar';
        
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    }

    limpiarFormulario() {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        
        // Ocultar Motivo
        const containerReason = document.getElementById('container-reason');
        const inputReason = document.getElementById('product-reason');
        if (containerReason) containerReason.style.display = 'none';
        if (inputReason) inputReason.required = false;

        // Restaurar interfaz
        document.querySelector('.form-section h2').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Registrar Nuevo Producto`;
        document.querySelector('.btn-cancelar').style.display = 'none'; // Ocultar botón cancelar si lo deseas
        document.querySelector('#product-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-save"></i> Guardar Producto';
    }

    async ajustarStock(id) {
        const producto = this.productos.find(p => p.id === id);
        if (!producto) return;

        const nuevoStockStr = prompt(`Ajustar Stock de "${producto.nombre}"\nActual: ${producto.stock}\n\nNuevo Stock:`, producto.stock);
        if (nuevoStockStr === null) return; // Cancelado

        const nuevoStock = parseFloat(nuevoStockStr);
        if (isNaN(nuevoStock)) {
            this.mostrarError('Stock inválido');
            return;
        }

        // Pedir motivo
        const motivo = prompt("Ingrese el motivo del ajuste (Obligatorio):");
        if (!motivo || motivo.trim() === "") {
            this.mostrarError("El motivo es obligatorio");
            return;
        }

        // Preparar datos para actualizar (conservando lo demás)
        const data = {
            nombre: producto.nombre,
            categoria_id: producto.categoria_id,
            precio_venta: producto.precio_venta,
            costo_compra: producto.costo_compra,
            unidad_medida: producto.unidad_medida,
            stock_minimo: producto.stock_minimo,
            id_tasa_iva: producto.id_tasa_iva,
            stock: nuevoStock,
            motivo_ajuste: motivo
        };

        // Reutilizar la lógica de actualización (simulando envío desde formulario)
        try {
            const response = await fetch(`/api/productos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Error actualizando stock');
            
            this.mostrarExito('Stock ajustado correctamente');
            this.cargarProductos(this.pagination.currentPage, this.pagination.limit);
        } catch (error) {
            this.mostrarError('Error al ajustar stock');
        }
    }

    async deleteProduct(id) {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;

        try {
            const response = await fetch(`/api/productos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.getToken()}` }
            });

            if (response.ok) {
                this.mostrarExito('Producto eliminado');
                this.cargarProductos(this.pagination.currentPage, this.pagination.limit);
            } else {
                const data = await response.json();
                this.mostrarError(data.error || 'Error al eliminar');
            }
        } catch (error) {
            console.error(error);
            this.mostrarError('Error de conexión');
        }
    }

    // ==================== UTILIDADES Y HELPERS ====================

    cambiarPagina(nuevaPagina) {
        if (nuevaPagina < 1 || nuevaPagina > this.pagination.totalPages) return;
        this.cargarProductos(nuevaPagina, this.pagination.limit);
    }

    verDetalles(id) {
        const p = this.productos.find(prod => prod.id === id);
        if (!p) return;
        alert(`Detalles:\nProducto: ${p.nombre}\nStock: ${p.stock}\nPrecio: Bs. ${p.precio_venta}\nCosto: Bs. ${p.costo_compra || 0}\nProveedor: ${p.proveedor || 'N/A'}`);
    }

  actualizarResumen() {
        // Lógica de las tarjetas
        if (!this.productos) return;
        
        // 1. Total de productos (viene de la paginación)
        const total = this.pagination.totalProducts; 
        
        // 2. Stock total (Suma de unidades)
        const stockTotal = this.productos.reduce((s, p) => s + this.parseNumber(p.stock), 0);
        
        // 3. Alertas (Bajo stock + Agotados)
        const bajoStock = this.productos.filter(p => this.parseNumber(p.stock) <= this.parseNumber(p.stock_minimo)).length;
        
        // 4. Valor del Inventario (Costo * Stock) - ESTO FALTABA
        const valorTotal = this.productos.reduce((sum, p) => {
            const costo = this.parseNumber(p.costo_compra) || 0;
            const stock = this.parseNumber(p.stock) || 0;
            return sum + (costo * stock);
        }, 0);
        
        // Actualizar DOM
        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
        
        setVal('card-total-productos', total);
        setVal('card-stock-total', stockTotal.toLocaleString('es-VE', {maximumFractionDigits: 2}));
        setVal('card-bajo-stock', bajoStock);
        
        // Mostrar valor formateado en Bs.
        setVal('card-valor-inventario', `Bs. ${valorTotal.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    }

    
    actualizarContadorProductos() {
        const el = document.querySelector('.table-header h2');
        if (el) el.innerHTML = `<i class="fa-solid fa-list"></i> Lista de Productos (${this.pagination.totalProducts})`;
    }

    // Helpers visuales
    getStockLevel(p) {
        const s = this.parseNumber(p.stock);
        const m = this.parseNumber(p.stock_minimo);
        if (s <= 0) return 'empty';
        if (s <= m) return 'low';
        if (s <= m * 2) return 'medium';
        return 'high';
    }

    getEstadoBadge(p) {
        const s = this.parseNumber(p.stock);
        const m = this.parseNumber(p.stock_minimo);
        if (s <= 0) return '<span class="badge badge-danger">Agotado</span>';
        if (s <= m) return '<span class="badge badge-warning">Bajo Stock</span>';
        return '<span class="badge badge-success">Disponible</span>';
    }

    getProductIcon(c) {
        const cat = (c || '').toLowerCase();
        if (cat.includes('pollo')) return 'fa-solid fa-drumstick-bite';
        if (cat.includes('carne') || cat.includes('res')) return 'fa-solid fa-bacon';
        if (cat.includes('aliño')) return 'fa-solid fa-seedling';
        return 'fa-solid fa-box';
    }

    getProductDescription(p) {
        return p.stock > 0 ? 'En existencia' : 'Sin stock disponible';
    }

    // Helpers generales
    parseNumber(val) { return parseFloat(val) || 0; }
    getToken() { return localStorage.getItem('authToken'); }
    escapeHtml(text) {
        if (!text) return '';
        return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    mostrarExito(mensaje) {
        this.mostrarNotificacion(mensaje, 'success');
    }

    mostrarError(mensaje) {
        this.mostrarNotificacion(mensaje, 'error');
    }

    mostrarNotificacion(mensaje, tipo) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${tipo}`;
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.productosManager = new ProductosManager();
});