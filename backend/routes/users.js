const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const {
    prisma,
    emailUtils,
    schemas,
    upload,
    requireRole,
    validate,
    validateQuery,
    coerceBoolean,
    normalizeAvatarUrl,
    uoftEmailRegex,
    dateRegex
} = require('../middleware');

// POST /users - Register new user
router.post('/', requireRole('cashier'), validate(schemas.createUser), async (req, res, next) => {
    try {
        const { utorid, name, email } = req.validatedData;
        const existing = await prisma.user.findFirst({ where: { OR: [{ utorid }, { email }] } });
        if (existing) return res.status(409).json({ error: 'User already exists' });
        
        const tempPassword = uuidv4();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const resetToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const user = await prisma.user.create({
            data: { 
                utorid, 
                name, 
                email, 
                password: hashedPassword, 
                resetToken, 
                resetTokenExpiry: expiresAt 
            }
        });
        
        // Send welcome email
        try {
            await emailUtils.sendWelcomeEmail(name, email, resetToken);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Continue even if email fails - don't block user creation
        }
        
        res.status(201).json({
            id: user.id, 
            utorid: user.utorid, 
            name: user.name, 
            email: user.email,
            verified: user.verified, 
            expiresAt: expiresAt.toISOString(), 
            resetToken
        });
    } catch (error) { next(error); }
});

// GET /users - List users
router.get('/', requireRole('manager'), validateQuery(z.object({
    name: z.string().optional(),
    role: z.enum(['regular', 'cashier', 'manager', 'superuser']).optional(),
    verified: z.preprocess(
        (val) => {
            if (val === undefined || val === null || val === '') return undefined;
            if (val === 'true' || val === true || val === '1') return true;
            if (val === 'false' || val === false || val === '0') return false;
            return undefined;
        },
        z.boolean().optional()
    ),
    activated: z.preprocess(
        (val) => {
            if (val === undefined || val === null || val === '') return undefined;
            if (val === 'true' || val === true || val === '1') return true;
            if (val === 'false' || val === false || val === '0') return false;
            return undefined;
        },
        z.boolean().optional()
    ),
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
        const { name, role, verified, activated, page, limit } = req.validatedQuery;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        const skip = (pageNum - 1) * limitNum;
        
        const where = {};
        
        if (name) {
            where.OR = [
                { utorid: { contains: name } }, 
                { name: { contains: name } }
            ];
        }
        
        if (role) {
            where.role = role;
        }
        
        if (typeof verified === 'boolean') {
            where.verified = verified;
        }

        if (typeof activated === 'boolean') {
            where.lastLogin = activated ? { not: null } : null;
        }
        
        const count = await prisma.user.count({ where });
        const users = await prisma.user.findMany({
            where,
            skip,
            take: limitNum,
            select: {
                id: true, 
                utorid: true, 
                name: true, 
                email: true, 
                birthday: true,
                role: true, 
                points: true, 
                createdAt: true, 
                lastLogin: true, 
                verified: true, 
                avatarUrl: true
            },
            orderBy: { createdAt: 'desc' }
        });
        
        const normalizedUsers = users.map(user => ({
            ...user,
            avatarUrl: normalizeAvatarUrl(user.avatarUrl)
        }));
        
        res.json({ count, results: normalizedUsers });
    } catch (error) { 
        next(error); 
    }
});

// GET /users/me - Get current user
router.get('/me', requireRole('regular'), async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                userPromotions: {
                    where: {
                        used: false,
                        promotion: { type: 'onetime', startTime: { lte: new Date() }, endTime: { gte: new Date() } }
                    },
                    include: { promotion: { select: { id: true, name: true, minSpending: true, rate: true, points: true } } }
                }
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const promotions = user.userPromotions.map(up => up.promotion);
        res.json({
            id: user.id, utorid: user.utorid, name: user.name, email: user.email,
            birthday: user.birthday, role: user.role, points: user.points,
            createdAt: user.createdAt, lastLogin: user.lastLogin, verified: user.verified,
            avatarUrl: normalizeAvatarUrl(user.avatarUrl), promotions
        });
    } catch (error) { next(error); }
});

// PATCH /users/me - Update current user
router.patch('/me', requireRole('regular'), upload.single('avatar'), async (req, res, next) => {
    try {
        const updates = {};
        let hasUpdates = false;
        
        if (req.body.name !== undefined && req.body.name !== null) {
            if (typeof req.body.name !== 'string' || req.body.name.length < 1 || req.body.name.length > 50) {
                return res.status(400).json({ error: 'Name must be 1-50 characters' });
            }
            updates.name = req.body.name;
            hasUpdates = true;
        }

        if (req.body.email !== undefined && req.body.email !== null) {
            if (typeof req.body.email !== 'string' || !uoftEmailRegex.test(req.body.email)) {
                return res.status(400).json({ error: 'Invalid email' });
            }
            updates.email = req.body.email;
            hasUpdates = true;
        }
        
        if (req.body.birthday !== undefined && req.body.birthday !== null) {
            if (typeof req.body.birthday !== 'string' || !dateRegex.test(req.body.birthday)) {
                return res.status(400).json({ error: 'Birthday must be in YYYY-MM-DD format' });
            }
            
            // Now validate if it's a real date
            const [year, month, day] = req.body.birthday.split('-').map(num => parseInt(num, 10));
            const date = new Date(year, month - 1, day);
            
            if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
                return res.status(400).json({ error: 'Invalid date' });
            }
            
            updates.birthday = req.body.birthday;
            hasUpdates = true;
        }
        
        if (req.file) {
            updates.avatarUrl = `/uploads/avatars/${req.file.filename}`;
            hasUpdates = true;
        }
        
        if (!hasUpdates) {
            return res.status(400).json({ error: 'At least one field must be provided' });
        }
        
        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: updates,
            select: {
                id: true, utorid: true, name: true, email: true, birthday: true,
                role: true, points: true, createdAt: true, lastLogin: true, verified: true, avatarUrl: true
            }
        });
        // Normalize avatar URL to use default if null
        res.json({
            ...user,
            avatarUrl: normalizeAvatarUrl(user.avatarUrl)
        });
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email already in use' });
        next(error);
    }
});

// PATCH /users/me/password - Change password
router.patch('/me/password', requireRole('regular'), validate(schemas.changePassword), async (req, res, next) => {
    try {
        const { old: oldPassword, new: newPassword } = req.validatedData;
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || !await bcrypt.compare(oldPassword, user.password)) {
            return res.status(403).json({ error: 'Current password is incorrect' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });
        res.json({ message: 'Password updated successfully' });
    } catch (error) { next(error); }
});

// GET /users/:userId - Get user details
router.get('/:userId', requireRole('cashier'), async (req, res, next) => {
    try {
        const identifier = req.params.userId;
        const whereClause = /^\d+$/.test(identifier)
            ? { id: parseInt(identifier, 10) }
            : { utorid: identifier };

        const user = await prisma.user.findUnique({
            where: whereClause,
            include: {
                userPromotions: {
                    where: {
                        used: false,
                        promotion: { type: 'onetime', startTime: { lte: new Date() }, endTime: { gte: new Date() } }
                    },
                    include: { promotion: { select: { id: true, name: true, minSpending: true, rate: true, points: true } } }
                }
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const promotions = user.userPromotions.map(up => up.promotion);
        
        if (req.user.role === 'cashier') {
            return res.json({ id: user.id, utorid: user.utorid, name: user.name, points: user.points, verified: user.verified, promotions });
        }
        
        res.json({
            id: user.id, utorid: user.utorid, name: user.name, email: user.email,
            birthday: user.birthday, role: user.role, points: user.points,
            createdAt: user.createdAt, lastLogin: user.lastLogin, verified: user.verified,
            suspicious: user.suspicious, avatarUrl: normalizeAvatarUrl(user.avatarUrl), promotions
        });
    } catch (error) { next(error); }
});

// PATCH /users/:userId - Update user
router.patch('/:userId', requireRole('manager'), async (req, res, next) => {
    try {
        const identifier = req.params.userId;
        const whereClause = /^\d+$/.test(identifier)
            ? { id: parseInt(identifier, 10) }
            : { utorid: identifier };

        const user = await prisma.user.findUnique({ where: whereClause });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Track which fields were provided in the request
        const providedFields = new Set();
        const updates = {};
        
        if (req.body.name !== undefined && req.body.name !== null) {
            providedFields.add('name');
            if (typeof req.body.name !== 'string' || req.body.name.length < 1 || req.body.name.length > 50) {
                return res.status(400).json({ error: 'Name must be 1-50 characters' });
            }
            if (user.name !== req.body.name) {
                updates.name = req.body.name;
            }
        }

        if (req.body.email !== undefined && req.body.email !== null) {
            providedFields.add('email');
            if (typeof req.body.email !== 'string' || !uoftEmailRegex.test(req.body.email)) {
                return res.status(400).json({ error: 'Invalid email' });
            }
            if (user.email !== req.body.email) {
                updates.email = req.body.email;
            }
        }
        
        if (req.body.birthday !== undefined && req.body.birthday !== null) {
            providedFields.add('birthday');
            if (req.body.birthday && !dateRegex.test(req.body.birthday)) {
                return res.status(400).json({ error: 'Invalid birthday format' });
            }
            if (user.birthday !== req.body.birthday) {
                updates.birthday = req.body.birthday;
            }
        }

        if (req.body.verified !== undefined && req.body.verified !== null) {
            providedFields.add('verified');
            const verifiedVal = coerceBoolean(req.body.verified);
            if (!verifiedVal) {
                return res.status(400).json({ error: 'Invalid verified value' });
            }
            if (user.verified !== verifiedVal) {
                updates.verified = verifiedVal;
            }
        }
        
        if (req.body.suspicious !== undefined && req.body.suspicious !== null) {
            providedFields.add('suspicious');
            const suspiciousVal = coerceBoolean(req.body.suspicious);
            if (suspiciousVal === null) {
                return res.status(400).json({ error: 'Invalid suspicious value' });
            }
            if (user.suspicious !== suspiciousVal) {
                updates.suspicious = suspiciousVal;
            }
        }
        
        if (req.body.role !== undefined && req.body.role !== null) {
            providedFields.add('role');
            const validRoles = ['regular', 'cashier', 'manager', 'superuser'];
            if (!validRoles.includes(req.body.role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            if (req.user.role === 'manager') {
                if (!['regular', 'cashier'].includes(req.body.role)) {
                    return res.status(403).json({ error: 'Managers can only set role to regular or cashier' });
                }
            }

            if (req.body.role === 'cashier' && user.suspicious) {
                return res.status(403).json({ error: 'Cannot promote suspicious user to cashier' });
            }
            
            if (user.role !== req.body.role) {
                updates.role = req.body.role;
            }
        }
        
        // Check if at least one field was provided
        if (providedFields.size === 0) {
            return res.status(400).json({ error: 'At least one field must be provided' });
        }
        
        // Perform update only if there are actual changes
        if (Object.keys(updates).length > 0) {
            await prisma.user.update({
                where: { id: user.id },
                data: updates
            });
        }
        
        // Fetch the final state with ALL fields including birthday
        const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { 
                id: true, 
                utorid: true, 
                name: true, 
                email: true, 
                birthday: true,
                verified: true, 
                suspicious: true, 
                role: true 
            }
        });
        
        // Build response: always include id, utorid, name
        const response = {
            id: updatedUser.id,
            utorid: updatedUser.utorid,
            name: updatedUser.name
        };
        
        if (providedFields.has('email')) {
            response.email = updatedUser.email;
        }
        if (providedFields.has('birthday')) {
            response.birthday = updatedUser.birthday;
        }
        if (providedFields.has('verified')) {
            response.verified = updatedUser.verified;
        }
        if (providedFields.has('suspicious')) {
            response.suspicious = updatedUser.suspicious;
        }
        if (providedFields.has('role')) {
            response.role = updatedUser.role;
        }
        
        res.json(response);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email already in use' });
        next(error);
    }
});

// POST /users/me/transactions - Create redemption
router.post('/me/transactions', requireRole('regular'), async (req, res, next) => {
    try {
        const { type, amount, remark } = req.body;
        if (type !== 'redemption') return res.status(400).json({ error: 'Invalid type' });
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        const amountInt = Math.floor(amount);
        
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user.verified) return res.status(403).json({ error: 'User not verified' });
        if (user.points < amountInt) return res.status(400).json({ error: 'Insufficient points' });
        
        const transaction = await prisma.transaction.create({
            data: {
                userId: user.id,
                type: 'redemption',
                amount: -amountInt,  // Store as negative
                remark: remark || '',
                createdBy: user.id,
                processed: false
            }
        });
        
        res.status(201).json({
            id: transaction.id,
            utorid: user.utorid,
            type: 'redemption',
            processedBy: null,
            amount: Math.abs(transaction.amount),  // Return as positive
            remark: transaction.remark,
            createdBy: user.utorid
        });
    } catch (error) { next(error); }
});

// POST /users/:userId/transactions - Transfer points
router.post('/:userId/transactions', requireRole('regular'), async (req, res, next) => {
    try {
        const { type, amount, remark } = req.body;
        if (!type) return res.status(400).json({ error: 'type is required' });
        if (type !== 'transfer') return res.status(400).json({ error: 'Invalid type' });
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!sender.verified) return res.status(403).json({ error: 'Sender not verified' });
        if (sender.points < amount) return res.status(400).json({ error: 'Insufficient points' });
        
        // Support both numeric ID and UTORid
        const identifier = req.params.userId;
        const whereClause = /^\d+$/.test(identifier)
            ? { id: parseInt(identifier, 10) }
            : { utorid: identifier };
        
        const recipient = await prisma.user.findUnique({ where: whereClause });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        
        // Prevent self-transfers
        if (sender.id === recipient.id) {
            return res.status(400).json({ error: 'Cannot transfer points to yourself' });
        }
        
        // Create two transactions
        const senderTx = await prisma.transaction.create({
            data: {
                userId: sender.id,
                type: 'transfer',
                amount: -amount,
                relatedId: recipient.id,
                remark: remark || '',
                createdBy: sender.id,
                processed: true
            }
        });
        
        await prisma.transaction.create({
            data: {
                userId: recipient.id,
                type: 'transfer',
                amount: amount,
                relatedId: sender.id,
                remark: remark || '',
                createdBy: sender.id,
                processed: true
            }
        });
        
        // Update points
        await prisma.user.update({ where: { id: sender.id }, data: { points: { decrement: amount } } });
        await prisma.user.update({ where: { id: recipient.id }, data: { points: { increment: amount } } });
        
        res.status(201).json({
            id: senderTx.id,
            sender: sender.utorid,
            recipient: recipient.utorid,
            type: 'transfer',
            sent: amount,
            remark: senderTx.remark,
            createdBy: sender.utorid
        });
    } catch (error) { next(error); }
});

// GET /users/me/transactions - List user's transactions
router.get('/me/transactions', requireRole('regular'), validateQuery(z.object({
    type: z.string().optional(),
    relatedId: z.string().optional(),
    promotionId: z.string().optional(),
    amount: z.string().optional(),
    operator: z.string().optional(),
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
        const { type, relatedId, promotionId, amount, operator, page = '1', limit = '10' } = req.validatedQuery;
        const pageNum = parseInt(page), limitNum = parseInt(limit);
        
        // FIX: Add validation
        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        
        const skip = (pageNum - 1) * limitNum;
        
        const where = { userId: req.user.id };
        if (type) where.type = type;
        if (relatedId) where.relatedId = parseInt(relatedId);
        if (promotionId) {
            const txPromos = await prisma.transactionPromotion.findMany({ where: { promotionId: parseInt(promotionId) } });
            where.id = { in: txPromos.map(tp => tp.transactionId) };
        }
        if (amount && operator) {
            where.amount = operator === 'gte' ? { gte: parseInt(amount) } : { lte: parseInt(amount) };
        }
        
        const count = await prisma.transaction.count({ where });
        const transactions = await prisma.transaction.findMany({
            where, skip, take: limitNum,
            include: {
                creator: { select: { utorid: true } },
                transactionPromotions: { select: { promotionId: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        const results = transactions.map(tx => {
            const result = {
                id: tx.id,
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
            if (tx.type === 'redemption') result.redeemed = Math.abs(tx.amount);
            return result;
        });
        
        res.json({ count, results });
    } catch (error) { next(error); }
});

// GET /users/:userId/transactions - List specific user's transactions
router.get('/:userId/transactions', requireRole('manager'), validateQuery(z.object({
    type: z.string().optional(),
    relatedId: z.string().optional(),
    promotionId: z.string().optional(),
    amount: z.string().optional(),
    operator: z.string().optional(),
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
        const identifier = req.params.userId;
        const whereClause = /^\d+$/.test(identifier)
            ? { id: parseInt(identifier, 10) }
            : { utorid: identifier };

        const targetUser = await prisma.user.findUnique({ where: whereClause });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        const { type, relatedId, promotionId, amount, operator, page = '1', limit = '10' } = req.validatedQuery;
        const pageNum = parseInt(page), limitNum = parseInt(limit);
        
        if (pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        
        const skip = (pageNum - 1) * limitNum;
        
        const where = { userId: targetUser.id };
        if (type) where.type = type;
        if (relatedId) where.relatedId = parseInt(relatedId);
        if (promotionId) {
            const txPromos = await prisma.transactionPromotion.findMany({ where: { promotionId: parseInt(promotionId) } });
            where.id = { in: txPromos.map(tp => tp.transactionId) };
        }
        if (amount && operator) {
            where.amount = operator === 'gte' ? { gte: parseInt(amount) } : { lte: parseInt(amount) };
        }
        
        const count = await prisma.transaction.count({ where });
        const transactions = await prisma.transaction.findMany({
            where, skip, take: limitNum,
            include: {
                creator: { select: { utorid: true } },
                transactionPromotions: { select: { promotionId: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        const results = transactions.map(tx => {
            const result = {
                id: tx.id,
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
            if (tx.type === 'redemption') result.redeemed = Math.abs(tx.amount);
            return result;
        });
        
        res.json({ count, results });
    } catch (error) { next(error); }
});

module.exports = router;

