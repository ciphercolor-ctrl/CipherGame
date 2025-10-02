const { app, server, io } = require('../server');
const { pool, query, dbReadyPromise } = require('../db');

// Global before and after hooks

before(async () => {
    // Ensure the database is ready before any tests run
    await dbReadyPromise;
    // Test setup completed - database ready
});

after((done) => {
    // Silently tear down test environment
    pool.end((err) => {
        server.close(() => {
            io.close(); // Close the socket.io server as well
            done();
        });
    });
});

// Helper function to clean the database between test suites if needed
const cleanupDatabase = async () => {
    await pool.query('DELETE FROM scores');
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM players');
    await pool.query('DELETE FROM admins');
};

module.exports = {
    app,
    server,
    pool,
    cleanupDatabase
};
