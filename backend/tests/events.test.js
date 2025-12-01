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
        it('should list events', async () => {
            const { token: managerToken } = await createTestUser('manager');

            await request(app)
                .post('/events')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    name: 'Test Event',
                    description: 'Desc',
                    location: 'Loc',
                    startTime: new Date(Date.now() + 100000).toISOString(),
                    endTime: new Date(Date.now() + 200000).toISOString(),
                    points: 5
                });

            const res = await request(app)
                .get('/events')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.results.length).toBeGreaterThanOrEqual(1);
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
            expect(eventId).toBeDefined();
            
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
    });
});
