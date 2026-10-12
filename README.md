# Eventora | Full-Stack Event Booking Platform

Eventora is a MERN application for discovering events and managing ticket requests. I built it around a complete booking workflow: account verification, event discovery, OTP-confirmed booking requests, and admin review.

## Project Overview

The app has a React single-page client and an Express REST API backed by MongoDB. Users can browse and search events, request tickets, check booking status, and cancel a request. Admins can manage events, review bookings, record payment status, and view operational totals.

**Booking flow:** Register and verify by email OTP → browse or search events → verify a booking request with OTP → admin approves or rejects it → user checks the result in the dashboard.

## Features

- **Authentication:** Registration, login, password hashing with bcrypt, JWT sessions, and email OTP account verification.
- **Role-based access control:** Admin-only event and booking management is enforced by Express middleware and database roles.
- **Event management:** Create, update, and delete events with date, time, category, location, image URL, ticket price, and seat capacity.
- **Booking lifecycle:** OTP-confirmed requests, duplicate-request checks, admin approval or rejection, cancellation reasons, and availability updates when a booking is confirmed or cancelled.
- **Payment tracking:** Admins record paid or unpaid status for an approved booking. Eventora does not process payments or connect to a payment gateway.
- **Dashboards:** Users can review their bookings; admins can manage events and bookings and review paid revenue and booking totals.
- **Email:** Nodemailer sends account and booking OTPs and booking status notifications. In local development, OTPs are printed in the server terminal when email settings are omitted.
- **Deployment:** One Render web service serves the built React client and Express API from the same origin.

## Technology

| Area | Tools |
| --- | --- |
| Frontend | React, React Router, Vite, Tailwind CSS, Axios |
| Backend | Node.js, Express |
| Data | MongoDB, Mongoose |
| Authentication | JWT, bcryptjs, time-limited email OTPs |
| Email | Nodemailer |
| Quality checks | Node.js test runner, ESLint, Vite production build |
| Hosting | Render Blueprint (`render.yaml`) |

## Repository Layout

```text
client/       React application and Vite configuration
server/       Express API, MongoDB models, controllers, and tests
render.yaml   Single-service Render deployment configuration
```

## Booking Workflow

The sequence below shows the API, booking controller, MongoDB, and email handoffs. The flowchart summarizes the user and admin steps.

![Eventora booking API sequence](dfd.png)

![Eventora user and admin booking flow](fc.png)

## Run Locally

Requirements: Node.js 20 or newer and a reachable MongoDB database. MongoDB Atlas or a local MongoDB server can be used.

1. Copy the environment template:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

2. Edit `server/.env`. Set `MONGO_URI` to your database connection string and replace the sample `JWT_SECRET` with a private random value. Set `EMAIL_USER` and `EMAIL_PASS` to enable email delivery; otherwise development OTPs appear in the server terminal.
3. From the project root, install and start both applications:

   ```sh
   npm install
   npm run dev
   ```

Open `http://localhost:5173`. Vite proxies `/api` requests to Express on port `5000`. The server waits for MongoDB before accepting requests.

### Create the First Admin

Public registration creates standard user accounts only. To create the first admin locally, set `ADMIN_EMAIL` and a private `ADMIN_PASSWORD` of at least 12 characters in your shell, then run:

```sh
npm run admin:create --workspace server
```

The command refuses to create an admin if one already exists. Remove the temporary shell variables afterward. Never commit credentials or put them in this README.

### Project Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API and Vite client together |
| `npm test` | Run the server test suite |
| `npm run lint` | Lint client source |
| `npm run build` | Build the client for production |
| `npm start` | Start the Express production server; build the client first |
| `npm run seed --workspace server` | Replace local database contents with demo data; never use on production data |

## API Overview

All endpoints are prefixed with `/api`.

| Area | Routes | Access |
| --- | --- | --- |
| Authentication | `/auth/register`, `/auth/login`, `/auth/verify-otp` | Public |
| Events | `GET /events`, `GET /events/:id` | Public |
| Event management | `POST /events`, `PUT /events/:id`, `DELETE /events/:id` | Admin |
| Bookings | `POST /bookings/send-otp`, `POST /bookings`, `GET /bookings/my`, `DELETE /bookings/:id` | Authenticated |
| Booking review | `PUT /bookings/:id/confirm` | Admin |
| Health | `GET /health` | Public; reports API and database readiness |

## Deploy to Render

The repository includes a Render Blueprint. Create a Blueprint from the GitHub repository and configure `MONGO_URI`, `EMAIL_USER`, and `EMAIL_PASS` when prompted. Render generates `JWT_SECRET`. The build installs the npm workspaces and builds the client; the service then serves the client and API together.

After the first deployment, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the Render service environment, run `npm run admin:create --workspace server` once from the Render Shell, then remove those temporary variables. Use a strong, unique password. See [SETUP_GUIDE.md](SETUP_GUIDE.md) for MongoDB Atlas, email, and deployment setup.

## Engineering Notes

- Booking and seat-count rules are handled by the API rather than trusted to client state.
- Admin authorization is checked on protected API routes, not only hidden in the UI.
- OTP records expire after five minutes; OTP values are generated using Node's cryptographic random number generator.
- Event search treats user input as literal text rather than an executable regular expression.
- Payment is recorded manually. There is no card processing, checkout provider, or real payment success/failure integration.

## Contact

Project repository: [github.com/Ankitprajapati790/eventora](https://github.com/Ankitprajapati790/eventora)
