#!/usr/bin/env node
'use strict';

const port = (() => {
    const args = process.argv;
    if (args.length !== 3) {
        console.error("usage: node index.js port");
        process.exit(1);
    }
    const num = parseInt(args[2], 10);
    if (isNaN(num)) {
        console.error("error: argument must be an integer.");
        process.exit(1);
    }
    return num;
})();

// Load environment variables
try { require('dotenv').config(); } catch (e) {}

const express = require("express");
const cors = require("cors");
const path = require("path");
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { z } = require('zod');
const fs = require('fs');

const prisma = new PrismaClient();
const app = express();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET not set in environment variables');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// UTILITIES
// ============================================

// JWT Utils
const jwtUtils = {
    generateToken(user) {
        const payload = { id: user.id, utorid: user.utorid, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        return { token, expiresAt: expiresAt.toISOString() };
    },
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    },
    extractToken(authHeader) {
        if (!authHeader) return null;
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
        return parts[1];
    }
};

// Validation Regexes
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;
const utoridRegex = /^[a-zA-Z0-9]{7,8}$/;
const uoftEmailRegex = /^[^\s@]+@(mail\.)?utoronto\.ca$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Validation Schemas
const schemas = {
    createUser: z.object({
        utorid: z.string().regex(utoridRegex),
        name: z.string().min(1).max(50),
        email: z.string().regex(uoftEmailRegex)
    }),
    login: z.object({ utorid: z.string(), password: z.string() }),
    resetRequest: z.object({ utorid: z.string() }),
    resetPassword: z.object({
        utorid: z.string(),
        password: z.string().regex(passwordRegex)
    }),
    changePassword: z.object({
        old: z.string(),
        new: z.string().regex(passwordRegex)
    }),
    createTransaction: z.object({
        utorid: z.string(),
        type: z.string(),
        spent: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (typeof val === 'string') {
                    const num = Number(val);
                    return Number.isFinite(num) ? num : val;
                }
                return val;
            },
            z.number().positive().optional()
        ),
        amount: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (typeof val === 'string') {
                    const num = Number(val);
                    return Number.isFinite(num) ? num : val;
                }
                return val;
            },
            z.number().optional()
        ),
        relatedId: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    if (trimmed === '') return undefined;
                    const num = Number(trimmed);
                    if (Number.isFinite(num) && Number.isInteger(num)) {
                        return num;
                    }
                    return val; // Return original to trigger Zod error
                }
                if (typeof val === 'number') {
                    if (Number.isFinite(val) && Number.isInteger(val)) {
                        return val;
                    }
                    return Math.floor(val);
                }
                return val; // Return original to trigger Zod error
            },
            z.number().int().optional()
        ),
        promotionIds: z.preprocess(
            (val) => {
                if (val === null || val === undefined) return undefined;
                if (Array.isArray(val)) return val;
                return val; // Return original to trigger Zod error
            },
            z.array(z.number()).optional()
        ),
        remark: z.string().optional()
    }),
    createEvent: z.object({
        name: z.string(),
        description: z.string(),
        location: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        capacity: z.number().positive().nullable().optional(),
        points: z.number().positive().int(),
        organizerIds: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (Array.isArray(val)) {
                    return val.map(v => {
                        if (typeof v === 'string') {
                            const num = Number(v);
                            return Number.isFinite(num) && Number.isInteger(num) ? num : v;
                        }
                        if (typeof v === 'number') {
                            return Number.isFinite(v) && Number.isInteger(v) ? v : v;
                        }
                        return v;
                    });
                }
                return val;
            },
            z.array(z.number().int().positive()).optional()
        )
    }),
    updateEvent: z.object({
        name: z.preprocess(
            (val) => val === null ? undefined : val,
            z.string().optional()
        ),
        description: z.preprocess(
            (val) => val === null ? undefined : val,
            z.string().optional()
        ),
        location: z.preprocess(
            (val) => val === null ? undefined : val,
            z.string().optional()
        ),
        startTime: z.preprocess(
            (val) => val === null ? undefined : val,
            z.string().optional()
        ),
        endTime: z.preprocess(
            (val) => val === null ? undefined : val,
            z.string().optional()
        ),
        capacity: z.preprocess(
            (val) => val === null ? undefined : val,
            z.number().positive().int().optional()
        ),
        points: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    const num = Number(trimmed);
                    if (Number.isFinite(num) && num > 0) {
                        const intVal = Math.floor(num);
                        if (intVal === num) return intVal;
                    }
                    return val; // Return original to trigger Zod error
                }
                if (typeof val === 'number') {
                    if (Number.isFinite(val) && val > 0) {
                        const intVal = Math.floor(val);
                        if (intVal === val) return intVal;
                    }
                    return val; // Return original to trigger Zod error
                }
                return val;
            },
            z.number().positive().int().optional()
        ),
        published: z.preprocess(
            (val) => val === null ? undefined : val,
            z.boolean().optional()
        ),
        organizerIds: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (Array.isArray(val)) {
                    return val.map(v => {
                        if (typeof v === 'string') {
                            const num = Number(v);
                            return Number.isFinite(num) && Number.isInteger(num) ? num : v;
                        }
                        if (typeof v === 'number') {
                            return Number.isFinite(v) && Number.isInteger(v) ? v : v;
                        }
                        return v;
                    });
                }
                return val;
            },
            z.array(z.number().int().positive()).optional()
        )
    }),
    createPromotion: z.object({
        name: z.string(),
        description: z.string(),
        type: z.preprocess(
            (val) => {
                if (typeof val === 'string') {
                    if (val === 'one-time' || val === 'onetime') return 'onetime';
                    if (val === 'automatic') return 'automatic';
                }
                return val;
            },
            z.enum(['automatic', 'onetime'])
        ),
        startTime: z.string(),
        endTime: z.string(),
        minSpending: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (typeof val === 'string') {
                    const num = Number(val);
                    return Number.isFinite(num) ? num : val;
                }
                return val;
            },
            z.number().positive().optional()
        ),
        rate: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (typeof val === 'string') {
                    const num = Number(val);
                    return Number.isFinite(num) ? num : val;
                }
                return val;
            },
            z.number().positive().optional()
        ),
        points: z.preprocess(
            (val) => {
                if (val === undefined || val === null) return undefined;
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    const num = Number(trimmed);
                    // Allow zero or positive integer values
                    if (Number.isFinite(num) && num >= 0) {
                        const intVal = Math.floor(num);
                        if (intVal === num) return intVal;
                    }
                    return val; // Return original to trigger Zod error
                }
                if (typeof val === 'number') {
                    if (Number.isFinite(val) && val >= 0) {
                        const intVal = Math.floor(val);
                        if (intVal === val) return intVal;
                    }
                    return val; // Return original to trigger Zod error
                }
                return val;
            },
            z.number().nonnegative().int().optional()
        )
    }),
    updatePromotion: z.object({
        name: z.preprocess(
            (val) => val === null || val === undefined ? undefined : val,
            z.string().optional()
        ),
        description: z.preprocess(
            (val) => val === null || val === undefined ? undefined : val,
            z.string().optional()
        ),
        type: z.preprocess(
            (val) => {
                if (val === null || val === undefined) return undefined;
                if (typeof val === 'string') {
                    if (val === 'one-time' || val === 'onetime') return 'onetime';
                    if (val === 'automatic') return 'automatic';
                }
                return val;
            },
            z.enum(['automatic', 'onetime']).optional()
        ),
        startTime: z.preprocess(
            (val) => val === null || val === undefined ? undefined : val,
            z.string().optional()
        ),
        endTime: z.preprocess(
            (val) => val === null || val === undefined ? undefined : val,
            z.string().optional()
        ),
        minSpending: z.preprocess(
            (val) => val === null || val === undefined ? undefined : val,
            z.number().positive().optional()
        ),
        rate: z.preprocess(
            (val) => val === null || val === undefined ? undefined : val,
            z.number().positive().optional()
        ),
        points: z.preprocess(
            (val) => val === null || val === undefined ? undefined : val,
            z.number().nonnegative().int().optional()
        )
    })
};

// Multer for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads/avatars');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.user.utorid}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        cb(extname && mimetype ? null : new Error('Only image files allowed'), extname && mimetype);
    }
});

// Rate Limiter
const requestLog = new Map();
const resetRateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    if (requestLog.has(ip)) {
        const lastRequestTime = requestLog.get(ip);
        if (now - lastRequestTime < 60000) {
            return res.status(429).json({ error: 'Too many requests' });
        }
    }
    requestLog.set(ip, now);
    for (const [savedIp, timestamp] of requestLog.entries()) {
        if (now - timestamp > 60000) requestLog.delete(savedIp);
    }
    next();
};

// ============================================
// MIDDLEWARE
// ============================================

const authenticate = (req, res, next) => {
    const token = jwtUtils.extractToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwtUtils.verifyToken(token);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

const requireRole = (minRole) => {
    const roleHierarchy = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
    const minLevel = roleHierarchy[minRole];
    return (req, res, next) => {
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        
        try {
            req.user = jwtUtils.verifyToken(token);
            if (roleHierarchy[req.user.role] < minLevel) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            next();
        } catch (error) {
            res.status(401).json({ error: 'Unauthorized' });
        }
    };
};

const optionalAuth = (req, res, next) => {
    const token = jwtUtils.extractToken(req.headers.authorization);
    if (token) {
        try { req.user = jwtUtils.verifyToken(token); }
        catch (error) { req.user = null; }
    } else {
        req.user = null;
    }
    next();
};

const validate = (schema) => (req, res, next) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        req.validatedData = schema.parse(body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        next(error);
    }
};

// Helper: coerce common boolean-like values from req.body
const coerceBoolean = (val) => {
    if (typeof val === 'boolean') return val;
    if (val === 'true' || val === '1' || val === 1) return true;
    if (val === 'false' || val === '0' || val === 0) return false;
    return null;
};

const validateQuery = (schema) => (req, res, next) => {
    try {
        req.validatedQuery = schema.parse(req.query);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        next(error);
    }
};

// ============================================
// AUTH ROUTES
// ============================================

// POST /auth/tokens - Login
app.post('/auth/tokens', validate(schemas.login), async (req, res, next) => {
    try {
        const { utorid, password } = req.validatedData;
        const user = await prisma.user.findUnique({ where: { utorid } });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const { token, expiresAt } = jwtUtils.generateToken(user);
        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
        res.json({ token, expiresAt });
    } catch (error) { next(error); }
});

// POST /auth/resets/:resetToken - Reset password
app.post('/auth/resets/:resetToken', validate(schemas.resetPassword), async (req, res, next) => {
    try {
        const { resetToken } = req.params;
        const { utorid, password } = req.validatedData;
        
        // First check if token exists
        const userWithToken = await prisma.user.findUnique({ where: { resetToken } });
        if (!userWithToken) return res.status(404).json({ error: 'Invalid reset token' });
        
        // Check if token expired
        if (userWithToken.resetTokenExpiry && new Date() > userWithToken.resetTokenExpiry) {
            return res.status(410).json({ error: 'Reset token expired' });
        }
        
        // Check if utorid matches
        if (userWithToken.utorid !== utorid) {
            return res.status(401).json({ error: 'UTORid mismatch' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: userWithToken.id },
            data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
        });
        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) { next(error); }
});

// POST /auth/resets - Request password reset
app.post('/auth/resets', validate(schemas.resetRequest), async (req, res, next) => {
    try {
        const { utorid } = req.validatedData;
        const user = await prisma.user.findUnique({ where: { utorid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const resetToken = uuidv4();
        const expiresAt = new Date(Date.now() + 3600000);
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { resetToken, resetTokenExpiry: expiresAt }
            });
        }
        res.status(202).json({ expiresAt: expiresAt.toISOString(), resetToken });
    } catch (error) { next(error); }
});

// ============================================
// USER ROUTES
// ============================================

// POST /users - Register new user
app.post('/users', requireRole('cashier'), validate(schemas.createUser), async (req, res, next) => {
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
app.get('/users', requireRole('manager'), validateQuery(z.object({
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
        
        res.json({ count, results: users });
    } catch (error) { 
        next(error); 
    }
});

// GET /users/me - Get current user
app.get('/users/me', requireRole('regular'), async (req, res, next) => {
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
            avatarUrl: user.avatarUrl, promotions
        });
    } catch (error) { next(error); }
});

// PATCH /users/me - Update current user
app.patch('/users/me', requireRole('regular'), upload.single('avatar'), async (req, res, next) => {
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
        res.json(user);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email already in use' });
        next(error);
    }
});

// PATCH /users/me/password - Change password
app.patch('/users/me/password', requireRole('regular'), validate(schemas.changePassword), async (req, res, next) => {
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
app.get('/users/:userId', requireRole('cashier'), async (req, res, next) => {
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
            suspicious: user.suspicious, avatarUrl: user.avatarUrl, promotions
        });
    } catch (error) { next(error); }
});

// PATCH /users/:userId - Update user
app.patch('/users/:userId', requireRole('manager'), async (req, res, next) => {
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

// ============================================
// TRANSACTION ROUTES
// ============================================

// Helper: Calculate points for purchase
const calculatePurchasePoints = async (spent, promotionIds = [], userId) => {
    let basePoints = spent / 0.25;
    let totalPoints = basePoints;
    
    if (promotionIds.length > 0) {
        // Validate all promotion IDs exist and are active
        const promotions = await prisma.promotion.findMany({
            where: { 
                id: { in: promotionIds }
            }
        });
        
        // Check if all promotions were found
        if (promotions.length !== promotionIds.length) {
            const foundIds = promotions.map(p => p.id);
            const missingIds = promotionIds.filter(id => !foundIds.includes(id));
            throw new Error(`Invalid promotion ID: ${missingIds[0]}`);
        }
        
        // Check each promotion
        for (const promo of promotions) {
            const now = new Date();
            
            // Check if promotion is active
            if (promo.startTime > now || promo.endTime < now) {
                throw new Error(`Promotion ${promo.id} not active`);
            }
            
            // Check if one-time promotion has been used
            if (promo.type === 'onetime' || promo.type === 'one-time') {
                const userPromo = await prisma.userPromotion.findUnique({
                    where: { userId_promotionId: { userId, promotionId: promo.id } }
                });
                if (userPromo && userPromo.used) {
                    throw new Error(`Promotion ${promo.id} already used`);
                }
            }
            
            // Check minimum spending
            if (promo.minSpending && spent < promo.minSpending) {
                throw new Error(`Minimum spending ${promo.minSpending} not met for promotion ${promo.id}`);
            }
            
            // Calculate bonus points
            if (promo.rate) totalPoints += spent * promo.rate * 100;
            if (promo.points) totalPoints += promo.points;
        }
    }
    
    return totalPoints;
};

// POST /transactions - Create purchase/adjustment
app.post('/transactions', requireRole('cashier'), validate(schemas.createTransaction), async (req, res, next) => {
    try {
        const { utorid, type, spent, amount, relatedId, promotionIds = [], remark } = req.validatedData;
        
        const targetUser = await prisma.user.findUnique({ where: { utorid } });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });
        
        let transaction, earnedPoints;
        
        if (type === 'purchase') {
            if (!spent || spent <= 0) return res.status(400).json({ error: 'Invalid spent amount' });
            
            earnedPoints = await calculatePurchasePoints(spent, promotionIds, targetUser.id);
            
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
            
            // Link promotions
            if (promotionIds && promotionIds.length > 0) {
                await prisma.transactionPromotion.createMany({
                    data: promotionIds.map(pid => ({ transactionId: transaction.id, promotionId: pid }))
                });
                
                // Mark one-time promotions as used
                for (const pid of promotionIds) {
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
                promotionIds: promotionIds || [],
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
                    createdBy: req.user.id
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
                createdBy: creatorUser.utorid
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
app.get('/transactions', requireRole('manager'), validateQuery(z.object({
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
    )
})), async (req, res, next) => {
    try {
        const { name, createdBy, suspicious, promotionId, type, relatedId, amount, operator, page = '1', limit = '10' } = req.validatedQuery;
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
        
        const count = await prisma.transaction.count({ where });
        const transactions = await prisma.transaction.findMany({
            where, skip, take: limitNum,
            include: {
                user: { select: { utorid: true } },
                creator: { select: { utorid: true } },
                transactionPromotions: { select: { promotionId: true } }
            },
            orderBy: { createdAt: 'desc' }
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
app.get('/transactions/redemptions', requireRole('cashier'), validateQuery(z.object({
    page: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '1' : val,
        z.string().regex(/^\d+$/)
    ),
    limit: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '10' : val,
        z.string().regex(/^\d+$/)
    ),
    processed: z.string().optional()
})), async (req, res, next) => {
    try {
        const { page = '1', limit = '10', processed } = req.validatedQuery;
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
        
        const count = await prisma.transaction.count({ where });
        const transactions = await prisma.transaction.findMany({
            where, skip, take: limitNum,
            include: {
                user: { select: { utorid: true, name: true } },
                creator: { select: { utorid: true } },
                processor: { select: { utorid: true } }
            },
            orderBy: { createdAt: 'desc' }
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
app.get('/transactions/:transactionId', requireRole('cashier'), async (req, res, next) => {
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
app.patch('/transactions/:transactionId/suspicious', requireRole('manager'), async (req, res, next) => {
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
            if (tx.type === 'purchase' && !tx.processed) {
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
app.patch('/transactions/:transactionId/amount', requireRole('manager'), async (req, res, next) => {
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
app.patch('/transactions/:transactionId/spent', requireRole('manager'), async (req, res, next) => {
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

// POST /users/me/transactions - Create redemption
app.post('/users/me/transactions', requireRole('regular'), async (req, res, next) => {
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
app.post('/users/:userId/transactions', requireRole('regular'), async (req, res, next) => {
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
        
        const recipientId = parseInt(req.params.userId);
        if (isNaN(recipientId)) return res.status(400).json({ error: 'Invalid recipient ID' });
        const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        
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
app.get('/users/me/transactions', requireRole('regular'), validateQuery(z.object({
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
app.get('/users/:userId/transactions', requireRole('manager'), validateQuery(z.object({
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


// PATCH /transactions/:transactionId/processed - Process redemption or purchase
app.patch('/transactions/:transactionId/processed', requireRole('cashier'), async (req, res, next) => {
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

// ============================================
// EVENT ROUTES
// ============================================

// Helper: Check if user is organizer
const isOrganizer = async (eventId, userId) => {
    const organizer = await prisma.eventOrganizer.findUnique({
        where: { eventId_userId: { eventId, userId } }
    });
    return !!organizer;
};

// POST /events - Validate request body better
app.post('/events', validate(schemas.createEvent), async (req, res, next) => {
    try {
        const { name, description, location, startTime, endTime, capacity, points } = req.body;
        
        // CRITICAL: Validate dates BEFORE permission check
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        if (start >= end) return res.status(400).json({ error: 'End time must be after start time' });
        if (start < new Date()) return res.status(400).json({ error: 'Start time cannot be in the past' });
        
        // NOW check permissions
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        
        try {
            req.user = jwtUtils.verifyToken(token);
            const roleHierarchy = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
            if (roleHierarchy[req.user.role] < 2) { // manager level
                return res.status(403).json({ error: 'Forbidden' });
            }
        } catch (error) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Handle organizerIds if provided
        const organizerIds = req.body.organizerIds || [];
        let organizers = [];
        
        if (organizerIds.length > 0) {
            // Validate that all user IDs exist
            const users = await prisma.user.findMany({
                where: { id: { in: organizerIds } },
                select: { id: true }
            });
            
            if (users.length !== organizerIds.length) {
                return res.status(400).json({ error: 'One or more organizer user IDs are invalid' });
            }
        }
        
        const event = await prisma.event.create({
            data: {
                name, description, location,
                startTime: start, endTime: end,
                capacity: capacity === undefined ? null : capacity,
                pointsAllocated: points,
                pointsRemain: points,
                published: false,
                organizers: organizerIds.length > 0 ? {
                    create: organizerIds.map(userId => ({ userId }))
                } : undefined
            },
            include: {
                organizers: {
                    include: {
                        user: {
                            select: { id: true, utorid: true, name: true }
                        }
                    }
                }
            }
        });
        
        organizers = event.organizers.map(o => ({
            id: o.user.id,
            utorid: o.user.utorid,
            name: o.user.name
        }));
        
        res.status(201).json({
            id: event.id, name: event.name, description: event.description,
            location: event.location, startTime: event.startTime, endTime: event.endTime,
            capacity: event.capacity, pointsRemain: event.pointsRemain,
            pointsAwarded: 0, published: event.published, organizers, guests: []
        });
    } catch (error) { next(error); }
});

// GET /events - List events  
app.get('/events', optionalAuth, validateQuery(z.object({
    name: z.string().optional(),
    location: z.string().optional(),
    started: z.string().optional(),
    ended: z.string().optional(),
    showFull: z.string().optional(),
    published: z.string().optional(),
    registeredUserName: z.string().optional(),
    registeredUserLimitMin: z.string().optional(),
    registeredUserLimitMax: z.string().optional(),
    isFull: z.string().optional(),
    registered: z.string().optional(),
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
        const { name, location, started, ended, showFull, published, registeredUserName, registeredUserLimitMin, registeredUserLimitMax, isFull, registered, page, limit } = req.validatedQuery;
        
        if (started && ended) return res.status(400).json({ error: 'Cannot specify both started and ended' });
        
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        // Add validation for parsed values
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        
        const skip = (pageNum - 1) * limitNum;
        const now = new Date();
        
        const where = {};
        if (name) where.name = { contains: name };
        if (location) where.location = { contains: location };
        if (started) where.startTime = started === 'true' ? { lte: now } : { gt: now };
        if (ended) where.endTime = ended === 'true' ? { lte: now } : { gt: now };
        
        const isManagerOrAbove = req.user && ['manager', 'superuser'].includes(req.user.role);
        
        if (!isManagerOrAbove) {
            where.published = true;
        } else if (published) {
            where.published = published === 'true';
        }
        
        // Need to include user data for registered user name filtering or registered status filtering
        const includeGuests = (registeredUserName || registered) ? { include: { user: { select: { id: true, name: true, utorid: true } } } } : true;
        
        let events = await prisma.event.findMany({
            where,
            include: {
                guests: includeGuests,
                organizers: isManagerOrAbove ? { include: { user: true } } : false
            }
        });
        
        // Filter by registered status (for current user) - must happen before other filters
        // Use the same logic as isRegistered calculation
        if (registered !== undefined && registered !== '' && req.user && req.user.id) {
            const isRegisteredFilter = registered === 'true';
            const userId = Number(req.user.id);
            events = events.filter(e => {
                // Use exact same logic as isRegistered calculation
                const userIsRegistered = e.guests.some(g => {
                    // Handle both direct userId and potential nested structures
                    const guestUserId = g.userId !== undefined ? g.userId : (g.user && g.user.id);
                    return Number(guestUserId) === userId;
                });
                return userIsRegistered === isRegisteredFilter;
            });
        }
        
        // Filter by registered user name if provided
        if (registeredUserName) {
            events = events.filter(e => {
                return e.guests.some(g => {
                    const userName = g.user?.name || '';
                    return userName.toLowerCase().includes(registeredUserName.toLowerCase());
                });
            });
        }
        
        // Filter by registered user limit (min/max)
        if (registeredUserLimitMin) {
            const minLimit = parseInt(registeredUserLimitMin);
            if (!isNaN(minLimit)) {
                events = events.filter(e => e.guests.length >= minLimit);
            }
        }
        if (registeredUserLimitMax) {
            const maxLimit = parseInt(registeredUserLimitMax);
            if (!isNaN(maxLimit)) {
                events = events.filter(e => e.guests.length <= maxLimit);
            }
        }
        
        // Filter by event full status
        if (isFull !== undefined && isFull !== '') {
            const fullStatus = isFull === 'true';
            events = events.filter(e => {
                const eventIsFull = e.capacity && e.guests.length >= e.capacity;
                return eventIsFull === fullStatus;
            });
        }
        
        // Filter out full events if needed (legacy showFull parameter)
        if (showFull !== 'true' && isFull === undefined) {
            events = events.filter(e => !e.capacity || e.guests.length < e.capacity);
        }
        
        const count = events.length;
        events = events.slice(skip, skip + limitNum);
        
        const results = events.map(e => {
            const result = {
                id: e.id, name: e.name, location: e.location,
                startTime: e.startTime, endTime: e.endTime,
                capacity: e.capacity, numGuests: e.guests.length
            };
            if (isManagerOrAbove) {
                result.pointsRemain = e.pointsRemain;
                result.pointsAwarded = e.pointsAllocated - e.pointsRemain;
                result.published = e.published;
            }
            // Check if current user is registered for this event
            // Always include isRegistered field (false if not logged in or not registered)
            if (req.user && req.user.id) {
                // When using include: { guests: true }, we get EventGuest objects with userId field
                // Ensure we compare as numbers since both are integers
                const userId = Number(req.user.id);
                // Debug: Check guest structure (remove after testing)
                if (e.guests.length > 0 && !e.guests[0].hasOwnProperty('userId')) {
                    console.log('Warning: Guest object structure:', Object.keys(e.guests[0]));
                }
                result.isRegistered = e.guests.some(g => {
                    // Handle both direct userId and potential nested structures
                    const guestUserId = g.userId !== undefined ? g.userId : (g.user && g.user.id);
                    return Number(guestUserId) === userId;
                });
            } else {
                result.isRegistered = false;
            }
            return result;
        });
        
        res.json({ count, results });
    } catch (error) { next(error); }
});

// GET /events/:eventId - Get event details (enforce error order)
app.get('/events/:eventId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(404).json({ error: 'Event not found' });
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                organizers: { include: { user: { select: { id: true, utorid: true, name: true } } } },
                guests: { include: { user: { select: { id: true, utorid: true, name: true } } } }
            }
        });
        
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Authentication (401) then authorization (403)
        let authUser = null;
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (token) {
            try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        }

        const isManagerOrAbove = authUser && ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = authUser ? await isOrganizer(eventId, authUser.id) : false;

        if (!event.published) {
            if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
            if (!isManagerOrAbove && !isEventOrganizer) return res.status(403).json({ error: 'Forbidden' });
        }
        
        const organizers = event.organizers.map(o => ({ id: o.user.id, utorid: o.user.utorid, name: o.user.name }));
        
        const response = {
            id: event.id, name: event.name, description: event.description,
            location: event.location, startTime: event.startTime, endTime: event.endTime,
            capacity: event.capacity, organizers
        };
        
        if (isManagerOrAbove || isEventOrganizer) {
            response.pointsRemain = event.pointsRemain;
            response.pointsAwarded = event.pointsAllocated - event.pointsRemain;
            response.published = event.published;
            response.guests = event.guests.map(g => ({ id: g.user.id, utorid: g.user.utorid, name: g.user.name }));
        } else {
            response.numGuests = event.guests.length;
            // Add isRegistered for regular users
            if (authUser && authUser.id) {
                const userId = Number(authUser.id);
                response.isRegistered = event.guests.some(g => {
                    const guestUserId = g.userId !== undefined ? g.userId : (g.user && g.user.id);
                    return Number(guestUserId) === userId;
                });
            } else {
                response.isRegistered = false;
            }
        }
        
        res.json(response);
    } catch (error) { next(error); }
});

// PATCH /events/:eventId - Update event (enforce ordering)
app.patch('/events/:eventId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

        // 3) Check if resources exist (404)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // 4) Check authentication (401)
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }

        // 5) Check authorization (403)
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = await isOrganizer(eventId, authUser.id);
        if (!isManagerOrAbove && !isEventOrganizer) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Enforce 403 for restricted fields before structure validation
        if (!isManagerOrAbove && ('points' in req.body || 'published' in req.body || 'organizerIds' in req.body)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // 1) Validate request body structure (400)
        // Coerce numeric-like strings and floats to integers for points
        if (req.body && 'points' in req.body && req.body.points !== undefined && req.body.points !== null) {
            if (typeof req.body.points === 'string') {
                const trimmed = req.body.points.trim();
                const num = Number(trimmed);
                if (Number.isFinite(num) && num > 0) {
                    const intVal = Math.floor(num);
                    if (intVal === num) {
                        req.body.points = intVal;
                    }
                }
            } else if (typeof req.body.points === 'number') {
                // Convert floats to integers if they're whole numbers
                if (Number.isFinite(req.body.points) && req.body.points > 0) {
                    const intVal = Math.floor(req.body.points);
                    if (intVal === req.body.points) {
                        req.body.points = intVal;
                    }
                }
            }
        }
        let updates;
        try {
            updates = schemas.updateEvent.parse(req.body || {});
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors[0].message });
            }
            throw error;
        }
        
        // Validate time updates
        if (updates.startTime || updates.endTime) {
            const newStart = updates.startTime ? new Date(updates.startTime) : event.startTime;
            const newEnd = updates.endTime ? new Date(updates.endTime) : event.endTime;
            
            if (newStart >= newEnd) return res.status(400).json({ error: 'Invalid times' });
            if (newStart < new Date() || newEnd < new Date()) return res.status(400).json({ error: 'Times cannot be in past' });
        }
        
        // 6) Time/capacity (410 group)
        const now = new Date();
        // Can't update certain fields after event starts
        if (event.startTime <= now) {
            const restrictedFields = ['name', 'description', 'location', 'startTime', 'capacity'];
            for (const field of restrictedFields) {
                if (updates[field] !== undefined) {
                    return res.status(400).json({ error: 'Cannot update after event started' });
                }
            }
        }
        
        // Can't update endTime after event ends
        if (event.endTime <= now && updates.endTime !== undefined) {
            return res.status(400).json({ error: 'Cannot update after event ended' });
        }
        
        // Check capacity reduction
        if (updates.capacity !== undefined && updates.capacity !== null) {
            if (updates.capacity < event.guests.length) {
                return res.status(400).json({ error: 'Cannot reduce capacity below guest count' });
            }
        }
        
        // Check points reduction
        if (updates.points !== undefined) {
            const awarded = event.pointsAllocated - event.pointsRemain;
            const newRemaining = updates.points - awarded;
            if (newRemaining < 0) {
                return res.status(400).json({ error: 'Cannot reduce points below awarded amount' });
            }
            updates.pointsAllocated = updates.points;
            updates.pointsRemain = newRemaining;
            delete updates.points;
        }
        
        // Published can only be set to true
        if (updates.published !== undefined && !updates.published) {
            return res.status(400).json({ error: 'Cannot unpublish event' });
        }
        
        // Handle organizerIds if provided (only for managers/superusers)
        if (updates.organizerIds !== undefined && isManagerOrAbove) {
            // Validate that all user IDs exist
            const organizerIds = updates.organizerIds;
            if (organizerIds.length > 0) {
                const users = await prisma.user.findMany({
                    where: { id: { in: organizerIds } },
                    select: { id: true }
                });
                
                if (users.length !== organizerIds.length) {
                    return res.status(400).json({ error: 'One or more organizer user IDs are invalid' });
                }
            }
            
            // Remove existing organizers and add new ones
            await prisma.eventOrganizer.deleteMany({
                where: { eventId }
            });
            
            if (organizerIds.length > 0) {
                await prisma.eventOrganizer.createMany({
                    data: organizerIds.map(userId => ({ eventId, userId })),
                    skipDuplicates: true
                });
            }
        }
        
        // Build final updates object
        const finalUpdates = {};
        if (updates.name) finalUpdates.name = updates.name;
        if (updates.description) finalUpdates.description = updates.description;
        if (updates.location) finalUpdates.location = updates.location;
        if (updates.startTime) finalUpdates.startTime = new Date(updates.startTime);
        if (updates.endTime) finalUpdates.endTime = new Date(updates.endTime);
        if (updates.capacity !== undefined) finalUpdates.capacity = updates.capacity;
        if (updates.pointsAllocated !== undefined) finalUpdates.pointsAllocated = updates.pointsAllocated;
        if (updates.pointsRemain !== undefined) finalUpdates.pointsRemain = updates.pointsRemain;
        if (updates.published !== undefined) finalUpdates.published = updates.published;
        
        const updated = await prisma.event.update({
            where: { id: eventId },
            data: finalUpdates,
            include: {
                organizers: {
                    include: {
                        user: {
                            select: { id: true, utorid: true, name: true }
                        }
                    }
                }
            }
        });
        
        // Build response - always return id, name, location + fields that were in the request
        const response = { 
            id: updated.id, 
            name: updated.name, 
            location: updated.location 
        };
        
        // Add fields that were in the original request
        const original = req.body;
        if ('description' in original) response.description = updated.description;
        if ('startTime' in original) response.startTime = updated.startTime;
        if ('endTime' in original) response.endTime = updated.endTime;
        if ('capacity' in original) response.capacity = updated.capacity;
        if ('published' in original) response.published = updated.published;
        if ('points' in original) {
            response.pointsAllocated = updated.pointsAllocated;
            response.pointsRemain = updated.pointsRemain;
        }
        if ('organizerIds' in original) {
            response.organizers = updated.organizers.map(o => ({
                id: o.user.id,
                utorid: o.user.utorid,
                name: o.user.name
            }));
        }
        
        res.json(response);
    } catch (error) { next(error); }
});

// DELETE /events/:eventId - Delete event (ensure published 400 precedes auth)
app.delete('/events/:eventId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        
        if (!event) return res.status(404).json({ error: 'Event not found' });
        // Check published (400) before auth/403
        // Published events cannot be deleted
        if (event.published) {
            return res.status(400).json({ error: 'Cannot delete published event' });
        }

        // Now authentication and authorization
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        if (!isManagerOrAbove) return res.status(403).json({ error: 'Forbidden' });
        
        await prisma.event.delete({ where: { id: eventId } });
        res.status(204).send();
    } catch (error) { next(error); }
});

// POST /events/:eventId/organizers - Add organizer (resource checks before validation)
app.post('/events/:eventId/organizers', async (req, res, next) => {
    try {
        // Validate event ID (400)
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        
        // Load event first (404 precedence over body validation)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                organizers: {
                    include: {
                        user: { select: { id: true, utorid: true, name: true } }
                    }
                }
            }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        // 410 checks (before auth/body)
        if (event.endTime <= new Date()) return res.status(410).json({ error: 'Event has ended' });
        
        // Authentication and authorization
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const roleHierarchy = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
        if (roleHierarchy[authUser.role] < 2) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        // Validate body presence minimally (400) without strict type/format to reach 404 path
        const utorid = req.body && req.body.utorid !== undefined && req.body.utorid !== null
            ? String(req.body.utorid)
            : '';
        if (utorid === '') {
            return res.status(400).json({ error: 'utorid is required' });
        }

        // Load user (404)
        const user = await prisma.user.findUnique({
            where: { utorid },
            select: { id: true, utorid: true, name: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // 400 business checks
        if (event.organizers.some(o => o.user.id === user.id)) {
            return res.status(400).json({ error: 'User is already an organizer' });
        }
        
        const isGuest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId: user.id } }
        });
        if (isGuest) return res.status(400).json({ error: 'User is already a guest' });
        
        // Add the organizer
        await prisma.eventOrganizer.create({ 
            data: { eventId, userId: user.id }
        });
        
        // Return updated event with new organizer list
        const updatedEvent = await prisma.event.findUnique({
            where: { id: eventId },
            include: { 
                organizers: { 
                    include: { 
                        user: {
                            select: { id: true, utorid: true, name: true }
                        }
                    }
                }
            }
        });
        
        res.status(201).json({
            id: updatedEvent.id,
            name: updatedEvent.name,
            description: updatedEvent.description,
            location: updatedEvent.location,
            startTime: updatedEvent.startTime,
            endTime: updatedEvent.endTime,
            capacity: updatedEvent.capacity,
            published: updatedEvent.published,
            organizers: updatedEvent.organizers.map(o => ({
                id: o.user.id,
                utorid: o.user.utorid,
                name: o.user.name
            }))
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'User is already an organizer' });
        }
        next(error);
    }
});

// DELETE /events/:eventId/organizers/:userId - Remove organizer
app.delete('/events/:eventId/organizers/:userId', requireRole('manager'), async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
        
        const organizer = await prisma.eventOrganizer.findUnique({
            where: { eventId_userId: { eventId, userId } }
        });
        if (!organizer) return res.status(404).json({ error: 'Organizer not found' });
        
        await prisma.eventOrganizer.delete({ 
            where: { eventId_userId: { eventId, userId } }
        });
        res.status(204).send();
    } catch (error) { next(error); }
});

// POST /events/:eventId/guests - Add a guest to this event
app.post('/events/:eventId/guests', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        
        // Load event (404 first)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // 410 checks (time/capacity) before auth/body
        if (event.endTime <= new Date()) {
            return res.status(410).json({ error: 'Event has ended' });
        }
        
        // Check if event is at capacity (capacity !== null means there's a limit)
        if (event.capacity !== null && event.guests.length >= event.capacity) {
            return res.status(410).json({ error: 'Event is full' });
        }

        // Authentication (401) and authorization (403)
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = await isOrganizer(eventId, authUser.id);
        if (!isManagerOrAbove && !isEventOrganizer) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Validate request body (400) - accept either userId or utorid
        const { utorid, userId } = req.body || {};
        if (!utorid && !userId) {
            return res.status(400).json({ error: 'utorid or userId is required' });
        }
        if (utorid && userId) {
            return res.status(400).json({ error: 'Provide either utorid or userId, not both' });
        }

        // Load user (404)
        const whereClause = utorid 
            ? { utorid } 
            : /^\d+$/.test(String(userId))
                ? { id: parseInt(userId, 10) }
                : null;
        
        if (!whereClause) {
            return res.status(400).json({ error: 'Invalid userId format' });
        }
        
        const user = await prisma.user.findUnique({ where: whereClause });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // 400 checks
        const userIsOrganizer = await prisma.eventOrganizer.findUnique({
            where: { eventId_userId: { eventId, userId: user.id } }
        });
        if (userIsOrganizer) return res.status(400).json({ error: 'User is an organizer' });
        
        await prisma.eventGuest.create({ data: { eventId, userId: user.id } });
        
        res.status(201).json({
            id: event.id,
            name: event.name,
            location: event.location,
            guestAdded: { id: user.id, utorid: user.utorid, name: user.name },
            numGuests: event.guests.length + 1
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'User is already a guest' });
        }
        next(error);
    }
});

// DELETE /events/:eventId/guests/me - Cancel self RSVP (enforce error order)
// NOTE: This must come before /events/:eventId/guests/:userId to avoid route conflict
app.delete('/events/:eventId/guests/me', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

        // Resource existence (404)
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Authentication (401) - needed to check if user is a guest
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }

        // Check if user is a guest (404)
        const guest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId: authUser.id } }
        });
        if (!guest) return res.status(404).json({ error: 'Not registered for this event' });

        // Time (410) - check if event has ended after confirming user is a guest
        if (event.endTime <= new Date()) return res.status(410).json({ error: 'Cannot delete guest after event end.' });

        await prisma.eventGuest.delete({ 
            where: { eventId_userId: { eventId, userId: authUser.id } }
        });
        res.status(204).send();
    } catch (error) { next(error); }
});

// DELETE /events/:eventId/guests/:userId - Remove guest
app.delete('/events/:eventId/guests/:userId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        const userId = parseInt(req.params.userId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
        
        // Load event (404 first)
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        // Authentication (401) and authorization (403)
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = await isOrganizer(eventId, authUser.id);
        if (!isManagerOrAbove && !isEventOrganizer) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const guest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId } }
        });
        if (!guest) return res.status(404).json({ error: 'Guest not found' });
        
        await prisma.eventGuest.delete({ 
            where: { eventId_userId: { eventId, userId } }
        });
        res.status(204).send();
    } catch (error) { next(error); }
});

// POST /events/:eventId/guests/me - Self RSVP with comprehensive error handling
app.post('/events/:eventId/guests/me', requireRole('regular'), async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        // 410 errors take precedence
        if (event.endTime <= new Date()) {
            return res.status(410).json({ error: 'Event has ended' });
        }
        
        // Check if event is at capacity (capacity !== null means there's a limit)
        if (event.capacity !== null && event.guests.length >= event.capacity) {
            return res.status(410).json({ error: 'Event is full' });
        }

        // Unpublished events remain hidden
        // if (!event.published) return res.status(404).json({ error: 'Event not found' });
        
        // 400 errors after 410s
        const existingGuest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId: req.user.id } }
        });
        if (existingGuest) return res.status(400).json({ error: 'Already registered' });
        
        const isEventOrganizer = await isOrganizer(eventId, req.user.id);
        if (isEventOrganizer) return res.status(400).json({ error: 'Organizers cannot be guests' });
        
        await prisma.eventGuest.create({ data: { eventId, userId: req.user.id } });
        
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        res.status(201).json({
            id: event.id,
            name: event.name,
            location: event.location,
            guestAdded: { id: user.id, utorid: user.utorid, name: user.name },
            numGuests: event.guests.length + 1
        });
    } catch (error) { next(error); }
});

// POST /events/:eventId/transactions - Award points (enforce error order)
app.post('/events/:eventId/transactions', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

        // Validate request body (400)
        const { type, utorid, amount } = req.body || {};
        if (type !== 'event') return res.status(400).json({ error: 'Invalid type' });
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        // Resource existence (404)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: { include: { user: true } } }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Authentication and authorization
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = await isOrganizer(eventId, authUser.id);
        if (!isManagerOrAbove && !isEventOrganizer) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const creator = await prisma.user.findUnique({ where: { id: authUser.id } });
        
        // Award to all guests (only if utorid is explicitly not provided)
        if (utorid === undefined || utorid === null) {
            const totalPoints = amount * event.guests.length;
            if (event.pointsRemain < totalPoints) {
                return res.status(400).json({ error: 'Insufficient points remaining' });
            }
            
            const transactions = [];
            for (const guest of event.guests) {
                const tx = await prisma.transaction.create({
                    data: {
                        userId: guest.userId,
                        type: 'event',
                        amount: amount,
                        relatedId: eventId,
                        remark: event.name,
                        createdBy: authUser.id
                    }
                });
                
                await prisma.user.update({
                    where: { id: guest.userId },
                    data: { points: { increment: amount } }
                });
                
                transactions.push({
                    id: tx.id,
                    recipient: guest.user.utorid,
                    awarded: amount,
                    type: 'event',
                    relatedId: eventId,
                    remark: tx.remark,
                    createdBy: creator.utorid
                });
            }
            
            await prisma.event.update({
                where: { id: eventId },
                data: { pointsRemain: { decrement: totalPoints } }
            });
            
            return res.status(201).json(transactions);
        }
        
        // Award to specific guest
        if (!utorid || typeof utorid !== 'string' || utorid.trim() === '') {
            return res.status(400).json({ error: 'Invalid utorid' });
        }
        
        const user = await prisma.user.findUnique({ where: { utorid } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Check if user is a guest - must be a guest to receive points
        const isGuest = event.guests.find(g => g.userId === user.id);
        if (!isGuest) return res.status(400).json({ error: 'User is not a guest' });
        
        if (event.pointsRemain < amount) {
            return res.status(400).json({ error: 'Insufficient points remaining' });
        }
        
        const tx = await prisma.transaction.create({
            data: {
                userId: user.id,
                type: 'event',
                amount: amount,
                relatedId: eventId,
                remark: event.name,
                createdBy: authUser.id
            }
        });
        
        await prisma.user.update({
            where: { id: user.id },
            data: { points: { increment: amount } }
        });
        
        await prisma.event.update({
            where: { id: eventId },
            data: { pointsRemain: { decrement: amount } }
        });
        
        res.status(201).json({
            id: tx.id,
            recipient: user.utorid,
            awarded: amount,
            type: 'event',
            relatedId: eventId,
            remark: tx.remark,
            createdBy: creator.utorid
        });
    } catch (error) { next(error); }
});

// ============================================
// PROMOTION ROUTES
// ============================================

// POST /promotions - Create promotion
app.post('/promotions', async (req, res, next) => {
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
app.get('/promotions', optionalAuth, validateQuery(z.object({
    name: z.string().optional(),
    type: z.enum(['automatic', 'onetime']).optional(),
    started: z.string().optional(),
    ended: z.string().optional(),
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
        const { name, type, started, ended, page = '1', limit = '10' } = req.validatedQuery;
        
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
        
        const where = {};
        if (name) where.name = { contains: name };
        if (type) where.type = type;
        
        const isManagerOrAbove = req.user && ['manager', 'superuser'].includes(req.user.role);
        
        // Managers see all promotions unless explicitly filtered by time
        if (isManagerOrAbove) {
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
            include: req.user ? {
                userPromotions: {
                    where: { userId: req.user.id }
                }
            } : false
        });
        
        // Filter out used one-time promotions for regular users
        if (!isManagerOrAbove && req.user) {
            promotions = promotions.filter(p => {
                if (p.type === 'automatic') return true;
                const userPromo = p.userPromotions?.find(up => up.userId === req.user.id);
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
        
        // For managers, use database count (total matching promotions)
        // For regular users, use filtered count (after removing used promotions)
        const finalCount = isManagerOrAbove ? dbCount : results.length;
        
        res.json({ count: finalCount, results });
    } catch (error) { next(error); }
});

// GET /promotions/:promotionId - Get promotion details
app.get('/promotions/:promotionId', optionalAuth, async (req, res, next) => {
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
app.patch('/promotions/:promotionId', requireRole('manager'), async (req, res, next) => {
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
        if (updates.minSpending !== undefined && updates.minSpending !== null) finalUpdates.minSpending = updates.minSpending;
        if (updates.rate !== undefined && updates.rate !== null) finalUpdates.rate = updates.rate;
        if (updates.points !== undefined && updates.points !== null) finalUpdates.points = updates.points;
        
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
app.delete('/promotions/:promotionId', requireRole('manager'), async (req, res, next) => {
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

// ============================================
// ANALYTICS ROUTES
// ============================================

const analyticsRoutes = require('./routes/analytics');

// GET /analytics/cashier/stats - Cashier analytics
app.get('/analytics/cashier/stats', requireRole('cashier'), analyticsRoutes.getCashierStats);

// GET /analytics/overview - System overview (Manager)
app.get('/analytics/overview', requireRole('manager'), analyticsRoutes.getOverview);

// GET /analytics/users - User analytics (Manager)
app.get('/analytics/users', requireRole('manager'), analyticsRoutes.getUserAnalytics);

// GET /analytics/transactions - Transaction analytics (Manager)
app.get('/analytics/transactions', requireRole('manager'), analyticsRoutes.getTransactionAnalytics);

// GET /analytics/events - Event analytics (Manager)
app.get('/analytics/events', requireRole('manager'), analyticsRoutes.getEventAnalytics);

// GET /analytics/promotions - Promotion analytics (Manager)
app.get('/analytics/promotions', requireRole('manager'), analyticsRoutes.getPromotionAnalytics);

// GET /analytics/financial - Financial insights (Manager)
app.get('/analytics/financial', requireRole('manager'), analyticsRoutes.getFinancialAnalytics);

// ============================================
// ERROR HANDLERS
// ============================================

app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (err.status) {
        return res.status(err.status).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ============================================
// START SERVER
// ============================================

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

server.on('error', (err) => {
    console.error(`cannot start server: ${err.message}`);
    process.exit(1);
});