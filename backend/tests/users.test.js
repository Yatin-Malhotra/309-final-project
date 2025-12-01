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
        it('should allow manager to list users with filters', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: regular } = await createTestUser('regular'); 
            const { user: cashier } = await createTestUser('cashier');

            await prisma.user.update({ where: { id: regular.id }, data: { verified: true } });
            await prisma.user.update({ where: { id: cashier.id }, data: { verified: false } });

            const res = await request(app)
                .get('/users')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBeGreaterThanOrEqual(3); // manager + regular + cashier

            // Filter by verified
            const resVerified = await request(app)
                .get('/users')
                .query({ verified: 'true' })
                .set('Authorization', `Bearer ${managerToken}`);
            
            expect(resVerified.body.results.some(u => u.utorid === regular.utorid)).toBe(true);
            expect(resVerified.body.results.some(u => u.utorid === cashier.utorid)).toBe(false);
        });

        it('should filter users by role', async () => {
            const { token: managerToken } = await createTestUser('manager');
            await createTestUser('cashier');

            const res = await request(app)
                .get('/users')
                .query({ role: 'cashier' })
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.results.every(u => u.role === 'cashier')).toBe(true);
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
                name: 'Updated Name',
                email: 'updated@mail.utoronto.ca',
                birthday: '2000-01-01'
            };

            const res = await request(app)
                .patch('/users/me')
                .set('Authorization', `Bearer ${token}`)
                .send(updates);

            expect(res.statusCode).toEqual(200);
            expect(res.body.name).toEqual(updates.name);
            expect(res.body.email).toEqual(updates.email);
            expect(res.body.birthday).toEqual(updates.birthday);
        });
    });

    describe('GET /users/:userId', () => {
        it('should allow cashier to get user details', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            const { user: targetUser } = await createTestUser('regular');

            const res = await request(app)
                .get(`/users/${targetUser.id}`)
                .set('Authorization', `Bearer ${cashierToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.utorid).toEqual(targetUser.utorid);
        });
    });

    describe('PATCH /users/:userId', () => {
        it('should allow manager to update user details', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: targetUser } = await createTestUser('regular');

            const res = await request(app)
                .patch(`/users/${targetUser.id}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ 
                    role: 'cashier',
                    verified: true,
                    suspicious: true 
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.role).toEqual('cashier');
            expect(res.body.verified).toBe(true);
            expect(res.body.suspicious).toBe(true);
        });
    });
});
