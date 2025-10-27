import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();

router.get('/api/productos', requireAuth, async (req, res) => {
  try {
    const tasaResult = await pool.query(
      'SELECT tasa_bs FROM tasa_cambio ORDER BY fecha_actualizacion DESC LIMIT 1'
    );
    const tasaActual = tasaResult.rows.length > 0 ? parseFloat(tasaResult.rows[0].tasa_bs) : 207.89;

    console.log('📊 Tasa actual para productos:', tasaActual);

    const result = await pool.query(`
      SELECT 
        p.id,
        p.nombre,
        p.precio_venta,
        p.precio_dolares,
        p.costo_compra,
        p.stock,
        p.unidad_medida,
        COALESCE(c.nombre, 'Sin categoría') as categoria,
        prov.nombre as proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE p.stock > 0
      ORDER BY p.nombre
    `);
    
    const productosFormateados = result.rows.map(producto => {
      const precioDolares = producto.precio_dolares 
        ? parseFloat(producto.precio_dolares)
        : (parseFloat(producto.precio_venta) / tasaActual);
      
      return {
        id: producto.id,
        nombre: producto.nombre,
        precio_venta: parseFloat(producto.precio_venta),
        precio_dolares: parseFloat(precioDolares.toFixed(2)),
        stock: parseInt(producto.stock),
        unidad_medida: producto.unidad_medida,
        categoria: producto.categoria,
        proveedor: producto.proveedor,
        tasa_cambio_actual: tasaActual
      };
    });
    
    console.log(`✅ ${productosFormateados.length} productos formateados con tasa: ${tasaActual}`);
    res.json(productosFormateados);
  } catch (error) {
    console.error('Error en /api/productos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/productos', requireAuth, async (req, res) => {
  try {
    const { nombre, precio_venta, costo_compra, stock, unidad_medida, id_provedores, categoria_id } = req.body;
    const result = await pool.query(`
      INSERT INTO productos (nombre, precio_venta, costo_compra, stock, unidad_medida, id_provedores, categoria_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [nombre, precio_venta, costo_compra, stock, unidad_medida, id_provedores, categoria_id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/productos/:id/stock', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.body;
    
    const result = await pool.query(
      'UPDATE productos SET stock = stock - $1 WHERE id = $2 RETURNING *',
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

export default router;