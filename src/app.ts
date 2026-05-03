import express, { Application, Request } from "express"; // TS Change: Added types
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";

import routes from "./routes/index"; // TS Change: Removed .js
import notFound from "./middleware/notFound"; 
import errorHandler from "./middleware/errorHandler";
import { globalLimiter } from "./middlewares/rateLimiter";
import { ALLOWED_ORIGINS } from "./config/env";

const app: Application = express(); // TS Change: Explicit type Application

// Security/UX defaults
app.use(helmet());
app.use(globalLimiter);

// TS Change: Added types for CORS origin callback
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(hpp());

// API routes
app.use("/api", routes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;