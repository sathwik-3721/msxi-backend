import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const dBconfig = {
    server: process.env.PUBLIC_IP,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true // Based on your configuration
    }
}

const poolPromise = sql.connect(dBconfig)
    .then(pool => {
        console.log('Connected to SQL');
        return pool;
    })
    .catch(err => {
        console.error('Connection failed', err);
        throw err;
    });

const fetchSurveyDetailsColumns = async () => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT * FROM survey_details'); // Modify this query to select your desired columns
        console.log('Survey details:', result.recordset); // Outputs the fetched data
        return result.recordset;
    } catch (err) {
        console.error('Error fetching survey details:', err);
        throw err;
    }
};

export { poolPromise, fetchSurveyDetailsColumns };
