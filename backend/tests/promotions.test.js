const request = require('supertest');
const { app, prisma } = require('../index');
const { createTestUser, clearDatabase } = require('./helpers');

describe('Promotion Endpoints', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('POST /promotions', () => {
        it('should allow manager to create a promotion', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const promoData = {
                name: 'Test Promo',
                description: 'Test Description',
                type: 'automatic',
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 86400000).toISOString(),
                rate: 1.5
            };

            const res = await request(app)
                .post('/promotions')
                .set('Authorization', `Bearer ${managerToken}`)
                .send(promoData);

            expect(res.statusCode).toEqual(201);
            expect(res.body.name).toEqual(promoData.name);
        });

        it('should validate dates', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const promoData = {
                name: 'Bad Date Promo',
                description: 'Test',
                type: 'automatic',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                endTime: new Date().toISOString(), // End before start
                rate: 1.5
            };

            const res = await request(app)
                .post('/promotions')
                .set('Authorization', `Bearer ${managerToken}`)
                .send(promoData);

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('GET /promotions', () => {
        it('should list promotions', async () => {
            const { token: managerToken } = await createTestUser('manager');
            
            await request(app)
                .post('/promotions')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'List Promo',
                    description: 'Desc',
                    type: 'automatic',
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 86400000).toISOString(),
                    rate: 1.5
                });

            const res = await request(app)
                .get('/promotions')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('PATCH /promotions/:id', () => {
        it('should update a promotion', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const createRes = await request(app)
                .post('/promotions')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Update Promo',
                    description: 'Desc',
                    type: 'automatic',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 86400000).toISOString(),
                    rate: 1.5
                });
            
            const promoId = createRes.body.id;

            const res = await request(app)
                .patch(`/promotions/${promoId}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Updated Name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.name).toEqual('Updated Name');
        });
    });

    describe('DELETE /promotions/:id', () => {
        it('should delete a promotion', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const createRes = await request(app)
                .post('/promotions')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Delete Promo',
                    description: 'Desc',
                    type: 'automatic',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 86400000).toISOString(),
                    rate: 1.5
                });
            
            const promoId = createRes.body.id;

            const res = await request(app)
                .delete(`/promotions/${promoId}`)
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(204);
        });

        it('should not delete an active promotion', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const createRes = await request(app)
                .post('/promotions')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Active Promo',
                    description: 'Desc',
                    type: 'automatic',
                    startTime: new Date(Date.now() - 1000).toISOString(), // Started
                    endTime: new Date(Date.now() + 86400000).toISOString(),
                    rate: 1.5
                });
            
            const promoId = createRes.body.id;

            const res = await request(app)
                .delete(`/promotions/${promoId}`)
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(403);
        });
    });
});
