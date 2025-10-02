process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, cleanupDatabase } = require('./testHelper');
const { expect } = require('chai');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

describe('Auth Routes', () => {

    beforeEach(async () => {
        await cleanupDatabase();
    });

    describe('/POST register', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password123',
                    country: 'US'
                });

            expect(res.statusCode).to.equal(201);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('message').eql('User registered');
            expect(res.body).to.have.property('token');
            expect(res.body).to.have.property('playerId');
            expect(res.body).to.have.property('username').eql('testuser');
            expect(res.body).to.have.property('country').eql('US');
            expect(res.body).to.have.property('level').eql(1);
        });

        it('should not register a user with existing username', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'existinguser',
                    password: 'password123',
                    country: 'US'
                });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'existinguser',
                    password: 'anotherpass',
                    country: 'CA'
                });

            expect(res.statusCode).to.equal(409);
            expect(res.body).to.have.property('message').eql('Username already exists');
        });

        it('should not register a user with invalid input', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'tu', // Too short
                    password: '123', // Too short
                    country: 'USA' // Invalid country code
                });

            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('message');
        });
    });

    describe('/POST login', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'loginuser',
                    password: 'loginpass',
                    country: 'DE'
                });
        });

        it('should login an existing user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'loginuser',
                    password: 'loginpass'
                });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('message').eql('Logged in');
            expect(res.body).to.have.property('token');
            expect(res.body).to.have.property('playerId');
            expect(res.body).to.have.property('username').eql('loginuser');
            expect(res.body).to.have.property('country').eql('DE');
            expect(res.body).to.have.property('level').eql(0);
        });

        it('should not login with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'loginuser',
                    password: 'wrongpass'
                });

            expect(res.statusCode).to.equal(401);
            expect(res.body).to.have.property('message').eql('Invalid credentials');
        });

        it('should not login with non-existent username', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'anypass'
                });

            expect(res.statusCode).to.equal(401);
            expect(res.body).to.have.property('message').eql('Invalid credentials');
        });
    });

    describe('/POST admin/login', () => {
        beforeEach(async () => {
            const adminUsername = 'testadmin';
            const adminPassword = 'testadminpass';
            const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
            const adminId = `admin_${Date.now()}`;
            const createdAt = new Date().toISOString();
            await query(`INSERT INTO admins (id, username, password, createdAt) VALUES ($1, $2, $3, $4)`, 
                [adminId, adminUsername, hashedAdminPassword, createdAt]);
        });

        it('should login an admin user', async () => {
            const res = await request(app)
                .post('/api/auth/admin/login')
                .send({
                    username: 'testadmin',
                    password: 'testadminpass'
                });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('message').eql('Admin logged in');
            expect(res.body).to.have.property('token');
        });

        it('should not login admin with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/admin/login')
                .send({
                    username: 'testadmin',
                    password: 'wrongadminpass'
                });

            expect(res.statusCode).to.equal(401);
            expect(res.body).to.have.property('message').eql('Invalid admin credentials');
        });

        it('should not login admin with non-existent username', async () => {
            const res = await request(app)
                .post('/api/auth/admin/login')
                .send({
                    username: 'nonexistentadmin',
                    password: 'anypass'
                });

            expect(res.statusCode).to.equal(401);
            expect(res.body).to.have.property('message').eql('Invalid admin credentials');
        });
    });
});
