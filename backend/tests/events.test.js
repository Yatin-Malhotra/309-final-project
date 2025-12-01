const request = require('supertest');
const { app, prisma } = require('../index');
const { createTestUser, clearDatabase } = require('./helpers');

describe('Event Endpoints', () => {
    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('POST /events', () => {
        it('should allow manager to create an event', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: organizer } = await createTestUser('regular');

            const eventData = {
                name: 'Test Event',
                description: 'Test Description',
                location: 'Test Location',
                startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                endTime: new Date(Date.now() + 90000000).toISOString(),
                points: 10,
                organizerIds: [organizer.id]
            };

            const res = await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${managerToken}`)
                .send(eventData);

            expect(res.statusCode).toEqual(201);
            expect(res.body.name).toEqual(eventData.name);
        });

        it('should not allow regular user to create an event', async () => {
            const { token: userToken } = await createTestUser('regular');

            const eventData = {
                name: 'Test Event',
                description: 'Test Description',
                location: 'Test Location',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                endTime: new Date(Date.now() + 90000000).toISOString(),
                points: 10
            };

            const res = await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${userToken}`)
                .send(eventData);

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('GET /events', () => {
        it('should list events with filters', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: regular, token: userToken } = await createTestUser('regular');

            // Create events
            const now = Date.now();
            // Past event
            await prisma.event.create({
                data: {
                    name: 'Past Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(now - 10000000),
                    endTime: new Date(now - 5000000),
                    pointsAllocated: 10,
                    pointsRemain: 10,
                    published: true
                }
            });
            // Future event
            const futureEvent = await prisma.event.create({
                data: {
                    name: 'Future Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(now + 10000000),
                    endTime: new Date(now + 20000000),
                    pointsAllocated: 10,
                    pointsRemain: 10,
                    published: true
                }
            });
            // Unpublished event
            await prisma.event.create({
                data: {
                    name: 'Unpublished Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(now + 10000000),
                    endTime: new Date(now + 20000000),
                    pointsAllocated: 10,
                    pointsRemain: 10,
                    published: false
                }
            });

            // Register user to future event
            await prisma.eventGuest.create({
                data: {
                    eventId: futureEvent.id,
                    userId: regular.id
                }
            });

            // Test list all published (regular user)
            const res1 = await request(app)
                .get('/events')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res1.body.results.length).toBe(2); // Past + Future
            expect(res1.body.results.find(e => e.name === 'Unpublished Event')).toBeUndefined();

            // Test filter started (past events)
            const res2 = await request(app)
                .get('/events')
                .query({ ended: 'true' })
                .set('Authorization', `Bearer ${userToken}`);
            expect(res2.body.results.length).toBeGreaterThanOrEqual(1);
            expect(res2.body.results[0].name).toEqual('Past Event');

            // Test filter registered
            const res3 = await request(app)
                .get('/events')
                .query({ registered: 'true' })
                .set('Authorization', `Bearer ${userToken}`);
            expect(res3.body.results.length).toBe(1);
            expect(res3.body.results[0].id).toEqual(futureEvent.id);
            expect(res3.body.results[0].isRegistered).toBe(true);
        });
    });

    describe('POST /events/:eventId/guests/me', () => {
        it('should allow user to register for an event', async () => {
            const { user, token } = await createTestUser('regular');
            const { token: managerToken } = await createTestUser('manager');

            const createRes = await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Public Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 1000000).toISOString(),
                    endTime: new Date(Date.now() + 2000000).toISOString(),
                    points: 5
                });
            
            const eventId = createRes.body.id;
            
            await request(app)
                .patch(`/events/${eventId}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ published: true });

            const res = await request(app)
                .post(`/events/${eventId}/guests/me`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toEqual(201);
            expect(res.body.guestAdded).toBeDefined();
            expect(res.body.guestAdded.utorid).toEqual(user.utorid);
        });

        it('should fail if event is full', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { token: userToken } = await createTestUser('regular');

            const event = await prisma.event.create({
                data: {
                    name: 'Full Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 1000000),
                    endTime: new Date(Date.now() + 2000000),
                    pointsAllocated: 10,
                    pointsRemain: 10,
                    capacity: 0, // Full
                    published: true
                }
            });

            const res = await request(app)
                .post(`/events/${event.id}/guests/me`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(410);
            expect(res.body.error).toMatch(/full/);
        });

        it('should fail if event has ended', async () => {
            const { token: userToken } = await createTestUser('regular');

            const event = await prisma.event.create({
                data: {
                    name: 'Ended Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() - 2000000),
                    endTime: new Date(Date.now() - 1000000),
                    pointsAllocated: 10,
                    pointsRemain: 10,
                    published: true
                }
            });

            const res = await request(app)
                .post(`/events/${event.id}/guests/me`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(410);
            expect(res.body.error).toMatch(/ended/);
        });

        it('should fail if already registered', async () => {
            const { user, token: userToken } = await createTestUser('regular');

            const event = await prisma.event.create({
                data: {
                    name: 'Reg Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 1000000),
                    endTime: new Date(Date.now() + 2000000),
                    pointsAllocated: 10,
                    pointsRemain: 10,
                    published: true
                }
            });

            await prisma.eventGuest.create({
                data: { eventId: event.id, userId: user.id }
            });

            const res = await request(app)
                .post(`/events/${event.id}/guests/me`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/Already registered/);
        });
    });

    describe('PATCH /events/:eventId', () => {
        it('should allow manager to update an event', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const createRes = await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Event to Update',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 1000000).toISOString(),
                    endTime: new Date(Date.now() + 2000000).toISOString(),
                    points: 5
                });
            
            const eventId = createRes.body.id;

            const res = await request(app)
                .patch(`/events/${eventId}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ name: 'Updated Event Name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.name).toEqual('Updated Event Name');
        });
    });

    describe('DELETE /events/:eventId', () => {
        it('should allow manager to delete an unpublished event', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const createRes = await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Event to Delete',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 1000000).toISOString(),
                    endTime: new Date(Date.now() + 2000000).toISOString(),
                    points: 5
                });
            
            const eventId = createRes.body.id;

            const res = await request(app)
                .delete(`/events/${eventId}`)
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(204);
        });

        it('should not allow deleting a published event', async () => {
            const { token: managerToken } = await createTestUser('manager');

            const createRes = await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Published Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 1000000).toISOString(),
                    endTime: new Date(Date.now() + 2000000).toISOString(),
                    points: 5
                });
            
            const eventId = createRes.body.id;
            
            await request(app)
                .patch(`/events/${eventId}`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ published: true });

            const res = await request(app)
                .delete(`/events/${eventId}`)
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('POST /events/:eventId/organizers', () => {
        it('should allow manager to add an organizer', async () => {
            const { token: managerToken } = await createTestUser('manager');
            const { user: regular } = await createTestUser('regular');

            const createRes = await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Org Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 1000000).toISOString(),
                    endTime: new Date(Date.now() + 2000000).toISOString(),
                    points: 5
                });
            
            const eventId = createRes.body.id;

            const res = await request(app)
                .post(`/events/${eventId}/organizers`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ utorid: regular.utorid });

            expect(res.statusCode).toEqual(201);
            expect(res.body.organizers.some(o => o.utorid === regular.utorid)).toBe(true);
        });
    });
});
