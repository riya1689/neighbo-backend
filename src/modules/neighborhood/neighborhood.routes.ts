import express, { type Router } from "express";
import { getAllNeighborhoods } from "./neighborhood.controller.js";

const router: Router = express.Router();

router.get("/", getAllNeighborhoods);

export default router;
