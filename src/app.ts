import express from "express";
import { type Application, type Request, type Response, type NextFunction } from "express"; 
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";

import routes from "./routes/index.js"; 
import notFound from "./middleware/notFound.js"; 
import errorHandler from "./middleware/errorHandler.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";
import { ALLOWED_ORIGINS } from "./config/env.js";
import passport from "./config/passport.js";

const app: Application = express(); // TS Change: Explicit type Application
app.use(passport.initialize());
app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "success",
    message: "Neighbo backend is running!",
    api_health: "/api/health",
    timestamp: new Date().toISOString()
  });
});
// Security/UX defaults
app.use(helmet());
// TS Change: Added types for CORS origin callback
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Dynamically allow SSLCommerz origins for payment callbacks
    const sslCommerzOrigins = ["https://sandbox.sslcommerz.com", "https://securepay.sslcommerz.com"];
    const allAllowedOrigins = [...ALLOWED_ORIGINS, ...sslCommerzOrigins];

    console.log(`CORS Check - Origin: ${origin}, Allowed: ${allAllowedOrigins.join(', ')}`);
    
    if (!origin || allAllowedOrigins.includes(origin)) {
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
app.use(express.urlencoded({ extended: true })); // Required for SSLCommerz form POST callbacks
app.use(hpp());

// API routes
app.use("/api", routes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;