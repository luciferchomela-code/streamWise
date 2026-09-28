import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5001";

const proxy = createProxy(AUTH_SERVICE_URL, "Auth service");

router.post("/login", proxy);
router.post("/refresh", proxy);
router.post("/logout", proxy);

router.get("/me", isAuth, proxy);

export default router;