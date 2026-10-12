# Eventora Setup Guide

This guide covers local setup, MongoDB Atlas, email OTPs, creating the first admin, and deploying the app to Render.

## Requirements

- Node.js 20 or newer and npm
- A MongoDB database, either local or hosted with MongoDB Atlas
- Gmail credentials with an App Password if you want OTP emails delivered

The client and server are npm workspaces. Install and run both from the repository root; separate client and server terminals are not needed.

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

1. Push the project repository to GitHub.
2. In Render, create a new **Blueprint** and select the GitHub repository. Render reads `render.yaml` to create one Node web service.
3. Set the requested `MONGO_URI`, `EMAIL_USER`, and `EMAIL_PASS` values in Render. Render generates `JWT_SECRET`; keep all secret values in Render's environment settings, not in GitHub.
4. Deploy. The build runs `npm install` and `npm run build`; the start command runs `npm start`. Render sets `NODE_ENV=production` and uses `/api/health` for its health check.
5. In the Render Shell, set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD`, then run `npm run admin:create --workspace server` once. Remove the temporary values from the service environment when finished.

## Email OTP Configuration

For Gmail, enable 2-Step Verification in your Google Account and create an App Password. Put the Gmail address in `EMAIL_USER` and the App Password in `EMAIL_PASS`. Never use your normal Gmail password. Production startup requires both variables; incorrect SMTP credentials prevent OTP email delivery.

## Booking and Payment Scope

Bookings are requests that an admin approves or rejects. The app records whether an approved booking is paid, but does not charge cards or integrate a payment provider. Payment success/failure routes are informational pages, not a checkout flow.
