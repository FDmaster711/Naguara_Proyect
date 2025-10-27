import express from 'express';
import bcrypt from 'bcrypt';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();

router.get('/api/usuarios', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, nombre_usuario, rol, estado, 
             TO_CHAR(fecha_creacion, 'DD/MM/YYYY HH24:MI') as fecha_creacion
      FROM usuarios 
      ORDER BY nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/api/usuarios', requireAuth, async (req, res) => {
  try {
    const { nombre, nombre_usuario, password, rol = 'Vendedor' } = req.body;
    
    if (req.session.user.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo administradores pueden crear usuarios' });
    }

    if (!nombre_usuario || !password || !nombre) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
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
       VALUES ($1, $2, $3, $4, 'Activo') RETURNING id, nombre, nombre_usuario, rol, estado`,
      [nombre, nombre_usuario, hashed, rol]
    );

    res.status(201).json({ 
      message: 'Usuario creado exitosamente',
      usuario: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error del servidor al crear usuario' });
  }
});

router.put('/api/usuarios/:id/estado', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (parseInt(id) === req.session.user.id && estado === 'Inactivo') {
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });
    }

    const result = await pool.query(
      'UPDATE usuarios SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ 
      message: `Usuario ${estado.toLowerCase()} correctamente`,
      usuario: result.rows[0] 
    });
  } catch (error) {
    console.error('Error actualizando estado usuario:', error);
    res.status(500).json({ error: 'Error al actualizar estado del usuario' });
  }
});

// En routes/usuarios.js
router.put('/api/usuarios/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, nombre_usuario, password, rol, estado } = req.body;

        // Verificar permisos
        if (req.session.user.rol !== 'Administrador') {
            return res.status(403).json({ error: 'Solo administradores pueden editar usuarios' });
        }

        let query = '';
        let params = [];

        if (password) {
            // Si hay nueva contraseña, hashearla
            const hashed = await bcrypt.hash(password, 10);
            query = `UPDATE usuarios SET nombre = $1, nombre_usuario = $2, password = $3, rol = $4, estado = $5 WHERE id = $6 RETURNING *`;
            params = [nombre, nombre_usuario, hashed, rol, estado, id];
        } else {
            // Sin cambiar contraseña
            query = `UPDATE usuarios SET nombre = $1, nombre_usuario = $2, rol = $3, estado = $4 WHERE id = $5 RETURNING *`;
            params = [nombre, nombre_usuario, rol, estado, id];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ 
            message: 'Usuario actualizado correctamente',
            usuario: result.rows[0] 
        });
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar usuario' });
    }
});

router.get('/api/usuarios/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT id, nombre, nombre_usuario, rol, estado, 
                   TO_CHAR(fecha_creacion, 'DD/MM/YYYY HH24:MI') as fecha_creacion
            FROM usuarios 
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
});

export default router;