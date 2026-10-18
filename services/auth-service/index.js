import express from "express";
import dotenv from "dotenv";
import connectDB from "../shared/config/db.js";
import authRoute from "./src/routes/auth.route.js";

import { parseCookies } from "./src/middlewares/parseCookies.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(parseCookies);

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
    if (process.env.NODE_ENV === "production") {
        if (!process.env.JWT_SEC) {
            throw new Error("FATAL: JWT_SEC must be configured in environment variables");
        }
        if (!process.env.GATEWAY_SECRET) {
            throw new Error("FATAL: GATEWAY_SECRET must be configured in environment variables");
        }
    }

    await connectDB();

    app.listen(PORT, () => {
        console.log(`Auth service is running on port ${PORT}`);
    });
};

start();
