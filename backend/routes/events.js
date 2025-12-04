const express = require('express');
const router = express.Router();
const { z } = require('zod');
const {
    prisma,
    schemas,
    jwtUtils,
    requireRole,
    optionalAuth,
    validate,
    validateQuery,
    isOrganizer
} = require('../middleware');

// POST /events - Validate request body better
router.post('/', validate(schemas.createEvent), async (req, res, next) => {
    try {
        const { name, description, location, startTime, endTime, capacity, points } = req.body;
        
        // CRITICAL: Validate dates BEFORE permission check
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        
        if (start >= end) return res.status(400).json({ error: 'End time must be after start time' });
        if (start < new Date()) return res.status(400).json({ error: 'Start time cannot be in the past' });
        
        // NOW check permissions
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        
        try {
            req.user = jwtUtils.verifyToken(token);
            const roleHierarchy = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
            if (roleHierarchy[req.user.role] < 2) { // manager level
                return res.status(403).json({ error: 'Forbidden' });
            }
        } catch (error) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Handle organizerIds if provided
        const organizerIds = req.body.organizerIds || [];
        let organizers = [];
        
        if (organizerIds.length > 0) {
            // Validate that all user IDs exist
            const users = await prisma.user.findMany({
                where: { id: { in: organizerIds } },
                select: { id: true }
            });
            
            if (users.length !== organizerIds.length) {
                return res.status(400).json({ error: 'One or more organizer user IDs are invalid' });
            }
        }
        
        const event = await prisma.event.create({
            data: {
                name, description, location,
                startTime: start, endTime: end,
                capacity: capacity === undefined ? null : capacity,
                pointsAllocated: points,
                pointsRemain: points,
                published: false,
                organizers: organizerIds.length > 0 ? {
                    create: organizerIds.map(userId => ({ userId }))
                } : undefined
            },
            include: {
                organizers: {
                    include: {
                        user: {
                            select: { id: true, utorid: true, name: true }
                        }
                    }
                }
            }
        });
        
        organizers = event.organizers.map(o => ({
            id: o.user.id,
            utorid: o.user.utorid,
            name: o.user.name
        }));
        
        res.status(201).json({
            id: event.id, name: event.name, description: event.description,
            location: event.location, startTime: event.startTime, endTime: event.endTime,
            capacity: event.capacity, pointsRemain: event.pointsRemain,
            pointsAwarded: 0, published: event.published, organizers, guests: []
        });
    } catch (error) { next(error); }
});

// GET /events - List events  
router.get('/', optionalAuth, validateQuery(z.object({
    name: z.string().optional(),
    location: z.string().optional(),
    started: z.string().optional(),
    ended: z.string().optional(),
    showFull: z.string().optional(),
    published: z.string().optional(),
    registeredUserName: z.string().optional(),
    registeredUserLimitMin: z.string().optional(),
    registeredUserLimitMax: z.string().optional(),
    isFull: z.string().optional(),
    registered: z.string().optional(),
    page: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '1' : val,
        z.string().regex(/^\d+$/)
    ),
    limit: z.preprocess(
        (val) => (val === undefined || val === null || val === '') ? '10' : val,
        z.string().regex(/^\d+$/)
    )
})), async (req, res, next) => {
    try {
        const { name, location, started, ended, showFull, published, registeredUserName, registeredUserLimitMin, registeredUserLimitMax, isFull, registered, page, limit } = req.validatedQuery;
        
        if (started && ended) return res.status(400).json({ error: 'Cannot specify both started and ended' });
        
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        // Add validation for parsed values
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({ error: 'Page must be at least 1' });
        }
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({ error: 'Limit must be between 1 and 100' });
        }
        
        const skip = (pageNum - 1) * limitNum;
        const now = new Date();
        
        const where = {};
        if (name) where.name = { contains: name };
        if (location) where.location = { contains: location };
        if (started) where.startTime = started === 'true' ? { lte: now } : { gt: now };
        if (ended) where.endTime = ended === 'true' ? { lte: now } : { gt: now };
        
        const isManagerOrAbove = req.user && ['manager', 'superuser'].includes(req.user.role);
        
        if (!isManagerOrAbove) {
            where.published = true;
        } else if (published) {
            where.published = published === 'true';
        }
        
        // Need to include user data for registered user name filtering or registered status filtering
        const includeGuests = (registeredUserName || registered) ? { include: { user: { select: { id: true, name: true, utorid: true } } } } : true;
        
        // Always include organizer userId to check if current user is organizer
        // But only include full user details for managers
        let events = await prisma.event.findMany({
            where,
            include: {
                guests: includeGuests,
                organizers: isManagerOrAbove 
                    ? { include: { user: true } } 
                    : true  // Include basic organizer info (with userId) for all users
            }
        });
        
        // Filter by registered status (for current user) - must happen before other filters
        // Use the same logic as isRegistered calculation
        if (registered !== undefined && registered !== '' && req.user && req.user.id) {
            const isRegisteredFilter = registered === 'true';
            const userId = Number(req.user.id);
            events = events.filter(e => {
                // Use exact same logic as isRegistered calculation
                const userIsRegistered = e.guests.some(g => {
                    // Handle both direct userId and potential nested structures
                    const guestUserId = g.userId !== undefined ? g.userId : (g.user && g.user.id);
                    return Number(guestUserId) === userId;
                });
                return userIsRegistered === isRegisteredFilter;
            });
        }
        
        // Filter by registered user name if provided
        if (registeredUserName) {
            events = events.filter(e => {
                return e.guests.some(g => {
                    const userName = g.user?.name || '';
                    return userName.toLowerCase().includes(registeredUserName.toLowerCase());
                });
            });
        }
        
        // Filter by registered user limit (min/max)
        if (registeredUserLimitMin) {
            const minLimit = parseInt(registeredUserLimitMin);
            if (!isNaN(minLimit)) {
                events = events.filter(e => e.guests.length >= minLimit);
            }
        }
        if (registeredUserLimitMax) {
            const maxLimit = parseInt(registeredUserLimitMax);
            if (!isNaN(maxLimit)) {
                events = events.filter(e => e.guests.length <= maxLimit);
            }
        }
        
        // Filter by event full status
        if (isFull !== undefined && isFull !== '') {
            const fullStatus = isFull === 'true';
            events = events.filter(e => {
                const eventIsFull = e.capacity && e.guests.length >= e.capacity;
                return eventIsFull === fullStatus;
            });
        }
        
        // Filter out full events if needed (legacy showFull parameter)
        if (showFull !== 'true' && isFull === undefined) {
            events = events.filter(e => !e.capacity || e.guests.length < e.capacity);
        }
        
        const count = events.length;
        events = events.slice(skip, skip + limitNum);
        
        const results = events.map(e => {
            const result = {
                id: e.id, name: e.name, location: e.location,
                startTime: e.startTime, endTime: e.endTime,
                capacity: e.capacity, numGuests: e.guests.length
            };
            if (isManagerOrAbove) {
                result.pointsRemain = e.pointsRemain;
                result.pointsAwarded = e.pointsAllocated - e.pointsRemain;
                result.published = e.published;
            }
            // Check if current user is registered for this event
            // Always include isRegistered field (false if not logged in or not registered)
            if (req.user && req.user.id) {
                // When using include: { guests: true }, we get EventGuest objects with userId field
                // Ensure we compare as numbers since both are integers
                const userId = Number(req.user.id);
                // Debug: Check guest structure (remove after testing)
                if (e.guests.length > 0 && !e.guests[0].hasOwnProperty('userId')) {
                    console.log('Warning: Guest object structure:', Object.keys(e.guests[0]));
                }
                result.isRegistered = e.guests.some(g => {
                    // Handle both direct userId and potential nested structures
                    const guestUserId = g.userId !== undefined ? g.userId : (g.user && g.user.id);
                    return Number(guestUserId) === userId;
                });
            } else {
                result.isRegistered = false;
            }
            // Check if current user is an organizer for this event
            // Always include isOrganizer field (false if not logged in or not organizer)
            if (req.user && req.user.id) {
                const userId = Number(req.user.id);
                if (e.organizers && e.organizers.length > 0) {
                    result.isOrganizer = e.organizers.some(o => {
                        // Handle both cases: with full user object (o.user.id) or just userId field
                        const organizerUserId = (o.user && o.user.id) ? o.user.id : o.userId;
                        return organizerUserId !== undefined && Number(organizerUserId) === userId;
                    });
                } else {
                    result.isOrganizer = false;
                }
            } else {
                result.isOrganizer = false;
            }
            return result;
        });
        
        res.json({ count, results });
    } catch (error) { next(error); }
});

// GET /events/:eventId - Get event details (enforce error order)
router.get('/:eventId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(404).json({ error: 'Event not found' });
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                organizers: { include: { user: { select: { id: true, utorid: true, name: true } } } },
                guests: { include: { user: { select: { id: true, utorid: true, name: true } } } }
            }
        });
        
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Authentication (401) then authorization (403)
        let authUser = null;
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (token) {
            try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        }

        const isManagerOrAbove = authUser && ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = authUser ? await isOrganizer(eventId, authUser.id) : false;

        if (!event.published) {
            if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
            if (!isManagerOrAbove && !isEventOrganizer) return res.status(403).json({ error: 'Forbidden' });
        }
        
        const organizers = event.organizers.map(o => ({ id: o.user.id, utorid: o.user.utorid, name: o.user.name }));
        
        const response = {
            id: event.id, name: event.name, description: event.description,
            location: event.location, startTime: event.startTime, endTime: event.endTime,
            capacity: event.capacity, organizers
        };
        
        if (isManagerOrAbove || isEventOrganizer) {
            response.pointsAllocated = event.pointsAllocated;
            response.pointsRemain = event.pointsRemain;
            response.pointsAwarded = event.pointsAllocated - event.pointsRemain;
            response.published = event.published;
            response.guests = event.guests.map(g => ({ id: g.user.id, utorid: g.user.utorid, name: g.user.name }));
        } else {
            response.numGuests = event.guests.length;
            // Add isRegistered for regular users
            if (authUser && authUser.id) {
                const userId = Number(authUser.id);
                response.isRegistered = event.guests.some(g => {
                    const guestUserId = g.userId !== undefined ? g.userId : (g.user && g.user.id);
                    return Number(guestUserId) === userId;
                });
            } else {
                response.isRegistered = false;
            }
        }
        
        res.json(response);
    } catch (error) { next(error); }
});

// PATCH /events/:eventId - Update event (enforce ordering)
router.patch('/:eventId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

        // 3) Check if resources exist (404)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // 4) Check authentication (401)
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }

        // 5) Check authorization (403)
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = await isOrganizer(eventId, authUser.id);
        if (!isManagerOrAbove && !isEventOrganizer) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Enforce 403 for restricted fields before structure validation
        if (!isManagerOrAbove && ('points' in req.body || 'published' in req.body || 'organizerIds' in req.body)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // 1) Validate request body structure (400)
        // Coerce numeric-like strings and floats to integers for points
        if (req.body && 'points' in req.body && req.body.points !== undefined && req.body.points !== null) {
            if (typeof req.body.points === 'string') {
                const trimmed = req.body.points.trim();
                const num = Number(trimmed);
                if (Number.isFinite(num) && num > 0) {
                    const intVal = Math.floor(num);
                    if (intVal === num) {
                        req.body.points = intVal;
                    }
                }
            } else if (typeof req.body.points === 'number') {
                // Convert floats to integers if they're whole numbers
                if (Number.isFinite(req.body.points) && req.body.points > 0) {
                    const intVal = Math.floor(req.body.points);
                    if (intVal === req.body.points) {
                        req.body.points = intVal;
                    }
                }
            }
        }
        let updates;
        try {
            updates = schemas.updateEvent.parse(req.body || {});
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors[0].message });
            }
            throw error;
        }
        
        // 6) Time/capacity (410 group)
        const now = new Date();
        const hasStarted = event.startTime <= now;
        const hasEnded = event.endTime <= now;
        
        // If event has started, only allow endTime to be updated
        if (hasStarted) {
            const restrictedFields = ['name', 'description', 'location', 'startTime', 'capacity'];
            const hasRestrictedFieldUpdate = restrictedFields.some(field => 
                updates[field] !== undefined && updates[field] !== null
            );
            
            if (hasRestrictedFieldUpdate) {
                return res.status(400).json({ error: 'Cannot update after event started' });
            }
            
            // Filter updates to only include allowed fields (endTime, points, published, organizerIds)
            const allowedUpdates = {};
            if (updates.endTime !== undefined && updates.endTime !== null) {
                allowedUpdates.endTime = updates.endTime;
            }
            if (updates.points !== undefined && updates.points !== null) {
                allowedUpdates.points = updates.points;
            }
            if (updates.published !== undefined && updates.published !== null) {
                allowedUpdates.published = updates.published;
            }
            if (updates.organizerIds !== undefined && updates.organizerIds !== null) {
                allowedUpdates.organizerIds = updates.organizerIds;
            }
            updates = allowedUpdates;
        }
        
        // Validate time updates
        if (updates.startTime || updates.endTime) {
            const newStart = updates.startTime ? new Date(updates.startTime) : event.startTime;
            const newEnd = updates.endTime ? new Date(updates.endTime) : event.endTime;
            
            if (newStart >= newEnd) return res.status(400).json({ error: 'Invalid times' });
            // If event has already started, allow startTime to be in the past
            if (updates.startTime && !hasStarted && newStart < now) {
                return res.status(400).json({ error: 'Times cannot be in past' });
            }
        }
        
        // Can't update anything after event ends
        if (hasEnded && Object.keys(updates).length > 0) {
            return res.status(400).json({ error: 'Cannot update after event ended' });
        }
        
        // Check capacity reduction
        if (updates.capacity !== undefined && updates.capacity !== null) {
            if (updates.capacity < event.guests.length) {
                return res.status(400).json({ error: 'Cannot reduce capacity below guest count' });
            }
        }
        
        // Check points reduction
        if (updates.points !== undefined) {
            const awarded = event.pointsAllocated - event.pointsRemain;
            const newRemaining = updates.points - awarded;
            if (newRemaining < 0) {
                return res.status(400).json({ error: 'Cannot reduce points below awarded amount' });
            }
            updates.pointsAllocated = updates.points;
            updates.pointsRemain = newRemaining;
            delete updates.points;
        }
        
        // Published can only be set to true
        if (updates.published !== undefined && !updates.published) {
            return res.status(400).json({ error: 'Cannot unpublish event' });
        }
        
        // Handle organizerIds if provided (only for managers/superusers)
        if (updates.organizerIds !== undefined && isManagerOrAbove) {
            // Validate that all user IDs exist
            const organizerIds = updates.organizerIds;
            if (organizerIds.length > 0) {
                const users = await prisma.user.findMany({
                    where: { id: { in: organizerIds } },
                    select: { id: true }
                });
                
                if (users.length !== organizerIds.length) {
                    return res.status(400).json({ error: 'One or more organizer user IDs are invalid' });
                }
            }
            
            // Get current organizers
            const currentOrganizers = await prisma.eventOrganizer.findMany({
                where: { eventId },
                select: { userId: true }
            });
            const currentOrganizerIds = currentOrganizers.map(o => o.userId);
            const newOrganizerIds = [...new Set(organizerIds)]; // Remove duplicates from input
            
            // Calculate which organizers to add and remove
            const organizersToAdd = newOrganizerIds.filter(id => !currentOrganizerIds.includes(id));
            const organizersToRemove = currentOrganizerIds.filter(id => !newOrganizerIds.includes(id));
            
            // Only update if organizers have actually changed
            if (organizersToAdd.length > 0 || organizersToRemove.length > 0) {
                // Remove organizers that are no longer in the list
                if (organizersToRemove.length > 0) {
                    await prisma.eventOrganizer.deleteMany({
                        where: {
                            eventId,
                            userId: { in: organizersToRemove }
                        }
                    });
                }
                
                // Add new organizers (we've already filtered out existing ones)
                if (organizersToAdd.length > 0) {
                    // Use individual creates with error handling to gracefully skip duplicates
                    for (const userId of organizersToAdd) {
                        try {
                            await prisma.eventOrganizer.create({
                                data: { eventId, userId }
                            });
                        } catch (error) {
                            // If organizer already exists (unique constraint violation), skip it
                            // This is defensive programming in case of race conditions
                            if (error.code !== 'P2002') {
                                throw error; // Re-throw if it's not a unique constraint error
                            }
                        }
                    }
                }
            }
        }
        
        // Build final updates object
        const finalUpdates = {};
        if (updates.name) finalUpdates.name = updates.name;
        if (updates.description) finalUpdates.description = updates.description;
        if (updates.location) finalUpdates.location = updates.location;
        if (updates.startTime) finalUpdates.startTime = new Date(updates.startTime);
        if (updates.endTime) finalUpdates.endTime = new Date(updates.endTime);
        if (updates.capacity !== undefined) finalUpdates.capacity = updates.capacity;
        if (updates.pointsAllocated !== undefined) finalUpdates.pointsAllocated = updates.pointsAllocated;
        if (updates.pointsRemain !== undefined) finalUpdates.pointsRemain = updates.pointsRemain;
        if (updates.published !== undefined) finalUpdates.published = updates.published;
        
        const updated = await prisma.event.update({
            where: { id: eventId },
            data: finalUpdates,
            include: {
                organizers: {
                    include: {
                        user: {
                            select: { id: true, utorid: true, name: true }
                        }
                    }
                }
            }
        });
        
        // Build response - always return id, name, location + fields that were in the request
        const response = { 
            id: updated.id, 
            name: updated.name, 
            location: updated.location 
        };
        
        // Add fields that were in the original request
        const original = req.body;
        if ('description' in original) response.description = updated.description;
        if ('startTime' in original) response.startTime = updated.startTime;
        if ('endTime' in original) response.endTime = updated.endTime;
        if ('capacity' in original) response.capacity = updated.capacity;
        if ('published' in original) response.published = updated.published;
        if ('points' in original) {
            response.pointsAllocated = updated.pointsAllocated;
            response.pointsRemain = updated.pointsRemain;
        }
        if ('organizerIds' in original) {
            response.organizers = updated.organizers.map(o => ({
                id: o.user.id,
                utorid: o.user.utorid,
                name: o.user.name
            }));
        }
        
        res.json(response);
    } catch (error) { next(error); }
});

// DELETE /events/:eventId - Delete event (ensure published 400 precedes auth)
router.delete('/:eventId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        
        if (!event) return res.status(404).json({ error: 'Event not found' });
        // Check published (400) before auth/403
        // Published events cannot be deleted
        if (event.published) {
            return res.status(400).json({ error: 'Cannot delete published event' });
        }

        // Now authentication and authorization
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        if (!isManagerOrAbove) return res.status(403).json({ error: 'Forbidden' });
        
        await prisma.event.delete({ where: { id: eventId } });
        res.status(204).send();
    } catch (error) { next(error); }
});

// POST /events/:eventId/organizers - Add organizer (resource checks before validation)
router.post('/:eventId/organizers', async (req, res, next) => {
    try {
        // Validate event ID (400)
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        
        // Load event first (404 precedence over body validation)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                organizers: {
                    include: {
                        user: { select: { id: true, utorid: true, name: true } }
                    }
                }
            }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        // 410 checks (before auth/body)
        if (event.endTime <= new Date()) return res.status(410).json({ error: 'Event has ended' });
        
        // Authentication and authorization
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const roleHierarchy = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
        if (roleHierarchy[authUser.role] < 2) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        // Validate body presence minimally (400) without strict type/format to reach 404 path
        const utorid = req.body && req.body.utorid !== undefined && req.body.utorid !== null
            ? String(req.body.utorid)
            : '';
        if (utorid === '') {
            return res.status(400).json({ error: 'utorid is required' });
        }

        // Load user (404)
        const user = await prisma.user.findUnique({
            where: { utorid },
            select: { id: true, utorid: true, name: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // 400 business checks
        if (event.organizers.some(o => o.user.id === user.id)) {
            return res.status(400).json({ error: 'User is already an organizer' });
        }
        
        const isGuest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId: user.id } }
        });
        if (isGuest) return res.status(400).json({ error: 'User is already a guest' });
        
        // Add the organizer
        await prisma.eventOrganizer.create({ 
            data: { eventId, userId: user.id }
        });
        
        // Return updated event with new organizer list
        const updatedEvent = await prisma.event.findUnique({
            where: { id: eventId },
            include: { 
                organizers: { 
                    include: { 
                        user: {
                            select: { id: true, utorid: true, name: true }
                        }
                    }
                }
            }
        });
        
        res.status(201).json({
            id: updatedEvent.id,
            name: updatedEvent.name,
            description: updatedEvent.description,
            location: updatedEvent.location,
            startTime: updatedEvent.startTime,
            endTime: updatedEvent.endTime,
            capacity: updatedEvent.capacity,
            published: updatedEvent.published,
            organizers: updatedEvent.organizers.map(o => ({
                id: o.user.id,
                utorid: o.user.utorid,
                name: o.user.name
            }))
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'User is already an organizer' });
        }
        next(error);
    }
});

// DELETE /events/:eventId/organizers/:userId - Remove organizer
router.delete('/:eventId/organizers/:userId', requireRole('manager'), async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
        
        const organizer = await prisma.eventOrganizer.findUnique({
            where: { eventId_userId: { eventId, userId } }
        });
        if (!organizer) return res.status(404).json({ error: 'Organizer not found' });
        
        await prisma.eventOrganizer.delete({ 
            where: { eventId_userId: { eventId, userId } }
        });
        res.status(204).send();
    } catch (error) { next(error); }
});

// POST /events/:eventId/guests - Add a guest to this event
router.post('/:eventId/guests', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        
        // Load event (404 first)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // 410 checks (time/capacity) before auth/body
        if (event.endTime <= new Date()) {
            return res.status(410).json({ error: 'Event has ended' });
        }
        
        // Check if event is at capacity (capacity !== null means there's a limit)
        if (event.capacity !== null && event.guests.length >= event.capacity) {
            return res.status(410).json({ error: 'Event is full' });
        }

        // Authentication (401) and authorization (403)
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = await isOrganizer(eventId, authUser.id);
        if (!isManagerOrAbove && !isEventOrganizer) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Validate request body (400) - accept either userId or utorid
        const { utorid, userId } = req.body || {};
        if (!utorid && !userId) {
            return res.status(400).json({ error: 'utorid or userId is required' });
        }
        if (utorid && userId) {
            return res.status(400).json({ error: 'Provide either utorid or userId, not both' });
        }

        // Load user (404)
        const whereClause = utorid 
            ? { utorid } 
            : /^\d+$/.test(String(userId))
                ? { id: parseInt(userId, 10) }
                : null;
        
        if (!whereClause) {
            return res.status(400).json({ error: 'Invalid userId format' });
        }
        
        const user = await prisma.user.findUnique({ where: whereClause });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // 400 checks
        const userIsOrganizer = await prisma.eventOrganizer.findUnique({
            where: { eventId_userId: { eventId, userId: user.id } }
        });
        if (userIsOrganizer) return res.status(400).json({ error: 'User is an organizer' });
        
        await prisma.eventGuest.create({ data: { eventId, userId: user.id } });
        
        res.status(201).json({
            id: event.id,
            name: event.name,
            location: event.location,
            guestAdded: { id: user.id, utorid: user.utorid, name: user.name },
            numGuests: event.guests.length + 1
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'User is already a guest' });
        }
        next(error);
    }
});

// DELETE /events/:eventId/guests/me - Cancel self RSVP (enforce error order)
// NOTE: This must come before /events/:eventId/guests/:userId to avoid route conflict
router.delete('/:eventId/guests/me', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

        // Resource existence (404)
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Authentication (401) - needed to check if user is a guest
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }

        // Check if user is a guest (404)
        const guest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId: authUser.id } }
        });
        if (!guest) return res.status(404).json({ error: 'Not registered for this event' });

        // Time (410) - check if event has ended after confirming user is a guest
        if (event.endTime <= new Date()) return res.status(410).json({ error: 'Cannot delete guest after event end.' });

        await prisma.eventGuest.delete({ 
            where: { eventId_userId: { eventId, userId: authUser.id } }
        });
        res.status(204).send();
    } catch (error) { next(error); }
});

// DELETE /events/:eventId/guests/:userId - Remove guest
router.delete('/:eventId/guests/:userId', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        const userId = parseInt(req.params.userId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
        
        // Load event (404 first)
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        // Authentication (401) and authorization (403) - only managers/superusers can remove guests
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        if (!isManagerOrAbove) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const guest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId } }
        });
        if (!guest) return res.status(404).json({ error: 'Guest not found' });
        
        await prisma.eventGuest.delete({ 
            where: { eventId_userId: { eventId, userId } }
        });
        res.status(204).send();
    } catch (error) { next(error); }
});

// POST /events/:eventId/guests/me - Self RSVP with comprehensive error handling
router.post('/:eventId/guests/me', requireRole('regular'), async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });
        
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        // 410 errors take precedence
        if (event.endTime <= new Date()) {
            return res.status(410).json({ error: 'Event has ended' });
        }
        
        // Check if event is at capacity (capacity !== null means there's a limit)
        if (event.capacity !== null && event.guests.length >= event.capacity) {
            return res.status(410).json({ error: 'Event is full' });
        }

        // Unpublished events remain hidden
        // if (!event.published) return res.status(404).json({ error: 'Event not found' });
        
        // 400 errors after 410s
        const existingGuest = await prisma.eventGuest.findUnique({
            where: { eventId_userId: { eventId, userId: req.user.id } }
        });
        if (existingGuest) return res.status(400).json({ error: 'Already registered' });
        
        const isEventOrganizer = await isOrganizer(eventId, req.user.id);
        if (isEventOrganizer) return res.status(400).json({ error: 'Organizers cannot be guests' });
        
        await prisma.eventGuest.create({ data: { eventId, userId: req.user.id } });
        
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        
        res.status(201).json({
            id: event.id,
            name: event.name,
            location: event.location,
            guestAdded: { id: user.id, utorid: user.utorid, name: user.name },
            numGuests: event.guests.length + 1
        });
    } catch (error) { next(error); }
});

// POST /events/:eventId/transactions - Award points (enforce error order)
router.post('/:eventId/transactions', async (req, res, next) => {
    try {
        const eventId = parseInt(req.params.eventId);
        if (isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

        // Validate request body (400)
        const { type, utorid, amount } = req.body || {};
        if (type !== 'event') return res.status(400).json({ error: 'Invalid type' });
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        // Resource existence (404)
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { guests: { include: { user: true } } }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Authentication and authorization
        const token = jwtUtils.extractToken(req.headers.authorization);
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let authUser;
        try { authUser = jwtUtils.verifyToken(token); } catch (_) { return res.status(401).json({ error: 'Unauthorized' }); }
        const isManagerOrAbove = ['manager', 'superuser'].includes(authUser.role);
        const isEventOrganizer = await isOrganizer(eventId, authUser.id);
        if (!isManagerOrAbove && !isEventOrganizer) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const creator = await prisma.user.findUnique({ where: { id: authUser.id } });
        
        // Award to all guests (only if utorid is explicitly not provided)
        if (utorid === undefined || utorid === null) {
            const totalPoints = amount * event.guests.length;
            if (event.pointsRemain < totalPoints) {
                return res.status(400).json({ error: 'Insufficient points remaining' });
            }
            
            const transactions = [];
            for (const guest of event.guests) {
                const tx = await prisma.transaction.create({
                    data: {
                        userId: guest.userId,
                        type: 'event',
                        amount: amount,
                        relatedId: eventId,
                        remark: event.name,
                        createdBy: authUser.id,
                        processed: true
                    }
                });
                
                await prisma.user.update({
                    where: { id: guest.userId },
                    data: { points: { increment: amount } }
                });
                
                transactions.push({
                    id: tx.id,
                    recipient: guest.user.utorid,
                    awarded: amount,
                    type: 'event',
                    relatedId: eventId,
                    remark: tx.remark,
                    createdBy: creator.utorid
                });
            }
            
            await prisma.event.update({
                where: { id: eventId },
                data: { pointsRemain: { decrement: totalPoints } }
            });
            
            return res.status(201).json(transactions);
        }
        
        // Award to specific guest
        if (!utorid || typeof utorid !== 'string' || utorid.trim() === '') {
            return res.status(400).json({ error: 'Invalid utorid' });
        }
        
        const user = await prisma.user.findUnique({ where: { utorid } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Check if user is a guest - must be a guest to receive points
        const isGuest = event.guests.find(g => g.userId === user.id);
        if (!isGuest) return res.status(400).json({ error: 'User is not a guest' });
        
        if (event.pointsRemain < amount) {
            return res.status(400).json({ error: 'Insufficient points remaining' });
        }
        
        const tx = await prisma.transaction.create({
            data: {
                userId: user.id,
                type: 'event',
                amount: amount,
                relatedId: eventId,
                remark: event.name,
                createdBy: authUser.id,
                processed: true
            }
        });
        
        await prisma.user.update({
            where: { id: user.id },
            data: { points: { increment: amount } }
        });
        
        await prisma.event.update({
            where: { id: eventId },
            data: { pointsRemain: { decrement: amount } }
        });
        
        res.status(201).json({
            id: tx.id,
            recipient: user.utorid,
            awarded: amount,
            type: 'event',
            relatedId: eventId,
            remark: tx.remark,
            createdBy: creator.utorid
        });
    } catch (error) { next(error); }
});

module.exports = router;

