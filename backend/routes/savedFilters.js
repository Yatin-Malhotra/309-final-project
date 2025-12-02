const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /saved-filters
const getSavedFilters = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page } = req.query;
        
        const where = { userId };
        if (page) {
            where.page = page;
        }

        const savedFilters = await prisma.savedFilter.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json(savedFilters);
    } catch (error) {
        next(error);
    }
};

// POST /saved-filters
const createSavedFilter = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { name, page, filters } = req.body;

        if (!name || !page || !filters) {
            return res.status(400).json({ error: 'Name, page, and filters are required' });
        }

        const savedFilter = await prisma.savedFilter.create({
            data: {
                userId,
                name,
                page,
                filters: typeof filters === 'string' ? filters : JSON.stringify(filters)
            }
        });

        res.status(201).json(savedFilter);
    } catch (error) {
        next(error);
    }
};

// DELETE /saved-filters/:id
const deleteSavedFilter = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        // Check ownership
        const savedFilter = await prisma.savedFilter.findUnique({
            where: { id: parseInt(id) }
        });

        if (!savedFilter) {
            return res.status(404).json({ error: 'Saved filter not found' });
        }

        if (savedFilter.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this filter' });
        }

        await prisma.savedFilter.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Saved filter deleted successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSavedFilters,
    createSavedFilter,
    deleteSavedFilter
};

