import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { attachTasa, getTasaActual } from '../middleware/tasaMiddleware.js';
import { 
  validateProduct, 
  validateStockUpdate, 
  validateStockMinimo 
} from '../middleware/validationMiddleware.js';
import { 
  checkProductExists, 
  checkStockSufficient, 
  getProductWithDetails 
} from '../middleware/productMiddleware.js';
import pool from '../database.js';

const router = express.Router();

// GET /api/productos - Obtener todos los productos (VERSIÓN CORREGIDA)
router.get('/api/productos', requireAuth, attachTasa, async (req, res) => {
  try {
    const { 
      categoria_id, 
      stock_alerts, 
      include_zero_stock, 
      page = 1, 
      limit = 10,
      search 
    } = req.query;
    
    const tasaActual = req.tasaActual;
    const offset = (parseInt(page) - 1) * parseInt(limit);

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
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 0;

    // Filtros para ambas consultas
    if (categoria_id) {
      paramCount++;
      query += ` AND p.categoria_id = $${paramCount}`;
      countQuery += ` AND p.categoria_id = $${paramCount}`;
      params.push(categoria_id);
    }

    if (search) {
      paramCount++;
      query += ` AND p.nombre ILIKE $${paramCount}`;
      countQuery += ` AND p.nombre ILIKE $${paramCount}`;
      params.push(`%${search}%`);
    }

    if (stock_alerts === 'true') {
      query += ` AND p.stock <= p.stock_minimo`;
      countQuery += ` AND p.stock <= p.stock_minimo`;
    } else if (include_zero_stock !== 'true') {
      query += ` AND p.stock > 0`;
      countQuery += ` AND p.stock > 0`;
    }

    query += ` ORDER BY p.nombre LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    
    // Parámetros para límite y offset
    const limitValue = parseInt(limit) > 50 ? 50 : parseInt(limit); // Máximo 50 por página
    const offsetValue = offset < 0 ? 0 : offset;
    
    const queryParams = [...params, limitValue, offsetValue];

    // Ejecutar ambas consultas en paralelo
    const [result, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limitValue);
    
    const productosFormateados = result.rows.map(producto => {
        const precioVenta = parseFloat(producto.precio_venta) || 0;
        
        // ✅ CORREGIDO: Usar la tasa_iva que viene del JOIN con tasas_iva
        // NO usar valor por defecto de 16 - esto era el problema principal
        const tasa_iva = parseFloat(producto.tasa_iva); // Sin valor por defecto
        
        // ✅ CORREGIDO: Solo calcular precio_sin_iva si la tasa no es 0
        let precio_sin_iva = precioVenta;
        if (tasa_iva > 0) {
            precio_sin_iva = precioVenta / (1 + (tasa_iva / 100));
        }
        
        let precioDolares = parseFloat(producto.precio_dolares) || 0;
        if (!producto.precio_dolares && tasaActual > 0) {
            precioDolares = precioVenta / tasaActual;
        }

        console.log(`📊 Producto ${producto.id}: ${producto.nombre}, ` +
                   `id_tasa_iva=${producto.id_tasa_iva}, ` +
                   `tasa_iva=${tasa_iva}, tipo_iva=${producto.tipo_iva}`);

        return {
            id: producto.id,
            nombre: producto.nombre,
            precio_venta: precioVenta,
            precio_dolares: parseFloat(precioDolares.toFixed(2)),
            costo_compra: parseFloat(producto.costo_compra) || 0,
            stock: parseFloat(producto.stock) || 0,
            stock_minimo: parseFloat(producto.stock_minimo) || 10,
            unidad_medida: producto.unidad_medida,
            categoria_id: producto.categoria_id,
            categoria: producto.categoria,
            proveedor: producto.proveedor,
            id_tasa_iva: producto.id_tasa_iva,
            tasa_iva: tasa_iva, // ✅ Esto ahora vendrá correcto desde la BD
            tipo_iva: producto.tipo_iva, // ✅ Esto también
            tasa_cambio_actual: tasaActual,
            precio_sin_iva: parseFloat(precio_sin_iva.toFixed(2)),
            alerta_stock: parseFloat(producto.stock) <= parseFloat(producto.stock_minimo)
        };
    });
    
    console.log(`✅ ${productosFormateados.length} productos cargados (Página ${page} de ${totalPages})`);
    
    res.json({
      productos: productosFormateados,
      pagination: {
        page: parseInt(page),
        limit: limitValue,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error en /api/productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/tasas-iva - Obtener todas las tasas de IVA
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

// POST /api/productos - Crear nuevo producto
router.post('/api/productos', requireAuth, validateProduct, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { 
      nombre, 
      precio_venta, 
      costo_compra, 
      stock = 0, 
      unidad_medida = 'unidad', 
      id_provedores, 
      categoria_id,
      stock_minimo = 10,
      id_tasa_iva = 1
    } = req.body;

    const tasaActual = await getTasaActual();
    const precioDolares = tasaActual > 0 ? (parseFloat(precio_venta) / tasaActual) : 0;

    console.log('📦 Creando producto:', { nombre, precio_venta, precioDolares, id_tasa_iva });

    const result = await client.query(`
      INSERT INTO productos (
        nombre, precio_venta, precio_dolares, costo_compra, stock, unidad_medida, 
        id_provedores, categoria_id, stock_minimo, id_tasa_iva
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *
    `, [
      nombre.trim(), 
      parseFloat(precio_venta),
      parseFloat(precioDolares.toFixed(4)),
      costo_compra ? parseFloat(costo_compra) : null,
      parseFloat(stock),
      unidad_medida,
      id_provedores || null,
      parseInt(categoria_id),
      parseFloat(stock_minimo),
      parseInt(id_tasa_iva)
    ]);

    const productoCompleto = await client.query(`
      SELECT p.*, ti.tasa as tasa_iva, ti.tipo as tipo_iva,
             c.nombre as categoria, prov.nombre as proveedor
      FROM productos p
      LEFT JOIN tasas_iva ti ON p.id_tasa_iva = ti.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE p.id = $1
    `, [result.rows[0].id]);

    await client.query('COMMIT');
    
    res.status(201).json(productoCompleto.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando producto:', error);
    
    if (error.code === '23505') {
      res.status(400).json({ error: 'Ya existe un producto con ese nombre' });
    } else if (error.code === '23503') {
      res.status(400).json({ error: 'Categoría o proveedor inválido' });
    } else {
      res.status(500).json({ error: 'Error al crear producto' });
    }
  } finally {
    client.release();
  }
});

// PUT /api/productos/:id - Actualizar producto
router.put('/api/productos/:id', requireAuth, checkProductExists, validateProduct, async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando actualización de producto:', req.params.id);
    console.log('📦 Datos recibidos:', req.body);
    
    await client.query('BEGIN');
    
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

    let updates = [];
    let params = [];
    let paramCount = 0;

    // Función auxiliar para agregar campos de forma segura
    const addField = (field, value, isNumber = false, allowNull = false) => {
      if (value !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        
        if (isNumber) {
          if (value === null || value === '') {
            params.push(allowNull ? null : 0);
          } else {
            const numValue = parseFloat(value);
            params.push(isNaN(numValue) ? (allowNull ? null : 0) : numValue);
          }
        } else {
          if (value === null || value === '') {
            params.push(allowNull ? null : '');
          } else {
            params.push(value.toString().trim());
          }
        }
        return true;
      }
      return false;
    };

    // AGREGAR TODOS LOS CAMPOS NECESARIOS
    addField('nombre', nombre, false);
    addField('precio_venta', precio_venta, true);
    addField('costo_compra', costo_compra, true, true);
    addField('stock', stock, true);
    addField('unidad_medida', unidad_medida, false);
    addField('id_provedores', id_provedores, true, true);
    addField('categoria_id', categoria_id, true);
    addField('stock_minimo', stock_minimo, true);
    addField('id_tasa_iva', id_tasa_iva, true);

    // Recalcular precio en dólares si se actualiza el precio_venta
    if (precio_venta !== undefined) {
      try {
        const tasaActual = await getTasaActual();
        console.log('💰 Tasa actual:', tasaActual);
        
        let precioDolares = 0;
        if (tasaActual > 0) {
          precioDolares = parseFloat(precio_venta) / tasaActual;
        }
        
        paramCount++;
        updates.push(`precio_dolares = $${paramCount}`);
        params.push(parseFloat(precioDolares.toFixed(4)));
        console.log('💵 Precio dólares calculado:', precioDolares);
      } catch (tasaError) {
        console.error('❌ Error obteniendo tasa:', tasaError);
        paramCount++;
        updates.push(`precio_dolares = $${paramCount}`);
        params.push(parseFloat(precio_venta) > 0 ? parseFloat(precio_venta) / 200 : 0);
      }
    }

    // Si no hay campos para actualizar, retornar error
    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    // Actualizar fecha de modificación
    updates.push('fecha_actualizacion = CURRENT_TIMESTAMP');
    
    // Agregar ID al final (siempre debe ser un número)
    paramCount++;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      throw new Error('ID de producto inválido');
    }
    params.push(productId);

    console.log('📝 Query final:', `UPDATE productos SET ${updates.join(', ')} WHERE id = $${paramCount}`);
    console.log('🔢 Parámetros:', params);
    console.log('📊 Número de parámetros:', paramCount);

    const result = await client.query(
      `UPDATE productos SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    console.log('✅ Producto actualizado en BD:', result.rows[0]);

    // Obtener el producto completo con joins
    const productoCompleto = await client.query(`
      SELECT 
        p.*, 
        ti.tasa as tasa_iva, 
        ti.tipo as tipo_iva,
        c.nombre as categoria, 
        prov.nombre as proveedor
      FROM productos p
      LEFT JOIN tasas_iva ti ON p.id_tasa_iva = ti.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE p.id = $1
    `, [productId]);

    await client.query('COMMIT');
    
    console.log('🎉 Actualización completada exitosamente');
    res.json(productoCompleto.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error actualizando producto:', error);
    console.error('📊 Detalles del error:', {
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      message: error.message
    });
    
    if (error.code === '23505') {
      res.status(400).json({ error: 'Ya existe un producto con ese nombre' });
    } else if (error.code === '23503') {
      res.status(400).json({ error: 'Categoría, proveedor o tasa IVA inválido' });
    } else {
      res.status(500).json({ 
        error: 'Error al actualizar producto',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } finally {
    client.release();
  }
});

// PUT /api/productos/:id/stock - Actualizar stock (descontar)
router.put('/api/productos/:id/stock', requireAuth, validateStockUpdate, checkStockSufficient, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { cantidad } = req.body;
    
    const currentStock = parseFloat(req.product.stock);
    const newStock = currentStock - parseFloat(cantidad);

    const result = await client.query(
      'UPDATE productos SET stock = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newStock, id]
    );
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando stock:', error);
    res.status(500).json({ error: 'Error al actualizar stock' });
  } finally {
    client.release();
  }
});

// GET /api/productos/stock-alerts - Alertas de stock bajo
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
        ti.tasa as tasa_iva,
        ti.tipo as tipo_iva
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

// GET /api/productos/:id - Obtener producto específico
router.get('/api/productos/:id', requireAuth, getProductWithDetails, async (req, res) => {
  res.json(req.productWithDetails);
});

// PUT /api/productos/:id/stock-minimo - Actualizar stock mínimo
router.put('/api/productos/:id/stock-minimo', requireAuth, checkProductExists, validateStockMinimo, async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_minimo } = req.body;
    
    const result = await pool.query(
      'UPDATE productos SET stock_minimo = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [stock_minimo, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando stock mínimo:', error);
    res.status(500).json({ error: 'Error al actualizar stock mínimo' });
  }
});

export default router;