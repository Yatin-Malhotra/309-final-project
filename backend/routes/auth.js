const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { prisma, jwtUtils, emailUtils, schemas, validate } = require('../middleware');

// POST /auth/tokens - Login
router.post('/tokens', validate(schemas.login), async (req, res, next) => {
    try {
        const { utorid, password } = req.validatedData;
        const user = await prisma.user.findUnique({ where: { utorid } });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const { token, expiresAt } = jwtUtils.generateToken(user);
        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
        
        // Set httpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.json({ token, expiresAt });
    } catch (error) { next(error); }
});

// POST /auth/logout - Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// POST /auth/resets/:resetToken - Reset password
router.post('/resets/:resetToken', validate(schemas.resetPassword), async (req, res, next) => {
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
router.post('/resets', validate(schemas.resetRequest), async (req, res, next) => {
    try {
        const { utorid } = req.validatedData;
        const user = await prisma.user.findUnique({ where: { utorid } });
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(202).json({ message: 'If the user exists, a password reset email has been sent.' });
        }
        const resetToken = uuidv4();
        const expiresAt = new Date(Date.now() + 3600000);
        
        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry: expiresAt }
        });
        
        // Send email with reset link
        try {
            await emailUtils.sendPasswordResetEmail(user.email, resetToken);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // Still return success to user for security (don't reveal email issues)
        }
        
        // Don't return resetToken in response for security
        res.status(202).json({ message: 'If the user exists, a password reset email has been sent.' });
    } catch (error) { next(error); }
});

module.exports = router;

