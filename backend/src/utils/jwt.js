import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtRefreshExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);