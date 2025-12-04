// Analytics routes for dashboard metrics
const { prisma } = require('../middleware');

// Helper function to get date ranges
const getDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return { today, weekAgo, monthAgo, thirtyDaysAgo, now };
};

// GET /analytics/cashier/stats - Cashier analytics
const getCashierStats = async (req, res, next) => {
    try {
        const cashierId = req.user.id;
        const { today, weekAgo, monthAgo } = getDateRanges();

        // Transactions created by this cashier
        const [transactionsToday, transactionsWeek, transactionsMonth, allTransactions] = await Promise.all([
            prisma.transaction.count({
                where: { createdBy: cashierId, createdAt: { gte: today } }
            }),
            prisma.transaction.count({
                where: { createdBy: cashierId, createdAt: { gte: weekAgo } }
            }),
            prisma.transaction.count({
                where: { createdBy: cashierId, createdAt: { gte: monthAgo } }
            }),
            prisma.transaction.findMany({
                where: { createdBy: cashierId },
                select: { amount: true, type: true, createdAt: true, processed: true }
            })
        ]);

        // Redemptions processed
        const [redemptionsToday, redemptionsWeek, redemptionsMonth] = await Promise.all([
            prisma.transaction.count({
                where: {
                    type: 'redemption',
                    processedBy: cashierId,
                    createdAt: { gte: today }
                }
            }),
            prisma.transaction.count({
                where: {
                    type: 'redemption',
                    processedBy: cashierId,
                    createdAt: { gte: weekAgo }
                }
            }),
            prisma.transaction.count({
                where: {
                    type: 'redemption',
                    processedBy: cashierId,
                    createdAt: { gte: monthAgo }
                }
            })
        ]);

        // Users created by this cashier
        const [usersToday, usersWeek, usersMonth] = await Promise.all([
            prisma.user.count({
                where: { createdAt: { gte: today } }
                // Note: We don't track who created users, so this is all users
            }),
            prisma.user.count({
                where: { createdAt: { gte: weekAgo } }
            }),
            prisma.user.count({
                where: { createdAt: { gte: monthAgo } }
            })
        ]);

        // Calculate average transaction value
        const avgTransactionValue = allTransactions.length > 0
            ? allTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / allTransactions.length
            : 0;

        // Total points issued
        const pointsIssuedToday = allTransactions
            .filter(tx => tx.createdAt >= today && ['purchase', 'event', 'adjustment'].includes(tx.type))
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const pointsIssuedWeek = allTransactions
            .filter(tx => tx.createdAt >= weekAgo && ['purchase', 'event', 'adjustment'].includes(tx.type))
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const pointsIssuedMonth = allTransactions
            .filter(tx => tx.createdAt >= monthAgo && ['purchase', 'event', 'adjustment'].includes(tx.type))
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        // Pending redemptions count
        const pendingRedemptions = await prisma.transaction.count({
            where: { type: 'redemption', processed: false }
        });

        // Processing rate
        const totalRedemptions = await prisma.transaction.count({
            where: { type: 'redemption' }
        });
        const processingRate = totalRedemptions > 0
            ? ((totalRedemptions - pendingRedemptions) / totalRedemptions * 100).toFixed(1)
            : 0;

        // Transaction types breakdown (only purchase and redemption for cashier)
        const typeBreakdown = {
            purchase: allTransactions.filter(tx => tx.type === 'purchase').length,
            redemption: allTransactions.filter(tx => tx.type === 'redemption').length
        };

        // Daily transaction volume (last 7 days)
        const dailyVolume = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const count = allTransactions.filter(tx => {
                const txDate = new Date(tx.createdAt);
                return txDate >= date && txDate < nextDate;
            }).length;
            
            dailyVolume.push({
                date: date.toISOString().split('T')[0],
                count
            });
        }

        // Top 5 most active users (by transaction count created by this cashier)
        const userTransactionCounts = {};
        allTransactions.forEach(tx => {
            // We need to get userId from transactions
            // For now, we'll get it from the transaction relation
        });
        
        const topUsers = await prisma.transaction.groupBy({
            by: ['userId'],
            where: { createdBy: cashierId },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        });

        const topUsersWithDetails = await Promise.all(
            topUsers.map(async (item) => {
                const user = await prisma.user.findUnique({
                    where: { id: item.userId },
                    select: { id: true, name: true, utorid: true }
                });
                return {
                    userId: item.userId,
                    name: user?.name || 'Unknown',
                    utorid: user?.utorid || 'Unknown',
                    transactionCount: item._count.id
                };
            })
        );

        res.json({
            transactions: {
                today: transactionsToday,
                week: transactionsWeek,
                month: transactionsMonth
            },
            redemptions: {
                today: redemptionsToday,
                week: redemptionsWeek,
                month: redemptionsMonth
            },
            usersCreated: {
                today: usersToday,
                week: usersWeek,
                month: usersMonth
            },
            averageTransactionValue: Math.round(avgTransactionValue),
            pointsIssued: {
                today: pointsIssuedToday,
                week: pointsIssuedWeek,
                month: pointsIssuedMonth
            },
            processingRate: parseFloat(processingRate),
            pendingRedemptions,
            typeBreakdown,
            dailyVolume,
            topUsers: topUsersWithDetails
        });
    } catch (error) {
        next(error);
    }
};

// GET /analytics/overview - System-wide overview (Manager)
const getOverview = async (req, res, next) => {
    try {
        const { today, weekAgo, monthAgo, thirtyDaysAgo } = getDateRanges();

        // Total points in circulation
        const totalPoints = await prisma.user.aggregate({
            _sum: { points: true }
        });

        // Points earned vs spent
        const [pointsEarnedWeek, pointsEarnedMonth] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    type: { in: ['purchase', 'event', 'adjustment'] },
                    createdAt: { gte: weekAgo }
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    type: { in: ['purchase', 'event', 'adjustment'] },
                    createdAt: { gte: monthAgo }
                },
                _sum: { amount: true }
            })
        ]);

        const [redemptionsWeek, redemptionsMonth, transfersWeek, transfersMonth] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    type: 'redemption',
                    createdAt: { gte: weekAgo }
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    type: 'redemption',
                    createdAt: { gte: monthAgo }
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    type: 'transfer',
                    amount: { lt: 0 },
                    createdAt: { gte: weekAgo }
                },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    type: 'transfer',
                    amount: { lt: 0 },
                    createdAt: { gte: monthAgo }
                },
                _sum: { amount: true }
            })
        ]);
        
        const pointsSpentWeek = {
            _sum: {
                amount: (redemptionsWeek._sum.amount || 0) + (transfersWeek._sum.amount || 0)
            }
        };
        const pointsSpentMonth = {
            _sum: {
                amount: (redemptionsMonth._sum.amount || 0) + (transfersMonth._sum.amount || 0)
            }
        };

        // User growth
        const [newUsersWeek, newUsersMonth, totalUsers] = await Promise.all([
            prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
            prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
            prisma.user.count()
        ]);

        // Transaction volume
        const [transactionsToday, transactionsWeek, transactionsMonth] = await Promise.all([
            prisma.transaction.count({ where: { createdAt: { gte: today } } }),
            prisma.transaction.count({ where: { createdAt: { gte: weekAgo } } }),
            prisma.transaction.count({ where: { createdAt: { gte: monthAgo } } })
        ]);

        // User growth trend (last 14 days / 2 weeks)
        const userGrowthTrend = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const count = await prisma.user.count({
                where: {
                    createdAt: { gte: date, lt: nextDate }
                }
            });
            
            userGrowthTrend.push({
                date: date.toISOString().split('T')[0],
                count
            });
        }

        // Points distribution
        const pointsDistribution = {
            '0-100': await prisma.user.count({ where: { points: { gte: 0, lt: 100 } } }),
            '100-500': await prisma.user.count({ where: { points: { gte: 100, lt: 500 } } }),
            '500-1000': await prisma.user.count({ where: { points: { gte: 500, lt: 1000 } } }),
            '1000+': await prisma.user.count({ where: { points: { gte: 1000 } } })
        };

        res.json({
            totalPointsInCirculation: totalPoints._sum.points || 0,
            pointsFlow: {
                week: {
                    earned: Math.abs(pointsEarnedWeek._sum.amount || 0),
                    spent: Math.abs(pointsSpentWeek._sum.amount || 0),
                    net: Math.abs(pointsEarnedWeek._sum.amount || 0) - Math.abs(pointsSpentWeek._sum.amount || 0)
                },
                month: {
                    earned: Math.abs(pointsEarnedMonth._sum.amount || 0),
                    spent: Math.abs(pointsSpentMonth._sum.amount || 0),
                    net: Math.abs(pointsEarnedMonth._sum.amount || 0) - Math.abs(pointsSpentMonth._sum.amount || 0)
                }
            },
            userGrowth: {
                week: newUsersWeek,
                month: newUsersMonth,
                total: totalUsers
            },
            transactionVolume: {
                today: transactionsToday,
                week: transactionsWeek,
                month: transactionsMonth
            },
            userGrowthTrend,
            pointsDistribution
        });
    } catch (error) {
        next(error);
    }
};

// GET /analytics/users - User analytics (Manager)
const getUserAnalytics = async (req, res, next) => {
    try {
        const { today, weekAgo, monthAgo } = getDateRanges();

        const [newUsersWeek, newUsersMonth, verifiedUsers, unverifiedUsers, suspiciousUsers, totalUsers] = await Promise.all([
            prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
            prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
            prisma.user.count({ where: { verified: true } }),
            prisma.user.count({ where: { verified: false } }),
            prisma.user.count({ where: { suspicious: true } }),
            prisma.user.count()
        ]);

        // Top 10 users by points balance
        const topUsersByPoints = await prisma.user.findMany({
            orderBy: { points: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                utorid: true,
                points: true,
                verified: true
            }
        });

        // Top 10 users by transaction count
        const topUsersByTxCount = await prisma.transaction.groupBy({
            by: ['userId'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10
        });

        const topUsersByTxWithDetails = await Promise.all(
            topUsersByTxCount.map(async (item) => {
                const user = await prisma.user.findUnique({
                    where: { id: item.userId },
                    select: { id: true, name: true, utorid: true, points: true }
                });
                return {
                    userId: item.userId,
                    name: user?.name || 'Unknown',
                    utorid: user?.utorid || 'Unknown',
                    points: user?.points || 0,
                    transactionCount: item._count.id
                };
            })
        );

        res.json({
            newUsers: {
                week: newUsersWeek,
                month: newUsersMonth
            },
            verified: {
                verified: verifiedUsers,
                unverified: unverifiedUsers
            },
            suspicious: suspiciousUsers,
            total: totalUsers,
            topUsersByPoints,
            topUsersByTransactionCount: topUsersByTxWithDetails
        });
    } catch (error) {
        next(error);
    }
};

// GET /analytics/transactions - Transaction analytics (Manager)
const getTransactionAnalytics = async (req, res, next) => {
    try {
        const { today, weekAgo, monthAgo, thirtyDaysAgo } = getDateRanges();

        // Transaction volume
        const [volumeToday, volumeWeek, volumeMonth] = await Promise.all([
            prisma.transaction.count({ where: { createdAt: { gte: today } } }),
            prisma.transaction.count({ where: { createdAt: { gte: weekAgo } } }),
            prisma.transaction.count({ where: { createdAt: { gte: monthAgo } } })
        ]);

        // Transaction types breakdown
        const typeBreakdown = {
            purchase: await prisma.transaction.count({ where: { type: 'purchase' } }),
            redemption: await prisma.transaction.count({ where: { type: 'redemption' } }),
            adjustment: await prisma.transaction.count({ where: { type: 'adjustment' } }),
            event: await prisma.transaction.count({ where: { type: 'event' } }),
            transfer: await prisma.transaction.count({ where: { type: 'transfer' } })
        };

        // Suspicious transactions
        const suspiciousCount = await prisma.transaction.count({
            where: { suspicious: true }
        });

        // Average transaction value
        const avgResult = await prisma.transaction.aggregate({
            _avg: { amount: true }
        });

        // Transaction volume trend (last 14 days / 2 weeks)
        const volumeTrend = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const count = await prisma.transaction.count({
                where: {
                    createdAt: { gte: date, lt: nextDate }
                }
            });
            
            volumeTrend.push({
                date: date.toISOString().split('T')[0],
                count
            });
        }

        // Points flow chart (earned vs spent over last 14 days / 2 weeks)
        const pointsFlow = [];
        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const [earned, redemptions, transfers] = await Promise.all([
                prisma.transaction.aggregate({
                    where: {
                        type: { in: ['purchase', 'event', 'adjustment'] },
                        createdAt: { gte: date, lt: nextDate }
                    },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: {
                        type: 'redemption',
                        createdAt: { gte: date, lt: nextDate }
                    },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: {
                        type: 'transfer',
                        amount: { lt: 0 },
                        createdAt: { gte: date, lt: nextDate }
                    },
                    _sum: { amount: true }
                })
            ]);
            
            const spent = (redemptions._sum.amount || 0) + (transfers._sum.amount || 0);
            
            pointsFlow.push({
                date: date.toISOString().split('T')[0],
                earned: Math.abs(earned._sum.amount || 0),
                spent: Math.abs(spent)
            });
        }

        // Total points volume
        const totalPointsVolume = await prisma.transaction.aggregate({
            _sum: { amount: true }
        });

        res.json({
            volume: {
                today: volumeToday,
                week: volumeWeek,
                month: volumeMonth
            },
            typeBreakdown,
            suspicious: suspiciousCount,
            averageTransactionValue: Math.round(Math.abs(avgResult._avg.amount || 0)),
            volumeTrend,
            pointsFlow,
            totalPointsVolume: Math.abs(totalPointsVolume._sum.amount || 0)
        });
    } catch (error) {
        next(error);
    }
};

// GET /analytics/events - Event analytics (Manager)
const getEventAnalytics = async (req, res, next) => {
    try {
        const now = new Date();

        // Total events
        const [totalEvents, publishedEvents, unpublishedEvents] = await Promise.all([
            prisma.event.count(),
            prisma.event.count({ where: { published: true } }),
            prisma.event.count({ where: { published: false } })
        ]);

        // Upcoming events
        const upcomingEvents = await prisma.event.count({
            where: { startTime: { gte: now } }
        });

        // Event attendance rates
        const events = await prisma.event.findMany({
            include: {
                guests: true
            }
        });

        const attendanceData = events.map(event => ({
            eventId: event.id,
            name: event.name,
            capacity: event.capacity,
            guestsRegistered: event.guests.length,
            attendanceRate: event.capacity ? (event.guests.length / event.capacity * 100).toFixed(1) : null
        }));

        // Most popular events (top 5 by guest count)
        const popularEvents = events
            .sort((a, b) => b.guests.length - a.guests.length)
            .slice(0, 5)
            .map(event => ({
                eventId: event.id,
                name: event.name,
                guestCount: event.guests.length,
                capacity: event.capacity
            }));

        // Total points allocated to events
        const totalPointsAllocated = events.reduce((sum, event) => sum + event.pointsAllocated, 0);

        // Points remaining in events
        const totalPointsRemaining = events.reduce((sum, event) => sum + event.pointsRemain, 0);

        res.json({
            total: totalEvents,
            published: publishedEvents,
            unpublished: unpublishedEvents,
            upcoming: upcomingEvents,
            attendanceData,
            popularEvents,
            totalPointsAllocated,
            totalPointsRemaining
        });
    } catch (error) {
        next(error);
    }
};

// GET /analytics/promotions - Promotion analytics (Manager)
const getPromotionAnalytics = async (req, res, next) => {
    try {
        const now = new Date();

        // Active promotions
        const activePromotions = await prisma.promotion.count({
            where: {
                startTime: { lte: now },
                endTime: { gte: now }
            }
        });

        // All promotions with usage counts
        const promotions = await prisma.promotion.findMany({
            include: {
                transactionPromotions: true,
                userPromotions: {
                    where: { used: true }
                }
            }
        });

        const promotionUsage = promotions.map(promo => ({
            promotionId: promo.id,
            name: promo.name,
            type: promo.type,
            usageCount: promo.transactionPromotions.length + promo.userPromotions.length
        }));

        // Most effective promotions (top 5 by usage)
        const effectivePromotions = promotionUsage
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 5);

        // Promotion type breakdown
        const typeBreakdown = {
            automatic: promotions.filter(p => p.type === 'automatic').length,
            onetime: promotions.filter(p => p.type === 'onetime').length
        };

        // Total points awarded via promotions
        // This is calculated from transactions that have promotions linked
        const transactionsWithPromotions = await prisma.transactionPromotion.findMany({
            include: {
                transaction: true
            }
        });

        const totalPointsAwarded = transactionsWithPromotions.reduce((sum, tp) => {
            // Only count positive amounts (earned points)
            if (tp.transaction.amount > 0) {
                return sum + tp.transaction.amount;
            }
            return sum;
        }, 0);

        res.json({
            active: activePromotions,
            total: promotions.length,
            promotionUsage,
            effectivePromotions,
            typeBreakdown,
            totalPointsAwarded
        });
    } catch (error) {
        next(error);
    }
};

// GET /analytics/financial - Financial insights (Manager)
const getFinancialAnalytics = async (req, res, next) => {
    try {
        const { weekAgo, monthAgo } = getDateRanges();

        // Total money spent (sum of `spent` field in purchase transactions)
        const [totalSpentWeek, totalSpentMonth, allPurchases] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    type: 'purchase',
                    createdAt: { gte: weekAgo }
                },
                _sum: { spent: true }
            }),
            prisma.transaction.aggregate({
                where: {
                    type: 'purchase',
                    createdAt: { gte: monthAgo }
                },
                _sum: { spent: true }
            }),
            prisma.transaction.findMany({
                where: { type: 'purchase' },
                select: { spent: true, amount: true }
            })
        ]);

        // Average spending per transaction
        const avgSpending = allPurchases.length > 0
            ? allPurchases.reduce((sum, tx) => sum + (tx.spent || 0), 0) / allPurchases.length
            : 0;

        // Points per dollar ratio
        const totalSpent = allPurchases.reduce((sum, tx) => sum + (tx.spent || 0), 0);
        const totalPoints = allPurchases.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const pointsPerDollar = totalSpent > 0 ? (totalPoints / totalSpent).toFixed(2) : 0;

        res.json({
            totalSpent: {
                week: totalSpentWeek._sum.spent || 0,
                month: totalSpentMonth._sum.spent || 0,
                allTime: totalSpent
            },
            averageSpendingPerTransaction: Math.round(avgSpending * 100) / 100,
            pointsPerDollarRatio: parseFloat(pointsPerDollar)
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCashierStats,
    getOverview,
    getUserAnalytics,
    getTransactionAnalytics,
    getEventAnalytics,
    getPromotionAnalytics,
    getFinancialAnalytics
};

