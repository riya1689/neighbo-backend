import express, { type Application, type Request } from "express"; // TS Change: Added types
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";

import routes from "./routes/index.js"; 
import notFound from "./middleware/notFound.js"; 
import errorHandler from "./middleware/errorHandler.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";
import { ALLOWED_ORIGINS } from "./config/env.js";

const app: Application = express(); // TS Change: Explicit type Application

// Security/UX defaults
app.use(helmet());
// TS Change: Added types for CORS origin callback
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    console.log(`CORS Check - Origin: ${origin}, Allowed: ${ALLOWED_ORIGINS.join(', ')}`);
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS Blocked for: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(globalLimiter);

// Log requests to help debug CORS
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
  next();
});


app.use(express.json({ limit: '10kb' }));
app.use(hpp());

// API routes
app.use("/api", routes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;