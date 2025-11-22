import express from 'express';
import  pool  from '../database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/api/categorias', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

router.post('/api/categorias', requireAuth, async (req, res) => {
  try {
    const { nombre, descripcion = '' } = req.body;
    const result = await pool.query(`
      INSERT INTO categorias (nombre, descripcion) 
      VALUES ($1, $2) RETURNING *
    `, [nombre, descripcion]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

router.delete('/api/categorias/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categorias WHERE id = $1', [id]);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});


export default router;