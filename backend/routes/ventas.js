import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();

router.post('/api/ventas', requireAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id_cliente, detalles, metodo_pago, payment_details } = req.body;
    const id_usuario = req.session.user.id;

    console.log('📦 Procesando venta con pago:', { 
      id_cliente, 
      detalles, 
      metodo_pago,
      payment_details 
    });

    // Calcular total de la venta
    const total_venta = detalles.reduce((sum, detalle) => 
      sum + (parseFloat(detalle.cantidad) * parseFloat(detalle.precio_unitario)), 0);

    // Insertar venta principal con nuevos campos
    const ventaResult = await client.query(
      `INSERT INTO ventas (
        id_usuario, id_cliente, metodo_pago, estado, 
        detalles_pago, referencia_pago, banco_pago, monto_recibido, cambio
      ) VALUES ($1, $2, $3, 'completada', $4, $5, $6, $7, $8) RETURNING *`,
      [
        id_usuario, 
        id_cliente, 
        metodo_pago,
        payment_details ? JSON.stringify(payment_details) : null,
        payment_details?.reference || payment_details?.referencia || null,
        payment_details?.bank || payment_details?.banco || null,
        payment_details?.received || payment_details?.monto_recibido || null,
        payment_details?.change || payment_details?.cambio || null
      ]
    );

    const venta = ventaResult.rows[0];
    console.log('✅ Venta creada:', venta.id);

    // Procesar detalles de la venta (productos)
    for (const detalle of detalles) {
      console.log('📝 Procesando detalle:', detalle);
      
      const productoResult = await client.query(
        'SELECT stock, nombre FROM productos WHERE id = $1',
        [detalle.id_producto]
      );
      
      if (productoResult.rows.length === 0) {
        throw new Error(`Producto con ID ${detalle.id_producto} no encontrado`);
      }
      
      const producto = productoResult.rows[0];
      if (producto.stock < detalle.cantidad) {
        throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}, Solicitado: ${detalle.cantidad}`);
      }

      await client.query(
        `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario) 
         VALUES ($1, $2, $3, $4)`,
        [venta.id, detalle.id_producto, detalle.cantidad, detalle.precio_unitario]
      );

      const updateResult = await client.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2 RETURNING stock, nombre',
        [detalle.cantidad, detalle.id_producto]
      );
      
      console.log('📊 Stock actualizado:', updateResult.rows[0]);
    }

    await client.query('COMMIT');

    console.log('✅ Venta completada exitosamente - ID:', venta.id);

    res.status(201).json({
      mensaje: 'Venta procesada correctamente',
      venta: {
        id: venta.id,
        fecha_venta: venta.fecha_venta,
        total: total_venta,
        metodo_pago: venta.metodo_pago,
        payment_details: payment_details
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en venta:', error);
    
    let errorMessage = 'Error al procesar la venta';
    if (error.code === '23505') {
      errorMessage = 'Error de duplicado en la base de datos';
    } else if (error.code === '23503') {
      errorMessage = 'Error de referencia (cliente o producto no existe)';
    } else if (error.message.includes('Stock insuficiente')) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: error.message 
    });
  } finally {
    client.release();
  }
});


router.get('/api/ventas', requireAuth, async (req, res) => {
  try {
    const { fecha } = req.query;
    let query = `
      SELECT v.*, c.nombre as cliente_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.id_cliente = c.id
      WHERE v.estado = 'completada'
    `;
    let params = [];

    if (fecha) {
      query += ' AND DATE(v.fecha_venta) = $1';
      params.push(fecha);
    }

    query += ' ORDER BY v.fecha_venta DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/ventas/resumen-diario', requireAuth, async (req, res) => {
  try {
    const { fecha } = req.query;
    const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
    const usuario_id = req.session.user.id; // ✅ Obtener el usuario de la sesión

    console.log('📊 Obteniendo resumen diario para:', { 
      fecha: fechaFiltro, 
      usuario: usuario_id 
    });

    // 1. Obtener ventas NO mixtas DEL USUARIO ACTUAL
    const ventasNoMixtas = await pool.query(`
      SELECT 
        metodo_pago,
        COUNT(*) as cantidad_ventas,
        SUM(
          (SELECT SUM(dv.cantidad * dv.precio_unitario) 
           FROM detalle_venta dv 
           WHERE dv.id_venta = v.id)
        ) as total_ventas
      FROM ventas v
      WHERE DATE(v.fecha_venta) = $1 
        AND v.estado = 'completada'
        AND v.metodo_pago != 'mixto'
        AND v.id_usuario = $2  -- ✅ FILTRAR POR USUARIO
      GROUP BY metodo_pago
    `, [fechaFiltro, usuario_id]);

    // 2. Obtener ventas mixtas DEL USUARIO ACTUAL
    const ventasMixtas = await pool.query(`
      SELECT v.id, v.detalles_pago
      FROM ventas v
      WHERE DATE(v.fecha_venta) = $1 
        AND v.estado = 'completada'
        AND v.metodo_pago = 'mixto'
        AND v.id_usuario = $2  -- ✅ FILTRAR POR USUARIO
    `, [fechaFiltro, usuario_id]);

    // 3. Obtener estadísticas generales DEL USUARIO ACTUAL
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_ventas_count,
        MIN(fecha_venta) as primera_venta,
        MAX(fecha_venta) as ultima_venta
      FROM ventas 
      WHERE DATE(fecha_venta) = $1 
        AND estado = 'completada'
        AND id_usuario = $2  -- ✅ FILTRAR POR USUARIO
    `, [fechaFiltro, usuario_id]);

    const stats = statsResult.rows[0] || {
      total_ventas_count: 0,
      primera_venta: null,
      ultima_venta: null
    };

    // Inicializar resumen
    const resumen = {
      efectivo_bs: 0,
      efectivo_usd: 0,
      punto_venta: 0,
      transferencia: 0,
      pago_movil: 0,
      mixto: 0,
      efectivo: 0,
      tarjeta: 0,
      total: 0,
      total_ventas_count: parseInt(stats.total_ventas_count) || 0,
      primera_venta: stats.primera_venta,
      ultima_venta: stats.ultima_venta,
      usuario: usuario_id  // ✅ Incluir info del usuario
    };

    // 4. Procesar ventas NO mixtas
    ventasNoMixtas.rows.forEach(row => {
      const metodo = row.metodo_pago;
      const total = parseFloat(row.total_ventas) || 0;
      
      if (resumen.hasOwnProperty(metodo)) {
        resumen[metodo] = total;
      }
      resumen.total += total;
    });

    // 5. Procesar ventas Mixtas - DESGLOSAR
    let contadorMixtas = 0;
    ventasMixtas.rows.forEach(venta => {
      contadorMixtas++;
      
      if (venta.detalles_pago && venta.detalles_pago.payments) {
        venta.detalles_pago.payments.forEach(pago => {
          const metodo = pago.method;
          const monto = parseFloat(pago.amount) || 0;
          
          if (resumen.hasOwnProperty(metodo)) {
            resumen[metodo] += monto;
            resumen.total += monto;
          }
        });
      }
    });

    resumen.mixto = contadorMixtas;

    console.log('📈 Resumen diario DEL USUARIO:', {
      usuario: usuario_id,
      totalVentas: resumen.total,
      cantidadVentas: resumen.total_ventas_count,
      ventasMixtas: contadorMixtas
    });

    res.json(resumen);

  } catch (error) {
    console.error('Error obteniendo resumen diario:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/cierre-caja/verificar', requireAuth, async (req, res) => {
  try {
    const { fecha, usuario_id } = req.query;
    const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
    const usuarioFiltro = usuario_id || req.session.user.id;

    console.log('🔍 Verificando cierre de caja para:', { fecha: fechaFiltro, usuario: usuarioFiltro });

    const result = await pool.query(
      'SELECT id, fecha, usuario_id, estado FROM cierre_caja WHERE fecha = $1 AND usuario_id = $2',
      [fechaFiltro, usuarioFiltro]
    );

    if (result.rows.length > 0) {
      console.log('❌ Cierre de caja ya existe:', result.rows[0]);
      return res.status(409).json({
        error: 'Cierre de caja ya existe',
        cierre_existente: result.rows[0]
      });
    }

    console.log('✅ No existe cierre de caja para hoy');
    res.json({ 
      mensaje: 'Puede proceder con el cierre de caja',
      puede_continuar: true 
    });

  } catch (error) {
    console.error('Error verificando cierre de caja:', error);
    res.status(500).json({ error: 'Error al verificar cierre de caja' });
  }
});



router.post('/api/cierre-caja', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const {
      fecha,
      usuario_id = req.session.user.id,
      efectivo_inicial,
      efectivo_final,
      total_ventas,
      total_ventas_efectivo,
      total_ventas_tarjeta,
      total_ventas_transferencia,
      total_ventas_pago_movil,
      diferencia
    } = req.body;

    console.log('🔐 Validando cierre de caja para usuario:', usuario_id, 'fecha:', fecha);

    // ✅ VALIDACIÓN: Verificar si ya existe un cierre de caja para este usuario en esta fecha
    const existingClose = await client.query(
      'SELECT id, fecha, usuario_id FROM cierre_caja WHERE fecha = $1 AND usuario_id = $2',
      [fecha, usuario_id]
    );

    if (existingClose.rows.length > 0) {
      await client.query('ROLLBACK');
      console.log('❌ Ya existe cierre de caja para hoy:', existingClose.rows[0]);
      return res.status(409).json({ 
        error: 'Ya existe un cierre de caja para esta fecha y usuario',
        cierre_existente: existingClose.rows[0]
      });
    }

    // ✅ Insertar nuevo cierre de caja
    const result = await client.query(`
      INSERT INTO cierre_caja (
        fecha, usuario_id, efectivo_inicial, efectivo_final, total_ventas,
        total_ventas_efectivo, total_ventas_tarjeta, total_ventas_transferencia,
        total_ventas_pago_movil, diferencia, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completado')
      RETURNING *
    `, [
      fecha, usuario_id, efectivo_inicial, efectivo_final, total_ventas,
      total_ventas_efectivo, total_ventas_tarjeta, total_ventas_transferencia,
      total_ventas_pago_movil, diferencia
    ]);

    await client.query('COMMIT');
    
    console.log('✅ Cierre de caja registrado exitosamente:', result.rows[0].id);
    res.status(201).json({ 
      mensaje: 'Cierre de caja procesado exitosamente',
      cierre: result.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error procesando cierre de caja:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Ya existe un cierre de caja para hoy' 
      });
    }
    
    res.status(500).json({ error: 'Error al procesar cierre de caja' });
  } finally {
    client.release();
  }
});


router.get('/api/ventas/top-productos', requireAuth, async (req, res) => {
  try {
    const { fecha } = req.query;
    const result = await pool.query(`
      SELECT 
        p.nombre,
        SUM(dv.cantidad) as cantidad,
        SUM(dv.cantidad * dv.precio_unitario) as total
      FROM detalle_venta dv
      JOIN productos p ON dv.id_producto = p.id
      JOIN ventas v ON dv.id_venta = v.id
      WHERE DATE(v.fecha_venta) = $1
      GROUP BY p.id, p.nombre
      ORDER BY cantidad DESC
      LIMIT 10
    `, [fecha]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo top productos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/ventas/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📋 Solicitando datos de venta:', id);
    
    const ventaResult = await pool.query(`
      SELECT v.*, c.nombre as cliente_nombre, c.cedula_rif, c.telefono, c.direccion,
             u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.id_cliente = c.id
      LEFT JOIN usuarios u ON v.id_usuario = u.id
      WHERE v.id = $1
    `, [id]);

    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const venta = ventaResult.rows[0];

    const detallesResult = await pool.query(`
      SELECT dv.*, p.nombre as producto_nombre, p.unidad_medida
      FROM detalle_venta dv
      LEFT JOIN productos p ON dv.id_producto = p.id
      WHERE dv.id_venta = $1
    `, [id]);

    const detalles = detallesResult.rows;
    
    const subtotal = detalles.reduce((sum, detalle) => 
      sum + (parseFloat(detalle.cantidad) * parseFloat(detalle.precio_unitario)), 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    console.log('✅ Datos de venta obtenidos:', { 
      id, 
      items: detalles.length,
      metodo_pago: venta.metodo_pago,
      detalles_pago_type: typeof venta.detalles_pago
    });

    // Manejar detalles_pago de forma segura
    let detallesPago = venta.detalles_pago;
    
    // Si es string, parsear; si ya es objeto, usar directamente
    if (detallesPago && typeof detallesPago === 'string') {
      try {
        detallesPago = JSON.parse(detallesPago);
      } catch (parseError) {
        console.warn('⚠️ Error parseando detalles_pago:', parseError);
        detallesPago = null;
      }
    }

    res.json({
      id: venta.id,
      fecha_venta: venta.fecha_venta,
      cliente: {
        nombre: venta.cliente_nombre,
        cedula_rif: venta.cedula_rif,
        telefono: venta.telefono,
        direccion: venta.direccion
      },
      vendedor: venta.vendedor_nombre,
      metodo_pago: venta.metodo_pago,
      detalles_pago: detallesPago,
      referencia_pago: venta.referencia_pago,
      banco_pago: venta.banco_pago,
      monto_recibido: venta.monto_recibido,
      cambio: venta.cambio,
      detalles: detalles,
      subtotal: subtotal,
      iva: iva,
      total: total
    });

  } catch (error) {
    console.error('❌ Error obteniendo venta:', error);
    res.status(500).json({ error: 'Error al obtener los datos de la venta' });
  }
});




// Agrega esto antes del export default




export default router;