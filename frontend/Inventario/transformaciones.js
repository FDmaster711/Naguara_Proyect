class TransformacionManager {
    constructor() {
        this.productos = [];
        this.productosOrigenValidos = [];
        this.init();
    }

    async init() {
        console.log('🔪 Inicializando Gestor de Transformaciones...');
        await this.cargarProductos();
        this.setupEventListeners();
        this.cargarHistorial();
    }

    // 1. CARGA DE DATOS
    async cargarProductos() {
        try {
            const response = await fetch('/api/productos', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (!response.ok) throw new Error('Error cargando productos');
            
            this.productos = await response.json();
            this.llenarSelectOrigen();
        } catch (error) {
            console.error(error);
            this.mostrarNotificacion('Error cargando catálogo', 'error');
        }
    }

    llenarSelectOrigen() {
        const selectOrigen = document.getElementById('origen-producto');
        selectOrigen.innerHTML = '<option value="">Seleccione producto origen...</option>';
        
        // 1. FILTRO RESTAURADO: Solo productos "Entero"
        this.productosOrigenValidos = this.productos.filter(p => 
            p.nombre.toLowerCase().includes('entero')
        );

        // Ordenar alfabéticamente
        this.productosOrigenValidos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        this.productosOrigenValidos.forEach(p => {
            selectOrigen.innerHTML += `<option value="${p.id}" data-stock="${p.stock}" data-unidad="${p.unidad_medida}">
                ${p.nombre} (Stock: ${p.stock} ${p.unidad_medida})
            </option>`;
        });
    }

    getProductosDestino(origenId) {
        if (!origenId) return [];
        // Filtramos para que no salga el mismo producto de origen en el destino
        const posibles = this.productos.filter(p => p.id != origenId);
        return posibles.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    setupEventListeners() {
        // Cambio de producto origen
        document.getElementById('origen-producto').addEventListener('change', (e) => {
            const select = e.target;
            const option = select.selectedOptions[0];
            const stockSpan = document.getElementById('stock-disponible');
            const unidadInput = document.getElementById('origen-unidad');
            
            document.getElementById('output-container').innerHTML = ''; // Limpiar salidas
            
            if (option && option.value) {
                const stock = option.getAttribute('data-stock');
                const unidad = option.getAttribute('data-unidad');
                
                stockSpan.textContent = `Stock actual: ${stock} ${unidad}`;
                unidadInput.value = unidad;
                
                // NOTA: Aquí ya no pedimos peso extra para el origen, se asume que la cantidad ingresada es la masa base
                // o que el usuario gestiona la equivalencia.
                this.agregarFilaSalida(select.value);
            } else {
                stockSpan.textContent = 'Stock actual: 0';
                unidadInput.value = '';
            }
            this.calcularTotales();
        });

        // Listener para input de cantidad origen
        document.getElementById('origen-cantidad').addEventListener('input', () => this.calcularTotales());

        // Botón agregar fila
        document.getElementById('btn-add-row').addEventListener('click', () => {
            const origenId = document.getElementById('origen-producto').value;
            if (!origenId) {
                this.mostrarNotificacion('Seleccione primero un producto origen', 'warning');
                return;
            }
            this.agregarFilaSalida(origenId);
        });

        document.getElementById('btn-procesar').addEventListener('click', () => this.procesarTransformacion());
    }

    agregarFilaSalida(origenId) {
        const container = document.getElementById('output-container');
        const rowId = Date.now();
        const productosPosibles = this.getProductosDestino(origenId);

        const row = document.createElement('div');
        row.className = 'output-item';
        row.dataset.id = rowId;
        // Ajustamos el grid para acomodar el nuevo campo de peso (3 columnas principales + borrar)
        row.style.gridTemplateColumns = '2fr 1fr 1fr 40px'; 

        let options = '<option value="">Seleccione derivado...</option>';
        productosPosibles.forEach(p => {
            // Guardamos la unidad en el option para detectarla al seleccionar
            const unidad = (p.unidad_medida || 'unidad').toLowerCase();
            options += `<option value="${p.id}" data-unidad="${unidad}">${p.nombre}</option>`;
        });

        // HTML de la fila: Incluye input de cantidad Y input de peso (oculto por defecto)
        row.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <select class="form-control row-product" style="width:100%">${options}</select>
                <small class="text-muted unit-label" style="font-size:0.75rem; margin-top:2px;">-</small>
            </div>
            
            <input type="number" class="form-control row-qty" placeholder="Cant." step="0.01" min="0">
            
            <div class="weight-container" style="display:none;">
                <input type="number" class="form-control row-weight" placeholder="Peso Kg" step="0.01" min="0" style="border-color: #ffc107; background: #fffdf5;">
                <small style="font-size: 0.7rem; color: #856404;">Peso Real</small>
            </div>

            <button class="btn btn-danger btn-sm btn-icon" onclick="transformacionManager.eliminarFila(${rowId})">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        container.appendChild(row);
        
        // --- LISTENERS DE LA FILA ---
        const select = row.querySelector('.row-product');
        const qtyInput = row.querySelector('.row-qty');
        const weightInput = row.querySelector('.row-weight');
        const weightContainer = row.querySelector('.weight-container');
        const unitLabel = row.querySelector('.unit-label');

        // 1. Detectar cambio de producto para mostrar/ocultar campo de peso
        select.addEventListener('change', (e) => {
            const opt = e.target.selectedOptions[0];
            if (opt && opt.value) {
                const unidad = opt.getAttribute('data-unidad');
                unitLabel.textContent = `Unidad: ${unidad}`;

                // LÓGICA: Si NO es Kg, pedimos el peso real para la métrica
                const esMasa = unidad.includes('kg') || unidad.includes('kilo') || unidad.includes('gramo');
                
                if (!esMasa) {
                    // Es Unidad/Pieza -> Mostrar campo peso
                    weightContainer.style.display = 'block';
                    weightInput.required = true;
                    // Cambiar placeholder de cantidad
                    qtyInput.placeholder = "Unidades";
                } else {
                    // Es Kg -> Ocultar campo peso (la cantidad YA es el peso)
                    weightContainer.style.display = 'none';
                    weightInput.required = false;
                    weightInput.value = '';
                    qtyInput.placeholder = "Kilos";
                }
            } else {
                unitLabel.textContent = '-';
                weightContainer.style.display = 'none';
            }
            this.calcularTotales();
        });

        // 2. Recalcular totales al escribir
        qtyInput.addEventListener('input', () => this.calcularTotales());
        weightInput.addEventListener('input', () => this.calcularTotales());
        
        container.scrollTop = container.scrollHeight;
    }

    eliminarFila(id) {
        const row = document.querySelector(`.output-item[data-id="${id}"]`);
        if (row) row.remove();
        this.calcularTotales();
    }

    calcularTotales() {
        const origenCant = parseFloat(document.getElementById('origen-cantidad').value) || 0;
        
        // Entrada Total: Asumimos que la cantidad de origen es la base de masa 
        // (OJO: Si metes 5 unidades de pollo, el sistema usará "5" como base. 
        // Si necesitas peso en origen también, avísame, pero dijiste que el peso extra era solo para resultantes).
        let masaEntrada = origenCant; 

        let masaSalidaTotal = 0;

        document.querySelectorAll('.output-item').forEach(row => {
            const weightContainer = row.querySelector('.weight-container');
            const qty = parseFloat(row.querySelector('.row-qty').value) || 0;
            const weight = parseFloat(row.querySelector('.row-weight').value) || 0;

            if (weightContainer.style.display !== 'none') {
                // Si el campo peso es visible, usamos ESE valor para la métrica
                masaSalidaTotal += weight;
            } else {
                // Si no, es porque el producto es Kg, usamos la cantidad
                masaSalidaTotal += qty;
            }
        });

        // Actualizar UI
        document.getElementById('resumen-entrada').textContent = masaEntrada.toFixed(2);
        document.getElementById('resumen-salida').textContent = masaSalidaTotal.toFixed(2); // Muestra PESO total
        
        const diferencia = masaEntrada - masaSalidaTotal;
        const diffEl = document.getElementById('resumen-diferencia');
        diffEl.textContent = diferencia.toFixed(2);

        this.actualizarBarraRendimiento(masaEntrada, masaSalidaTotal);
    }

    actualizarBarraRendimiento(entrada, salida) {
        const bar = document.getElementById('yield-bar');
        const text = document.getElementById('yield-text');
        
        if (entrada > 0) {
            const porcentaje = (salida / entrada) * 100;
            bar.style.width = `${Math.min(porcentaje, 100)}%`;
            text.textContent = `${porcentaje.toFixed(1)}% Rendimiento`;

            if (porcentaje > 105) { // Margen error
                bar.style.backgroundColor = '#dc3545';
                text.textContent += ' (ERROR)';
            } else if (porcentaje < 80) {
                bar.style.backgroundColor = '#ffc107';
            } else {
                bar.style.backgroundColor = '#28a745';
            }
            
            const diffEl = document.getElementById('resumen-diferencia');
            diffEl.style.color = (entrada - salida) < 0 ? 'red' : 'green';
        } else {
            bar.style.width = '0%';
            text.textContent = '0% Rendimiento';
            bar.style.backgroundColor = '#e9ecef';
        }
    }

    async procesarTransformacion() {
        const btn = document.getElementById('btn-procesar');
        const origenId = document.getElementById('origen-producto').value;
        const origenCant = parseFloat(document.getElementById('origen-cantidad').value); 
        const obs = document.getElementById('observaciones').value;

        if (!origenId) return this.mostrarNotificacion('Seleccione el producto origen', 'error');
        if (!origenCant || origenCant <= 0) return this.mostrarNotificacion('Ingrese cantidad origen', 'error');

        const detalles = [];
        let masaSalidaTotal = 0;
        let errorFila = false;

        document.querySelectorAll('.output-item').forEach(row => {
            const destId = row.querySelector('.row-product').value;
            const destQty = parseFloat(row.querySelector('.row-qty').value);
            const destWeight = parseFloat(row.querySelector('.row-weight').value) || 0;
            const weightVisible = row.querySelector('.weight-container').style.display !== 'none';

            if (destId && destQty > 0) {
                // Validación: Si pide peso, debe tener peso
                if (weightVisible && destWeight <= 0) {
                    errorFila = true;
                    this.mostrarNotificacion('Debe indicar el peso real para los productos por unidad', 'warning');
                    return;
                }

                // Para la métrica usamos el peso si existe, si no la cantidad
                masaSalidaTotal += weightVisible ? destWeight : destQty;

                // Al backend enviamos la cantidad (Unidades o Kg) para el stock
                // Opcional: Podríamos enviar el peso en un campo 'notas' o auxiliar si se requiere en futuro
                detalles.push({ 
                    producto_destino_id: destId, 
                    cantidad_destino: destQty 
                });
            } else if (destId || destQty) {
                errorFila = true;
            }
        });

        if (errorFila) return;
        if (detalles.length === 0) return this.mostrarNotificacion('Agregue productos de salida', 'warning');

        // Validación Lógica (Masa Entrada vs Masa Salida Total)
        if (masaSalidaTotal > (origenCant + 0.5)) { 
            if(!confirm(`⚠️ Advertencia: La salida (${masaSalidaTotal.toFixed(2)}) supera la entrada (${origenCant.toFixed(2)}). ¿Es correcto?`)) return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const response = await fetch('/api/transformaciones', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    producto_origen_id: origenId,
                    cantidad_origen: origenCant,
                    observaciones: obs,
                    detalles: detalles
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al procesar');

            this.mostrarNotificacion('Transformación registrada', 'success');
            this.resetForm();
            this.cargarHistorial();
            await this.cargarProductos(); 

        } catch (error) {
            this.mostrarNotificacion(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Procesar Transformación';
        }
    }

    resetForm() {
        document.getElementById('origen-producto').value = '';
        document.getElementById('origen-cantidad').value = '';
        document.getElementById('stock-disponible').textContent = 'Stock actual: 0';
        document.getElementById('origen-unidad').value = '';
        document.getElementById('observaciones').value = '';
        document.getElementById('output-container').innerHTML = '';
        
        document.getElementById('resumen-entrada').textContent = '0.00';
        document.getElementById('resumen-salida').textContent = '0.00';
        document.getElementById('resumen-diferencia').textContent = '0.00';
        this.actualizarBarraRendimiento(0,0);
    }

    async cargarHistorial() {
        // ... (código historial igual que antes) ...
        const tbody = document.getElementById('historial-body');
        if(!tbody) return;
        
        try {
            const res = await fetch('/api/transformaciones', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const data = await res.json();
            
            if(data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">Sin registros recientes</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(t => `
                <tr>
                    <td>#${t.id}</td>
                    <td>${new Date(t.fecha_transformacion).toLocaleDateString()}</td>
                    <td>${t.nombre_origen}</td>
                    <td><span class="badge badge-warning">-${t.cantidad_origen}</span></td>
                    <td>${t.usuario}</td>
                    <td><button class="btn btn-sm btn-info" onclick="transformacionManager.verDetalle(${t.id})"><i class="fa-solid fa-eye"></i></button></td>
                </tr>
            `).join('');
        } catch(e) { console.error(e); }
    }
    
    async verDetalle(id) {
        try {
            const res = await fetch(`/api/transformaciones/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const det = await res.json();
            let msg = 'Salida:\n';
            det.forEach(d => msg += `- ${d.nombre_producto}: ${d.cantidad_destino}\n`);
            alert(msg);
        } catch(e) { console.error(e); }
    }

    mostrarNotificacion(mensaje, tipo) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${tipo}`;
        toast.textContent = mensaje;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

window.transformacionManager = new TransformacionManager();