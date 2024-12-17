import express from "express";
import { appendDealerInfo } from "../controllers/dealer.controller.js";

const router = express.Router();

router.route("/appendDealerInfo").post(appendDealerInfo);

export default router;
