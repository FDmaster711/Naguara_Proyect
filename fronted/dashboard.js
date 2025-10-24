document.addEventListener('DOMContentLoaded', function () {
    // Actualiza los KPIs
    actualizarCardsDashboard();

    // Gráfica de producto más vendido
    const ventasPorProducto = {};
    ventasDB.forEach(v => {
        ventasPorProducto[v.producto_id] = (ventasPorProducto[v.producto_id] || 0) + v.cantidad;
    });
    const labels = productosDB.map(p => p.nombre);
    const series = productosDB.map(p => ventasPorProducto[p.id] || 0);

    var options = {
        chart: { type: 'donut', height: 250 },
        series: series,
        labels: labels,
        colors: ['#536DFE', '#ffc260', '#3CD4A0', '#9013FE'],
        legend: { position: 'bottom' }
    };
    var chart = new ApexCharts(document.querySelector("#chartProductoMasVendido"), options);
    chart.render();

    // Ejemplo de notificación al cargar
    mostrarToast('¡Bienvenido al Dashboard!', 'primary', 'fa-home');
});