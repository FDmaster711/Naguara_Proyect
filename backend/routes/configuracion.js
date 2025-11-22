import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();

// Dashboard stats
router.get('/api/dashboard/stats', async (req, res) => {
  try {
    const productosCount = await pool.query('SELECT COUNT(*) FROM productos');
    const ventasHoy = await pool.query(`SELECT COUNT(*) FROM ventas WHERE DATE(fecha_venta) = CURRENT_DATE`);
    const proveedoresCount = await pool.query('SELECT COUNT(*) FROM proveedores');
    const stockMinimo = await pool.query(`SELECT COUNT(*) FROM productos WHERE stock < 10 OR stock IS NULL`);

    res.json({
      totalProductos: parseInt(productosCount.rows[0].count),
      ventasHoy: parseInt(ventasHoy.rows[0].count),
      totalProveedores: parseInt(proveedoresCount.rows[0].count),
      productosStockMinimo: parseInt(stockMinimo.rows[0].count)
    });
  } catch (error) {
    console.error('Error en dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Empresa
router.get('/api/empresa', requireAuth, async (req, res) => {
  try {
    console.log('🏢 Solicitando datos de la empresa');
    
    const result = await pool.query('SELECT * FROM configuracion_empresa LIMIT 1');
    
    if (result.rows.length > 0) {
      console.log('✅ Datos de empresa encontrados en BD');
      res.json(result.rows[0]);
    } else {
      console.log('⚠️ Usando datos de empresa por defecto');
      res.json({
        nombre_empresa: "Na'Guara",
        rif: "J-123456789",
        telefono: "(0412) 123-4567",
        direccion: "Barquisimeto, Venezuela",
        mensaje_factura: "¡Gracias por su compra!"
      });
    }
  } catch (error) {
    console.error('❌ Error obteniendo datos empresa:', error);
    res.json({
      nombre_empresa: "Na'Guara",
      rif: "J-123456789",
      telefono: "(0412) 123-4567", 
      direccion: "Barquisimeto, Venezuela",
      mensaje_factura: "¡Gracias por su compra!"
    });
  }
});

router.put('/api/empresa', requireAuth, async (req, res) => {
  try {
    const { nombre_empresa, rif, telefono, direccion, email } = req.body;
    
    const result = await pool.query(`
      UPDATE configuracion_empresa 
      SET nombre_empresa = $1, rif = $2, telefono = $3, direccion = $4,
          email = $5
      RETURNING *
    `, [nombre_empresa, rif, telefono, direccion, email]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando empresa:', error);
    res.status(500).json({ error: 'Error al actualizar datos de empresa' });
  }
});


// Configuración negocio
router.put('/api/configuracion/negocio', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { iva_rate, stock_minimo } = req.body;

    console.log('💾 Guardando configuración negocio:', { iva_rate, stock_minimo });

    const result = await client.query(`
      INSERT INTO configuracion_negocio (iva_rate, stock_minimo) 
      VALUES ($1, $2)
      ON CONFLICT (id) 
      DO UPDATE SET 
          iva_rate = EXCLUDED.iva_rate, 
          stock_minimo = EXCLUDED.stock_minimo,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING *
    `, [iva_rate, stock_minimo]);

    await client.query('COMMIT');
    
    console.log('✅ Configuración guardada:', result.rows[0]);
    
    res.json({ 
      message: 'Configuración guardada correctamente',
      configuracion: result.rows[0] 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error guardando configuración negocio:', error);
    res.status(500).json({ error: 'Error al guardar configuración' });
  } finally {
    client.release();
  }
});

router.get('/api/configuracion/negocio', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM configuracion_negocio ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      const insertResult = await pool.query(`
        INSERT INTO configuracion_negocio (iva_rate, stock_minimo) 
        VALUES (16.00, 10) 
        RETURNING *
      `);
      res.json(insertResult.rows[0]);
    }
  } catch (error) {
    console.error('Error obteniendo configuración negocio:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// Métodos de pago
router.get('/api/configuracion/metodos-pago', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT metodo_id as id, nombre, habilitado FROM metodos_pago_config ORDER BY id'
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo métodos pago:', error);
        res.status(500).json({ error: 'Error al obtener métodos de pago' });
    }
});

router.put('/api/configuracion/metodos-pago/:metodo', requireAuth, async (req, res) => {
    try {
        const { metodo } = req.params;
        const { habilitado } = req.body;

        console.log(`🔧 Actualizando método ${metodo} a:`, habilitado);
        
        const result = await pool.query(
            'UPDATE metodos_pago_config SET habilitado = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE metodo_id = $2 RETURNING *',
            [habilitado, metodo]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Método de pago no encontrado' });
        }
        
        res.json({ 
            message: `Método ${metodo} ${habilitado ? 'habilitado' : 'deshabilitado'}`,
            metodo: result.rows[0]
        });
    } catch (error) {
        console.error('Error actualizando método pago:', error);
        res.status(500).json({ error: 'Error al actualizar método de pago' });
    }
});

export default router;