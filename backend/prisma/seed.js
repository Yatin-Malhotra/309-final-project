/*
 * Database seeding script for CSSU Rewards System
 * This script populates the database with:
 * - At least 10 users (1 cashier, 1 manager, 1 superuser, 7+ regular users)
 * - At least 30 transactions (at least 2 of each type)
 * - At least 15 events and 15 promotions
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting database seeding...');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    await prisma.transactionPromotion.deleteMany();
    await prisma.userPromotion.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.eventGuest.deleteMany();
    await prisma.eventOrganizer.deleteMany();
    await prisma.event.deleteMany();
    await prisma.promotion.deleteMany();
    await prisma.user.deleteMany();

    // Hash password for all users (using a simple password for testing)
    const defaultPassword = await bcrypt.hash('password', 10);

    // Create users
    console.log('Creating users...');
    const users = await Promise.all([
        // Superuser
        prisma.user.create({
            data: {
                utorid: 'super01',
                name: 'Super Admin',
                email: 'super.admin@mail.utoronto.ca',
                password: defaultPassword,
                role: 'superuser',
                verified: true,
                points: 1000,
                birthday: '2003-01-15'
            }
        }),
        // Manager
        prisma.user.create({
            data: {
                utorid: 'manager1',
                name: 'Manager One',
                email: 'manager.one@mail.utoronto.ca',
                password: defaultPassword,
                role: 'manager',
                verified: true,
                points: 500,
                birthday: '2004-03-20'
            }
        }),
        // Cashier
        prisma.user.create({
            data: {
                utorid: 'cashier1',
                name: 'Cashier One',
                email: 'cashier.one@mail.utoronto.ca',
                password: defaultPassword,
                role: 'cashier',
                verified: true,
                points: 200,
                birthday: '2005-05-10'
            }
        }),
        // Regular users
        prisma.user.create({
            data: {
                utorid: 'user001',
                name: 'Krit Grover',
                email: 'krit.grover@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 350,
                birthday: '2006-07-22'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user002',
                name: 'Gursimar Singh',
                email: 'gursimar.singh@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 150,
                birthday: '2005-09-15'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user003',
                name: 'Yatin Malhotra',
                email: 'yatin.malhotra@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 750,
                birthday: '2004-11-30'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user004',
                name: 'Diana Prince',
                email: 'diana.prince@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: false,
                points: 50,
                birthday: '2007-01-05'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user005',
                name: 'Eve Wilson',
                email: 'eve.wilson@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 600,
                birthday: '2002-04-18'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user006',
                name: 'Frank Miller',
                email: 'frank.miller@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 250,
                suspicious: true,
                birthday: '2003-08-12'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user007',
                name: 'Grace Lee',
                email: 'grace.lee@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 400,
                birthday: '2006-12-25'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user008',
                name: 'Henry Davis',
                email: 'henry.davis@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 100,
                birthday: '2005-06-08'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user009',
                name: 'Ivy Chen',
                email: 'ivy.chen@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 800,
                birthday: '2002-02-14'
            }
        }),
        prisma.user.create({
            data: {
                utorid: 'user010',
                name: 'Jack Taylor',
                email: 'jack.taylor@mail.utoronto.ca',
                password: defaultPassword,
                role: 'regular',
                verified: true,
                points: 300,
                birthday: '2004-10-31'
            }
        })
    ]);

    console.log(`Created ${users.length} users`);

    // Extract specific users for easier reference
    const superuser = users[0];
    const manager = users[1];
    const cashier = users[2];
    const regularUsers = users.slice(3);

    // Create events
    console.log('Creating events...');
    const now = new Date();
    const events = await Promise.all([
        prisma.event.create({
            data: {
                name: 'CSSU Annual Hackathon',
                description: 'Join us for a 24-hour coding competition with prizes and networking opportunities.',
                location: 'Bahen Centre, Room 1200',
                startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                endTime: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
                capacity: 100,
                pointsAllocated: 5000,
                pointsRemain: 3500,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'Tech Talk: AI in Modern Development',
                description: 'Learn about the latest AI tools and techniques used in software development.',
                location: 'Sanford Fleming Building, Room 1101',
                startTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                endTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
                capacity: 50,
                pointsAllocated: 2000,
                pointsRemain: 1200,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU Game Night',
                description: 'Relax and play board games, video games, and socialize with fellow students.',
                location: 'CSSU Office, Sandford Fleming Building',
                startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // 4 hours later
                capacity: 30,
                pointsAllocated: 1500,
                pointsRemain: 800,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'Workshop: Building REST APIs',
                description: 'Hands-on workshop on designing and implementing RESTful APIs with best practices.',
                location: 'Bahen Centre, Room 2175',
                startTime: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
                endTime: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours later
                capacity: 40,
                pointsAllocated: 3000,
                pointsRemain: 3000,
                published: false
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU End of Semester Party',
                description: 'Celebrate the end of the semester with food, drinks, and music!',
                location: 'Hart House, Great Hall',
                startTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000), // 5 hours later
                capacity: 200,
                pointsAllocated: 10000,
                pointsRemain: 7500,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU Career Fair',
                description: 'Connect with top tech companies and explore internship and full-time opportunities.',
                location: 'Myhal Centre, Room 150',
                startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
                endTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000), // 6 hours later
                capacity: 150,
                pointsAllocated: 6000,
                pointsRemain: 4000,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'Web Development Bootcamp',
                description: 'Intensive 2-day bootcamp covering React, Node.js, and modern web development practices.',
                location: 'Bahen Centre, Room 1160',
                startTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
                endTime: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), // Next day + 8 hours
                capacity: 60,
                pointsAllocated: 4000,
                pointsRemain: 2500,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU Study Session',
                description: 'Collaborative study session with snacks and coffee provided. Bring your assignments!',
                location: 'CSSU Office, Sandford Fleming Building',
                startTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
                endTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000), // 5 hours later
                capacity: 25,
                pointsAllocated: 1000,
                pointsRemain: 600,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'Machine Learning Workshop',
                description: 'Introduction to machine learning concepts with hands-on Python exercises.',
                location: 'Bahen Centre, Room 2195',
                startTime: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000), // 18 days from now
                endTime: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // 4 hours later
                capacity: 45,
                pointsAllocated: 3500,
                pointsRemain: 2800,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU Movie Night',
                description: 'Watch a tech-themed movie with popcorn and drinks. Vote for the movie on our Discord!',
                location: 'Hart House, East Common Room',
                startTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
                endTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours later
                capacity: 80,
                pointsAllocated: 2500,
                pointsRemain: 1800,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'Database Design Seminar',
                description: 'Learn database normalization, indexing strategies, and query optimization techniques.',
                location: 'Sanford Fleming Building, Room 2101',
                startTime: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
                endTime: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours later
                capacity: 35,
                pointsAllocated: 2800,
                pointsRemain: 2800,
                published: false
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU Networking Mixer',
                description: 'Network with alumni, industry professionals, and fellow students over refreshments.',
                location: 'Myhal Centre, Atrium',
                startTime: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
                endTime: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours later
                capacity: 120,
                pointsAllocated: 4500,
                pointsRemain: 3200,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'Cybersecurity Workshop',
                description: 'Learn about common security vulnerabilities and how to protect your applications.',
                location: 'Bahen Centre, Room 1240',
                startTime: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000), // 16 days from now
                endTime: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours later
                capacity: 55,
                pointsAllocated: 3800,
                pointsRemain: 2400,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU Code Review Session',
                description: 'Get your code reviewed by experienced developers and learn best practices.',
                location: 'CSSU Office, Sandford Fleming Building',
                startTime: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
                endTime: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
                capacity: 20,
                pointsAllocated: 1200,
                pointsRemain: 800,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'Mobile App Development Talk',
                description: 'Explore React Native and Flutter for cross-platform mobile development.',
                location: 'Sanford Fleming Building, Room 1105',
                startTime: new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000), // 22 days from now
                endTime: new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
                capacity: 50,
                pointsAllocated: 2200,
                pointsRemain: 1500,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'CSSU Alumni Panel',
                description: 'Hear from successful CSSU alumni about their career journeys and advice for students.',
                location: 'Myhal Centre, Room 1210',
                startTime: new Date(now.getTime() + 19 * 24 * 60 * 60 * 1000), // 19 days from now
                endTime: new Date(now.getTime() + 19 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
                capacity: 70,
                pointsAllocated: 3200,
                pointsRemain: 2200,
                published: true
            }
        }),
        prisma.event.create({
            data: {
                name: 'DevOps Fundamentals Workshop',
                description: 'Introduction to CI/CD, Docker, and cloud deployment strategies.',
                location: 'Bahen Centre, Room 2190',
                startTime: new Date(now.getTime() + 27 * 24 * 60 * 60 * 1000), // 27 days from now
                endTime: new Date(now.getTime() + 27 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // 4 hours later
                capacity: 40,
                pointsAllocated: 3000,
                pointsRemain: 3000,
                published: false
            }
        })
    ]);

    console.log(`Created ${events.length} events`);

    // Create event organizers
    await Promise.all([
        prisma.eventOrganizer.create({
            data: {
                eventId: events[0].id,
                userId: superuser.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[0].id,
                userId: manager.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[1].id,
                userId: manager.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[2].id,
                userId: cashier.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[4].id,
                userId: superuser.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[5].id,
                userId: manager.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[6].id,
                userId: cashier.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[7].id,
                userId: manager.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[8].id,
                userId: superuser.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[9].id,
                userId: cashier.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[10].id,
                userId: manager.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[11].id,
                userId: superuser.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[12].id,
                userId: manager.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[13].id,
                userId: cashier.id
            }
        }),
        prisma.eventOrganizer.create({
            data: {
                eventId: events[14].id,
                userId: superuser.id
            }
        })
    ]);

    // Create event guests
    await Promise.all([
        prisma.eventGuest.create({
            data: {
                eventId: events[0].id,
                userId: regularUsers[0].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[0].id,
                userId: regularUsers[1].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[1].id,
                userId: regularUsers[2].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[2].id,
                userId: regularUsers[3].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[2].id,
                userId: regularUsers[4].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[5].id,
                userId: regularUsers[5].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[5].id,
                userId: regularUsers[6].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[6].id,
                userId: regularUsers[0].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[7].id,
                userId: regularUsers[1].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[8].id,
                userId: regularUsers[2].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[9].id,
                userId: regularUsers[3].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[10].id,
                userId: regularUsers[4].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[11].id,
                userId: regularUsers[5].id
            }
        }),
        prisma.eventGuest.create({
            data: {
                eventId: events[12].id,
                userId: regularUsers[6].id
            }
        })
    ]);

    // Create promotions
    console.log('Creating promotions...');
    const promotions = await Promise.all([
        prisma.promotion.create({
            data: {
                name: 'Double Points Weekend',
                description: 'Earn double points on all purchases this weekend!',
                type: 'automatic',
                startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                endTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
                rate: 0.02 // for every dollar spent, 2 extra points are added
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'New Member Bonus',
                description: 'Get 100 bonus points when you make your first purchase!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                points: 100,
                minSpending: 10.0
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Holiday Special',
                description: 'Spend $50 or more and get 50 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
                endTime: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
                minSpending: 50.0,
                points: 50
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Flash Sale Points',
                description: 'Triple points for the next 24 hours!',
                type: 'automatic',
                startTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                endTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
                rate: 0.03 // for every dollar spent, 3 extra points are added
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Big Spender Reward',
                description: 'Spend $100 or more and receive 200 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                endTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
                minSpending: 100.0,
                points: 200
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Midweek Bonus',
                description: 'Spend $25 or more on Wednesday and get 40 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                minSpending: 25.0,
                points: 40
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Student Welcome Package',
                description: 'New students get 150 bonus points on their first $20 purchase!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
                endTime: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
                minSpending: 20.0,
                points: 150
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Lunch Rush Special',
                description: 'Spend $15 or more between 11 AM and 2 PM and get 30 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                endTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                minSpending: 15.0,
                points: 30
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Referral Bonus',
                description: 'Refer a friend and both get 75 bonus points when they make their first purchase!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
                endTime: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000), // 40 days from now
                points: 75,
                minSpending: 5.0
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Weekend Warrior',
                description: 'Spend $35 or more on weekends (Saturday and Sunday) and get 90 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                endTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
                minSpending: 35.0,
                points: 90
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Early Bird Special',
                description: 'Spend $30 or more before 10 AM and get 60 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
                endTime: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
                minSpending: 30.0,
                points: 60
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Monthly Mega Points',
                description: 'Spend $40 or more in the first week of the month and get 160 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                endTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
                minSpending: 40.0,
                points: 160
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Loyalty Reward',
                description: 'Make 5 purchases this month and get 100 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
                endTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
                points: 100,
                minSpending: 0.0
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Evening Boost',
                description: 'Spend $20 or more after 6 PM and get 35 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                endTime: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
                minSpending: 20.0,
                points: 35
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Birthday Bonus',
                description: 'Celebrate your birthday month with 250 bonus points on any purchase!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
                endTime: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
                points: 250,
                minSpending: 10.0
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Study Break Special',
                description: 'During exam season, spend $25 or more and get 55 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
                endTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
                minSpending: 25.0,
                points: 55
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Premium Member Exclusive',
                description: 'Members with 500+ points get 80 bonus points on purchases over $40!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
                endTime: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000), // 18 days from now
                minSpending: 40.0,
                points: 80
            }
        }),
        prisma.promotion.create({
            data: {
                name: 'Flash Friday',
                description: 'Spend $30 or more on Friday and get 90 bonus points!',
                type: 'onetime',
                startTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                endTime: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
                minSpending: 30.0,
                points: 90
            }
        })
    ]);

    console.log(`Created ${promotions.length} promotions`);

    // Create user promotions (assign some promotions to users)
    await Promise.all([
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[0].id,
                promotionId: promotions[2].id, // Holiday Special
                used: false
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[1].id,
                promotionId: promotions[2].id, // Holiday Special
                used: true
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[2].id,
                promotionId: promotions[4].id, // Big Spender Reward
                used: false
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[3].id,
                promotionId: promotions[4].id, // Big Spender Reward
                used: true
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[4].id,
                promotionId: promotions[5].id, // Midweek Bonus
                used: false
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[5].id,
                promotionId: promotions[6].id, // Student Welcome Package
                used: true
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[6].id,
                promotionId: promotions[7].id, // Lunch Rush Special
                used: false
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[0].id,
                promotionId: promotions[8].id, // Referral Bonus
                used: false
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[1].id,
                promotionId: promotions[9].id, // Weekend Warrior
                used: true
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[2].id,
                promotionId: promotions[10].id, // Early Bird Special
                used: false
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[3].id,
                promotionId: promotions[11].id, // Monthly Mega Points
                used: true
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[4].id,
                promotionId: promotions[12].id, // Loyalty Reward
                used: false
            }
        }),
        prisma.userPromotion.create({
            data: {
                userId: regularUsers[5].id,
                promotionId: promotions[13].id, // Evening Boost
                used: true
            }
        })
    ]);

    // Create transactions
    console.log('Creating transactions...');
    const transactions = [];

    // Purchase transactions (at least 2, creating 8)
    for (let i = 0; i < 8; i++) {
        const user = regularUsers[i % regularUsers.length];
        const amount = Math.floor(Math.random() * 200) + 10; // 10-210 points
        const spent = Math.random() * 50 + 5; // $5-$55
        transactions.push(
            prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'purchase',
                    amount: amount,
                    spent: spent,
                    createdBy: cashier.id,
                    processed: true,
                    processedBy: cashier.id,
                    createdAt: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000) // Different days
                }
            })
        );
    }

    // Redemption transactions (at least 2, creating 6)
    for (let i = 0; i < 6; i++) {
        const user = regularUsers[i % regularUsers.length];
        const amount = -(Math.floor(Math.random() * 100) + 10); // -10 to -110 points
        transactions.push(
            prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'redemption',
                    amount: amount,
                    createdBy: cashier.id,
                    processed: true,
                    processedBy: cashier.id,
                    createdAt: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000)
                }
            })
        );
    }

    // Adjustment transactions (at least 2, creating 5)
    for (let i = 0; i < 5; i++) {
        const user = regularUsers[i % regularUsers.length];
        const amount = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 50) + 5); // ±5 to ±55 points
        transactions.push(
            prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'adjustment',
                    amount: amount,
                    createdBy: manager.id,
                    processed: true,
                    processedBy: manager.id,
                    remark: `Manual adjustment: ${amount > 0 ? 'Added' : 'Deducted'} ${Math.abs(amount)} points`,
                    createdAt: new Date(now.getTime() - (i + 3) * 24 * 60 * 60 * 1000)
                }
            })
        );
    }

    // Event transactions (at least 2, creating 4)
    for (let i = 0; i < 4; i++) {
        const user = regularUsers[i % regularUsers.length];
        const event = events[i % events.length];
        const amount = Math.floor(Math.random() * 100) + 50; // 50-150 points
        transactions.push(
            prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'event',
                    amount: amount,
                    relatedId: event.id,
                    createdBy: superuser.id,
                    processed: true,
                    processedBy: superuser.id,
                    remark: `Points from event: ${event.name}`,
                    createdAt: new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
                }
            })
        );
    }

    // Transfer transactions (at least 2, creating 7)
    for (let i = 0; i < 7; i++) {
        const fromUser = regularUsers[i % regularUsers.length];
        const toUser = regularUsers[(i + 1) % regularUsers.length];
        const amount = -(Math.floor(Math.random() * 50) + 10); // -10 to -60 points (from sender)
        transactions.push(
            prisma.transaction.create({
                data: {
                    userId: fromUser.id,
                    type: 'transfer',
                    amount: amount,
                    relatedId: toUser.id,
                    createdBy: fromUser.id,
                    processed: true,
                    processedBy: manager.id,
                    remark: `Transfer to ${toUser.name}`,
                    createdAt: new Date(now.getTime() - (i + 1) * 2 * 24 * 60 * 60 * 1000)
                }
            })
        );
        // Create corresponding positive transaction for receiver
        transactions.push(
            prisma.transaction.create({
                data: {
                    userId: toUser.id,
                    type: 'transfer',
                    amount: Math.abs(amount),
                    relatedId: fromUser.id,
                    createdBy: fromUser.id,
                    processed: true,
                    processedBy: manager.id,
                    remark: `Transfer from ${fromUser.name}`,
                    createdAt: new Date(now.getTime() - (i + 1) * 2 * 24 * 60 * 60 * 1000)
                }
            })
        );
    }

    const createdTransactions = await Promise.all(transactions);
    console.log(`Created ${createdTransactions.length} transactions`);

    // Create transaction-promotion relationships (link some transactions to promotions)
    await Promise.all([
        prisma.transactionPromotion.create({
            data: {
                transactionId: createdTransactions[0].id, // First purchase
                promotionId: promotions[0].id // Double Points Weekend
            }
        }),
        prisma.transactionPromotion.create({
            data: {
                transactionId: createdTransactions[1].id, // Second purchase
                promotionId: promotions[0].id // Double Points Weekend
            }
        }),
        prisma.transactionPromotion.create({
            data: {
                transactionId: createdTransactions[2].id, // Third purchase
                promotionId: promotions[3].id // Flash Sale Points
            }
        }),
        prisma.transactionPromotion.create({
            data: {
                transactionId: createdTransactions[3].id, // Fourth purchase
                promotionId: promotions[1].id // New Member Bonus
            }
        })
    ]);

    console.log('Database seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`- Users: ${users.length} (1 superuser, 1 manager, 1 cashier, ${regularUsers.length} regular)`);
    console.log(`- Events: ${events.length}`);
    console.log(`- Promotions: ${promotions.length}`);
    console.log(`- Transactions: ${createdTransactions.length}`);
    console.log(`  - Purchase: 8`);
    console.log(`  - Redemption: 6`);
    console.log(`  - Adjustment: 5`);
    console.log(`  - Event: 4`);
    console.log(`  - Transfer: 14 (7 pairs)`);
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
