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

    // ✅ CORREGIDO: Sin comentarios en el SQL
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
        COALESCE(c.nombre, 'Sin categoría') as categoria,
        prov.nombre as proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 0;

    // Filtro por categoría
    if (categoria_id) {
      paramCount++;
      query += ` AND p.categoria_id = $${paramCount}`;
      params.push(categoria_id);
    }

    // ✅ CORREGIDO: Lógica de stock mejorada
    if (stock_alerts === 'true') {
      // Para alertas: obtener stock mínimo configurado
      const configResult = await pool.query(
        'SELECT stock_minimo FROM configuracion_negocio ORDER BY id DESC LIMIT 1'
      );
      const stockMinimo = configResult.rows[0]?.stock_minimo || 10;
      
      paramCount++;
      query += ` AND p.stock <= $${paramCount}`;
      params.push(stockMinimo);
    } else {
      // Para uso normal: solo productos con stock disponible
      query += ` AND p.stock > 0`;
    }

    query += ` ORDER BY p.nombre`;

    console.log('🔍 Query productos:', query, 'Params:', params);
    
    const result = await pool.query(query, params);
    
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
        categoria_id: producto.categoria_id,
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

router.get('/api/productos/stock-alerts', requireAuth, async (req, res) => {
    try {
        // Primero obtener el stock mínimo configurado
        const configResult = await pool.query(
            'SELECT stock_minimo FROM configuracion_negocio ORDER BY id DESC LIMIT 1'
        );
        
        const stockMinimo = configResult.rows[0]?.stock_minimo || 10;

        // Buscar productos con stock bajo
        const productosResult = await pool.query(
            'SELECT id, nombre, stock, unidad_medida FROM productos WHERE stock <= $1 ORDER BY stock ASC',
            [stockMinimo]
        );

        res.json(productosResult.rows);
    } catch (error) {
        console.error('Error obteniendo alertas de stock:', error);
        res.status(500).json({ error: 'Error al obtener alertas de stock' });
    }
});

export default router;