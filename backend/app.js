import express from 'express';
import bcrypt from 'bcrypt';  
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './database.js';
import session from 'express-session';
import cors from 'cors';  

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,  // Permite cualquier origen en desarrollo
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto-temporal',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.get('/', (req, res) => {
  res.json({
    message: '✅ API Pollera NaGuara funcionando',
    version: '1.0.0',
    endpoints: {
      dashboard: '/api/dashboard/stats',
      productos: '/api/productos',
      clientes: '/api/clientes',
      ventas: '/api/ventas (POST)'
    }
  });
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const productosCount = await pool.query('SELECT COUNT(*) FROM productos');
    
    const ventasHoy = await pool.query(`
      SELECT COUNT(*) FROM ventas 
      WHERE DATE(fecha_venta) = CURRENT_DATE
    `);
    
    const clientesCount = await pool.query('SELECT COUNT(*) FROM clientes');
    
    const stockMinimo = await pool.query(`
      SELECT COUNT(*) FROM productos 
      WHERE stock < 10 OR stock IS NULL
    `);
    
    res.json({
      totalProductos: parseInt(productosCount.rows[0].count),
      ventasHoy: parseInt(ventasHoy.rows[0].count),
      totalClientes: parseInt(clientesCount.rows[0].count),
      productosStockMinimo: parseInt(stockMinimo.rows[0].count)
    });
  } catch (error) {
    console.error('Error en dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/productos', async (req, res) => {
  try {
    const { q } = req.query; 
    let query = `
      SELECT 
        p.id,
        p.categoria,
        p.precio_venta,
        p.costo_compra,
        p.stock,
        p.unidad_medida,
        p.id_provedores,
        p.fecha_actualizacion,
        prov.nombre as proveedor_nombre
      FROM productos p
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      WHERE 1=1
    `;
    let params = [];
    
    if (q) {
      query += ' AND (p.categoria ILIKE $1 OR CAST(p.id AS TEXT) ILIKE $1 OR prov.nombre ILIKE $1)';
      params.push(`%${q}%`);
    }
    
    query += ' ORDER BY p.id';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en productos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clientes', async (req, res) => {
  try {
    const { cedula } = req.query;
    
    if (cedula) {
      const result = await pool.query(
        'SELECT * FROM clientes WHERE cedula_rif = $1 AND estado = $2',
        [cedula, 'Activo']
      );
      return res.json(result.rows[0] || null);
    }
    
    const result = await pool.query('SELECT * FROM clientes WHERE estado = $1 ORDER BY nombre', ['Activo']);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const { cedula_rif, nombre, telefono, direccion } = req.body;
    
    const existe = await pool.query(
      'SELECT id FROM clientes WHERE cedula_rif = $1',
      [cedula_rif]
    );
    
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un cliente con esta cédula/RIF' });
    }
    
    const result = await pool.query(
      `INSERT INTO clientes (cedula_rif, nombre, telefono, direccion, estado) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cedula_rif, nombre, telefono, direccion, 'Activo']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ventas', async (req, res) => {
  try {
    const { cliente_id, productos, total, metodo_pago } = req.body;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const ventaResult = await client.query(
        `INSERT INTO ventas (id_usuario, metodo_pago, estado) 
         VALUES ($1, $2, $3) RETURNING *`,
        [1, metodo_pago, 'completada'] 
      );
      
      const ventaId = ventaResult.rows[0].id;
      
      for (const item of productos) {
        await client.query(
          `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario) 
           VALUES ($1, $2, $3, $4)`,
          [ventaId, item.productoId, item.cantidad, item.precio]
        );
        
        await client.query(
          'UPDATE productos SET stock = stock - $1 WHERE id = $2',
          [item.cantidad, item.productoId]
        );
      }
      
      await client.query('COMMIT');
      res.status(201).json({
        ...ventaResult.rows[0],
        mensaje: 'Venta procesada exitosamente'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error en ventas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/proveedores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    
    if (password !== user.password) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    
    res.json({
      mensaje: 'Login exitoso',
      usuario: {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor API corriendo en http://localhost:${PORT}`);
});