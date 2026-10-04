import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { VideoInteraction } from '../shared/models/videoInteraction.model.js';

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  const interactions = await VideoInteraction.find();
  console.log("All interactions:", interactions);
  
  process.exit(0);
}
test();
