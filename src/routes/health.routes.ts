import express, { type Router } from "express"; // TS Change: Imported Router type
import { getHealth } from "../controllers/healthController.js"; // TS Change: Removed .js extension

const router: Router = express.Router(); // TS Change: Explicitly typed as Router

router.get("/", getHealth);

export default router;