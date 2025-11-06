import mongoose from 'mongoose';

export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
};

const swapRequestSchema = new mongoose.Schema(
  {
    requesterUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mySlot: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    theirSlot: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    status: { type: String, enum: Object.values(REQUEST_STATUS), default: REQUEST_STATUS.PENDING, index: true },
  },
  { timestamps: true }
);

export const SwapRequest = mongoose.model('SwapRequest', swapRequestSchema);
