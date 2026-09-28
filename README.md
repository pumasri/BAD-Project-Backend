

# Campus Lost & Found Backend

Backend API for a university Lost and Found management system. The system allows students and staff to report lost or found items, submit claims, review possible matches, and manage item recovery securely.

## Features

- Microsoft authentication using Microsoft Entra ID/OIDC
- JWT-based authentication and role-based authorization
- Student, staff, and administrator roles
- Lost-item and found-item reporting
- Image uploads for item reports and claim evidence
- Privacy-aware public item browsing
- AI-assisted lost-and-found item matching using Gemini embeddings
- Manual matching and match review by staff
- Claim submission and evidence management
- Claim approval, rejection, and additional-information requests
- Administrative user, category, partner, and audit-log management
- Partner API for sharing public found-item metadata
- AI assistant for lost-and-found questions
- PostgreSQL database managed with Prisma ORM

## Technology Stack

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- Microsoft Entra ID/OIDC
- JSON Web Tokens
- Google Gemini
- Azure Key Vault
- Zod
- Multer

## User Roles

| Role | Main permissions |
| --- | --- |
| Student | Create lost-item reports, view public found items, submit claims, and view personal claims |
| Staff | Create found-item reports, manage reports, review claims, and manage matches |
| Admin | Manage users, roles, categories, partners, and audit logs |

Anonymous users can view public found-item reports without reporter details.

## Project Structure

```text
.
├── src/
│   ├── config/          # Environment, Prisma, and matching configuration
│   ├── middleware/      # Authentication, authorization, uploads, and error handling
│   ├── routes/          # API route modules
│   ├── services/        # Matching, AI, Microsoft login, Key Vault, and partner services
│   ├── app.js           # Express application configuration
│   └── server.js        # Application entry point
├── prisma/
│   ├── migrations/      # Database migrations
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Initial roles and item categories
├── scripts/             # Demo and showcase data seed scripts
├── docs/
│   └── partner-api.md   # Partner synchronization API documentation
├── .env.example
└── package.json
```

## Requirements

- Node.js 20.19 or later
- PostgreSQL
- Microsoft Entra application credentials
- Gemini API key for AI matching and the AI assistant

Azure Key Vault is required when running in production.

## Installation

Clone the repository and enter the backend directory:

```bash
git clone https://github.com/pumasri/BAD-Project-Backend.git
cd BAD-Project-Backend
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Update `.env` with your local PostgreSQL, Microsoft Entra, JWT, and Gemini configuration.

## Environment Variables

Important variables include:

```env
PORT=5050
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/campus_lost_found?schema=public

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d

MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:5050/api/auth/microsoft/callback

GEMINI_API_KEY=your-gemini-api-key
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-001
```

Do not commit `.env` or expose database passwords, JWT secrets, OAuth secrets, or API keys.

## Database Setup

Generate the Prisma client:

```bash
npm run prisma:generate
```

Run database migrations:

```bash
npm run prisma:migrate
```

Seed the initial roles and item categories:

```bash
npm run prisma:seed
```

Validate the Prisma schema:

```bash
npm run prisma:validate
```

## Running the Application

Start the development server:

```bash
npm run dev
```

Start the production server:

```bash
npm start
```

The API will run at:

```text
http://localhost:5050
```

Check the server health:

```bash
curl http://localhost:5050/api/health
```

## API Overview

All application routes are prefixed with `/api`.

| Area | Example endpoints | Description |
| --- | --- | --- |
| Health | `GET /api/health` | Check backend availability |
| Authentication | `/api/auth/*` | Microsoft login, logout, token exchange, and current-user information |
| Items | `/api/items` | Create, browse, update, and upload images for reports |
| Claims | `/api/claims` | Submit claims, upload evidence, and review claim status |
| Matches | `/api/matches` | Review AI-assisted item matches |
| Categories | `/api/categories` | View item categories |
| Administration | `/api/admin/*` | Manage users, categories, partners, and audit logs |
| Partner API | `/api/peer/*` | Exchange public found-item metadata with partner systems |
| Chat | `POST /api/chat` | Ask the AI assistant a lost-and-found-related question |

Protected endpoints require a bearer token:

```http
Authorization: Bearer <JWT_TOKEN>
```

Partner API requests use an API key:

```http
x-api-key: <PARTNER_API_KEY>
```

For more information about partner synchronization, see [`docs/partner-api.md`](docs/partner-api.md).

## AI-Assisted Matching

When a report is created or updated, the backend can generate an embedding and compare it with eligible reports.

Matching considers:

- Description similarity
- Item category
- Color
- Location
- Date reported

Staff can review, confirm, reject, or manually create matches.

AI matching requires a valid `GEMINI_API_KEY`. Reports can still be created if the embedding service is unavailable, but automatic matching may not be generated.

## Security and Privacy

- Anonymous users can only access public found-item reports.
- Reporter information is hidden from anonymous users.
- Students can access their own reports and claims.
- Staff and administrators have role-specific permissions.
- Invalid or expired JWTs are rejected.
- User logout invalidates existing tokens.
- Partner synchronization exchanges only public found-item metadata.
- Claims, evidence, user information, and private descriptions are not shared through the Partner API.
- Sensitive production secrets can be loaded from Azure Key Vault.

## Testing and Code Checks

Run the automated tests:

```bash
npm test
```

Run JavaScript syntax checks:

```bash
npm run check
```

Run Prisma validation:

```bash
npm run prisma:validate
```

## Useful Commands

```bash
npm run dev
npm start
npm test
npm run check
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run seed:demo
npm run seed:peer-demo
npm run seed:showcase
npm run seed:final
```

## Related Project

The frontend application is maintained in a separate repository and communicates with this backend through the REST API.

## License

This project is intended for academic and educational use.
```

