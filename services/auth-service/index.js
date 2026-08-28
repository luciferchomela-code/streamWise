import express from "express";
import dotenv from "dotenv";
import connectDB from "../shared/config/db.js";
import authRoute from "./src/routes/auth.route.js";

dotenv.config();

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoute);

app.use((error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(error.statusCode || 500).json({
        message: error.message || "Internal server error",
    });
});

const PORT = process.env.PORT || 5001;

const start = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Auth service running on port ${PORT}`);
    });
};

start();
