import express from 'express';
import mongoose from 'mongoose';
import { authRequired } from '../middleware/auth.js';
import { Event, EVENT_STATUS } from '../models/Event.js';
import { SwapRequest, REQUEST_STATUS } from '../models/SwapRequest.js';

const router = express.Router();

router.use(authRequired);

// GET /api/swappable-slots - all others' SWAPPABLE events
router.get('/swappable-slots', async (req, res) => {
  const events = await Event.find({ status: EVENT_STATUS.SWAPPABLE, owner: { $ne: req.user.id } })
    .sort({ startTime: 1 })
    .populate('owner', 'name email');
  res.json(events);
});

// POST /api/swap-request { mySlotId, theirSlotId }
router.post('/swap-request', async (req, res) => {
  const { mySlotId, theirSlotId } = req.body;
  if (!mySlotId || !theirSlotId) return res.status(400).json({ error: 'Missing slot ids' });

  const mySlot = await Event.findOne({ _id: mySlotId, owner: req.user.id, status: EVENT_STATUS.SWAPPABLE });
  if (!mySlot) return res.status(400).json({ error: 'Your slot is not available to swap' });

  const theirSlot = await Event.findOne({ _id: theirSlotId, owner: { $ne: req.user.id }, status: EVENT_STATUS.SWAPPABLE }).populate('owner', 'name email');
  if (!theirSlot) return res.status(400).json({ error: 'Requested slot not available' });

  // Optimistically set both to SWAP_PENDING (guarding current state)
  const updatedMy = await Event.findOneAndUpdate(
    { _id: mySlot._id, status: EVENT_STATUS.SWAPPABLE },
    { $set: { status: EVENT_STATUS.SWAP_PENDING } },
    { new: true }
  );
  if (!updatedMy) return res.status(409).json({ error: 'Your slot is no longer swappable' });

  const updatedTheir = await Event.findOneAndUpdate(
    { _id: theirSlot._id, status: EVENT_STATUS.SWAPPABLE },
    { $set: { status: EVENT_STATUS.SWAP_PENDING } },
    { new: true }
  );
  if (!updatedTheir) {
    // rollback mine
    await Event.updateOne({ _id: mySlot._id, status: EVENT_STATUS.SWAP_PENDING }, { $set: { status: EVENT_STATUS.SWAPPABLE } });
    return res.status(409).json({ error: 'Requested slot was taken' });
  }

  const reqDoc = await SwapRequest.create({
    requesterUser: req.user.id,
    receiverUser: theirSlot.owner._id || theirSlot.owner,
    mySlot: mySlot._id,
    theirSlot: theirSlot._id,
    status: REQUEST_STATUS.PENDING,
  });

  res.status(201).json(reqDoc);
});

// GET /api/requests - incoming & outgoing for current user
router.get('/requests', async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const [incoming, outgoing] = await Promise.all([
    SwapRequest.find({ receiverUser: userId })
      .sort({ createdAt: -1 })
      .populate('mySlot')
      .populate('theirSlot')
      .populate('requesterUser', 'name email')
      .populate('receiverUser', 'name email'),
    SwapRequest.find({ requesterUser: userId })
      .sort({ createdAt: -1 })
      .populate('mySlot')
      .populate('theirSlot')
      .populate('requesterUser', 'name email')
      .populate('receiverUser', 'name email'),
  ]);
  res.json({ incoming, outgoing });
});

// POST /api/swap-response/:requestId { accept: boolean }
router.post('/swap-response/:id', async (req, res) => {
  const { id } = req.params;
  const { accept } = req.body;
  if (typeof accept !== 'boolean') return res.status(400).json({ error: 'accept must be boolean' });

  try {
    const reqDoc = await SwapRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ error: 'Request not found' });
    if (reqDoc.receiverUser.toString() !== req.user.id) return res.status(403).json({ error: 'Not authorized to respond to this request' });
    if (reqDoc.status !== REQUEST_STATUS.PENDING) return res.status(400).json({ error: 'Request is not pending' });

    const mySlotId = reqDoc.mySlot;
    const theirSlotId = reqDoc.theirSlot;
    const requesterId = reqDoc.requesterUser.toString();
    const receiverId = reqDoc.receiverUser.toString();

    if (!accept) {
      // Reject: reset both to SWAPPABLE if still pending
      await Promise.all([
        Event.updateOne({ _id: mySlotId, owner: requesterId, status: EVENT_STATUS.SWAP_PENDING }, { $set: { status: EVENT_STATUS.SWAPPABLE } }),
        Event.updateOne({ _id: theirSlotId, owner: receiverId, status: EVENT_STATUS.SWAP_PENDING }, { $set: { status: EVENT_STATUS.SWAPPABLE } }),
      ]);
      reqDoc.status = REQUEST_STATUS.REJECTED;
      await reqDoc.save();
      return res.json({ ok: true, status: reqDoc.status });
    }

    // Accept path: try a transaction; if not supported, fallback gracefully
    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(async () => {
          // Ensure both slots are still pending and owners match expectations
          const updatedMy = await Event.findOneAndUpdate(
            { _id: mySlotId, owner: requesterId, status: EVENT_STATUS.SWAP_PENDING },
            { $set: { owner: receiverId, status: EVENT_STATUS.BUSY } },
            { session, new: true }
          );
          if (!updatedMy) throw new Error('Your offered slot is no longer pending');

          const updatedTheir = await Event.findOneAndUpdate(
            { _id: theirSlotId, owner: receiverId, status: EVENT_STATUS.SWAP_PENDING },
            { $set: { owner: requesterId, status: EVENT_STATUS.BUSY } },
            { session, new: true }
          );
          if (!updatedTheir) throw new Error('Their slot is no longer pending');

          reqDoc.status = REQUEST_STATUS.ACCEPTED;
          await reqDoc.save({ session });
        });
      } catch (txnErr) {
        // If transactions are not supported (standalone Mongo), ignore and fallback
        // code 20 IllegalOperation or message contains 'Transaction numbers'
        const msg = txnErr?.message || '';
        if (txnErr?.code === 20 || txnErr?.codeName === 'IllegalOperation' || msg.includes('Transaction numbers')) {
          // do nothing, will fallback below
        } else if (reqDoc.status !== REQUEST_STATUS.ACCEPTED) {
          // For any other txn error, also fallback to best-effort conditional updates
        }
      }

      if (reqDoc.status === REQUEST_STATUS.ACCEPTED) {
        return res.json({ ok: true, status: reqDoc.status });
      }

      // Fallback (no transaction available): conditional updates
      const updatedMy = await Event.findOneAndUpdate(
        { _id: mySlotId, owner: requesterId, status: EVENT_STATUS.SWAP_PENDING },
        { $set: { owner: receiverId, status: EVENT_STATUS.BUSY } },
        { new: true }
      );
      const updatedTheir = await Event.findOneAndUpdate(
        { _id: theirSlotId, owner: receiverId, status: EVENT_STATUS.SWAP_PENDING },
        { $set: { owner: requesterId, status: EVENT_STATUS.BUSY } },
        { new: true }
      );

      if (!updatedMy || !updatedTheir) {
        // rollback best-effort to SWAPPABLE if partial
        if (updatedMy) await Event.updateOne({ _id: mySlotId }, { $set: { owner: requesterId, status: EVENT_STATUS.SWAPPABLE } });
        if (updatedTheir) await Event.updateOne({ _id: theirSlotId }, { $set: { owner: receiverId, status: EVENT_STATUS.SWAPPABLE } });
        reqDoc.status = REQUEST_STATUS.REJECTED;
        await reqDoc.save();
        return res.status(409).json({ error: 'Swap could not be completed due to concurrent change. Try again.' });
      }

      reqDoc.status = REQUEST_STATUS.ACCEPTED;
      await reqDoc.save();
      return res.json({ ok: true, status: reqDoc.status });
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error('swap-response error', err);
    return res.status(500).json({ error: 'Failed to process swap response' });
  }
});

export default router;
