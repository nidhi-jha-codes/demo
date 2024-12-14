import mongoose from "mongoose";

import { MONGODB_URL } from "../constants";
import logger from "../utils/logger";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(`${MONGODB_URL}`);
    logger.info(`MongoDB Connected \n${connectionInstance.connection.host}`);
  } catch (error) {
    logger.error("MongoDB Connection Error", error);
    process.exit(1);
  }
};

export default connectDB;
