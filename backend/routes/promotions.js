const express = require('express');
const router = express.Router();
const { z } = require('zod');
const {
    prisma,
    schemas,
    jwtUtils,
    requireRole,
    optionalAuth,
    validate,
    validateQuery
} = require('../middleware');

// POST /promotions - Create promotion
router.post('/', async (req, res, next) => {
    try {
        // Check authentication and authorization FIRST (before validation)
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        
        let authUser;
        try {
            authUser = jwtUtils.verifyToken(token);
        } catch (error) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const roleHierarchy = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
        if (roleHierarchy[authUser.role] < 2) { // manager level
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        // Now validate request body
        let validatedData;
        try {
            validatedData = schemas.createPromotion.parse(req.body || {});
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors[0].message });
            }
            throw error;
        }
        
        const { name, description, type, startTime, endTime, minSpending, rate, points } = validatedData;
        
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        // Allow promotions to start in the past (already-active promotions)
        if (start >= end) return res.status(400).json({ error: 'End time must be after start time' });
        
        const promotion = await prisma.promotion.create({
            data: {
                name, description, type,
                startTime: start, endTime: end,
                minSpending: minSpending || null,
                rate: rate || null,
                points: points || null
            }
        });
        
        res.status(201).json({
            id: promotion.id,
            name: promotion.name,
            description: promotion.description,
            type: promotion.type,
            startTime: promotion.startTime,
            endTime: promotion.endTime,
            minSpending: promotion.minSpending,
            rate: promotion.rate,
            points: promotion.points
        });
    } catch (error) { next(error); }
});

// GET /promotions - List promotions
router.get('/', optionalAuth, validateQuery(z.object({
    name: z.string().optional(),
    type: z.enum(['automatic', 'onetime']).optional(),
    started: z.string().optional(),
    ended: z.string().optional(),
    utorid: z.string().optional(),
    page: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '1' : val,
        z.string().regex(/^\d+$/)
    ),
    limit: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '10' : val,
        z.string().regex(/^\d+$/)
    )
})), async (req, res, next) => {
    try {
        const { name, type, started, ended, utorid, page = '1', limit = '10' } = req.validatedQuery;
        
        if (started && ended) return res.status(400).json({ error: 'Cannot specify both started and ended' });
        
        const pageNum = parseInt(page), limitNum = parseInt(limit);
        
        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        
        const skip = (pageNum - 1) * limitNum;
        const now = new Date();
        
        // Determine which user's role to use for filtering
        let targetUser = req.user;
        let targetUserId = req.user?.id;
        const requesterIsManagerOrAbove = req.user && ['manager', 'superuser'].includes(req.user.role);
        
        // If utorid is provided, look up that user instead
        if (utorid) {
            const userByUtorid = await prisma.user.findUnique({ where: { utorid } });
            if (!userByUtorid) {
                return res.status(404).json({ error: 'User not found' });
            }
            targetUser = userByUtorid;
            targetUserId = userByUtorid.id;
        }
        
        const where = {};
        if (name) where.name = { contains: name };
        if (type) where.type = type;
        
        // Use target user's role to determine visibility
        const isManagerOrAbove = targetUser && ['manager', 'superuser'].includes(targetUser.role);
        
        if (utorid) {
            where.startTime = { lte: now };
            where.endTime = { gte: now };
        } else if (isManagerOrAbove) {
            // Only apply time filters if explicitly requested with 'true' or 'false'
            if (started === 'true' || started === 'false') {
                where.startTime = started === 'true' ? { lte: now } : { gt: now };
            }
            if (ended === 'true' || ended === 'false') {
                where.endTime = ended === 'true' ? { lte: now } : { gt: now };
            }
        } else {
            // Regular users only see active promotions
            where.startTime = { lte: now };
            where.endTime = { gte: now };
        }
        
        const dbCount = await prisma.promotion.count({ where });
        let promotions = await prisma.promotion.findMany({
            where,
            skip,
            take: limitNum,
            include: targetUserId ? {
                userPromotions: {
                    where: { userId: targetUserId }
                }
            } : false
        });
        
        if (targetUserId && (!requesterIsManagerOrAbove || utorid)) {
            promotions = promotions.filter(p => {
                if (p.type === 'automatic') return true;
                const userPromo = p.userPromotions?.find(up => up.userId === targetUserId);
                return !userPromo || !userPromo.used;
            });
        }
        
        const results = promotions.map(p => {
            const result = {
                id: p.id,
                name: p.name,
                type: p.type,
                endTime: p.endTime,
                minSpending: p.minSpending,
                rate: p.rate,
                points: p.points
            };
            if (isManagerOrAbove) result.startTime = p.startTime;
            return result;
        });
        
        const finalCount = (requesterIsManagerOrAbove && !utorid) ? dbCount : results.length;
        
        res.json({ count: finalCount, results });
    } catch (error) { next(error); }
});

// GET /promotions/:promotionId - Get promotion details
router.get('/:promotionId', optionalAuth, async (req, res, next) => {
    try {
        const promotionId = parseInt(req.params.promotionId, 10);
        if (isNaN(promotionId) || promotionId < 1) {
            return res.status(400).json({ error: 'Invalid promotion ID' });
        }
        
        const promotion = await prisma.promotion.findUnique({ where: { id: promotionId } });
        
        if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
        
        const isManagerOrAbove = req.user && ['manager', 'superuser'].includes(req.user.role);
        const now = new Date();
        
        const isActive = promotion.startTime <= now && promotion.endTime >= now;
        
        // Regular users can only see active promotions
        if (!isManagerOrAbove && !isActive) {
            return res.status(404).json({ error: 'Promotion not found' });
        }
        
        const response = {
            id: promotion.id,
            name: promotion.name,
            description: promotion.description,
            type: promotion.type,
            endTime: promotion.endTime,
            minSpending: promotion.minSpending,
            rate: promotion.rate,
            points: promotion.points
        };
        
        if (isManagerOrAbove) response.startTime = promotion.startTime;
        
        res.json(response);
    } catch (error) { next(error); }
});

// PATCH /promotions/:promotionId - Update promotion
router.patch('/:promotionId', requireRole('manager'), async (req, res, next) => {
    try {
        const promotionId = parseInt(req.params.promotionId);

        if (isNaN(promotionId) || promotionId <= 0) {
            return res.status(400).json({ error: 'Invalid promotion ID' });
        }
        
        const promotion = await prisma.promotion.findUnique({ where: { id: promotionId } });
        if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
        
        // Now validate request body
        let updates;
        try {
            updates = schemas.updatePromotion.parse(req.body || {});
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors[0].message });
            }
            throw error;
        }
        
        const now = new Date();
        
        // Validate time updates
        if (updates.startTime || updates.endTime) {
            const newStart = updates.startTime ? new Date(updates.startTime) : promotion.startTime;
            const newEnd = updates.endTime ? new Date(updates.endTime) : promotion.endTime;
            
            if (newStart >= newEnd) return res.status(400).json({ error: 'Invalid times' });
            if (updates.startTime && newStart < now) return res.status(400).json({ error: 'Times cannot be in past' });
            if (updates.endTime && newEnd < now) return res.status(400).json({ error: 'Times cannot be in past' });
        }
        
        if (promotion.startTime <= now) {
            const restrictedFields = ['name', 'description', 'type', 'startTime', 'minSpending', 'rate', 'points'];
            for (const field of restrictedFields) {
                if (updates[field] !== undefined && updates[field] !== null) {
                    return res.status(400).json({ error: 'Cannot update after promotion started' });
                }
            }
        }
        
        // Can't update endTime after promotion ends
        if (promotion.endTime <= now && updates.endTime !== undefined && updates.endTime !== null) {
            return res.status(400).json({ error: 'Cannot update after promotion ended' });
        }
        
        const finalUpdates = {};
        if (updates.name) finalUpdates.name = updates.name;
        if (updates.description) finalUpdates.description = updates.description;
        if (updates.type) finalUpdates.type = updates.type;
        if (updates.startTime) finalUpdates.startTime = new Date(updates.startTime);
        if (updates.endTime) finalUpdates.endTime = new Date(updates.endTime);
        if (updates.minSpending !== undefined) finalUpdates.minSpending = updates.minSpending;
        if (updates.rate !== undefined) finalUpdates.rate = updates.rate;
        if (updates.points !== undefined) finalUpdates.points = updates.points;
        
        const updated = await prisma.promotion.update({
            where: { id: promotionId },
            data: finalUpdates
        });
        
        // Build response - always include id, name, and type
        const response = { 
            id: updated.id, 
            name: updated.name, 
            type: updated.type 
        };
        
        // Add endTime if it was updated
        if (updates.endTime !== undefined && updates.endTime !== null) {
            response.endTime = updated.endTime;
        }
        
        // Add minSpending if it exists in the database
        if (updated.minSpending !== null && updated.minSpending !== undefined) {
            response.minSpending = updated.minSpending;
        }
        
        res.json(response);
    } catch (error) { next(error); }
});

// DELETE /promotions/:promotionId - Delete promotion
router.delete('/:promotionId', requireRole('manager'), async (req, res, next) => {
    try {
        const promotionId = parseInt(req.params.promotionId);
        if (isNaN(promotionId) || promotionId <= 0) {
            return res.status(400).json({ error: 'Invalid promotion ID' });
        }
        const promotion = await prisma.promotion.findUnique({ where: { id: promotionId } });
        
        if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
        
        // Check if promotion has started (403) - must come after existence check
        const now = new Date();
        if (promotion.startTime <= now) {
            return res.status(403).json({ error: 'Cannot delete promotion that has started' });
        }
        
        await prisma.promotion.delete({ where: { id: promotionId } });
        res.status(204).send();
    } catch (error) { next(error); }
});

module.exports = router;

