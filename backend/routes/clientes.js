import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();

router.get('/api/clientes/cedula/:cedula', requireAuth, async (req, res) => {
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

router.get('/api/clientes', requireAuth, async (req, res) => {
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

router.post('/api/clientes', requireAuth, async (req, res) => {
  try {
    const { cedula_rif, nombre, telefono, direccion } = req.body;
    
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
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un cliente con esta cédula/RIF' });
    }
    res.status(500).json({ error: 'Error del servidor al crear cliente' });
  }
});

export default router;