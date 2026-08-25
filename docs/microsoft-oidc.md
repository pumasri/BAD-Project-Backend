# Microsoft OIDC authentication

The browser starts authentication at `GET /api/auth/microsoft`. The backend
uses Microsoft Entra's tenant-specific OpenID Connect discovery document and
Authorization Code Flow with PKCE, state, and nonce. Microsoft returns only to
the configured backend callback URL.

The backend validates the authorization response and ID token with
`openid-client`, then looks up the local user by Microsoft object ID or
normalized AU email. Local PostgreSQL roles remain authoritative. Every new AU
tenant identity is created with `STUDENT`; only an existing database assignment
can grant `STAFF` or `ADMIN`.

The temporary email/password development-login endpoint is removed. Logout
calls `POST /api/auth/logout`, increments the local user's JWT token version,
and invalidates the application token before the frontend returns to `/login`.

After successful validation, the callback redirects to the fixed
`FRONTEND_URL` with a random, single-use handoff code. The frontend exchanges
that code for the existing application JWT. The handoff expires after one
minute and is deleted on first use. The application JWT is never placed in a
URL.

## Microsoft Entra application setup

Configure a Web redirect URI matching `MICROSOFT_REDIRECT_URI` exactly. For
local development it is:

`http://localhost:5050/api/auth/microsoft/callback`

The application needs the standard OpenID scopes `openid`, `profile`, and
`email`. The client secret is backend-only. Register the frontend root URL as
an allowed post-logout redirect if tenant policy requires it.

## Environment

Copy `.env.example` to `.env` and replace placeholders locally. Never commit
`.env`.

No Prisma migration is required: the existing `User.microsoftObjectId` field
already maps uniquely to the `microsoftOid` database column.

## Local verification

1. Start PostgreSQL and ensure the existing Prisma migrations are applied.
2. Start the backend with `npm run dev` from the backend repository.
3. Start the frontend with `npm run dev` from the frontend repository.
4. Open `http://localhost:5173/login` and select **Sign in with Microsoft**.
5. Sign in with an account from the configured AU tenant.
6. Confirm a new student reaches `/student-home`, while pre-provisioned staff
   and admins reach their database-role dashboards.
7. Refresh the dashboard and confirm `/api/auth/me` restores the session.
8. Log out and confirm both the local token and Microsoft browser session are
   cleared where Microsoft end-session is available.
