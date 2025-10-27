// configuracion.js - Versión completa con todas las funcionalidades
class ConfiguracionManager {
    constructor() {
        this.currentSection = 'empresa';
        this.empresaData = null;
        this.configData = null;
        this.usuarioEditando = null;
        
        this.init();
    }

    init() {
        console.log('⚙️ Inicializando módulo de configuración...');
        this.checkAuthentication();
        this.setupModals();
        this.setupEventListeners();
        this.loadEmpresaData();
        this.loadCategorias();
        this.loadUsuarios();
        this.loadUserInfo();
        this.loadConfigNegocio();
        this.loadMetodosPago();
        this.loadBackupHistory();
    }

    setupModals() {
        // Crear modal de edición de usuario si no existe
        if (!document.getElementById('usuario-edit-modal')) {
            const modalHTML = `
                <div id="usuario-edit-modal" class="modal hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white p-6 rounded-xl shadow-lg max-w-md w-full mx-4">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-purple-600">Editar Usuario</h2>
                            <button onclick="configManager.closeEditModal()" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <form id="usuario-edit-form">
                            <div class="space-y-4">
                                <div class="form-group">
                                    <label for="edit-usuario-nombre">Nombre Completo *</label>
                                    <input type="text" id="edit-usuario-nombre" class="input-field" required data-field-name="edit-usuario-nombre">
                                    <div class="error-message hidden" id="error-edit-usuario-nombre"></div>
                                </div>

                                <div class="form-group">
                                    <label for="edit-usuario-username">Nombre de Usuario *</label>
                                    <input type="text" id="edit-usuario-username" class="input-field" required data-field-name="edit-usuario-username">
                                    <div class="error-message hidden" id="error-edit-usuario-username"></div>
                                </div>

                                <div class="form-group">
                                    <label for="edit-usuario-rol">Rol *</label>
                                    <select id="edit-usuario-rol" class="input-field" required data-field-name="edit-usuario-rol">
                                        <option value="Vendedor">Vendedor</option>
                                        <option value="Administrador">Administrador</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="edit-usuario-estado">Estado *</label>
                                    <select id="edit-usuario-estado" class="input-field" required data-field-name="edit-usuario-estado">
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="edit-usuario-password">Nueva Contraseña (opcional)</label>
                                    <input type="password" id="edit-usuario-password" class="input-field" placeholder="Dejar en blanco para no cambiar">
                                    <div class="help-text">Mínimo 6 caracteres</div>
                                    <div class="error-message hidden" id="error-edit-usuario-password"></div>
                                </div>
                            </div>

                            <div class="flex justify-end space-x-3 mt-6">
                                <button type="button" onclick="configManager.closeEditModal()" class="btn-secondary">
                                    Cancelar
                                </button>
                                <button type="submit" class="btn-primary">
                                    <i class="fas fa-save mr-2"></i>
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        // Event listener para el formulario de edición
        document.getElementById('usuario-edit-form').addEventListener('submit', (e) => this.handleUsuarioEditForm(e));
    }

    checkAuthentication() {
        fetch('/api/me', {
            credentials: 'include'
        })
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

    setupEventListeners() {
        console.log('🔧 Configurando event listeners...');
        
        // Navegación lateral
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems.length > 0) {
            navItems.forEach(item => {
                item.addEventListener('click', () => {
                    this.switchSection(item.dataset.section);
                });
            });
        }

        // Formularios con validación
        const empresaForm = document.getElementById('empresa-form');
        if (empresaForm) {
            empresaForm.addEventListener('submit', (e) => this.handleEmpresaForm(e));
            this.setupFormValidation(empresaForm);
        }

        const usuarioForm = document.getElementById('usuario-form');
        if (usuarioForm) {
            usuarioForm.addEventListener('submit', (e) => this.handleUsuarioForm(e));
            this.setupFormValidation(usuarioForm);
        }

        // Botones
        const addCategoriaBtn = document.getElementById('add-categoria');
        if (addCategoriaBtn) {
            addCategoriaBtn.addEventListener('click', () => this.addCategoria());
        }

        const guardarConfigBtn = document.getElementById('guardar-config-negocio');
        if (guardarConfigBtn) {
            guardarConfigBtn.addEventListener('click', () => this.handleConfigNegocio());
        }

        const createBackupBtn = document.getElementById('create-backup');
        if (createBackupBtn) {
            createBackupBtn.addEventListener('click', () => this.createBackup());
        }

        // Ver perfil
        const verPerfilBtn = document.querySelector('a[href="#"] .fa-user')?.closest('a');
        if (verPerfilBtn) {
            verPerfilBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showUserProfile();
            });
        }

        console.log('✅ Event listeners configurados');
    }

    // ==================== VALIDACIONES DE FORMULARIOS ====================

    setupFormValidation(form) {
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        
        inputs.forEach(input => {
            // Validación en tiempo real
            input.addEventListener('blur', () => {
                this.validateField(input);
            });
            
            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
    }

    validateField(field) {
        this.clearFieldError(field);
        
        const value = field.value.trim();
        const fieldName = field.id;

        // Validaciones específicas por tipo de campo
        if (field.hasAttribute('required') && !value) {
            this.showFieldError(field, `${this.getFieldDisplayName(fieldName)} es obligatorio`);
            return false;
        }

        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                this.showFieldError(field, 'Ingrese un email válido');
                return false;
            }
        }

        if ((field.id === 'usuario-password' || field.id === 'edit-usuario-password') && value && value.length < 6) {
            this.showFieldError(field, 'La contraseña debe tener al menos 6 caracteres');
            return false;
        }

        if (field.id === 'empresa-rif' && value) {
            const rifRegex = /^[JGVEP]-?\d{8}-?\d$/;
            if (!rifRegex.test(value.toUpperCase())) {
                this.showFieldError(field, 'Formato de RIF inválido. Ejemplo: J-123456789');
                return false;
            }
        }

        if ((field.id.includes('nombre') || field.id === 'edit-usuario-nombre') && value && value.length < 2) {
            this.showFieldError(field, 'El nombre debe tener al menos 2 caracteres');
            return false;
        }

        if ((field.id === 'usuario-username' || field.id === 'edit-usuario-username') && value) {
            if (value.length < 3) {
                this.showFieldError(field, 'El usuario debe tener al menos 3 caracteres');
                return false;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                this.showFieldError(field, 'Solo se permiten letras, números y guiones bajos');
                return false;
            }
        }

        return true;
    }

    getFieldDisplayName(fieldName) {
        const names = {
            'empresa-nombre': 'Nombre de la empresa',
            'empresa-rif': 'RIF',
            'usuario-nombre': 'Nombre completo',
            'usuario-username': 'Nombre de usuario',
            'usuario-password': 'Contraseña',
            'usuario-rol': 'Rol',
            'edit-usuario-nombre': 'Nombre completo',
            'edit-usuario-username': 'Nombre de usuario',
            'edit-usuario-rol': 'Rol',
            'edit-usuario-estado': 'Estado'
        };
        return names[fieldName] || 'Este campo';
    }

    showFieldError(field, message) {
        field.classList.add('error');
        const errorDiv = document.getElementById(`error-${field.id}`) || this.createErrorElement(field);
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    clearFieldError(field) {
        field.classList.remove('error');
        const errorDiv = document.getElementById(`error-${field.id}`);
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    createErrorElement(field) {
        const errorDiv = document.createElement('div');
        errorDiv.id = `error-${field.id}`;
        errorDiv.className = 'error-message';
        field.parentNode.appendChild(errorDiv);
        return errorDiv;
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    // ==================== EDICIÓN DE USUARIOS ====================

    async editUsuario(id) {
        try {
            console.log(`📝 Editando usuario ID: ${id}`);
            const response = await fetch(`/api/usuarios/${id}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const usuario = await response.json();
                this.openEditModal(usuario);
            } else if (response.status === 404) {
                // Si no existe el endpoint específico, cargar desde la lista
                await this.loadUsuarioFromList(id);
            } else {
                this.showAlert('Error cargando usuario', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    async loadUsuarioFromList(id) {
        try {
            const response = await fetch('/api/usuarios', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const usuarios = await response.json();
                const usuario = usuarios.find(u => u.id == id);
                if (usuario) {
                    this.openEditModal(usuario);
                } else {
                    this.showAlert('Usuario no encontrado', 'error');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error cargando usuarios', 'error');
        }
    }

    openEditModal(usuario) {
        this.usuarioEditando = usuario;
        
        // Llenar formulario
        document.getElementById('edit-usuario-nombre').value = usuario.nombre || '';
        document.getElementById('edit-usuario-username').value = usuario.nombre_usuario || '';
        document.getElementById('edit-usuario-rol').value = usuario.rol || 'Vendedor';
        document.getElementById('edit-usuario-estado').value = usuario.estado || 'Activo';
        document.getElementById('edit-usuario-password').value = '';

        // Limpiar errores
        this.clearEditFormErrors();

        // Mostrar modal
        document.getElementById('usuario-edit-modal').classList.remove('hidden');
    }

    closeEditModal() {
        document.getElementById('usuario-edit-modal').classList.add('hidden');
        this.usuarioEditando = null;
        document.getElementById('usuario-edit-form').reset();
        this.clearEditFormErrors();
    }

    clearEditFormErrors() {
        const errors = document.querySelectorAll('#usuario-edit-form .error-message');
        errors.forEach(error => error.classList.add('hidden'));
        
        const fields = document.querySelectorAll('#usuario-edit-form .input-field');
        fields.forEach(field => field.classList.remove('error'));
    }

    async handleUsuarioEditForm(e) {
        e.preventDefault();
        
        if (!this.validateForm(e.target)) {
            this.showAlert('Por favor, corrija los errores en el formulario', 'error');
            return;
        }

        const formData = {
            nombre: document.getElementById('edit-usuario-nombre').value.trim(),
            nombre_usuario: document.getElementById('edit-usuario-username').value.trim(),
            rol: document.getElementById('edit-usuario-rol').value,
            estado: document.getElementById('edit-usuario-estado').value
        };

        // Agregar password solo si se proporcionó uno nuevo
        const nuevaPassword = document.getElementById('edit-usuario-password').value;
        if (nuevaPassword) {
            if (nuevaPassword.length < 6) {
                this.showFieldError(document.getElementById('edit-usuario-password'), 'La contraseña debe tener al menos 6 caracteres');
                return;
            }
            formData.password = nuevaPassword;
        }

        try {
            const response = await fetch(`/api/usuarios/${this.usuarioEditando.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                this.closeEditModal();
                this.loadUsuarios();
                this.showAlert('Usuario actualizado correctamente', 'success');
            } else {
                const error = await response.json();
                this.showAlert(error.error || 'Error al actualizar usuario', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    // ==================== FUNCIONALIDADES DE USUARIO ====================

    async showUserProfile() {
        try {
            const response = await fetch('/api/me', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const user = await response.json();
                this.showAlert(`Perfil de ${user.nombre} (${user.rol})`, 'info');
                // Aquí puedes expandir para mostrar un modal más detallado
            }
        } catch (error) {
            console.error('Error cargando perfil:', error);
            this.showAlert('Error cargando perfil', 'error');
        }
    }

    async loadUserInfo() {
        try {
            const response = await fetch('/api/me', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const user = await response.json();
                document.getElementById('user-role').textContent = user.rol.toUpperCase();
                document.getElementById('user-name').textContent = user.nombre;
            }
        } catch (error) {
            console.error('Error cargando info usuario:', error);
        }
    }

    // ==================== GESTIÓN DE EMPRESA ====================

    async loadEmpresaData() {
        try {
            const response = await fetch('/api/empresa', {
                credentials: 'include'
            });
            
            if (response.ok) {
                this.empresaData = await response.json();
                this.populateEmpresaForm();
                console.log('🏢 Datos de empresa cargados:', this.empresaData);
            }
        } catch (error) {
            console.error('Error cargando datos empresa:', error);
        }
    }

    populateEmpresaForm() {
        if (this.empresaData) {
            document.getElementById('empresa-nombre').value = this.empresaData.nombre_empresa || '';
            document.getElementById('empresa-rif').value = this.empresaData.rif || '';
            document.getElementById('empresa-direccion').value = this.empresaData.direccion || '';
            document.getElementById('empresa-telefono').value = this.empresaData.telefono || '';
            document.getElementById('empresa-email').value = this.empresaData.email || '';
            document.getElementById('empresa-mensaje').value = this.empresaData.mensaje_factura || '';
        }
    }

    async handleEmpresaForm(e) {
        e.preventDefault();
        
        if (!this.validateForm(e.target)) {
            this.showAlert('Por favor, corrija los errores en el formulario', 'error');
            return;
        }
        
        const formData = {
            nombre_empresa: document.getElementById('empresa-nombre').value,
            rif: document.getElementById('empresa-rif').value,
            direccion: document.getElementById('empresa-direccion').value,
            telefono: document.getElementById('empresa-telefono').value,
            email: document.getElementById('empresa-email').value,
            mensaje_factura: document.getElementById('empresa-mensaje').value
        };

        try {
            const response = await fetch('/api/empresa', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showAlert('Información de empresa actualizada correctamente', 'success');
            } else {
                this.showAlert('Error al actualizar la información', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    // ==================== GESTIÓN DE USUARIOS ====================

    async handleUsuarioForm(e) {
        e.preventDefault();
        
        if (!this.validateForm(e.target)) {
            this.showAlert('Por favor, corrija los errores en el formulario', 'error');
            return;
        }
        
        const formData = {
            nombre: document.getElementById('usuario-nombre').value,
            nombre_usuario: document.getElementById('usuario-username').value,
            password: document.getElementById('usuario-password').value,
            rol: document.getElementById('usuario-rol').value
        };

        try {
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                document.getElementById('usuario-form').reset();
                this.loadUsuarios();
                this.showAlert('Usuario creado correctamente', 'success');
            } else {
                const error = await response.json();
                this.showAlert(error.error || 'Error al crear usuario', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    async loadUsuarios() {
        try {
            const response = await fetch('/api/usuarios', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const usuarios = await response.json();
                this.populateUsuarios(usuarios);
            }
        } catch (error) {
            console.error('Error cargando usuarios:', error);
        }
    }

    populateUsuarios(usuarios) {
        const container = document.getElementById('usuarios-list');
        if (!container) return;

        container.innerHTML = '';

        if (usuarios.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-users text-3xl mb-2"></i>
                    <p>No hay usuarios registrados</p>
                </div>
            `;
            return;
        }

        usuarios.forEach(usuario => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
            item.innerHTML = `
                <div class="flex-1">
                    <div class="font-medium">${usuario.nombre}</div>
                    <div class="text-sm text-gray-500">
                        ${usuario.nombre_usuario} • ${usuario.rol} • 
                        <span class="${usuario.estado === 'Activo' ? 'text-green-600' : 'text-red-600'}">
                            ${usuario.estado}
                        </span>
                        <div class="text-xs text-gray-400 mt-1">
                            Creado: ${usuario.fecha_creacion}
                        </div>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button class="btn-info btn-sm" onclick="configManager.editUsuario(${usuario.id})" title="Editar usuario">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="configManager.toggleUsuarioEstado(${usuario.id}, '${usuario.estado}')" 
                            title="${usuario.estado === 'Activo' ? 'Desactivar' : 'Activar'} usuario">
                        <i class="fas ${usuario.estado === 'Activo' ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    async toggleUsuarioEstado(id, estadoActual) {
        const nuevoEstado = estadoActual === 'Activo' ? 'Inactivo' : 'Activo';
        
        if (confirm(`¿Está seguro de ${nuevoEstado === 'Activo' ? 'activar' : 'desactivar'} este usuario?`)) {
            try {
                const response = await fetch(`/api/usuarios/${id}/estado`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ estado: nuevoEstado })
                });

                if (response.ok) {
                    this.loadUsuarios();
                    this.showAlert(`Usuario ${nuevoEstado.toLowerCase()}`, 'success');
                } else {
                    this.showAlert('Error al cambiar estado', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                this.showAlert('Error de conexión', 'error');
            }
        }
    }

    // ==================== GESTIÓN DE CATEGORÍAS ====================

    async loadCategorias() {
        try {
            const response = await fetch('/api/categorias', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const categorias = await response.json();
                this.populateCategorias(categorias);
            }
        } catch (error) {
            console.error('Error cargando categorías:', error);
        }
    }

    populateCategorias(categorias) {
        const container = document.getElementById('categorias-list');
        if (!container) return;

        container.innerHTML = '';

        if (categorias.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-tags text-3xl mb-2"></i>
                    <p>No hay categorías registradas</p>
                </div>
            `;
            return;
        }

        categorias.forEach(categoria => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
            item.innerHTML = `
                <div class="flex-1">
                    <div class="font-medium">${categoria.nombre}</div>
                    <div class="text-sm text-gray-500">${categoria.descripcion || 'Sin descripción'}</div>
                </div>
                <button class="btn-danger btn-sm" onclick="configManager.deleteCategoria(${categoria.id})" title="Eliminar categoría">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            container.appendChild(item);
        });
    }

    async addCategoria() {
        const nombreInput = document.getElementById('nueva-categoria');
        const descInput = document.getElementById('categoria-descripcion');
        const nombre = nombreInput.value.trim();
        
        if (!nombre) {
            this.showAlert('Ingrese un nombre para la categoría', 'error');
            return;
        }

        try {
            const response = await fetch('/api/categorias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    nombre: nombre,
                    descripcion: descInput.value.trim() 
                })
            });

            if (response.ok) {
                nombreInput.value = '';
                descInput.value = '';
                this.loadCategorias();
                this.showAlert('Categoría agregada correctamente', 'success');
            } else {
                this.showAlert('Error al agregar la categoría', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    async deleteCategoria(id) {
        if (!confirm('¿Está seguro de eliminar esta categoría?')) return;

        try {
            const response = await fetch(`/api/categorias/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                this.loadCategorias();
                this.showAlert('Categoría eliminada', 'success');
            } else {
                this.showAlert('Error al eliminar la categoría', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    // ==================== CONFIGURACIÓN DE NEGOCIO ====================

    async loadConfigNegocio() {
        try {
            const response = await fetch('/api/configuracion/negocio', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const config = await response.json();
                document.getElementById('iva-rate').value = config.iva_rate || 16;
                document.getElementById('stock-minimo-global').value = config.stock_minimo || 10;
                console.log('✅ Configuración negocio cargada:', config);
            }
        } catch (error) {
            console.error('Error cargando configuración negocio:', error);
        }
    }

    async handleConfigNegocio() {
        const configData = {
            iva_rate: parseFloat(document.getElementById('iva-rate').value),
            stock_minimo: parseInt(document.getElementById('stock-minimo-global').value)
        };

        // Validación básica
        if (configData.iva_rate < 0 || configData.iva_rate > 100) {
            this.showAlert('La tasa de IVA debe estar entre 0 y 100', 'error');
            return;
        }

        if (configData.stock_minimo < 1) {
            this.showAlert('El stock mínimo debe ser mayor a 0', 'error');
            return;
        }

        try {
            const response = await fetch('/api/configuracion/negocio', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(configData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showAlert('Configuración de negocio guardada correctamente', 'success');
                console.log('✅ Configuración guardada:', result);
            } else {
                this.showAlert('Error al guardar configuración', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Error de conexión', 'error');
        }
    }

    // ==================== MÉTODOS DE PAGO ====================

    async loadMetodosPago() {
        try {
            const response = await fetch('/api/configuracion/metodos-pago', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const metodos = await response.json();
                this.populateMetodosPago(metodos);
            }
        } catch (error) {
            console.error('Error cargando métodos pago:', error);
        }
    }

    populateMetodosPago(metodos) {
        metodos.forEach(metodo => {
            const checkbox = document.getElementById(`pago-${metodo.id}`);
            if (checkbox) {
                checkbox.checked = metodo.habilitado;
                
                // Agregar event listener para guardar cambios
                checkbox.addEventListener('change', () => {
                    this.updateMetodoPago(metodo.id, checkbox.checked);
                });
            }
        });
    }

    async updateMetodoPago(metodo, habilitado) {
        try {
            const response = await fetch(`/api/configuracion/metodos-pago/${metodo}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ habilitado })
            });

            if (response.ok) {
                const result = await response.json();
                this.showAlert(result.message, 'success');
                console.log(`✅ Método ${metodo} actualizado:`, habilitado);
            } else {
                const error = await response.json();
                this.showAlert(error.error || 'Error actualizando método', 'error');
                
                // Revertir el cambio en la interfaz
                const checkbox = document.getElementById(`pago-${metodo}`);
                if (checkbox) {
                    checkbox.checked = !habilitado;
                }
            }
        } catch (error) {
            console.error('Error actualizando método pago:', error);
            this.showAlert('Error de conexión', 'error');
            
            // Revertir el cambio en la interfaz
            const checkbox = document.getElementById(`pago-${metodo}`);
            if (checkbox) {
                checkbox.checked = !habilitado;
            }
        }
    }

    // ==================== BACKUP Y SEGURIDAD ====================

    async loadBackupHistory() {
        try {
            const response = await fetch('/api/backup/history', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const backups = await response.json();
                this.populateBackupHistory(backups);
            }
        } catch (error) {
            console.error('Error cargando historial backup:', error);
            this.showBackupError();
        }
    }

    populateBackupHistory(backups) {
        const container = document.getElementById('backup-history');
        if (!container) return;

        if (backups.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-database text-3xl mb-2"></i>
                    <p>No hay copias de seguridad</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        backups.forEach(backup => {
            const item = document.createElement('div');
            item.className = 'backup-item flex items-center justify-between p-4 bg-gray-50 rounded-lg';
            item.innerHTML = `
                <div class="flex-1">
                    <div class="font-medium">${backup.filename}</div>
                    <div class="text-sm text-gray-500">
                        ${new Date(backup.created_at).toLocaleDateString('es-ES', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })} - ${backup.size}
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button class="btn-info btn-sm" onclick="configManager.downloadBackup('${backup.filename}')" title="Descargar backup">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="configManager.deleteBackup('${backup.filename}')" title="Eliminar backup">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    async createBackup() {
        const button = document.getElementById('create-backup');
        const progress = document.getElementById('backup-progress');
        const progressFill = progress.querySelector('.progress-fill');
        const status = document.getElementById('backup-status');

        button.disabled = true;
        progress.classList.remove('hidden');
        status.textContent = 'Creando copia de seguridad...';

        try {
            // Simular progreso
            let width = 0;
            const progressInterval = setInterval(() => {
                width += 5;
                progressFill.style.width = width + '%';
                
                if (width >= 90) {
                    clearInterval(progressInterval);
                }
            }, 200);

            const response = await fetch('/api/backup/create', {
                method: 'POST',
                credentials: 'include'
            });

            clearInterval(progressInterval);
            progressFill.style.width = '100%';

            if (response.ok) {
                const result = await response.json();
                status.textContent = '✅ Backup creado exitosamente';
                this.showAlert('Copia de seguridad creada correctamente', 'success');
                this.loadBackupHistory();
                
                setTimeout(() => {
                    progress.classList.add('hidden');
                    button.disabled = false;
                    progressFill.style.width = '0%';
                }, 2000);
            } else {
                const error = await response.json();
                status.textContent = '❌ Error creando backup';
                this.showAlert(error.error || 'Error creando backup', 'error');
                button.disabled = false;
            }
        } catch (error) {
            console.error('Error creando backup:', error);
            status.textContent = '❌ Error de conexión';
            this.showAlert('Error de conexión al crear backup', 'error');
            button.disabled = false;
        }
    }

    async downloadBackup(filename) {
        try {
            const response = await fetch(`/api/backup/download/${filename}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showAlert('Descargando backup...', 'success');
            } else {
                const error = await response.json();
                this.showAlert(error.error || 'Error descargando backup', 'error');
            }
        } catch (error) {
            console.error('Error descargando backup:', error);
            this.showAlert('Error de conexión al descargar', 'error');
        }
    }

    async deleteBackup(filename) {
        if (!confirm(`¿Está seguro de eliminar el backup "${filename}"?`)) return;

        try {
            const response = await fetch(`/api/backup/${filename}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                this.loadBackupHistory();
                this.showAlert('Backup eliminado correctamente', 'success');
            } else {
                const error = await response.json();
                this.showAlert(error.error || 'Error eliminando backup', 'error');
            }
        } catch (error) {
            console.error('Error eliminando backup:', error);
            this.showAlert('Error de conexión al eliminar', 'error');
        }
    }

    showBackupError() {
        const container = document.getElementById('backup-history');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Error cargando backups</p>
                </div>
            `;
        }
    }

    // ==================== NAVEGACIÓN Y UTILIDADES ====================

    switchSection(section) {
        document.querySelectorAll('.config-section').forEach(sec => {
            sec.classList.add('hidden');
        });
        
        const targetSection = document.getElementById(`section-${section}`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNav = document.querySelector(`[data-section="${section}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        this.currentSection = section;
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm fade-in`;
        
        const colors = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white'
        };
        
        alert.className += ` ${colors[type] || colors.info}`;
        alert.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Inicializar
let configManager;
document.addEventListener('DOMContentLoaded', () => {
    configManager = new ConfiguracionManager();
});