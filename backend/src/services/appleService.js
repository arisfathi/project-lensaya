import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import axios from "axios";
import { ApiError } from "../utils/apiError.js";
import { env } from "../config/env.js";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";

const JWKS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
let cachedJwks = null;
let cachedAtMs = 0;

const nowMs = () => Date.now();

const fetchAppleJwks = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && cachedJwks && nowMs() - cachedAtMs < JWKS_CACHE_TTL_MS) {
    return cachedJwks;
  }

  const res = await axios.get(APPLE_JWKS_URL, { timeout: 8000 });
  const keys = Array.isArray(res?.data?.keys) ? res.data.keys : [];
  cachedJwks = keys;
  cachedAtMs = nowMs();
  return keys;
};

const getTokenKid = (token = "") => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded !== "object") return "";
  return String(decoded?.header?.kid || "");
};

const toPublicKeyObject = (jwk) => {
  try {
    return crypto.createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    throw new ApiError(401, "Invalid Apple token key");
  }
};

const normalizeAppleClientId = () => {
  const clientId = String(env.appleAuth?.clientId || "").trim();
  if (!clientId) {
    throw new ApiError(500, "APPLE_CLIENT_ID not configured");
  }
  return clientId;
};

const normalizeApplePrivateKey = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("\\n") && !trimmed.includes("\n")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  return trimmed;
};

const normalizeAppleTokenExchangeConfig = () => {
  const teamId = String(env.appleAuth?.teamId || "").trim();
  const keyId = String(env.appleAuth?.keyId || "").trim();
  const privateKey = normalizeApplePrivateKey(env.appleAuth?.privateKey || "");
  const redirectUri = String(env.appleAuth?.redirectUri || "").trim();

  const missing = [
    ...(teamId ? [] : ["APPLE_TEAM_ID"]),
    ...(keyId ? [] : ["APPLE_KEY_ID"]),
    ...(privateKey ? [] : ["APPLE_PRIVATE_KEY"]),
    ...(redirectUri ? [] : ["APPLE_REDIRECT_URI"]),
  ];

  if (missing.length > 0) {
    throw new ApiError(500, "Missing required Apple Sign-In env vars: " + missing.join(", "));
  }

  return { teamId, keyId, privateKey, redirectUri };
};

const createAppleClientSecret = ({ teamId, keyId, clientId, privateKey }) => {
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = nowSeconds + 60 * 10;

    return jwt.sign(
      {
        iss: teamId,
        iat: nowSeconds,
        exp: expiresAt,
        aud: APPLE_ISSUER,
        sub: clientId,
      },
      privateKey,
      {
        algorithm: "ES256",
        header: {
          kid: keyId,
        },
      }
    );
  } catch {
    throw new ApiError(500, "APPLE_PRIVATE_KEY is invalid");
  }
};

export const appleService = {
  async verifyIdToken(idToken = "") {
    if (!idToken) throw new ApiError(400, "Missing Apple token");

    const kid = getTokenKid(idToken);
    if (!kid) throw new ApiError(401, "Apple token invalid");

    const audience = normalizeAppleClientId();

    const keys = await fetchAppleJwks();
    let jwk = keys.find((candidate) => candidate?.kid === kid);
    if (!jwk) {
      const refreshed = await fetchAppleJwks({ forceRefresh: true });
      jwk = refreshed.find((candidate) => candidate?.kid === kid);
    }
    if (!jwk) throw new ApiError(401, "Apple token invalid");

    const publicKey = toPublicKeyObject(jwk);

    try {
      const payload = jwt.verify(idToken, publicKey, {
        algorithms: ["RS256"],
        issuer: APPLE_ISSUER,
        audience,
      });
      return payload && typeof payload === "object" ? payload : {};
    } catch {
      throw new ApiError(401, "Apple token invalid");
    }
  },

  async exchangeAuthorizationCode(code = "") {
    if (!code) {
      throw new ApiError(400, "Missing Apple authorization code");
    }

    const clientId = normalizeAppleClientId();
    const { teamId, keyId, privateKey, redirectUri } = normalizeAppleTokenExchangeConfig();
    const clientSecret = createAppleClientSecret({ teamId, keyId, clientId, privateKey });

    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("code", String(code));
    params.set("grant_type", "authorization_code");
    params.set("redirect_uri", redirectUri);

    try {
      const res = await axios.post(APPLE_TOKEN_URL, params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 8000,
      });

      return res?.data || {};
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      if (status >= 400 && status < 500) {
        throw new ApiError(401, "Apple sign-in failed");
      }
      throw new ApiError(503, "Apple sign-in is unavailable");
    }
  },
};