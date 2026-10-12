<h1 align="center">Eventora | Setup &amp; Deployment</h1>
<p align="center"><strong>Local development → GitHub → Render</strong></p>
<p align="center">
	<img alt="Node.js 20 or newer" src="https://img.shields.io/badge/Node.js-20%2B-43853D?logo=nodedotjs&logoColor=white">
	<img alt="MongoDB" src="https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb&logoColor=white">
	<img alt="Render" src="https://img.shields.io/badge/Hosting-Render-46E3B7?logo=render&logoColor=111111">
</p>

Use this guide to configure a local database, run the complete app, create the first admin account, and deploy the GitHub repository as a Render Blueprint.

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
- Gmail credentials with an App Password if you want OTP emails delivered

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

The production server serves the built client and API from one process. To test locally, build the client, set `NODE_ENV=production`, ensure `MONGO_URI`, `JWT_SECRET`, `EMAIL_USER`, and `EMAIL_PASS` are configured, then run `npm start`.

## 7. Deploy to Render

1. Push the project repository to GitHub and confirm `render.yaml` is in the repository root.
2. In Render, select **New > Blueprint**. Connect GitHub if prompted, then choose `Ankitprajapati790/eventora`.
3. Review the Blueprint plan. It should create one Node web service named `eventora` from the repository root, with `npm install && npm run build` as the build command and `npm start` as the start command.
4. Enter `MONGO_URI`, `EMAIL_USER`, and `EMAIL_PASS` in Render's secret environment fields. Render generates `JWT_SECRET`. Never commit these values or paste them into chat.
5. Apply the Blueprint and wait for the build and deploy to finish. Render sets `NODE_ENV=production` and checks `/api/health`.
6. Open the service URL and append `/api/health`. A healthy deployment returns JSON with `"status":"ok"` and `"database":"connected"`.
7. Create the first admin from the Render Shell. Temporarily set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, run `npm run admin:create --workspace server` from the repository root, then remove the temporary password from the service environment.

> [!NOTE]
> The admin bootstrap refuses to create another admin if one already exists. Choose a strong, unique password.

## Email OTP Configuration

For Gmail, enable 2-Step Verification in your Google Account and create an App Password. Put the Gmail address in `EMAIL_USER` and the App Password in `EMAIL_PASS`. Never use your normal Gmail password. Production startup requires both variables; incorrect SMTP credentials prevent OTP email delivery.

## Booking and Payment Scope

Bookings are requests that an admin approves or rejects. The app records whether an approved booking is paid, but does not charge cards or integrate a payment provider. Payment success/failure routes are informational pages, not a checkout flow.
