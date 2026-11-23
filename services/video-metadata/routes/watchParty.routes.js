import express from "express";
import {
  getPartySnapshot,
  joinParty,
  applyPartyAction,
} from "../controllers/watchParty.controller.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import { optionalGatewayIdentity } from "../middlewares/optionalGatewayIdentity.js";

const router = express.Router();

router.get("/:roomId", optionalGatewayIdentity, getPartySnapshot);
router.post("/:roomId/join", optionalGatewayIdentity, joinParty);
router.post("/:roomId/action", requireGatewayIdentity, applyPartyAction);

export default router;
