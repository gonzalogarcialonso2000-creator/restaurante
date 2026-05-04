const pool = require('./database/db');

async function testConnection() {
	try {
		const result = await pool.query('SELECT NOW()');
		console.log('Conexion exitosa a PostgreSQL');
		console.log('Hora del servidor:', result.rows[0].now);
	} catch (error) {
		console.error('Error conectado a PostgreSQL:', error);
	}
}

testConnection();
