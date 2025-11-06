import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { Event, EVENT_STATUS } from '../models/Event.js';

const router = express.Router();

router.use(authRequired);

// List my events
router.get('/', async (req, res) => {
  const events = await Event.find({ owner: req.user.id }).sort({ startTime: 1 });
  res.json(events);
});

// Create event
router.post('/', async (req, res) => {
  try {
    const { title, startTime, endTime, status } = req.body;
    if (!title || !startTime || !endTime) return res.status(400).json({ error: 'Missing fields' });
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || end <= start) return res.status(400).json({ error: 'Invalid times' });
    const ev = await Event.create({ title, startTime: start, endTime: end, status: status || EVENT_STATUS.BUSY, owner: req.user.id });
    res.status(201).json(ev);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event (owner only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['title', 'startTime', 'endTime', 'status'];
    for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
    if (updates.startTime) updates.startTime = new Date(updates.startTime);
    if (updates.endTime) updates.endTime = new Date(updates.endTime);
    const ev = await Event.findOne({ _id: id, owner: req.user.id });
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    if (ev.status === EVENT_STATUS.SWAP_PENDING && 'status' in updates) {
      return res.status(400).json({ error: 'Cannot change status while swap pending' });
    }
    Object.assign(ev, updates);
    await ev.save();
    res.json(ev);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (only if not pending)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ev = await Event.findOne({ _id: id, owner: req.user.id });
    if (!ev) return res.status(404).json({ error: 'Event not found' });
    if (ev.status === EVENT_STATUS.SWAP_PENDING) return res.status(400).json({ error: 'Cannot delete event during swap pending' });
    await ev.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
