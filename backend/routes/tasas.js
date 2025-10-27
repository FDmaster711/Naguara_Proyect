import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../database.js';

const router = express.Router();
const API_DOLAR_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

router.get('/api/tasa-cambio/actual', async (req, res) => {
  try {
    console.log('🔄 Obteniendo tasa de cambio actual de dolarapi.com...');
    
    let tasaAPI = null;
    let fechaAPI = null;
    
    try {
      const response = await fetch(API_DOLAR_URL);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Respuesta API completa:', data);
        
        tasaAPI = parseFloat(data.promedio) || parseFloat(data.compra) || parseFloat(data.venta) || 0;
        fechaAPI = data.fechaActualizacion || new Date().toISOString();
        
        console.log('✅ Tasa promedio de API:', tasaAPI);
        
        if (!tasaAPI || tasaAPI <= 0) {
          console.log('❌ Tasa no válida de API');
          throw new Error('Tasa no válida');
        }
      } else {
        console.log('❌ API respondió con error:', response.status);
        throw new Error('API no disponible');
      }
    } catch (apiError) {
      console.log('❌ Error con API dolarapi.com:', apiError.message);
      const result = await pool.query(
        'SELECT tasa_bs FROM tasa_cambio WHERE activo = true ORDER BY fecha_actualizacion DESC LIMIT 1'
      );
      tasaAPI = result.rows.length > 0 ? parseFloat(result.rows[0].tasa_bs) : 216.37;
      fechaAPI = new Date().toISOString();
      console.log('🔄 Usando última tasa guardada:', tasaAPI);
    }

    const ultimaTasa = await pool.query(
      'SELECT tasa_bs FROM tasa_cambio ORDER BY fecha_actualizacion DESC LIMIT 1'
    );
    
    const ultimaTasaValor = ultimaTasa.rows.length > 0 ? parseFloat(ultimaTasa.rows[0].tasa_bs) : 0;
    
    if (Math.abs(tasaAPI - ultimaTasaValor) > 0.1) {
      await pool.query(
        'INSERT INTO tasa_cambio (tasa_bs, fuente) VALUES ($1, $2)',
        [tasaAPI, 'api']
      );
      console.log('💾 Nueva tasa guardada:', tasaAPI);
    } else {
      console.log('ℹ️  Tasa sin cambios significativos');
    }

    res.json({ 
      tasa_bs: tasaAPI,
      fecha_actualizacion: fechaAPI,
      fuente: 'api_oficial',
      nombre: 'Dólar Oficial'
    });

  } catch (error) {
    console.error('❌ Error crítico obteniendo tasa:', error);
    const result = await pool.query(
      'SELECT tasa_bs FROM tasa_cambio ORDER BY fecha_actualizacion DESC LIMIT 1'
    );
    const tasaFallback = result.rows.length > 0 ? parseFloat(result.rows[0].tasa_bs) : 216.37;
    
    res.json({ 
      tasa_bs: tasaFallback,
      fecha_actualizacion: new Date().toISOString(),
      fuente: 'fallback',
      nombre: 'Dólar Oficial (Fallback)'
    });
  }
});

router.get('/api/tasa-cambio/historial', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasa_cambio ORDER BY fecha_actualizacion DESC LIMIT 30'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

export default router;