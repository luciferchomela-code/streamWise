import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const mongoUrl = process.env.MONGO_URL;

        if (!mongoUrl) {
            throw new Error("MONGO_URL is required");
        }

        const conn = await mongoose.connect(mongoUrl, {
            dbName: process.env.MONGO_DB_NAME || "streamwise",
        });
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.log("Database connection error:", error);
        process.exit(1);
    }
};

export default connectDB;
