const Event = require('../models/Event');
const { escapeRegex, resolveEventImage } = require('../utils/securityAndMedia');

exports.getEvents = async (req, res) => {
    try {
        const filters = {};
        if (req.query.category) filters.category = req.query.category;
        const search = String(req.query.search || '').trim().slice(0, 100);
        if (search) filters.title = { $regex: escapeRegex(search), $options: 'i' };

        const events = await Event.find(filters).populate('createdBy', 'name email');
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('createdBy', 'name email');
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, time, location, category, totalSeats, ticketPrice, image } = req.body;
        const safeImage = resolveEventImage(image);
        const event = await Event.create({
            title,
            description,
            date,
            time: time || '09:00',
            location,
            category,
            totalSeats,
            availableSeats: totalSeats,
            ticketPrice: ticketPrice || 0,
            image: safeImage,
            createdBy: req.user.id
        });
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const updateData = { ...req.body };

        if (updateData.image === undefined || !updateData.image || !String(updateData.image).trim()) {
            updateData.image = resolveEventImage(event.image);
        } else {
            updateData.image = resolveEventImage(updateData.image);
        }

        if (updateData.time === undefined && event.time) {
            updateData.time = event.time;
        }

        if (updateData.totalSeats !== undefined) {
            const nextTotalSeats = Number(updateData.totalSeats);
            if (Number.isNaN(nextTotalSeats) || nextTotalSeats < 0) {
                return res.status(400).json({ message: 'Total seats must be a valid non-negative number' });
            }

            const alreadyBooked = event.totalSeats - event.availableSeats;
            if (nextTotalSeats < alreadyBooked) {
                return res.status(400).json({
                    message: `Cannot reduce total seats below the current booked count (${alreadyBooked}).`
                });
            }

            updateData.totalSeats = nextTotalSeats;
            updateData.availableSeats = Math.max(0, nextTotalSeats - alreadyBooked);
        }

        const updatedEvent = await Event.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(updatedEvent);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
