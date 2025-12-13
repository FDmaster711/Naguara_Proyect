const NOTI_API_BASE = 'http://localhost:3000/api';

// 1. inyectar estilos globales
function injectStyles() {
    if (document.getElementById('noti-global-styles')) return;

    const css = `
    /* estilos notificaciones globales */
    .notification-container {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: 40px; 
        height: 40px;
        justify-content: center;
        margin-left: auto;
        cursor: pointer;
        z-index: 10001;
    }
    
    .notification-badge {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        transition: transform 0.2s;
    }
    .notification-badge:hover {
        transform: scale(1.1);
    }
    .notification-badge i {
        color: #5a00b3; /* primary */
        font-size: 1.2rem;
    }
    
    .badge-count {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #e74c3c; /* danger */
        color: white !important;
        font-size: 0.75rem;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
        border: 2px solid #fff;
    }

    /* posicion fija para evitar peos de overflow */
    .notification-dropdown {
        display: none;
        position: fixed; 
        top: 0;
        left: 0;
        background: #fff;
        width: 320px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 999999;
        overflow: hidden;
        border: 1px solid #ddd;
    }
    
    .notification-dropdown.active {
        display: block;
        animation: fadeIn 0.2s ease-out;
    }

    .notification-header {
        background: #5a00b3;
        color: #fff;
        padding: 15px;
        font-weight: 600;
        font-size: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .notification-list {
        max-height: 400px;
        overflow-y: auto;
        padding: 0;
        margin: 0;
        list-style: none;
    }

    .notification-item {
        padding: 15px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: start;
        gap: 15px;
        cursor: pointer;
        transition: background 0.2s;
    }
    .notification-item:hover { background: #f9f9f9; }
    
    .notification-icon {
        color: #e74c3c;
        background: #ffebee;
        width: 35px; height: 35px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        font-size: 1.1rem;
    }
    
    .notification-content { flex: 1; }
    .notification-title { font-weight: 600; font-size: 0.95rem; color: #333; margin-bottom: 4px; }
    .notification-desc { font-size: 0.85rem; color: #666; line-height: 1.4; }
    .notification-empty { padding: 30px; text-align: center; color: #888; font-size: 0.95rem; }
    
    /* resaltar los no leidos */
    .notification-item.unread {
        border-left: 4px solid #8b5cf6;
    }

    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    `;

    const style = document.createElement('style');
    style.id = 'noti-global-styles';
    style.textContent = css;
    document.head.appendChild(style);
}

// inyectar html de la notificacion
function injectHTML() {
    if (document.getElementById('notification-bell') || document.getElementById('notiBadge')) {
        return;
    }

    const breadcrumb = document.querySelector('.breadcrumb');
    if (breadcrumb) {

        breadcrumb.style.display = 'flex';
        breadcrumb.style.justifyContent = 'space-between';
        breadcrumb.style.alignItems = 'center';
        breadcrumb.style.overflow = 'visible';

        const container = document.createElement('div');
        container.className = 'notification-container';
        container.id = 'injected-bell';

        container.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.toggleNotifications(e);
        };

        container.innerHTML = `
            <div class="notification-badge" id="notiBadge">
                <i class="fas fa-bell"></i>
                <span class="badge-count" id="notiCount" style="display: none;">0</span>
            </div>
             <div class="notification-dropdown" id="notiDropdown">
                <div class="notification-header">
                    <span>Notificaciones</span>
                    <span style="font-size: 0.8rem;" id="notiCountText">0 nuevas</span>
                </div>
                <ul class="notification-list" id="notiList">
                    <li class="notification-empty">Cargando...</li>
                </ul>
            </div>
        `;

        breadcrumb.appendChild(container);
        return;
    }
}

// logica del fetch para traer datos
async function fetchNotiData(endpoint) {
    try {
        const res = await fetch(`${NOTI_API_BASE}${endpoint}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
    } catch (err) {
        return null;
    }
}

// manejo del estado
let currentNotis = [];

async function checkNotifications() {
    try {
        const stats = await fetchNotiData('/dashboard/stats');
        if (!stats) return;

        currentNotis = stats.productosStockMinimoDetalles || [];
        updateGeneralizedUI(stats);

    } catch (e) {
        console.error("Error checking notifications:", e);
    }
}

function getSeenIds() {
    try {
        return JSON.parse(localStorage.getItem('noti_seen_ids') || '[]');
    } catch { return []; }
}

function updateGeneralizedUI(stats) {
    const badge = document.getElementById('notiBadge');
    const countEl = document.getElementById('notiCount');
    const list = document.getElementById('notiList');
    const countText = document.getElementById('notiCountText');
    const seenIds = getSeenIds();

    const ventasBell = document.getElementById('notification-bell');
    if (ventasBell && !badge) {
        updateVentasTailwindUI(stats, ventasBell, seenIds);
        return;
    }

    if (!list) return;

    list.innerHTML = '';
    let allProducts = stats.productosStockMinimoDetalles || [];

    // contar lo q no se ha leido
    const unreadCount = allProducts.filter(p => !seenIds.includes(p.id)).length;
    // si hay mas alertas q detalles pues sumar la diferensia
    const totalRemoteCount = stats.productosStockMinimo || 0;
    const extraCount = Math.max(0, totalRemoteCount - allProducts.length);
    const totalUnread = unreadCount + extraCount;

    // renderizar la lista
    if (allProducts.length > 0) {
        allProducts.forEach(prod => {
            const isUnread = !seenIds.includes(prod.id);
            const styleClass = isUnread ? 'notification-item unread' : 'notification-item';
            const bgStyle = isUnread ? 'background-color: #f3e8ff;' : ''; // moradito clarito pa lo no leido

            list.innerHTML += `
                <li class="${styleClass}" style="${bgStyle}" onclick="window.location.href='/Inventario/Productos.html?filtro=bajo'">
                <div class="notification-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="notification-content">
                    <div class="notification-title">Stock Bajo: ${prod.nombre}</div>
                    <div class="notification-desc">Quedan <b>${prod.stock}</b> unidades (Mín: ${prod.stock_minimo}).</div>
                </div>
                </li>
            `;
        });

        if (extraCount > 0) {
            list.innerHTML += `
                <li class="notification-item" style="justify-content: center; color: #5a00b3; font-weight: 600; font-size: 0.9rem;">
                   <i class="fas fa-plus-circle mr-2"></i> ${extraCount} productos más...
                </li>
            `;
        }

    } else if (totalRemoteCount > 0) {
        // si no hay detalles se muestra el l detalle 
        list.innerHTML += `
            <li class="notification-item" onclick="window.location.href='/Inventario/Productos.html?filtro=bajo'">
            <div class="notification-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="notification-content">
                <div class="notification-title">Stock Mínimo</div>
                <div class="notification-desc">Hay ${totalRemoteCount} productos con bajo inventario.</div>
            </div>
            </li>
        `;
    } else {
        list.innerHTML = '<li class="notification-empty">No hay notificaciones</li>';
    }

    // actulizar el badge (la cosa rija donde se muestra el numero de notudicones)
    if (totalUnread > 0) {
        if (countEl) {
            countEl.style.display = 'block';
            countEl.textContent = totalUnread;
        }
        if (countText) countText.textContent = `${totalUnread} nuevas`;
        if (badge && badge.querySelector('i')) badge.querySelector('i').style.animation = 'pulse 2s infinite';
    } else {
        if (countEl) countEl.style.display = 'none';
        if (countText) countText.textContent = '0 nuevas';
        if (list.innerHTML.includes('No hay notificaciones')) {
            // dejarlo escondido
        }
        if (badge && badge.querySelector('i')) badge.querySelector('i').style.animation = 'none';
    }
}

function updateVentasTailwindUI(stats, container, seenIds) {
    let badge = container.querySelector('span.absolute');
    const list = container.querySelector('ul');
    if (!list) return;

    list.innerHTML = '';

    let allProducts = stats.productosStockMinimoDetalles || [];
    const unreadCount = allProducts.filter(p => !seenIds.includes(p.id)).length;

    if (allProducts.length > 0) {
        allProducts.forEach(prod => {
            const isUnread = !seenIds.includes(prod.id);
            const bgClass = isUnread ? 'bg-purple-50' : 'hover:bg-gray-50';

            list.innerHTML += `
                <li class="p-3 ${bgClass} cursor-pointer border-b border-gray-50 text-left" onclick="window.location.href='../Inventario/Productos.html?filtro=bajo'">
                    <p class="text-sm font-medium text-gray-800 text-red-600"><i class="fas fa-exclamation-triangle mr-1"></i> Stock bajo: ${prod.nombre}</p>
                    <p class="text-xs text-gray-500">Quedan ${prod.stock} (Mín: ${prod.stock_minimo})</p>
                </li>
             `;
        });
    } else {
        list.innerHTML = `<li class="p-3 text-center text-gray-400 text-sm">Sin notificaciones</li>`;
    }

    if (unreadCount > 0) {
        badge.classList.remove('hidden');
        badge.textContent = unreadCount;
    } else {
        badge.classList.add('hidden');
    }
}

// togle global
window.toggleNotifications = function (event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const dropdown = document.getElementById('notiDropdown');
    const bell = document.getElementById('injected-bell') || document.getElementById('notiBadge')?.parentElement || document.getElementById('notification-container');

    if (dropdown && bell) {
        const rect = bell.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 10) + 'px';
        let leftPos = rect.right - 300;
        if (leftPos < 10) leftPos = 10;
        dropdown.style.left = leftPos + 'px';
        dropdown.classList.toggle('active');

        // marcar como leidas al abrir
        if (dropdown.classList.contains('active')) {
            markAsRead();
        }

    } else {
        const standardDropdown = document.getElementById('notiDropdown');
        if (standardDropdown) {
            standardDropdown.classList.toggle('active');
            if (standardDropdown.classList.contains('active')) markAsRead();
        }
    }
};

function markAsRead() {
    if (!currentNotis || currentNotis.length === 0) return;

    const seenIds = getSeenIds();
    let changed = false;

    currentNotis.forEach(p => {
        if (!seenIds.includes(p.id)) {
            seenIds.push(p.id);
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('noti_seen_ids', JSON.stringify(seenIds));
        // actualizar ui de una pa quitar el badge (la vaina roja)
        setTimeout(() => checkNotifications(), 300);
    }
}

// para que se cierre el dropdown al hacer click fuera
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notiDropdown');
    const bell = document.getElementById('injected-bell') || document.getElementById('notiBadge')?.parentElement;

    if (dropdown && dropdown.classList.contains('active')) {
        if (bell && bell.contains(e.target)) return;
        if (dropdown.contains(e.target)) return;
        dropdown.classList.remove('active');
    }
});


function init() {
    injectStyles();
    injectHTML();
    checkNotifications();
    setInterval(checkNotifications, 60000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
