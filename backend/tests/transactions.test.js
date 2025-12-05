const request = require('supertest');
const { app, prisma } = require('../index');
const { createTestUser, clearDatabase } = require('./helpers');

describe('Transaction Endpoints', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('POST /transactions (Purchase)', () => {
        it('should allow cashier to create a purchase transaction with promotion', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            const { user: targetUser } = await createTestUser('regular');

            const promo = await prisma.promotion.create({
                data: {
                    name: 'Bonus Points',
                    description: 'Desc',
                    type: 'automatic',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 86400000),
                    rate: 0.5 
                }
            });

            const transactionData = {
                utorid: targetUser.utorid,
                type: 'purchase',
                spent: 10.0,
                promotionIds: [promo.id],
                remark: 'Test Purchase with Promo'
            };

            const res = await request(app)
                .post('/transactions')
                .set('Cookie', `token=${cashierToken}`)
                .send(transactionData);

            expect(res.statusCode).toEqual(201);
            expect(res.body.promotionIds).toContain(promo.id);
            expect(res.body.earned).toBe(540);
        });

        it('should fail with invalid promotion', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            const { user: targetUser } = await createTestUser('regular');

            const transactionData = {
                utorid: targetUser.utorid,
                type: 'purchase',
                spent: 10.0,
                promotionIds: [99999] 
            };

            const res = await request(app)
                .post('/transactions')
                .set('Cookie', `token=${cashierToken}`)
                .send(transactionData);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/Invalid promotion/);
        });

        it('should fail if promotion requirements not met', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            const { user: targetUser } = await createTestUser('regular');

            const promo = await prisma.promotion.create({
                data: {
                    name: 'Min Spend Promo',
                    description: 'Desc',
                    type: 'automatic',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 86400000),
                    minSpending: 100.0
                }
            });

            const res = await request(app)
                .post('/transactions')
                .set('Cookie', `token=${cashierToken}`)
                .send({
                    utorid: targetUser.utorid,
                    type: 'purchase',
                    spent: 50.0, // Less than min
                    promotionIds: [promo.id]
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/Minimum spending/);
        });
    });

    describe('POST /users/me/transactions (Redemption)', () => {
        it('should allow user to request redemption', async () => {
            const { user, token } = await createTestUser('regular');
            await prisma.user.update({ where: { id: user.id }, data: { points: 1000 } });

            const res = await request(app)
                .post('/users/me/transactions')
                .set('Cookie', `token=${token}`)
                .send({
                    type: 'redemption',
                    amount: 500,
                    remark: 'Redeem'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.type).toEqual('redemption');
            expect(res.body.amount).toEqual(500);
            expect(res.body.processedBy).toBeNull();
        });
    });

    describe('POST /transactions (Adjustment)', () => {
        it('should allow manager to create an adjustment', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: targetUser } = await createTestUser('regular');
            const { user: cashier } = await createTestUser('cashier');

            const tx = await prisma.transaction.create({
                data: {
                    userId: targetUser.id,
                    createdBy: cashier.id,
                    type: 'purchase',
                    amount: 100,
                    spent: 25.0,
                    processed: true
                }
            });

            const res = await request(app)
                .post('/transactions')
                .set('Cookie', `token=${managerToken}`)
                .send({
                    utorid: targetUser.utorid,
                    type: 'adjustment',
                    amount: -50,
                    relatedId: tx.id,
                    remark: 'Correction'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.type).toEqual('adjustment');
            expect(res.body.amount).toEqual(-50);
        });
    });

    describe('POST /users/:userId/transactions (Transfer)', () => {
        it('should allow regular user to transfer points', async () => {
            const { user: sender, token: senderToken } = await createTestUser('regular');
            const { user: recipient } = await createTestUser('regular');

            await prisma.user.update({ where: { id: sender.id }, data: { points: 1000 } });

            const res = await request(app)
                .post(`/users/${recipient.utorid}/transactions`)
                .set('Cookie', `token=${senderToken}`)
                .send({
                    type: 'transfer',
                    amount: 200,
                    remark: 'Gift'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.type).toEqual('transfer');
        });
    });

    describe('PATCH /transactions/:transactionId/processed', () => {
        it('should allow cashier to process redemption', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            const { user: regular } = await createTestUser('regular');

            await prisma.user.update({ where: { id: regular.id }, data: { points: 1000 } });
            const tx = await prisma.transaction.create({
                data: {
                    userId: regular.id,
                    type: 'redemption',
                    amount: -500,
                    processed: false,
                    createdBy: regular.id
                }
            });

            const res = await request(app)
                .patch(`/transactions/${tx.id}/processed`)
                .set('Cookie', `token=${cashierToken}`)
                .send({ processed: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.processed).toBe(true);
        });

        it('should allow manager to process purchase', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: regular } = await createTestUser('regular');
            const { user: cashier } = await createTestUser('cashier');

            // Suspicious transaction by cashier
            const tx = await prisma.transaction.create({
                data: {
                    userId: regular.id,
                    type: 'purchase',
                    amount: 100,
                    spent: 25.0,
                    processed: false,
                    suspicious: false, // Normally processed automatically, but let's test manual if possible or pending logic
                    // Wait, purchase transactions are processed automatically unless suspicious.
                    // If suspicious, they are processed=false.
                    createdBy: cashier.id
                }
            });
            
            // Let's make a suspicious one that is pending
            await prisma.transaction.update({
                where: { id: tx.id },
                data: { suspicious: false, processed: false } // Force pending state for testing
            });

            const res = await request(app)
                .patch(`/transactions/${tx.id}/processed`)
                .set('Cookie', `token=${managerToken}`)
                .send({ processed: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.processed).toBe(true);
        });
    });

    describe('GET /transactions/:transactionId', () => {
        it('should allow cashier to get transaction details', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            const { user: regular } = await createTestUser('regular');

            const tx = await prisma.transaction.create({
                data: {
                    userId: regular.id,
                    type: 'purchase',
                    amount: 100,
                    spent: 25.0,
                    processed: true,
                    createdBy: regular.id
                }
            });

            const res = await request(app)
                .get(`/transactions/${tx.id}`)
                .set('Cookie', `token=${cashierToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.id).toEqual(tx.id);
        });
    });

    describe('PATCH /transactions/:transactionId/suspicious', () => {
        it('should allow manager to flag transaction as suspicious', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: regular } = await createTestUser('regular');

            await prisma.user.update({ where: { id: regular.id }, data: { points: 100 } });
            const tx = await prisma.transaction.create({
                data: {
                    userId: regular.id,
                    type: 'purchase',
                    amount: 100,
                    spent: 25.0,
                    processed: true,
                    createdBy: regular.id,
                    suspicious: false
                }
            });

            // Flag suspicious
            const res = await request(app)
                .patch(`/transactions/${tx.id}/suspicious`)
                .set('Cookie', `token=${managerToken}`)
                .send({ suspicious: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.suspicious).toBe(true);
            
            // Verify points deducted
            const updatedUser = await prisma.user.findUnique({ where: { id: regular.id } });
            expect(updatedUser.points).toBe(0); // 100 - 100

            // Unflag suspicious
            const res2 = await request(app)
                .patch(`/transactions/${tx.id}/suspicious`)
                .set('Cookie', `token=${managerToken}`)
                .send({ suspicious: false });
            
            expect(res2.statusCode).toEqual(200);
            expect(res2.body.suspicious).toBe(false);

            const updatedUser2 = await prisma.user.findUnique({ where: { id: regular.id } });
            expect(updatedUser2.points).toBe(100); // 0 + 100
        });
    });

    describe('GET /transactions', () => {
        it('should allow manager to list transactions with filters', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: cashier } = await createTestUser('cashier'); 
            const { user: targetUser } = await createTestUser('regular');

            await prisma.transaction.create({
                data: {
                    userId: targetUser.id,
                    createdBy: cashier.id,
                    type: 'purchase',
                    amount: 40,
                    spent: 10.0,
                    processed: true,
                    suspicious: false
                }
            });

            await prisma.transaction.create({
                data: {
                    userId: targetUser.id,
                    createdBy: cashier.id,
                    type: 'purchase',
                    amount: 40,
                    spent: 10.0,
                    processed: true,
                    suspicious: true
                }
            });

            const res = await request(app)
                .get('/transactions')
                .set('Cookie', `token=${managerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBeGreaterThanOrEqual(2);

            const resSuspicious = await request(app)
                .get('/transactions')
                .query({ suspicious: 'true' })
                .set('Cookie', `token=${managerToken}`);
            
            expect(resSuspicious.body.results.length).toBe(1);
            expect(resSuspicious.body.results[0].suspicious).toBe(true);
        });
    });
});
