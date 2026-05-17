# Neighbo Backend

Welcome to the backend of **Neighbo**, a community-driven platform designed to connect neighbors, share updates, and provide a space for local interactions.

## Project Overview
The Neighbo Backend is a robust and scalable API built with **Node.js**, **Express.js** and **TypeScript**. It serves as the core logic provider for the Neighbo platform, handling everything from secure authentication and payment processing to AI-driven assistance and real-time social interactions.

---

## Live Demo
Live site: [https://neighbo-backend.vercel.app](https://neighbo-backend.vercel.app)
---

## Role & Permissions
The system implements a Role-Based Access Control (RBAC) mechanism:

- **PUBLIC USER**:
    - Users who are not logged in.
    - They can only view content.
    - They cannot create posts, comments, votes, shares, use AI features, or subscribe to premium plans.

- **REGISTERED USER**:
    - Create and interact with posts (comments, votes, shares).
    - Follow/Unfollow other neighbors.
    - Subscribe to Premium Plans.
    - Unlock premium content.
    - Access AI Assistant.
- **ADMIN**:
    - All USER permissions.
    - Access to Admin Dashboard.
    - Manage categories and neighborhoods.
    - Moderate events and system updates.
    - View platform-wide revenue and analytics.

---

## Features & Functionality
- **Authentication**: Secure login via Google OAuth 2.0 (passportjs)and Email, Password with JWT, password hashing with bcryptjs..
- **Social Core**: Posting (images/text), commenting, upvoting/downvoting, follow/unfollow and sharing.
- **Premium Content**: Monetization system allowing creators to set prices for specific posts. If any user unlocks or purchases premium content, that payment is added to the premium content creator’s revenue balance.
- **Premium Plans**: When a user purchases a premium subscription plan, the payment is added to the platform admin’s revenue.
- **AI Integration**: Integrated **Google Gemini AI** for smart community assistance.
- **Invoice Generation**: Automatic invoice generation with **SSLCommerz** for subscriptions and content unlocking.
- **Downloadable Cash Memo**: Users can download their cash memo after payment.
- **Payment Gateway**: Seamless integration with **SSLCommerz** for subscriptions and content unlocking.
- **Notifications**: System-wide notification service for follows, votes, and activities.
- **Event Management**: Community event scheduling and approval workflow.
-**User Dashboard**: User's personalized activity center.
-**Admin Dashboard**: Full-featured management suite for platform administrators.
-**Responsive Dashboard**: A personalized home feed for neighborhood updates.
-**Event Discovery**: Calendar and list views for upcoming neighborhood events.
-**Explore Feature**: Discover new neighborhoods and trending posts and categories.
-**Onboarding Flow**: Structured registration process including neighborhood selection.

---
## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: Passport.js (Google OAuth), JWT, Bcrypt
- **AI**: Google Generative AI (Gemini)
- **Payments**: SSLCommerz LTS
- **Security**: Helmet, HPP, Express Rate Limit, CORS

---

## API Endpoints
All routes are prefixed with `/api`.

| Route | Description |
|-------|-------------|
| `/api/auth` | Authentication (Google & Local) |
| `/api/users` | User profiles and follower management |
| `/api/posts` | Post CRUD and feed retrieval |
| `/api/neighborhoods`| Neighborhood management |
| `/api/categories` | Post category management |
| `/api/payments` | Payment processing and SSLCommerz callbacks |
| `/api/admin` | Administrative dashboards and management |
| `/api/ai` | AI Assistant interactions |
| `/api/notifications`| User notification center |
| `/api/events` | Community event management |

---

## Error Handling
The backend uses a centralized error-handling middleware to ensure clean and consistent error responses. Whenever users try restricted actions or done successfull actions, the system shows beautiful React Hot Toast error messages. 

**Sample Error Response:**
```json 
{
  "status": "error",
  "message": "Detailed error message here"
}
```
- **Validation Errors**: Returns 400 Bad Request with specific details.
- **Authentication Errors**: Returns 401 Unauthorized for missing/invalid tokens.
- **Authorization Errors**: Returns 403 Forbidden for insufficient permissions.
- **Not Found**: Returns 404 for missing resources.

---

## Database Tables
The platform uses **Prisma** with **PostgreSQL**. Key models include:

- `User`: Stores user profiles, roles, and status.
- `Neighborhood`: Community groups.
- `Post`: Content shared by users (supports `isPremium`).
- `Comment`: User interactions on posts.
- `Follow`: Social connections between users.
- `Payment`: Transaction logs.
- `Invoice`: Financial records for users.
- `Notification`: Alerts for user activities.
- `Event`: Neighborhood community events.
- `PremiumPlan`: Available subscription tiers.

---

## Getting Started

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Setup**:
   Create a `.env` file with:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `STORE_ID` & `STORE_PASS` (SSLCommerz)
   - `GEMINI_API_KEY`

3. **Prisma Setup**:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Run Development Server**:
   ```bash
   pnpm dev
   ```
