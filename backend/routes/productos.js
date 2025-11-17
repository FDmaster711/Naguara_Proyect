import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();

router.get('/api/productos', requireAuth, async (req, res) => {
  try {
    const { categoria_id, stock_alerts } = req.query;
    
    const tasaResult = await pool.query(
      'SELECT tasa_bs FROM tasa_cambio ORDER BY fecha_actualizacion DESC LIMIT 1'
    );
    const tasaActual = tasaResult.rows.length > 0 ? parseFloat(tasaResult.rows[0].tasa_bs) : 207.89;

    console.log('📊 Tasa actual para productos:', tasaActual);

    let query = `
      SELECT 
        p.id,
        p.nombre,
        p.precio_venta,
        p.precio_dolares,
        p.costo_compra,
        p.stock,
        p.unidad_medida,
        p.categoria_id,
        p.stock_minimo,
        p.id_tasa_iva,
        ti.tasa as tasa_iva,
        ti.tipo as tipo_iva,
        COALESCE(c.nombre, 'Sin categoría') as categoria,
        prov.nombre as proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      LEFT JOIN tasas_iva ti ON p.id_tasa_iva = ti.id
      WHERE 1=1
    `;
    
    let params = [];

    if (categoria_id) {
      query += ` AND p.categoria_id = $1`;
      params.push(categoria_id);
    }

    if (stock_alerts === 'true') {
      query += ` AND p.stock <= p.stock_minimo`;
    } else {
      query += ` AND p.stock > 0`;
    }

    query += ` ORDER BY p.nombre`;

    // ✅ ELIMINADO: console.log que mostraba el query SQL
    const result = await pool.query(query, params);
    
    const productosFormateados = result.rows.map(producto => {
      // ✅ CORREGIDO: Manejo seguro de valores NULL/NaN
      const precioVenta = parseFloat(producto.precio_venta) || 0;
      
      // Si precio_dolares es NULL, calcularlo desde precio_venta
      let precioDolares;
      if (producto.precio_dolares !== null && producto.precio_dolares !== undefined) {
        precioDolares = parseFloat(producto.precio_dolares) || 0;
      } else {
        precioDolares = tasaActual > 0 ? (precioVenta / tasaActual) : 0;
      }
      
      const tasa_iva = parseFloat(producto.tasa_iva) || 16;
      const precio_sin_iva = precioVenta / (1 + (tasa_iva / 100));

      return {
        id: producto.id,
        nombre: producto.nombre,
        precio_venta: precioVenta,
        precio_dolares: parseFloat(precioDolares.toFixed(2)),
        stock: parseFloat(producto.stock) || 0,  
        stock_minimo: parseFloat(producto.stock_minimo) || 0,  
        unidad_medida: producto.unidad_medida,
        categoria_id: producto.categoria_id,
        categoria: producto.categoria,
        proveedor: producto.proveedor,
        id_tasa_iva: producto.id_tasa_iva,  
        tasa_iva: tasa_iva,  
        tipo_iva: producto.tipo_iva,  
        tasa_cambio_actual: tasaActual,
        precio_sin_iva: parseFloat(precio_sin_iva.toFixed(2))
      };
    });
    
    console.log(`✅ ${productosFormateados.length} productos formateados con tasa: ${tasaActual}`);
    res.json(productosFormateados);
  } catch (error) {
    console.error('Error en /api/productos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las tasas de IVA para formularios
router.get('/api/tasas-iva', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, tasa, descripcion, tipo, estado 
      FROM tasas_iva 
      WHERE estado = 'Activa'
      ORDER BY tasa DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo tasas IVA:', error);
    res.status(500).json({ error: error.message });
  }
});


router.post('/api/productos', requireAuth, async (req, res) => {
  try {
    const { 
      nombre, 
      precio_venta, 
      costo_compra, 
      stock, 
      unidad_medida, 
      id_provedores, 
      categoria_id,
      stock_minimo = 10,  
      id_tasa_iva = 1     
    } = req.body;

    console.log('📦 Creando producto:', { 
      nombre, 
      precio_venta, 
      stock_minimo,
      id_tasa_iva 
    });

    const result = await pool.query(`
      INSERT INTO productos (
        nombre, precio_venta, costo_compra, stock, unidad_medida, 
        id_provedores, categoria_id, stock_minimo, id_tasa_iva
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [
      nombre, 
      precio_venta, 
      costo_compra, 
      stock, 
      unidad_medida, 
      id_provedores, 
      categoria_id,
      stock_minimo,    
      id_tasa_iva      
    ]);

    const productoCompleto = await pool.query(`
      SELECT p.*, ti.tasa as tasa_iva, ti.tipo as tipo_iva,
             c.nombre as categoria, prov.nombre as proveedor
      FROM productos p
      LEFT JOIN tasas_iva ti ON p.id_tasa_iva = ti.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE p.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(productoCompleto.rows[0]);
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/productos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nombre, 
      precio_venta, 
      costo_compra, 
      stock, 
      unidad_medida, 
      id_provedores, 
      categoria_id,
      stock_minimo,
      id_tasa_iva
    } = req.body;

    const result = await pool.query(`
      UPDATE productos 
      SET nombre = $1, precio_venta = $2, costo_compra = $3, stock = $4, 
          unidad_medida = $5, id_provedores = $6, categoria_id = $7,
          stock_minimo = $8, id_tasa_iva = $9, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $10 
      RETURNING *
    `, [
      nombre, 
      precio_venta, 
      costo_compra, 
      stock, 
      unidad_medida, 
      id_provedores, 
      categoria_id,
      stock_minimo,    
      id_tasa_iva,   
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const productoCompleto = await pool.query(`
      SELECT p.*, ti.tasa as tasa_iva, ti.tipo as tipo_iva,
             c.nombre as categoria, prov.nombre as proveedor
      FROM productos p
      LEFT JOIN tasas_iva ti ON p.id_tasa_iva = ti.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE p.id = $1
    `, [id]);

    res.json(productoCompleto.rows[0]);
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/productos/:id/stock', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;
    
    const result = await pool.query(
      'UPDATE productos SET stock = stock - $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [cantidad, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando stock:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/productos/stock-alerts', requireAuth, async (req, res) => {
  try {
    const productosResult = await pool.query(`
      SELECT 
        p.id, 
        p.nombre, 
        p.stock, 
        p.stock_minimo,
        p.unidad_medida,
        c.nombre as categoria,
        ti.tasa as tasa_iva
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN tasas_iva ti ON p.id_tasa_iva = ti.id
      WHERE p.stock <= p.stock_minimo 
      ORDER BY p.stock ASC
    `);

    console.log(`⚠️ ${productosResult.rows.length} productos con stock bajo`);

    res.json(productosResult.rows);
  } catch (error) {
    console.error('Error obteniendo alertas de stock:', error);
    res.status(500).json({ error: 'Error al obtener alertas de stock' });
  }
});

router.get('/api/productos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.*,
        ti.tasa as tasa_iva,
        ti.tipo as tipo_iva,
        ti.descripcion as descripcion_iva,
        c.nombre as categoria,
        prov.nombre as proveedor
      FROM productos p
      LEFT JOIN tasas_iva ti ON p.id_tasa_iva = ti.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/productos/:id/stock-minimo', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_minimo } = req.body;
    
    const result = await pool.query(
      'UPDATE productos SET stock_minimo = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [stock_minimo, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando stock mínimo:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;