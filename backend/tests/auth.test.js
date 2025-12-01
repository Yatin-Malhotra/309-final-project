const request = require('supertest');
const { app, prisma } = require('../index');
const { createTestUser, clearDatabase } = require('./helpers');

describe('Auth Endpoints', () => {
    beforeAll(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('POST /auth/tokens (Login)', () => {
        it('should login successfully with valid credentials', async () => {
            const { user, password } = await createTestUser('regular');
            
            const res = await request(app)
                .post('/auth/tokens')
                .send({
                    utorid: user.utorid,
                    password: password
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('expiresAt');
        });

        it('should fail with invalid credentials', async () => {
            const { user } = await createTestUser('regular');
            
            const res = await request(app)
                .post('/auth/tokens')
                .send({
                    utorid: user.utorid,
                    password: 'WrongPassword!'
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', 'Invalid credentials');
        });
    });

    describe('POST /auth/resets (Request Reset)', () => {
        it('should request password reset', async () => {
            const { user } = await createTestUser();
            
            const res = await request(app)
                .post('/auth/resets')
                .send({ utorid: user.utorid });
                
            expect(res.statusCode).toEqual(202);
            
            // Verify token was created in DB
            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
            expect(updatedUser.resetToken).toBeTruthy();
        });
    });
});
