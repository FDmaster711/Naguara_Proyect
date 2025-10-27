// auth-check.js - Verificación universal de autenticación
class AuthChecker {
    constructor() {
        this.API_BASE = 'http://localhost:3000/api';
        this.init();
    }

    async init() {
        console.log('🔐 Verificando autenticación...');
        const isAuthenticated = await this.checkSession();
        
        if (!isAuthenticated) {
            console.log('❌ Usuario no autenticado, redirigiendo al login...');
            this.redirectToLogin();
        } else {
            console.log('✅ Usuario autenticado');
        }
    }

    async checkSession() {
        try {
            const response = await fetch(`${this.API_BASE}/sesion`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data.autenticado === true;
            
        } catch (error) {
            console.error('Error verificando sesión:', error);
            return false;
        }
    }

    redirectToLogin() {
        // Guardar la página actual para redirigir después del login
        const currentPath = window.location.pathname;
        if (currentPath !== '/login.html' && !currentPath.includes('login.html')) {
            sessionStorage.setItem('redirectAfterLogin', currentPath);
        }
        
        window.location.href = 'login.html';
    }

    // Método para obtener información del usuario logueado
    async getCurrentUser() {
        try {
            const response = await fetch(`${this.API_BASE}/me`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Error obteniendo usuario actual:', error);
            return null;
        }
    }

    // Método para cerrar sesión
    async logout() {
        try {
            const response = await fetch('http://localhost:3000/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                localStorage.removeItem('usuario');
                sessionStorage.removeItem('redirectAfterLogin');
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Error cerrando sesión:', error);
        }
    }
}

// Inicializar verificación de autenticación
const authChecker = new AuthChecker();