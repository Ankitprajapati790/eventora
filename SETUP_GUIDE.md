<h1 align="center">Eventora | Setup &amp; Deployment</h1>
<p align="center"><strong>Local development → GitHub → Render</strong></p>
<p align="center">
	<img alt="Node.js 20 or newer" src="https://img.shields.io/badge/Node.js-20%2B-43853D?logo=nodedotjs&logoColor=white">
	<img alt="MongoDB" src="https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb&logoColor=white">
	<img alt="Render" src="https://img.shields.io/badge/Hosting-Render-46E3B7?logo=render&logoColor=111111">
</p>

Use this guide to configure a local database, run the complete app, create the first admin account, and deploy the GitHub repository as a Render Blueprint.

<p align="center"><strong>Live application:</strong> <a href="https://eventora-n1ou.onrender.com">Open Eventora</a></p>

## Contents

- [Requirements](#requirements)
- [Configure MongoDB](#1-create-a-mongodb-atlas-database)
- [Set local environment](#2-configure-local-environment)
- [Run locally](#3-start-the-application)
- [Create the first admin](#4-create-the-first-admin)
- [Test and build](#6-run-checks)
- [Deploy to Render](#7-deploy-to-render)
- [Email OTP](#email-otp-configuration)

## Requirements

- Node.js 20 or newer and npm
- A MongoDB database, either local or hosted with MongoDB Atlas
- A Resend API key and verified sender domain for production email delivery

The client and server are npm workspaces. Install and run both from the repository root; separate client and server terminals are not needed.

> [!IMPORTANT]
> Use Node.js 20 or newer. MongoDB must be reachable before the API starts; `npm install` does not create or host a database.

## 1. Create a MongoDB Atlas Database

1. Create an account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a cluster.
2. In **Database Access**, create a database user with a unique password. This database user is separate from your Eventora admin account.
3. In **Network Access**, allow your development machine to connect. For Render, allow the service's outbound IP addresses where available. `0.0.0.0/0` permits connections from any IP; use it only if necessary, and protect the database with a strong password.
4. From **Connect > Drivers**, copy the connection string and select a database name such as `eventora`.
5. URL-encode special characters in the database username or password before placing them in the connection string.

## 2. Configure Local Environment

From the project root, create the local environment file:

```powershell
Copy-Item server/.env.example server/.env
```

Edit `server/.env` and set:

```env
NODE_ENV=development
MONGO_URI=mongodb+srv://<database-user>:<encoded-password>@<cluster-host>/eventora?retryWrites=true&w=majority
JWT_SECRET=<long-random-private-value>
EMAIL_USER=
EMAIL_PASS=
PORT=5000
```

Keep `server/.env` private. It is ignored by Git; never paste secrets into source files or commit history. For local testing without email, leave the email values blank and read OTPs from the server terminal.

> [!WARNING]
> URL-encode reserved characters in MongoDB usernames and passwords. Never commit a populated `.env` file or paste credentials into a public issue.

## 3. Start the Application

Run these commands at the project root:

```sh
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`. The Vite development server forwards `/api` requests to Express on port `5000`. The backend waits for a MongoDB connection and exits with an error if it cannot connect.

## 4. Create the First Admin

Public registration creates user accounts only. To create the first admin locally, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the current terminal. Use a unique password at least 12 characters long.

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "<private-password>"
npm run admin:create --workspace server
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

The command hashes the password and refuses to add another admin if one already exists. Keep the password out of shell history where possible.

## 5. Optional Demo Data

For a disposable local database only, run:

```sh
npm run seed --workspace server
```

This deletes all existing users, events, and bookings before inserting demo data. Do not run it against a production or personal database. The seed is blocked when `NODE_ENV=production`.

## 6. Run Checks

From the project root:

```sh
npm test
npm run lint
npm run build
```

The production server serves the built client and API from one process. To test locally, build the client, set `NODE_ENV=production`, ensure `MONGO_URI`, `JWT_SECRET`, and either `RESEND_API_KEY` plus `EMAIL_FROM` or `EMAIL_USER` plus `EMAIL_PASS` are configured, then run `npm start`.

## 7. Deploy to Render

1. Push the project to GitHub and select **New > Web Service** in Render.
2. Connect the repository `Ankitprajapati790/eventora` (or select the public repository URL), branch `main`, region Oregon, and the repository root as the root directory.
3. Set the build command to `npm install --include=dev && npm run build` and the start command to `npm run start`. Set the health check to `/api/health`.
4. Choose a compute plan. The current live service uses Render's free plan, which may sleep when idle.
5. Add `NODE_ENV=production`, `MONGO_URI`, `RESEND_API_KEY`, `EMAIL_FROM`, and a generated `JWT_SECRET` in Render's environment settings. Never commit these values or paste them into chat.
6. Deploy and check the service URL. The live app is [https://eventora-n1ou.onrender.com](https://eventora-n1ou.onrender.com); its health endpoint should return `"status":"ok"` and `"database":"connected"`.
7. To create the first admin on a fresh database, use a trusted local checkout whose `server/.env` points to the same MongoDB database. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the local shell, then run `npm run admin:create --workspace server`. The bootstrap refuses to add another admin if one exists.

> [!NOTE]
> Public-repository deployments do not automatically deploy future commits. Connect Render's GitHub integration to enable automatic deploys. The free plan does not include the Render Shell workflow.

## Email OTP Configuration

For reliable delivery from Render, configure a Resend API key as `RESEND_API_KEY` and a sender address on a domain verified with Resend as `EMAIL_FROM` (for example, `Eventora <notifications@your-verified-domain.com>`). The app sends through Resend's HTTPS API, avoiding SMTP port restrictions on hosted platforms. Never commit the API key.

For local development, Gmail SMTP is also supported: enable 2-Step Verification, create a Google App Password, and set `EMAIL_USER` and `EMAIL_PASS`. Do not use your normal Gmail password. Email delivery errors return promptly and include the provider's rejection reason when available. If a signup is unverified because delivery failed, submit the same email again to set/update the pending account password and request a fresh OTP.

When using the Render Blueprint, set `RESEND_API_KEY` and `EMAIL_FROM` in the service's environment settings after verifying the sender domain with Resend. The app cannot deliver production emails until the provider key and sender address are valid.

## Booking and Payment Scope

Bookings are requests that an admin approves or rejects. The app records whether an approved booking is paid, but does not charge cards or integrate a payment provider. Payment success/failure routes are informational pages, not a checkout flow.
