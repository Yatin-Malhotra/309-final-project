const request = require('supertest');
const { app, prisma } = require('../index');
const { createTestUser, clearDatabase } = require('./helpers');

describe('User Endpoints', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('POST /users', () => {
        it('should allow cashier to create a new user', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            
            const newUser = {
                utorid: 'newuser1',
                name: 'New User',
                email: 'newuser1@mail.utoronto.ca'
            };

            const res = await request(app)
                .post('/users')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send(newUser);

            expect(res.statusCode).toEqual(201);
            expect(res.body.utorid).toEqual(newUser.utorid);
            expect(res.body).toHaveProperty('resetToken');
        });

        it('should not allow regular user to create a new user', async () => {
            const { token: userToken } = await createTestUser('regular');
            
            const newUser = {
                utorid: 'newuser2',
                name: 'New User 2',
                email: 'newuser2@mail.utoronto.ca'
            };

            const res = await request(app)
                .post('/users')
                .set('Authorization', `Bearer ${userToken}`)
                .send(newUser);

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('GET /users', () => {
        it('should allow manager to list users', async () => {
            const { token: managerToken } = await createTestUser('manager');
            await createTestUser('regular'); // Create another user to list

            const res = await request(app)
                .get('/users')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBeGreaterThanOrEqual(2); // manager + regular
        });
    });

    describe('GET /users/me', () => {
        it('should return current user profile', async () => {
            const { user, token } = await createTestUser('regular');

            const res = await request(app)
                .get('/users/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.utorid).toEqual(user.utorid);
        });
    });

    describe('PATCH /users/me', () => {
        it('should allow user to update their profile', async () => {
            const { token } = await createTestUser('regular');

            const updates = {
                name: 'Updated Name'
            };

            const res = await request(app)
                .patch('/users/me')
                .set('Authorization', `Bearer ${token}`)
                .send(updates);

            expect(res.statusCode).toEqual(200);
            expect(res.body.name).toEqual(updates.name);
        });
    });
});

