import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();

router.post('/api/ventas', requireAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id_cliente, detalles, metodo_pago } = req.body;
    const id_usuario = req.session.user.id;

    console.log('📦 Procesando venta:', { 
      id_cliente, 
      detalles, 
      metodo_pago, 
      id_usuario 
    });

    const ventaResult = await client.query(
      `INSERT INTO ventas (id_usuario, id_cliente, metodo_pago, estado) 
       VALUES ($1, $2, $3, 'completada') RETURNING *`,
      [id_usuario, id_cliente, metodo_pago]
    );

    const venta = ventaResult.rows[0];
    console.log('✅ Venta creada:', venta.id);

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
        total: detalles.reduce((sum, detalle) => sum + (detalle.cantidad * detalle.precio_unitario), 0)
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

    console.log('✅ Datos de venta obtenidos:', { id, items: detalles.length });

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

    const existingClose = await client.query(
      'SELECT id FROM cierre_caja WHERE fecha = $1 AND usuario_id = $2',
      [fecha, usuario_id]
    );

    if (existingClose.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Ya existe un cierre de caja para esta fecha y usuario' 
      });
    }

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
    res.status(201).json({ cierre: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error procesando cierre de caja:', error);
    
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

export default router;