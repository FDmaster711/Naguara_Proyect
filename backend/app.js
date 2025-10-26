// app.js
import express from 'express';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './database.js';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000'
  ],
  credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const rutaFrontend = path.resolve(__dirname, '..', 'frontend');

app.use(express.static(rutaFrontend));


app.use(session({
  name: process.env.SESSION_NAME || 'naguara.sid',
  secret: process.env.SESSION_SECRET || 'secreto-temporal',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 // 1 hora
  }
}));


function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'No autorizado' });
}


app.get('/api/sesion', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ autenticado: true, usuario: req.session.user });
  } else {
    res.json({ autenticado: false });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { nombre, nombre_usuario, password, rol = 'Vendedor' } = req.body;
    if (!nombre_usuario || !password || !nombre) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const exists = await pool.query(
      'SELECT id FROM usuarios WHERE nombre_usuario = $1',
      [nombre_usuario]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Nombre de usuario ya existe' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, nombre_usuario, password, rol, estado)
       VALUES ($1, $2, $3, $4, 'Activo') RETURNING id, nombre, nombre_usuario, rol`,
      [nombre, nombre_usuario, hashed, rol]
    );

    res.status(201).json({ usuario: result.rows[0] });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


app.post('/login', async (req, res) => {
  try {
    const { nombre_usuario, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM usuarios WHERE nombre_usuario = $1 AND estado = $2',
      [nombre_usuario, 'Activo']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    req.session.user = {
      id: user.id,
      nombre: user.nombre,
      rol: user.rol
    };

    res.json({
      mensaje: 'Login exitoso',
      usuario: req.session.user
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    res.clearCookie(process.env.SESSION_NAME || 'naguara.sid');
    res.json({ mensaje: 'Sesión cerrada correctamente' });
  });
});


app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.session.user || null);
});


app.get('/api/dashboard/stats', async (req, res) => {
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

app.get('/api/productos', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.nombre,
        p.precio_venta,
        p.costo_compra,
        p.stock,
        p.unidad_medida,
        COALESCE(c.nombre, 'Sin categoría') as categoria,
        prov.nombre as proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE p.stock > 0  -- Solo productos con stock disponible
      ORDER BY p.nombre
    `);
    
    // Formatear la respuesta como espera el frontend
    const productosFormateados = result.rows.map(producto => ({
      id: producto.id,
      nombre: producto.nombre,
      precio_venta: parseFloat(producto.precio_venta),
      stock: parseInt(producto.stock),
      unidad_medida: producto.unidad_medida,
      categoria: producto.categoria,
      proveedor: producto.proveedor
    }));
    
    res.json(productosFormateados);
  } catch (error) {
    console.error('Error en /api/productos:', error);
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/productos', requireAuth, async (req, res) => {
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

app.put('/api/productos/:id/stock', requireAuth, async (req, res) => {
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

// Agregar estas rutas a tu app.js existente

// Rutas para clientes

app.get('/api/clientes/cedula/:cedula', requireAuth, async (req, res) => {
  try {
    const { cedula } = req.params;
    const result = await pool.query('SELECT * FROM clientes WHERE cedula_rif = $1 AND estado = $2', [cedula, 'Activo']);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clientes', requireAuth, async (req, res) => {
  try {
    const { nombre, cedula } = req.query;
    let result;

    if (nombre) {
      result = await pool.query(
        `SELECT * FROM clientes 
         WHERE estado = $1 
         AND (nombre ILIKE $2 OR direccion ILIKE $2)
         ORDER BY nombre`,
        ['Activo', `%${nombre}%`]
      );
    } else if (cedula) {
      result = await pool.query(
        `SELECT * FROM clientes 
         WHERE estado = $1 
         AND cedula_rif ILIKE $2
         ORDER BY nombre`,
        ['Activo', `%${cedula}%`]
      );
    } else {
      result = await pool.query(
        'SELECT * FROM clientes WHERE estado = $1 ORDER BY nombre',
        ['Activo']
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error en búsqueda de clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes', requireAuth, async (req, res) => {
    try {
        const { cedula_rif, nombre, telefono, direccion } = req.body;
        
        // Verificar si ya existe un cliente con esa cédula
        const exists = await pool.query(
            'SELECT id FROM clientes WHERE cedula_rif = $1',
            [cedula_rif]
        );
        
        if (exists.rows.length > 0) {
            return res.status(409).json({ error: 'Ya existe un cliente con esta cédula/RIF' });
        }

        const result = await pool.query(
            `INSERT INTO clientes (cedula_rif, nombre, telefono, direccion) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [cedula_rif, nombre, telefono, direccion]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creando cliente:', error);
        if (error.code === '23505') { // unique violation
            return res.status(409).json({ error: 'Ya existe un cliente con esta cédula/RIF' });
        }
        res.status(500).json({ error: 'Error del servidor al crear cliente' });
    }
});
// Rutas para ventas
app.post('/api/ventas', requireAuth, async (req, res) => {
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

    // ✅ CORREGIDO: Incluir id_cliente en la inserción
    const ventaResult = await client.query(
      `INSERT INTO ventas (id_usuario, id_cliente, metodo_pago, estado) 
       VALUES ($1, $2, $3, 'completada') RETURNING *`,
      [id_usuario, id_cliente, metodo_pago]  // ← Ahora sí incluye id_cliente
    );

    const venta = ventaResult.rows[0];
    console.log('✅ Venta creada:', venta.id);

    // Agregar detalles de venta y actualizar stock
    for (const detalle of detalles) {
      console.log('📝 Procesando detalle:', detalle);
      
      // Verificar que el producto existe y tiene stock
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

      // Insertar detalle de venta
      await client.query(
        `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario) 
         VALUES ($1, $2, $3, $4)`,
        [venta.id, detalle.id_producto, detalle.cantidad, detalle.precio_unitario]
      );

      // Actualizar stock
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

app.get('/api/ventas', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, u.nombre as vendedor, c.nombre as cliente
      FROM ventas v
      LEFT JOIN usuarios u ON v.id_usuario = u.id
      LEFT JOIN clientes c ON v.id_cliente = c.id
      ORDER BY v.fecha_venta DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📋 Solicitando datos de venta:', id);
    
    // Obtener datos básicos de la venta
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

    // Obtener detalles de la venta
    const detallesResult = await pool.query(`
      SELECT dv.*, p.nombre as producto_nombre, p.unidad_medida
      FROM detalle_venta dv
      LEFT JOIN productos p ON dv.id_producto = p.id
      WHERE dv.id_venta = $1
    `, [id]);

    const detalles = detallesResult.rows;
    
    // Calcular totales
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

app.get('/api/empresa', requireAuth, async (req, res) => {
  try {
    console.log('🏢 Solicitando datos de la empresa');
    
    // Verificar si la tabla existe y tiene datos
    const result = await pool.query('SELECT * FROM configuracion_empresa LIMIT 1');
    
    if (result.rows.length > 0) {
      console.log('✅ Datos de empresa encontrados en BD');
      res.json(result.rows[0]);
    } else {
      // Datos por defecto si no hay configuración
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
    // Datos por defecto en caso de error
    res.json({
      nombre_empresa: "Na'Guara",
      rif: "J-123456789",
      telefono: "(0412) 123-4567", 
      direccion: "Barquisimeto, Venezuela",
      mensaje_factura: "¡Gracias por su compra!"
    });
  }
});


fs.readdirSync(rutaFrontend).forEach(file => {
  if (file.endsWith('.html')) {
    app.get(`/${file}`, (req, res) => {
      res.sendFile(path.join(rutaFrontend, file));
    });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Servidor API corriendo en http://localhost:${PORT}`);
});

