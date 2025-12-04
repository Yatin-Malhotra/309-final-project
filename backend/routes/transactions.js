const express = require('express');
const router = express.Router();
const { z } = require('zod');
const {
    prisma,
    schemas,
    requireRole,
    validate,
    validateQuery,
    coerceBoolean,
    calculatePurchasePoints
} = require('../middleware');

// POST /transactions - Create purchase/adjustment
router.post('/', requireRole('cashier'), validate(schemas.createTransaction), async (req, res, next) => {
    try {
        const { utorid, type, spent, amount, relatedId, promotionIds = [], remark } = req.validatedData;
        
        const targetUser = await prisma.user.findUnique({ where: { utorid } });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });
        
        let transaction, earnedPoints;
        
        if (type === 'purchase') {
            if (!spent || spent <= 0) return res.status(400).json({ error: 'Invalid spent amount' });
            
            // Automatically fetch and include automatic promotions
            const now = new Date();
            const automaticPromotions = await prisma.promotion.findMany({
                where: {
                    type: 'automatic',
                    startTime: { lte: now },
                    endTime: { gte: now }
                }
            });
            
            // Filter automatic promotions based on user role and minimum spending
            const applicableAutomaticPromotions = automaticPromotions.filter(promo => {
                // Check if user role allows this promotion (regular users see all active, managers/superusers see all)
                const isManagerOrAbove = ['manager', 'superuser'].includes(targetUser.role);
                // For now, all active automatic promotions are available to all users
                // Check minimum spending requirement
                if (promo.minSpending && spent < promo.minSpending) {
                    return false;
                }
                return true;
            });
            
            // Combine manual promotion IDs with automatic promotion IDs
            const allPromotionIds = [...new Set([
                ...promotionIds.map(id => parseInt(id)),
                ...applicableAutomaticPromotions.map(p => p.id)
            ])];
            
            earnedPoints = await calculatePurchasePoints(spent, allPromotionIds, targetUser.id);
            
            const creator = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (!creator) return res.status(404).json({ error: 'Creator not found' });
            
            // Transaction is suspicious if creator is a cashier AND marked as suspicious
            const suspicious = creator.role === 'cashier' && Boolean(creator.suspicious);
            // If cashier is suspicious, transaction should be pending (not processed)
            const processed = !suspicious;
            
            transaction = await prisma.transaction.create({
                data: {
                    userId: targetUser.id,
                    type: 'purchase',
                    amount: earnedPoints, // Store the calculated points even if suspicious
                    spent,
                    suspicious,
                    processed,
                    remark: remark || '',
                    createdBy: req.user.id
                }
            });
            
            // Link promotions (including automatic ones)
            if (allPromotionIds && allPromotionIds.length > 0) {
                await prisma.transactionPromotion.createMany({
                    data: allPromotionIds.map(pid => ({ transactionId: transaction.id, promotionId: pid }))
                });
                
                // Mark one-time promotions as used
                for (const pid of allPromotionIds) {
                    const promo = await prisma.promotion.findUnique({ where: { id: pid } });
                    if (promo && promo.type === 'onetime') {
                        await prisma.userPromotion.upsert({
                            where: { userId_promotionId: { userId: targetUser.id, promotionId: pid } },
                            update: { used: true },
                            create: { userId: targetUser.id, promotionId: pid, used: true }
                        });
                    }
                }
            }
            
            // Only update user points if transaction is NOT suspicious
            // The transaction amount still stores the calculated points for audit purposes
            if (!suspicious) {
                await prisma.user.update({
                    where: { id: targetUser.id },
                    data: { points: { increment: earnedPoints } }
                });
            }
            
            const creatorUser = await prisma.user.findUnique({ where: { id: req.user.id } });
            return res.status(201).json({
                id: transaction.id,
                utorid: targetUser.utorid,
                type: 'purchase',
                spent: transaction.spent,
                earned: suspicious ? 0 : earnedPoints,
                remark: transaction.remark,
                promotionIds: allPromotionIds || [],
                createdBy: creatorUser.utorid
            });
            
        } else if (type === 'adjustment') {
            if (req.user.role !== 'manager' && req.user.role !== 'superuser') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            // Check if required fields are missing (400)
            if (amount === undefined || amount === null) {
                return res.status(400).json({ error: 'Invalid adjustment data' });
            }
            if (relatedId === undefined || relatedId === null) {
                return res.status(400).json({ error: 'Invalid adjustment data' });
            }
            
            // Convert relatedId to number if needed (schema preprocessing should have done this, but handle edge cases)
            let relatedIdNum;
            if (typeof relatedId === 'number') {
                relatedIdNum = relatedId;
            } else if (typeof relatedId === 'string') {
                relatedIdNum = parseInt(relatedId, 10);
                if (isNaN(relatedIdNum) || relatedIdNum <= 0) {
                    return res.status(400).json({ error: 'Invalid adjustment data' });
                }
            } else {
                return res.status(400).json({ error: 'Invalid adjustment data' });
            }
            
            // Check if related transaction exists (404) - this should come after format validation
            const relatedTransaction = await prisma.transaction.findUnique({ where: { id: relatedIdNum } });
            if (!relatedTransaction) return res.status(404).json({ error: 'Related transaction not found' });
            
            transaction = await prisma.transaction.create({
                data: {
                    userId: targetUser.id,
                    type: 'adjustment',
                    amount,
                    relatedId: relatedIdNum,
                    remark: remark || '',
                    createdBy: req.user.id,
                    processed: true  // Adjustments are applied immediately, so they're processed
                }
            });
            
            // Link promotions
            if (promotionIds && promotionIds.length > 0) {
                await prisma.transactionPromotion.createMany({
                    data: promotionIds.map(pid => ({ transactionId: transaction.id, promotionId: pid }))
                });
            }
            
            // Apply adjustment immediately
            await prisma.user.update({
                where: { id: targetUser.id },
                data: { points: { increment: amount } }
            });
            
            const creatorUser = await prisma.user.findUnique({ where: { id: req.user.id } });
            return res.status(201).json({
                id: transaction.id,
                utorid: targetUser.utorid,
                amount: transaction.amount,
                type: 'adjustment',
                relatedId: transaction.relatedId,
                remark: transaction.remark,
                promotionIds: promotionIds || [],
                createdBy: creatorUser.utorid,
                processed: transaction.processed
            });
        } else {
            return res.status(400).json({ error: 'Invalid transaction type' });
        }
    } catch (error) {
        if (error.message.includes('Promotion') || error.message.includes('promotion')) {
            return res.status(400).json({ error: error.message });
        }
        if (error.message.includes('Invalid promotion')) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
});

// GET /transactions - List all transactions
router.get('/', requireRole('manager'), validateQuery(z.object({
    name: z.string().optional(),
    createdBy: z.string().optional(),
    suspicious: z.string().optional(),
    promotionId: z.string().optional(),
    type: z.string().optional(),
    relatedId: z.string().optional(),
    amount: z.string().optional(),
    operator: z.string().optional(),
    page: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '1' : val,
        z.string().regex(/^\d+$/)
    ),
    limit: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '10' : val,
        z.string().regex(/^\d+$/)
    ),
    sortBy: z.enum(['id', 'amount', 'type', 'createdAt', 'processed', 'suspicious', 'user']).optional(),
    order: z.enum(['asc', 'desc']).optional()
})), async (req, res, next) => {
    try {
        const { name, createdBy, suspicious, promotionId, type, relatedId, amount, operator, page = '1', limit = '10', sortBy, order } = req.validatedQuery;
        const pageNum = parseInt(page), limitNum = parseInt(limit);
        
        // FIX: Add validation
        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        
        const skip = (pageNum - 1) * limitNum;
        
        const where = {};
        if (name) {
            const users = await prisma.user.findMany({
                where: { OR: [{ utorid: { contains: name } }, { name: { contains: name } }] }
            });
            where.userId = { in: users.map(u => u.id) };
        }
        if (createdBy) {
            const creator = await prisma.user.findFirst({ where: { utorid: createdBy } });
            if (creator) where.createdBy = creator.id;
        }
        if (suspicious) where.suspicious = suspicious === 'true';
        if (promotionId) {
            const txPromos = await prisma.transactionPromotion.findMany({ where: { promotionId: parseInt(promotionId) } });
            where.id = { in: txPromos.map(tp => tp.transactionId) };
        }
        if (type) where.type = type;
        if (relatedId) where.relatedId = parseInt(relatedId);
        if (amount && operator) {
            where.amount = operator === 'gte' ? { gte: parseInt(amount) } : { lte: parseInt(amount) };
        }

        const orderBy = {};
        if (sortBy) {
            if (sortBy === 'user') {
                orderBy.user = { utorid: order || 'asc' };
            } else {
                orderBy[sortBy] = order || 'asc';
            }
        } else {
            orderBy.createdAt = 'desc';
        }
        
        const count = await prisma.transaction.count({ where });
        const transactions = await prisma.transaction.findMany({
            where, skip, take: limitNum,
            include: {
                user: { select: { utorid: true } },
                creator: { select: { utorid: true } },
                transactionPromotions: { select: { promotionId: true } }
            },
            orderBy
        });
        
        const results = transactions.map(tx => {
            const result = {
                id: tx.id,
                utorid: tx.user.utorid,
                amount: tx.amount,
                type: tx.type,
                promotionIds: tx.transactionPromotions.map(tp => tp.promotionId),
                remark: tx.remark,
                createdBy: tx.creator.utorid,
                createdAt: tx.createdAt,
                processed: tx.processed
            };
            if (tx.spent) result.spent = tx.spent;
            if (tx.relatedId) result.relatedId = tx.relatedId;
            if (tx.type === 'purchase' || tx.type === 'adjustment') result.suspicious = tx.suspicious;
            if (tx.type === 'redemption') result.redeemed = Math.abs(tx.amount);
            return result;
        });
        
        res.json({ count, results });
    } catch (error) { next(error); }
});

// GET /transactions/redemptions - List redemption transactions (cashier only)
router.get('/redemptions', requireRole('cashier'), validateQuery(z.object({
    page: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '1' : val,
        z.string().regex(/^\d+$/)
    ),
    limit: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '10' : val,
        z.string().regex(/^\d+$/)
    ),
    processed: z.string().optional(),
    sortBy: z.enum(['id', 'amount', 'type', 'createdAt', 'processed', 'user']).optional(),
    order: z.enum(['asc', 'desc']).optional()
})), async (req, res, next) => {
    try {
        const { page = '1', limit = '10', processed, sortBy, order } = req.validatedQuery;
        const pageNum = parseInt(page), limitNum = parseInt(limit);
        
        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        
        const skip = (pageNum - 1) * limitNum;
        
        const where = { type: 'redemption' };
        if (processed !== undefined) {
            where.processed = processed === 'true';
        }

        const orderBy = {};
        if (sortBy) {
            if (sortBy === 'user') {
                 orderBy.user = { utorid: order || 'asc' };
            } else {
                orderBy[sortBy] = order || 'asc';
            }
        } else {
            orderBy.createdAt = 'desc';
        }
        
        const count = await prisma.transaction.count({ where });
        const transactions = await prisma.transaction.findMany({
            where, skip, take: limitNum,
            include: {
                user: { select: { utorid: true, name: true } },
                creator: { select: { utorid: true } },
                processor: { select: { utorid: true } }
            },
            orderBy
        });
        
        const results = transactions.map(tx => {
            const result = {
                id: tx.id,
                utorid: tx.user.utorid,
                userName: tx.user.name,
                amount: Math.abs(tx.amount), // Return as positive
                type: tx.type,
                remark: tx.remark,
                createdBy: tx.creator.utorid,
                createdAt: tx.createdAt,
                processed: tx.processed,
                redeemed: Math.abs(tx.amount)
            };
            if (tx.processor) result.processedBy = tx.processor.utorid;
            return result;
        });
        
        res.json({ count, results });
    } catch (error) { next(error); }
});

// GET /transactions/:transactionId - Get single transaction
router.get('/:transactionId', requireRole('cashier'), async (req, res, next) => {
    try {
        const transactionId = parseInt(req.params.transactionId);
        if (isNaN(transactionId)) return res.status(400).json({ error: 'Invalid transaction ID' });
        const tx = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                user: { select: { utorid: true } },
                creator: { select: { utorid: true } },
                transactionPromotions: { select: { promotionId: true } }
            }
        });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        
        const result = {
            id: tx.id,
            utorid: tx.user.utorid,
            type: tx.type,
            amount: tx.amount,
            promotionIds: tx.transactionPromotions.map(tp => tp.promotionId),
            remark: tx.remark,
            createdBy: tx.creator.utorid,
            createdAt: tx.createdAt,
            processed: tx.processed
        };
        if (tx.spent) result.spent = tx.spent;
        if (tx.relatedId) result.relatedId = tx.relatedId;
        if (tx.type === 'purchase' || tx.type === 'adjustment') result.suspicious = tx.suspicious;
        
        res.json(result);
    } catch (error) { next(error); }
});

// PATCH /transactions/:transactionId/suspicious - Flag transaction
router.patch('/:transactionId/suspicious', requireRole('manager'), async (req, res, next) => {
    try {
        const suspicious = coerceBoolean(req.body.suspicious);
        if (typeof suspicious !== 'boolean') return res.status(400).json({ error: 'Invalid data' });
        
        const transactionId = parseInt(req.params.transactionId);
        if (isNaN(transactionId)) return res.status(400).json({ error: 'Invalid transaction ID' });
        const tx = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { user: true, creator: { select: { utorid: true } }, transactionPromotions: { select: { promotionId: true } } }
        });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        
        // Update points based on flag change
        if (suspicious && !tx.suspicious) {
            // Marking as suspicious - deduct points
            await prisma.user.update({
                where: { id: tx.userId },
                data: { points: { decrement: tx.amount } }
            });
        } else if (!suspicious && tx.suspicious) {
            // Clearing suspicious - add points
            await prisma.user.update({
                where: { id: tx.userId },
                data: { points: { increment: tx.amount } }
            });
        }
        
        // If marking as suspicious and transaction was processed, set processed to false
        const updateData = { suspicious };
        if (suspicious && tx.processed) {
            updateData.processed = false;
        } else if (!suspicious && tx.suspicious) {
            if (tx.type === 'purchase' || tx.type === 'adjustment' && !tx.processed) {
                updateData.processed = true;
                updateData.processedBy = req.user.id;
            }
        }
        
        const updated = await prisma.transaction.update({
            where: { id: tx.id },
            data: updateData
        });
        
        res.json({
            id: updated.id,
            utorid: tx.user.utorid,
            type: updated.type,
            spent: updated.spent,
            amount: updated.amount,
            promotionIds: tx.transactionPromotions.map(tp => tp.promotionId),
            suspicious: updated.suspicious,
            processed: updated.processed,
            remark: updated.remark,
            createdBy: tx.creator.utorid,
            createdAt: tx.createdAt
        });
    } catch (error) { next(error); }
});

// PATCH /transactions/:transactionId/amount - Update transaction amount
router.patch('/:transactionId/amount', requireRole('manager'), async (req, res, next) => {
    try {
        const amount = parseFloat(req.body.amount);
        if (isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' });
        
        const transactionId = parseInt(req.params.transactionId);
        if (isNaN(transactionId)) return res.status(400).json({ error: 'Invalid transaction ID' });
        
        const tx = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { 
                user: true, 
                creator: { select: { utorid: true } }, 
                transactionPromotions: { select: { promotionId: true } } 
            }
        });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        
        // Only allow updating amount for purchase and adjustment transactions
        if (tx.type !== 'purchase' && tx.type !== 'adjustment') {
            return res.status(400).json({ error: 'Cannot update amount for this transaction type' });
        }
        
        // Calculate the difference
        const oldAmount = tx.amount;
        const difference = amount - oldAmount;
        
        // Update user points if transaction is not suspicious
        if (!tx.suspicious) {
            await prisma.user.update({
                where: { id: tx.userId },
                data: { points: { increment: difference } }
            });
        }
        
        // Update transaction amount
        const updated = await prisma.transaction.update({
            where: { id: tx.id },
            data: { amount }
        });
        
        res.json({
            id: updated.id,
            utorid: tx.user.utorid,
            type: updated.type,
            spent: updated.spent,
            amount: updated.amount,
            promotionIds: tx.transactionPromotions.map(tp => tp.promotionId),
            suspicious: updated.suspicious,
            remark: updated.remark,
            createdBy: tx.creator.utorid,
            createdAt: updated.createdAt
        });
    } catch (error) { next(error); }
});

// PATCH /transactions/:transactionId/spent - Update transaction spent amount
router.patch('/:transactionId/spent', requireRole('manager'), async (req, res, next) => {
    try {
        const spent = parseFloat(req.body.spent);
        if (isNaN(spent) || spent <= 0) return res.status(400).json({ error: 'Invalid spent amount' });
        
        const transactionId = parseInt(req.params.transactionId);
        if (isNaN(transactionId)) return res.status(400).json({ error: 'Invalid transaction ID' });
        
        const tx = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { 
                user: true, 
                creator: { select: { utorid: true } }, 
                transactionPromotions: { select: { promotionId: true } } 
            }
        });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        
        // Only allow updating spent for purchase transactions
        if (tx.type !== 'purchase') {
            return res.status(400).json({ error: 'Cannot update spent for this transaction type' });
        }
        
        // Recalculate points based on new spent amount and promotions
        const promotionIds = tx.transactionPromotions.map(tp => tp.promotionId);
        const newAmount = await calculatePurchasePoints(spent, promotionIds, tx.userId);
        const oldAmount = tx.amount;
        const amountDifference = newAmount - oldAmount;
        
        // Update user points if transaction is not suspicious
        if (!tx.suspicious && amountDifference !== 0) {
            await prisma.user.update({
                where: { id: tx.userId },
                data: { points: { increment: amountDifference } }
            });
        }
        
        // Update transaction spent and amount
        const updated = await prisma.transaction.update({
            where: { id: tx.id },
            data: { 
                spent,
                amount: newAmount
            }
        });
        
        res.json({
            id: updated.id,
            utorid: tx.user.utorid,
            type: updated.type,
            spent: updated.spent,
            amount: updated.amount,
            promotionIds: tx.transactionPromotions.map(tp => tp.promotionId),
            suspicious: updated.suspicious,
            remark: updated.remark,
            createdBy: tx.creator.utorid,
            createdAt: updated.createdAt
        });
    } catch (error) { next(error); }
});

// PATCH /transactions/:transactionId/processed - Process redemption or purchase
router.patch('/:transactionId/processed', requireRole('cashier'), async (req, res, next) => {
    try {
        const processed = coerceBoolean(req.body.processed);
        if (processed !== true) return res.status(400).json({ error: 'Invalid data' });
        
        const transactionId = parseInt(req.params.transactionId);
        if (isNaN(transactionId)) return res.status(400).json({ error: 'Invalid transaction ID' });
        const tx = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { user: true, creator: { select: { utorid: true } }, transactionPromotions: { select: { promotionId: true } } }
        });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        if (tx.processed) return res.status(400).json({ error: 'Already processed' });
        
        // Cashiers can only process redemptions
        if (req.user.role === 'cashier' && tx.type !== 'redemption') {
            return res.status(403).json({ error: 'Cashiers can only process redemptions' });
        }
        
        // Managers can process purchase transactions (pending and not suspicious)
        if (tx.type === 'purchase') {
            if (req.user.role !== 'manager' && req.user.role !== 'superuser') {
                return res.status(403).json({ error: 'Only managers can process purchase transactions' });
            }
            if (tx.suspicious) {
                return res.status(400).json({ error: 'Cannot process suspicious transactions' });
            }
            // Add points to user
            await prisma.user.update({
                where: { id: tx.userId },
                data: { points: { increment: tx.amount } }
            });
        } else if (tx.type === 'redemption') {
            // For redemptions, check if user has enough points
            if (tx.user.points < Math.abs(tx.amount)) return res.status(400).json({ error: 'Insufficient points' });
            // Deduct points (amount is negative, so increment by negative = subtract)
            await prisma.user.update({
                where: { id: tx.userId },
                data: { points: { increment: tx.amount } }
            });
        } else {
            return res.status(400).json({ error: 'Cannot process this transaction type' });
        }
        
        const updated = await prisma.transaction.update({
            where: { id: tx.id },
            data: { processed: true, processedBy: req.user.id }
        });
        
        const processor = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        const result = {
            id: updated.id,
            utorid: tx.user.utorid,
            type: updated.type,
            processed: updated.processed,
            processedBy: processor.utorid,
            remark: updated.remark,
            createdAt: updated.createdAt
        };
        
        if (tx.type === 'redemption') {
            result.redeemed = Math.abs(updated.amount);
            result.createdBy = tx.user.utorid;
        } else if (tx.type === 'purchase') {
            result.spent = updated.spent;
            result.amount = updated.amount;
            result.promotionIds = tx.transactionPromotions.map(tp => tp.promotionId);
            result.createdBy = tx.creator.utorid;
        }
        
        res.json(result);
    } catch (error) { next(error); }
});

module.exports = router;

