const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { prisma } = require('../index');

const createTestUser = async (role = 'regular', utorid = null) => {
    const uniqueSuffix = Date.now().toString() + Math.floor(Math.random() * 1000);
    const actualUtorid = utorid || `u${uniqueSuffix.substring(uniqueSuffix.length - 7)}`;
    const email = `${actualUtorid}@mail.utoronto.ca`;
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            utorid: actualUtorid,
            name: `Test User ${actualUtorid}`,
            email,
            password: hashedPassword,
            role,
            verified: true
        }
    });

    const token = jwt.sign(
        { id: user.id, utorid: user.utorid, role: user.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );

    return { user, token, password };
};

const clearDatabase = async () => {
    try {
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
        
        const tablenames = await prisma.$queryRaw`
            SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations';
        `;

        for (const { name } of tablenames) {
            await prisma.$executeRawUnsafe(`DELETE FROM "${name}";`);
        }
        
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    } catch (error) {
        console.error('Error clearing database:', error);
    }
};

module.exports = {
    createTestUser,
    clearDatabase
};
