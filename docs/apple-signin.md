# Sign in with Apple (Web)

Lensaya uses the standard Apple web flow:
1. Frontend opens Apple Sign-In JS popup and receives `code` and `id_token`.
2. Frontend sends the payload to `POST /api/v1/auth/apple`.
3. Backend exchanges `code` at Apple token endpoint and verifies the returned `id_token`.
4. Backend links users by stable Apple subject (`sub` / `appleId`) and falls back to email linkage for first login only.

## Apple Developer Portal Steps

1. Create or identify your existing primary App ID.
2. Ensure Sign in with Apple is enabled on that App ID.
3. Create a Services ID for web auth.
4. Open the Services ID configuration and:
   - Associate it with the primary App ID.
   - Add Website URLs (domains/subdomains).
   - Add Return URLs.
5. Create a Sign in with Apple private key (.p8):
   - Enable Sign in with Apple on the key.
   - Associate the key to your App ID.
   - Download and store the `.p8` file.
6. Copy these values from Apple:
   - Team ID
   - Key ID
   - Services ID

## Env Vars To Fill

Backend (`backend/.env`):
- `APPLE_AUTH_ENABLED=true`
- `APPLE_CLIENT_ID=` Apple Services ID (web OAuth client_id)
- `APPLE_TOKEN_EXCHANGE_ENABLED=true`
- `APPLE_TEAM_ID=` Team ID
- `APPLE_KEY_ID=` Key ID
- `APPLE_PRIVATE_KEY=` full `.p8` key text
- `APPLE_REDIRECT_URI=` return URL

Frontend (`frontend/.env`):
- `VITE_APPLE_AUTH_ENABLED=true`
- `VITE_APPLE_CLIENT_ID=` same Apple Services ID as backend
- `VITE_APPLE_REDIRECT_URI=` same URL as backend `APPLE_REDIRECT_URI`

Important:
- `APPLE_CLIENT_ID` is the Apple Services ID for web auth.
- `APPLE_PRIVATE_KEY` supports both real multiline value and escaped `\\n` format.
- Startup fails clearly when Apple auth is enabled but required config is missing/invalid.

## Return URLs To Register

Register each value below in Apple Developer Services ID Return URLs, and use the same value in both frontend and backend env:

- Local: `http://localhost:5173`
- Staging: `https://app-staging.your-domain.com`
- Production: `https://app.your-domain.com`

Register matching Website URLs (domains/subdomains):
- Local domain: `localhost`
- Staging domain: `app-staging.your-domain.com`
- Production domain: `app.your-domain.com`

## Local And Staging Test Flow

1. Set Apple env vars in both backend and frontend.
2. Start backend and frontend.
3. Open login or signup page and click Continue with Apple.
4. Complete Apple consent flow.
5. Confirm authenticated session is created and user is redirected.

## Manual Smoke Checklist

- [ ] Apple button visible on login when `VITE_APPLE_AUTH_ENABLED=true` and Apple env is complete.
- [ ] Apple button visible on signup when `VITE_APPLE_AUTH_ENABLED=true` and Apple env is complete.
- [ ] First Apple login creates account when no existing `appleId` exists.
- [ ] Repeat Apple login returns the same account via `appleId`.
- [ ] Google login still works after Apple is enabled.
- [ ] Disabling `APPLE_AUTH_ENABLED` makes `/auth/apple` return 404.

## Apple Data Caveat

Apple may provide `name` and `email` only on the first authorization for a Services ID. Later logins can omit them, so account linkage must rely on Apple `sub` (`appleId`) as the stable identifier.
