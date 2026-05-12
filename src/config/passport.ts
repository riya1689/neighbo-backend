import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma.js";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } from "./env.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, displayName, emails, photos } = profile;
        const email = emails?.[0]?.value;

        if (!email) {
          return done(new Error("No email found from Google profile"), undefined);
        }

        // Check if user exists by googleId
        let user = await prisma.user.findUnique({
          where: { googleId: id },
        });

        if (!user) {
          // Check if user exists by email
          user = await prisma.user.findUnique({
            where: { email },
          });

          if (user) {
            // Update existing user with googleId
            user = await prisma.user.update({
              where: { email },
              data: { googleId: id },
            });
          } else {
            // Create new user
            // Generate unique username
            let baseUsername = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            if (!baseUsername) baseUsername = 'user';
            
            let username = baseUsername;
            let counter = 1;
            let usernameExists = true;

            while (usernameExists) {
              const existing = await prisma.user.findUnique({ where: { username } });
              if (!existing) {
                usernameExists = false;
              } else {
                username = `${baseUsername}_${counter}`;
                counter++;
              }
            }

            user = await prisma.user.create({
              data: {
                displayName,
                email,
                username,
                googleId: id,
                // password is optional in schema now
              },
            });
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
