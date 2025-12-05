const request = require('supertest');
const { app, prisma } = require('../index');
const { createTestUser, clearDatabase } = require('./helpers');

describe('Analytics Endpoints', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // Helpers to seed data
    const seedData = async (cashierId) => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const { user: user1 } = await createTestUser('regular');
        const { user: user2 } = await createTestUser('regular');

        // Create purchase
        await prisma.transaction.create({
            data: {
                userId: user1.id,
                type: 'purchase',
                amount: 100,
                spent: 25.0,
                processed: true,
                createdBy: cashierId,
                createdAt: now
            }
        });

        // Create redemption
        await prisma.transaction.create({
            data: {
                userId: user2.id,
                type: 'redemption',
                amount: -50,
                processed: true,
                processedBy: cashierId,
                createdBy: user2.id, // Redemption requested by user
                createdAt: yesterday
            }
        });
    };

    describe('GET /analytics/cashier/stats', () => {
        it('should return cashier stats', async () => {
            const { user: cashier, token } = await createTestUser('cashier');
            await seedData(cashier.id);

            const res = await request(app)
                .get('/analytics/cashier/stats')
                .set('Cookie', `token=${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.transactions.today).toBe(1); // 1 purchase
            expect(res.body.redemptions.week).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /analytics/overview', () => {
        it('should return system overview for manager', async () => {
            const { user: manager, token } = await createTestUser('manager');
            const { user: cashier } = await createTestUser('cashier');
            await seedData(cashier.id);

            const res = await request(app)
                .get('/analytics/overview')
                .set('Cookie', `token=${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.totalPointsInCirculation).toBeDefined();
            expect(res.body.transactionVolume.week).toBeGreaterThanOrEqual(2);
        });
    });

    describe('GET /analytics/users', () => {
        it('should return user analytics for manager', async () => {
            const { user: manager, token } = await createTestUser('manager');
            // Users already created by createTestUser calls in beforeEach/helpers
            
            const res = await request(app)
                .get('/analytics/users')
                .set('Cookie', `token=${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.total).toBeGreaterThanOrEqual(1);
            expect(res.body.topUsersByPoints).toBeInstanceOf(Array);
        });
    });

    describe('GET /analytics/transactions', () => {
        it('should return transaction analytics', async () => {
            const { user: manager, token } = await createTestUser('manager');
            const { user: cashier } = await createTestUser('cashier');
            await seedData(cashier.id);

            const res = await request(app)
                .get('/analytics/transactions')
                .set('Cookie', `token=${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.typeBreakdown.purchase).toBeGreaterThanOrEqual(1);
            expect(res.body.typeBreakdown.redemption).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /analytics/events', () => {
        it('should return event analytics', async () => {
            const { user: manager, token } = await createTestUser('manager');
            
            // Create an event
            await prisma.event.create({
                data: {
                    name: 'Analytics Event',
                    description: 'Test',
                    location: 'Test',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 3600000),
                    pointsAllocated: 100,
                    pointsRemain: 100,
                    published: true
                }
            });

            const res = await request(app)
                .get('/analytics/events')
                .set('Cookie', `token=${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.total).toBeGreaterThanOrEqual(1);
            expect(res.body.published).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /analytics/promotions', () => {
        it('should return promotion analytics', async () => {
            const { user: manager, token } = await createTestUser('manager');

            // Create promotion
            await prisma.promotion.create({
                data: {
                    name: 'Analytics Promo',
                    description: 'Test',
                    type: 'automatic',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 86400000),
                    rate: 2.0
                }
            });

            const res = await request(app)
                .get('/analytics/promotions')
                .set('Cookie', `token=${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.total).toBeGreaterThanOrEqual(1);
            expect(res.body.active).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /analytics/financial', () => {
        it('should return financial analytics', async () => {
            const { user: manager, token } = await createTestUser('manager');
            const { user: cashier } = await createTestUser('cashier');
            await seedData(cashier.id); // creates a purchase with spent=25.0

            const res = await request(app)
                .get('/analytics/financial')
                .set('Cookie', `token=${token}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.totalSpent.allTime).toBeGreaterThanOrEqual(25.0);
        });
    });
});

