import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();


// GET /api/compras - Listar compras con filtros
router.get('/api/compras', requireAuth, async (req, res) => {
  try {
    const { estado, proveedor_id, fecha_desde, fecha_hasta } = req.query;
    
    let query = `
      SELECT c.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.id_proveedor = p.id
      LEFT JOIN usuarios u ON c.id_usuario = u.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (estado) {
      paramCount++;
      query += ` AND c.estado = $${paramCount}`;
      params.push(estado);
    }

    if (proveedor_id) {
      paramCount++;
      query += ` AND c.id_proveedor = $${paramCount}`;
      params.push(proveedor_id);
    }

    if (fecha_desde) {
      paramCount++;
      query += ` AND c.fecha_compra >= $${paramCount}`;
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      paramCount++;
      query += ` AND c.fecha_compra <= $${paramCount}`;
      params.push(fecha_hasta);
    }

    query += ' ORDER BY c.fecha_compra DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo compras:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/compras - Crear nueva compra
router.post('/api/compras', requireAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id_proveedor, num_factura, observaciones, detalles } = req.body;
    const id_usuario = req.session.user.id;

    console.log('📦 Creando nueva compra:', { id_proveedor, num_factura });

    // Insertar compra
    const compraResult = await client.query(
      `INSERT INTO compras (id_proveedor, id_usuario, num_factura, observaciones, estado) 
       VALUES ($1, $2, $3, $4, 'pendiente') RETURNING *`,
      [id_proveedor, id_usuario, num_factura, observaciones]
    );

    const compra = compraResult.rows[0];

    // Insertar detalles
    for (const detalle of detalles) {
      await client.query(
        `INSERT INTO detalle_compra (id_compra, id_producto, cantidad, precio_compra, cantidad_recibida) 
         VALUES ($1, $2, $3, $4, 0)`,
        [compra.id, detalle.id_producto, detalle.cantidad, detalle.precio_compra]
      );
    }

    // Calcular y actualizar total
    const totalResult = await client.query(
      `SELECT SUM(cantidad * precio_compra) as total 
       FROM detalle_compra WHERE id_compra = $1`,
      [compra.id]
    );

    await client.query(
      'UPDATE compras SET total = $1 WHERE id = $2',
      [totalResult.rows[0].total || 0, compra.id]
    );

    await client.query('COMMIT');

    console.log('✅ Compra creada exitosamente - ID:', compra.id);

    res.status(201).json({
      mensaje: 'Compra creada correctamente',
      compra: { ...compra, total: totalResult.rows[0].total || 0 }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creando compra:', error);
    res.status(500).json({ error: 'Error al crear la compra', details: error.message });
  } finally {
    client.release();
  }
});

// PUT /api/compras/:id/recibir - Recibir compra (actualizar stock)
router.put('/api/compras/:id/recibir', requireAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { detalles_recibidos } = req.body; // Array con {id_detalle, cantidad_recibida, lote, fecha_vencimiento}

    console.log('📥 Recibiendo compra:', id);

    // Actualizar detalles de compra
    for (const detalle of detalles_recibidos) {
      await client.query(
        `UPDATE detalle_compra 
         SET cantidad_recibida = $1, lote = $2, fecha_vencimiento = $3 
         WHERE id = $4 AND id_compra = $5`,
        [detalle.cantidad_recibida, detalle.lote, detalle.fecha_vencimiento, detalle.id_detalle, id]
      );

      // Actualizar stock del producto
      await client.query(
        'UPDATE productos SET stock = stock + $1 WHERE id = $2',
        [detalle.cantidad_recibida, detalle.id_producto]
      );
    }

    // Verificar si la compra se recibió completa o parcialmente
    const pendientesResult = await client.query(
      `SELECT COUNT(*) as pendientes 
       FROM detalle_compra 
       WHERE id_compra = $1 AND cantidad_recibida < cantidad`,
      [id]
    );

    const estado = parseInt(pendientesResult.rows[0].pendientes) > 0 ? 'parcial' : 'recibida';

    await client.query(
      'UPDATE compras SET estado = $1, fecha_recepcion = CURRENT_TIMESTAMP WHERE id = $2',
      [estado, id]
    );

    await client.query('COMMIT');

    console.log('✅ Compra recibida - ID:', id, 'Estado:', estado);

    res.json({
      mensaje: `Compra ${estado === 'recibida' ? 'completamente recibida' : 'recibida parcialmente'}`,
      estado
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recibiendo compra:', error);
    res.status(500).json({ error: 'Error al recibir la compra', details: error.message });
  } finally {
    client.release();
  }
});

// GET /api/compras/:id - Obtener compra con detalles
router.get('/api/compras/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const compraResult = await pool.query(`
      SELECT c.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.id_proveedor = p.id
      LEFT JOIN usuarios u ON c.id_usuario = u.id
      WHERE c.id = $1
    `, [id]);

    if (compraResult.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const detallesResult = await pool.query(`
      SELECT dc.*, pr.nombre as producto_nombre, pr.unidad_medida
      FROM detalle_compra dc
      LEFT JOIN productos pr ON dc.id_producto = pr.id
      WHERE dc.id_compra = $1
    `, [id]);

    res.json({
      compra: compraResult.rows[0],
      detalles: detallesResult.rows
    });

  } catch (error) {
    console.error('Error obteniendo compra:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/compras/:id/factura - Generar factura de compra
router.get('/api/compras/:id/factura', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🧾 Generando factura de compra:', id);

    // 1. Obtener datos de la compra
    const compraResult = await pool.query(`
      SELECT 
        c.*,
        p.nombre as proveedor_nombre,
        p.contacto as proveedor_contacto,
        p.direccion as proveedor_direccion,
        u.nombre as comprador_nombre,
        emp.nombre_empresa,
        emp.rif as empresa_rif,
        emp.telefono as empresa_telefono,
        emp.direccion as empresa_direccion,
        emp.mensaje_factura
      FROM compras c
      LEFT JOIN proveedores p ON c.id_proveedor = p.id
      LEFT JOIN usuarios u ON c.id_usuario = u.id
      LEFT JOIN configuracion_empresa emp ON emp.id = 1
      WHERE c.id = $1
    `, [id]);

    if (compraResult.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const compra = compraResult.rows[0];

    // 2. Obtener detalles de la compra
    const detallesResult = await pool.query(`
      SELECT 
        dc.*,
        pr.nombre as producto_nombre,
        pr.unidad_medida,
        (dc.cantidad * dc.precio_compra) as total_linea
      FROM detalle_compra dc
      LEFT JOIN productos pr ON dc.id_producto = pr.id
      WHERE dc.id_compra = $1
      ORDER BY dc.id
    `, [id]);

    const detalles = detallesResult.rows;

    // 3. Calcular totales
    const subtotal = detalles.reduce((sum, detalle) => 
      sum + (parseFloat(detalle.cantidad) * parseFloat(detalle.precio_compra)), 0);
    
    // Obtener tasa de IVA desde configuración
    const ivaConfig = await pool.query(
      'SELECT iva_rate FROM configuracion_negocio ORDER BY id DESC LIMIT 1'
    );
    const ivaRate = ivaConfig.rows[0]?.iva_rate || 16.00;
    const iva = subtotal * (ivaRate / 100);
    const total = subtotal + iva;

    // 4. Estructurar datos para la factura
    const factura = {
      // Información de la empresa
      empresa: {
        nombre: compra.nombre_empresa || 'Na\'Guara',
        rif: compra.empresa_rif || 'J-123456789',
        telefono: compra.empresa_telefono || '(0412) 123-4567',
        direccion: compra.empresa_direccion || 'Caracas, Venezuela',
        mensaje: compra.mensaje_factura || '¡Gracias por su compra!'
      },
      
      // Información del proveedor
      proveedor: {
        nombre: compra.proveedor_nombre,
        contacto: compra.proveedor_contacto,
        direccion: compra.proveedor_direccion
      },
      
      // Información de la compra
      compra: {
        id: compra.id,
        numero_factura: compra.num_factura || `COMP-${compra.id.toString().padStart(6, '0')}`,
        fecha_compra: compra.fecha_compra,
        fecha_recepcion: compra.fecha_recepcion,
        estado: compra.estado,
        comprador: compra.comprador_nombre,
        observaciones: compra.observaciones
      },
      
      // Detalles de productos
      detalles: detalles.map(detalle => ({
        producto: detalle.producto_nombre,
        unidad_medida: detalle.unidad_medida,
        cantidad: parseFloat(detalle.cantidad),
        precio_unitario: parseFloat(detalle.precio_compra),
        total_linea: parseFloat(detalle.cantidad) * parseFloat(detalle.precio_compra),
        lote: detalle.lote,
        fecha_vencimiento: detalle.fecha_vencimiento
      })),
      
      // Totales
      totales: {
        subtotal: subtotal,
        iva: iva,
        iva_rate: ivaRate,
        total: total
      }
    };

    console.log('✅ Factura generada - Compra ID:', id);

    res.json(factura);

  } catch (error) {
    console.error('❌ Error generando factura:', error);
    res.status(500).json({ error: 'Error al generar la factura de compra' });
  }
});

// GET /api/compras/stats/estadisticas - Estadísticas de compras
router.get('/api/compras/stats/estadisticas', requireAuth, async (req, res) => {
  try {
    const { mes, año } = req.query;
    
    // Obtener mes y año actual en JavaScript
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1; // getMonth() devuelve 0-11
    const añoActual = fechaActual.getFullYear();
    
    // Usar los parámetros o los valores por defecto
    const mesFiltro = mes || mesActual;
    const añoFiltro = año || añoActual;

    console.log('📊 Obteniendo estadísticas:', { mes: mesFiltro, año: añoFiltro });

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_compras,
        COALESCE(SUM(total), 0) as total_invertido,
        COALESCE(AVG(total), 0) as promedio_compra,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as compras_pendientes,
        COUNT(CASE WHEN estado = 'recibida' THEN 1 END) as compras_recibidas
      FROM compras
      WHERE EXTRACT(MONTH FROM fecha_compra) = $1 AND EXTRACT(YEAR FROM fecha_compra) = $2
    `, [mesFiltro, añoFiltro]);

    const topProveedoresResult = await pool.query(`
      SELECT 
        p.id,
        p.nombre,
        COUNT(c.id) as total_compras,
        COALESCE(SUM(c.total), 0) as total_comprado
      FROM proveedores p
      LEFT JOIN compras c ON p.id = c.id_proveedor
      GROUP BY p.id, p.nombre
      ORDER BY total_comprado DESC NULLS LAST
      LIMIT 5
    `);

    res.json({
      estadisticas: statsResult.rows[0],
      top_proveedores: topProveedoresResult.rows
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
});


export default router;