import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/slotswapper';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    dbName: uri.split('/').pop(),
  });
  console.log('Connected to MongoDB');
}
