/*
 * Complete this script so that it is able to add a superuser to the database
 * Usage example: 
 *   node prisma/createsu.js clive123 clive.su@mail.utoronto.ca SuperUser123!
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createSuperuser() {
    try {
        // Validate command line arguments
        const args = process.argv.slice(2);
        
        if (args.length !== 3) {
            console.error('Usage: node prisma/createsu.js <utorid> <email> <password>');
            process.exit(1);
        }

        const [utorid, email, password] = args;

        // Validate utorid (7-8 alphanumeric characters)
        if (!/^[a-zA-Z0-9]{7,8}$/.test(utorid)) {
            console.error('Error: utorid must be 7-8 alphanumeric characters');
            process.exit(1);
        }

        // Validate email (must be UofT email)
        const emailRegex = /^[^\s@]+@(mail\.)?utoronto\.ca$/i;
        if (!emailRegex.test(email)) {
            console.error('Error: email must be a valid University of Toronto email');
            process.exit(1);
        }

        // Validate password (8-20 characters, at least one uppercase, one lowercase, one number, one special character)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;
        if (!passwordRegex.test(password)) {
            console.error('Error: password must be 8-20 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character');
            process.exit(1);
        }

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { utorid: utorid },
                    { email: email }
                ]
            }
        });

        if (existingUser) {
            console.error('Error: user with this utorid or email already exists');
            process.exit(1);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create superuser
        const superuser = await prisma.user.create({
            data: {
                utorid: utorid,
                name: utorid, // Use utorid as default name
                email: email,
                password: hashedPassword,
                role: 'superuser',
                verified: true, // Superuser is pre-verified
                points: 0
            }
        });

        console.log(`Superuser created successfully:`);
        console.log(`  ID: ${superuser.id}`);
        console.log(`  UTORid: ${superuser.utorid}`);
        console.log(`  Email: ${superuser.email}`);
        console.log(`  Role: ${superuser.role}`);

    } catch (error) {
        console.error('Error creating superuser:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createSuperuser();