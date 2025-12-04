#!/usr/bin/env node
'use strict';

// Load environment variables
try { require('dotenv').config(); } catch (e) {}

const express = require("express");
const cors = require("cors");
const path = require("path");
const { PrismaClient } = require('@prisma/client');

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
// ROUTES
// ============================================

// Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const eventRoutes = require('./routes/events');
const promotionRoutes = require('./routes/promotions');
const analyticsRoutes = require('./routes/analytics');
const savedFiltersRoutes = require('./routes/savedFilters');

// Mount routes in order (order matters for Express routing)
// More specific routes should come before more general ones
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/transactions', transactionRoutes);
app.use('/events', eventRoutes);
app.use('/promotions', promotionRoutes);

// Analytics routes (already modularized)
const { requireRole } = require('./middleware');
app.get('/analytics/cashier/stats', requireRole('cashier'), analyticsRoutes.getCashierStats);
app.get('/analytics/overview', requireRole('manager'), analyticsRoutes.getOverview);
app.get('/analytics/users', requireRole('manager'), analyticsRoutes.getUserAnalytics);
app.get('/analytics/transactions', requireRole('manager'), analyticsRoutes.getTransactionAnalytics);
app.get('/analytics/events', requireRole('manager'), analyticsRoutes.getEventAnalytics);
app.get('/analytics/promotions', requireRole('manager'), analyticsRoutes.getPromotionAnalytics);
app.get('/analytics/financial', requireRole('manager'), analyticsRoutes.getFinancialAnalytics);

// Saved filters routes (already modularized)
app.get('/saved-filters', requireRole('regular'), savedFiltersRoutes.getSavedFilters);
app.post('/saved-filters', requireRole('regular'), savedFiltersRoutes.createSavedFilter);
app.delete('/saved-filters/:id', requireRole('regular'), savedFiltersRoutes.deleteSavedFilter);

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

// Export app for testing
module.exports = { app, prisma };

if (require.main === module) {
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

    const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });

    server.on('error', (err) => {
        console.error(`cannot start server: ${err.message}`);
        process.exit(1);
    });
}
