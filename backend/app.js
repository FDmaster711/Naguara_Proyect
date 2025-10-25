// app.js
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

app.use(express.static(path.join(__dirname, 'frontend')));

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

// Cerrar sesión
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
  if (!req.session.user) return res.json(null);
  res.json(req.session.user);
});

app.get('/api/dashboard/stats',  async (req, res) => {
  try {
    const productosCount = await pool.query('SELECT COUNT(*) FROM productos');

    const ventasHoy = await pool.query(`
      SELECT COUNT(*) FROM ventas 
      WHERE DATE(fecha_venta) = CURRENT_DATE
    `);

    const proveedoresCount = await pool.query('SELECT COUNT(*) FROM proveedores');

    const stockMinimo = await pool.query(`
      SELECT COUNT(*) FROM productos 
      WHERE stock < 10 OR stock IS NULL
    `);

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
      SELECT p.*, c.nombre as categoria, prov.nombre as proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores prov ON p.id_provedores = prov.id
      ORDER BY p.nombre
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/productos', requireAuth, async (req, res) => {
  try {
    const { nombre, precio_venta, costo_compra, stock, unidad_medida, id_provedores, categoria_id } = req.body;
    const result = await pool.query(
      `INSERT INTO productos (nombre, precio_venta, costo_compra, stock, unidad_medida, id_provedores, categoria_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, precio_venta, costo_compra, stock, unidad_medida, id_provedores, categoria_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor API corriendo en http://localhost:${PORT}`);
});
