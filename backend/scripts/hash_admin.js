import bcrypt from 'bcrypt';
import pool from '../database.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const passwordPlain = '123456'; 
  const saltRounds = 10;
  const hashed = await bcrypt.hash(passwordPlain, saltRounds);

  try {
    const res = await pool.query(
      'UPDATE usuarios SET password = $1 WHERE nombre_usuario = $2 RETURNING id, nombre_usuario',
      [hashed, 'admin']
    );
    console.log('✅ Contraseña actualizada correctamente:', res.rows);
  } catch (err) {
    console.error('❌ Error actualizando password:', err);
  } finally {
    await pool.end();
  }
}

run();
