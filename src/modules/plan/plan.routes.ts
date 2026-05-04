import express, { type Router } from "express";
import { getActivePlans } from "./plan.controller.js";

const router: Router = express.Router();

router.get("/", getActivePlans);

export default router;
