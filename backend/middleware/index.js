const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET not set in environment variables');
    process.exit(1);
}

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

// EmailJS Configuration
const isEmailConfigured = () => {
    return !!(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_PRIVATE_KEY);
};

const isWelcomeEmailConfigured = () => {
    return !!(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_WELCOME_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_PRIVATE_KEY);
};

const emailjs = require('@emailjs/nodejs');

const emailUtils = {
    async sendPasswordResetEmail(userEmail, resetToken) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${frontendUrl}/reset-password/${resetToken}`;
        
        if (!isEmailConfigured()) {
            console.log('\n========================================');
            console.log('PASSWORD RESET LINK (Development Mode)');
            console.log('========================================');
            console.log(`Email would be sent to: ${userEmail}`);
            console.log(`Reset Link: ${resetLink}`);
            console.log('========================================\n');
            return { messageId: 'console-log', resetLink };
        }
        
        try {
            const templateParams = {
                email: userEmail,
                link: resetLink,
            };
            
            const response = await emailjs.send(
                process.env.EMAILJS_SERVICE_ID,
                process.env.EMAILJS_TEMPLATE_ID,
                templateParams,
                {
                    publicKey: process.env.EMAILJS_PUBLIC_KEY,
                    privateKey: process.env.EMAILJS_PRIVATE_KEY,
                }
            );
            
            console.log('Password reset email sent via EmailJS:', response.text);
            return { messageId: response.text, resetLink };
        } catch (error) {
            console.error('Error sending password reset email via EmailJS:', error);
            throw error;
        }
    },
    async sendWelcomeEmail(userName, userEmail, resetToken) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${frontendUrl}/reset-password/${resetToken}`;
        
        if (!isWelcomeEmailConfigured()) {
            console.log('\n========================================');
            console.log('WELCOME EMAIL (Development Mode)');
            console.log('========================================');
            console.log(`Email would be sent to: ${userEmail}`);
            console.log(`Name: ${userName}`);
            console.log(`Reset Link: ${resetLink}`);
            console.log('========================================\n');
            return { messageId: 'console-log', resetLink };
        }
        
        try {
            const templateParams = {
                name: userName,
                email: userEmail,
                url: resetLink,
            };
            
            const response = await emailjs.send(
                process.env.EMAILJS_SERVICE_ID,
                process.env.EMAILJS_WELCOME_TEMPLATE_ID,
                templateParams,
                {
                    publicKey: process.env.EMAILJS_PUBLIC_KEY,
                    privateKey: process.env.EMAILJS_PRIVATE_KEY,
                }
            );
            
            console.log('Welcome email sent via EmailJS:', response.text);
            return { messageId: response.text, resetLink };
        } catch (error) {
            console.error('Error sending welcome email via EmailJS:', error);
            throw error;
        }
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
                    return val;
                }
                if (typeof val === 'number') {
                    if (Number.isFinite(val) && Number.isInteger(val)) {
                        return val;
                    }
                    return Math.floor(val);
                }
                return val;
            },
            z.number().int().optional()
        ),
        promotionIds: z.preprocess(
            (val) => {
                if (val === null || val === undefined) return undefined;
                if (Array.isArray(val)) return val;
                return val;
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
                    return val;
                }
                if (typeof val === 'number') {
                    if (Number.isFinite(val) && val > 0) {
                        const intVal = Math.floor(val);
                        if (intVal === val) return intVal;
                    }
                    return val;
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
                    if (num === 0) return undefined;
                    return Number.isFinite(num) ? num : val;
                }
                if (val === 0) return undefined;
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
                    if (Number.isFinite(num) && num >= 0) {
                        const intVal = Math.floor(num);
                        if (intVal === num) return intVal;
                    }
                    return val;
                }
                if (typeof val === 'number') {
                    if (Number.isFinite(val) && val >= 0) {
                        const intVal = Math.floor(val);
                        if (intVal === val) return intVal;
                    }
                    return val;
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
            (val) => {
                if (val === undefined) return undefined;
                if (val === null || val === '') return null;
                if (val === 0 || val === '0') return null;
                if (typeof val === 'string') {
                    const num = Number(val);
                    if (num === 0) return null;
                    return Number.isFinite(num) ? num : val;
                }
                return val;
            },
            z.number().positive().nullable().optional()
        ),
        points: z.preprocess(
            (val) => {
                if (val === undefined) return undefined;
                if (val === null || val === '') return null;
                if (val === 0 || val === '0') return null;
                if (typeof val === 'string') {
                    const num = Number(val);
                    if (num === 0) return null;
                    return Number.isFinite(num) ? num : val;
                }
                return val;
            },
            z.number().positive().int().nullable().optional()
        )
    })
};

// Multer for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/avatars');
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

// Middleware functions
const authenticate = (req, res, next) => {
    let token = req.cookies?.token || jwtUtils.extractToken(req.headers.authorization);
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
        let token = req.cookies?.token;
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
    let token = req.cookies?.token;
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

// Helper functions
const normalizeAvatarUrl = (avatarUrl) => {
    return avatarUrl || '/uploads/avatars/default.png';
};

// Helper: Calculate points for purchase
const calculatePurchasePoints = async (spent, promotionIds = [], userId) => {
    let basePoints = spent / 0.25;
    let totalPoints = basePoints;
    
    if (promotionIds.length > 0) {
        const promotions = await prisma.promotion.findMany({
            where: { 
                id: { in: promotionIds }
            }
        });
        
        if (promotions.length !== promotionIds.length) {
            const foundIds = promotions.map(p => p.id);
            const missingIds = promotionIds.filter(id => !foundIds.includes(id));
            throw new Error(`Invalid promotion ID: ${missingIds[0]}`);
        }
        
        for (const promo of promotions) {
            const now = new Date();
            
            if (promo.startTime > now || promo.endTime < now) {
                throw new Error(`Promotion ${promo.id} not active`);
            }
            
            if (promo.type === 'onetime' || promo.type === 'one-time') {
                const userPromo = await prisma.userPromotion.findUnique({
                    where: { userId_promotionId: { userId, promotionId: promo.id } }
                });
                if (userPromo && userPromo.used) {
                    throw new Error(`Promotion ${promo.id} already used`);
                }
            }
            
            if (promo.minSpending && spent < promo.minSpending) {
                throw new Error(`Minimum spending ${promo.minSpending} not met for promotion ${promo.id}`);
            }
            
            if (promo.rate) totalPoints += spent * promo.rate * 100;
            if (promo.points) totalPoints += promo.points;
        }
    }
    
    return totalPoints;
};

// Helper: Check if user is organizer
const isOrganizer = async (eventId, userId) => {
    const organizer = await prisma.eventOrganizer.findUnique({
        where: { eventId_userId: { eventId, userId } }
    });
    return !!organizer;
};

module.exports = {
    prisma,
    jwtUtils,
    emailUtils,
    schemas,
    upload,
    authenticate,
    requireRole,
    optionalAuth,
    validate,
    validateQuery,
    coerceBoolean,
    normalizeAvatarUrl,
    calculatePurchasePoints,
    isOrganizer,
    passwordRegex,
    utoridRegex,
    uoftEmailRegex,
    dateRegex
};

