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
        it('should allow cashier to create a purchase transaction', async () => {
            const { token: cashierToken } = await createTestUser('cashier');
            const { user: targetUser } = await createTestUser('regular');

            const transactionData = {
                utorid: targetUser.utorid,
                type: 'purchase',
                spent: 10.0,
                remark: 'Test Purchase'
            };

            const res = await request(app)
                .post('/transactions')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send(transactionData);

            expect(res.statusCode).toEqual(201);
            expect(res.body.type).toEqual('purchase');
            expect(res.body.utorid).toEqual(targetUser.utorid);
            expect(res.body.spent).toEqual(10.0);
            expect(res.body.earned).toBeGreaterThan(0);
        });

        it('should fail if user does not exist', async () => {
            const { token: cashierToken } = await createTestUser('cashier');

            const transactionData = {
                utorid: 'nonexistent',
                type: 'purchase',
                spent: 10.0
            };

            const res = await request(app)
                .post('/transactions')
                .set('Authorization', `Bearer ${cashierToken}`)
                .send(transactionData);

            expect(res.statusCode).toEqual(404);
        });
    });

    describe('GET /transactions', () => {
        it('should allow manager to list transactions', async () => {
            const { token: managerToken } = await createTestUser('manager');
            
            // Create a transaction first
            const { user: cashier } = await createTestUser('cashier'); 
            const { user: targetUser } = await createTestUser('regular');
            
            // Manually create transaction to save API call overhead in setup
            await prisma.transaction.create({
                data: {
                    userId: targetUser.id,
                    createdBy: cashier.id,
                    type: 'purchase',
                    amount: 40,
                    spent: 10.0,
                    processed: true
                }
            });

            const res = await request(app)
                .get('/transactions')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBeGreaterThanOrEqual(1);
        });
    });
});

