import express, { type Router } from "express";
import { getAllCategories } from "./category.controller.js";

const router: Router = express.Router();

router.get("/", getAllCategories);

export default router;
