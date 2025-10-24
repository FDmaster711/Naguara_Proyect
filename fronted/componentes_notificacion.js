function mostrarToast(mensaje, tipo = 'info', icono = 'fa-info-circle', tiempo = 5000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
        <span class="toast-icon"><i class="fas ${icono}"></i></span>
        <span class="toast-message">${mensaje}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => container.removeChild(toast), 500);
    }, tiempo);
}