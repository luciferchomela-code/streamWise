import express from "express"
import {loginUser, myProfile, refreshAccessToken, logoutUser } from "../controller/auth.controller.js"
import { isAuth } from "../../../api-gateway/src/middleware/isAuth.js"

const router = express.Router()

router.post("/login", loginUser)
router.post("/refresh", refreshAccessToken)
router.post("/logout", logoutUser)
router.get("/me", isAuth, myProfile)

export default router