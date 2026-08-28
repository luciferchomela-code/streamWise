import express from "express"
import {loginUser, myProfile, refreshAccessToken, logoutUser } from "../controller/auth.controller.js"
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js"

const router = express.Router()

router.post("/login", loginUser)
router.post("/refresh", refreshAccessToken)
router.post("/logout", logoutUser)
router.get("/me", requireGatewayIdentity, myProfile)

export default router
