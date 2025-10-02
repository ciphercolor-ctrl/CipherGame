process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, cleanupDatabase } = require('./testHelper');
const { query } = require('../db');
const { expect } = require('chai');

describe('Profile Routes', () => {
    let testUserToken;
    let testUserId;

    beforeEach(async () => {
        await cleanupDatabase();
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'profileuser',
                password: 'password123',
                country: 'TR'
            });
        testUserToken = registerRes.body.token;
        testUserId = registerRes.body.playerId;
    });

    describe('GET /api/profile/players/:id', () => {
        it('should get a user profile', async () => {
            const res = await request(app)
                .get(`/api/profile/players/${testUserId}`)
                .set('Authorization', `Bearer ${testUserToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('username', 'profileuser');
            expect(res.body).to.have.property('country', 'TR');
            expect(res.body).to.have.property('level', 0);
        });

        it('should return 404 for a non-existent user', async () => {
            const res = await request(app)
                .get('/api/profile/players/nonexistentuser')
                .set('Authorization', `Bearer ${testUserToken}`);

            expect(res.statusCode).to.equal(404);
            expect(res.body).to.have.property('message', 'Player not found.');
        });
    });

    describe('PUT /api/profile/username', () => {
        it('should update the username', async () => {
            const res = await request(app)
                .put('/api/profile/username')
                .set('Authorization', `Bearer ${testUserToken}`)
                .send({
                    newUsername: 'newprofilename'
                });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('message', 'Username updated successfully');
            expect(res.body).to.have.property('newUsername', 'newprofilename');

            const result = await query('SELECT * FROM players WHERE id = $1', [testUserId]);
            const updatedUser = result.rows[0];
            expect(updatedUser.username).to.equal('newprofilename');
        });
    });
});
