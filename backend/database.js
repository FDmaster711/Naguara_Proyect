import pkg from 'pg';
import dotenv from 'dotenv';

const {Pool} = pkg;
dotenv.config();
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,

});

pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err);
    process.exit(-1);
});

const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log('Conexión exitosa a la base de datos PostgreSQL');
        client.release();
    } catch (err) {
        console.error('Error al conectar a la base de datos PostgreSQL:', err);
    }
}

connectDB();

export default pool;