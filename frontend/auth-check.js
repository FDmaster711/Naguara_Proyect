// auth-check.js - Versión corregida
class AuthChecker {
    constructor() {
        this.API_BASE = 'http://localhost:3000/api';
        this.isLoginPage = window.location.pathname.includes('login.html');
        this.init();
    }

    async init() {
        console.log('🔐 Verificando autenticación en:', window.location.pathname);
        
        // No verificar autenticación en la página de login
        if (this.isLoginPage) {
            await this.checkIfAlreadyAuthenticated();
            return;
        }

        // Para otras páginas, verificar autenticación
        const isAuthenticated = await this.checkSession();
        
        if (!isAuthenticated) {
            console.log('❌ Usuario no autenticado, redirigiendo al login...');
            this.redirectToLogin();
        } else {
            console.log('✅ Usuario autenticado');
        }
    }

    async checkIfAlreadyAuthenticated() {
        const isAuthenticated = await this.checkSession();
        if (isAuthenticated) {
            console.log('✅ Usuario ya autenticado, redirigiendo al dashboard...');
            this.redirectAfterLogin();
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
        // Guardar la página actual EXCEPTO si ya es login
        const currentPath = window.location.pathname;
        if (currentPath !== '/login.html' && !currentPath.includes('login.html')) {
            sessionStorage.setItem('redirectAfterLogin', currentPath + window.location.search);
            console.log('📍 Guardando ruta para redirección:', currentPath);
        }
        
        // Redirigir al login
        window.location.href = '/login.html';
    }

    redirectAfterLogin() {
        const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
        
        if (redirectUrl && !redirectUrl.includes('login.html')) {
            sessionStorage.removeItem('redirectAfterLogin');
            window.location.href = redirectUrl;
        } else {
            window.location.href = '/index.html';
        }
    }

    async getCurrentUser() {
        try {
            const response = await fetch(`${this.API_BASE}/me`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const user = await response.json();
                // Actualizar localStorage para consistencia
                localStorage.setItem('usuario', JSON.stringify(user));
                return user;
            }
            return null;
        } catch (error) {
            console.error('Error obteniendo usuario actual:', error);
            return null;
        }
    }

    async logout() {
        try {
            const response = await fetch('http://localhost:3000/logout', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                localStorage.removeItem('usuario');
                sessionStorage.removeItem('redirectAfterLogin');
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Error cerrando sesión:', error);
        }
    }
}

// Inicializar
const authChecker = new AuthChecker();