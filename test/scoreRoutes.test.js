process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, cleanupDatabase } = require('./testHelper');
const { expect } = require('chai');
const { updateLeaderboardView } = require('../update_leaderboard_view');

describe('Score and Leaderboard Routes', () => {
    let testUserToken;
    let testUserId;

    beforeEach(async () => {
        await cleanupDatabase();
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'edis',
                password: '123123',
                country: 'TR'
            });
        testUserToken = res.body.token;
        testUserId = res.body.playerId;
    });

    describe('POST /api/scores', () => {
        it('should submit a new score and return the new level', async () => {
            const res = await request(app)
                .post('/api/scores')
                .set('Authorization', `Bearer ${testUserToken}`)
                .send({
                    score: 1500,
                    mode: 'classic',
                    memoryTime: 30.5,
                    matchingTime: 60.2,
                    clientGameId: 'game-id-123'
                });

            expect(res.statusCode).to.equal(201);
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('newLevel');
        });

        it('should return 400 for invalid score data', async () => {
            const res = await request(app)
                .post('/api/scores')
                .set('Authorization', `Bearer ${testUserToken}`)
                .send({
                    mode: 'classic' // Missing score
                });

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('message', 'Score, mode, and game ID are required');
        });
    });

    describe('GET /api/leaderboard/individual', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/scores')
                .set('Authorization', `Bearer ${testUserToken}`)
                .send({
                    score: 2000,
                    mode: 'time_attack',
                    memoryTime: 25.0,
                    matchingTime: 50.0,
                    clientGameId: 'game-id-leaderboard' // Add a clientGameId here
                });
            await updateLeaderboardView(); // Refresh the materialized view
        });

        it('should get the individual leaderboard', async () => {
            const res = await request(app)
                .get('/api/leaderboard/individual');

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array');
            expect(res.body.length).to.be.greaterThan(0);
            expect(res.body[0]).to.have.property('name', 'edis');
            expect(res.body[0]).to.have.property('score', 2000);
        });
    });
});
