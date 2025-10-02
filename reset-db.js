// reset-db.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const dbName = process.env.PG_DATABASE;

// Configuration to connect to the default 'postgres' database
const pgConfig = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    database: 'postgres', // Connect to the default db to be able to drop/create the target db
};

const pool = new Pool(pgConfig);

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

const resetDatabase = async () => {
    console.log(`Preparing to reset database: '${dbName}'...`);
    
    if (!dbName) {
        console.error('Error: PG_DATABASE environment variable is not set.');
        process.exit(1);
    }

    let client;
    try {
        client = await pool.connect();

        console.log(`-> Terminating existing connections to '${dbName}'...`);
        await client.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '${dbName}'
              AND pid <> pg_backend_pid();
        `);
        console.log(`-> Existing connections terminated.`);

        console.log(`-> Dropping database '${dbName}'...`);
        await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`-> Database '${dbName}' dropped successfully.`);

        console.log(`-> Creating database '${dbName}'...`);
        await client.query(`CREATE DATABASE "${dbName}"`);
        console.log(`-> Database '${dbName}' created successfully.`);

        console.log('\nDatabase reset complete!');
        console.log('You can now start the application to initialize the tables.');

    } catch (error) {
        console.error('An error occurred during database reset:', error);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
};

resetDatabase();
