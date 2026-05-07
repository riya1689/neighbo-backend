// import jwt from "jsonwebtoken";
// import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env.js";

// /**
//  * @param {string} userId
//  * @returns {string}
//  */
// function generateToken(userId: string): string {
//   return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
// }

// export default generateToken;
import jwt, { type SignOptions } from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env.js";

function generateToken(userId: string): string {
  // Cast secret to string and use SignOptions for type safety
  const options: SignOptions = { 
    expiresIn: JWT_EXPIRES_IN as any 
  };

  return jwt.sign({ userId }, JWT_SECRET as string, options);
}

export default generateToken;