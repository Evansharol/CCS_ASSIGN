# Email-OTP Demo with Cracking Simulation

This project is a small demonstration of email-based one-time-password (OTP) login and a safe, limited password-cracking simulation to help evaluate authentication strength.

WARNING: Educational demo only. It stores data in memory and runs a deliberately limited, local cracking routine. Do not reuse secrets or run this in production.

What is included

- Frontend: React (Vite) UI in `src/` with separate pages for Register, Login (email OTP), and Platform (cracking sim).
- Backend: Express server in `server/` with endpoints:
  - `POST /api/register` — register with name, email and password (bcrypt-hashed)
  - `POST /api/request-login-otp` — send a 6-digit OTP to the registered email (dev preview returned)
  - `POST /api/verify-login-otp` — verify the OTP and create a short-lived session
  - `POST /api/simulate-crack` — run a safe cracking simulation against the stored hash (requires active session)

How the cracking simulation works

- It tries a small list of common passwords and then a tiny brute-force over lowercase+digits up to length 4.
- It's intentionally constrained (quick, low CPU) to be safe for local demo use. It does not implement real-world large-scale cracking techniques.

Email sending (development)

- The server uses Nodemailer with an Ethereal test account for development. Emails are not delivered to real inboxes — instead the server returns a preview URL that opens the generated email in the browser. This keeps the demo safe and easy to test.

How to run (Windows PowerShell)

1. Install dependencies (frontend + server):

```powershell
npm install
```

2. Start the backend server (port 4000):

```powershell
npm run server
```

3. In another terminal start the frontend dev server:

```powershell
npm run dev
```

Open http://localhost:5173 (Vite) to use the demo. When you request an OTP, the server response will include a `previewUrl` you can open to view the email content.

Files added/edited

- `server/index.js` — demo backend server (email OTP + cracker)
- `server/cracker.js` — safe cracking simulator
- `src/App.jsx` — multi-page UI (Register / Login / Platform)
- `package.json` — added server deps and scripts

What to demo / Evaluation notes

- Show registration (name + email + password), then use Login to request an OTP for that email. Open the returned preview URL to see the OTP.
- Verify the OTP to create a session and open the Platform page.
- Run `simulate-crack` from the Platform page. The sim will report whether the password was found, how many attempts it used and duration.
- Discussion points: the demo shows how email-OTP protects the platform because the attacker would need the OTP email to continue after cracking a password. Also discuss limitations (email interception, SIM swap, phishing, real-world cracking scale).

Suggested next steps

- Add persistent storage (sqlite) and rate-limiting (lock out after repeated failures).
- Use Argon2 for hashing and add email verification on registration.
- Add tests to automate attacker scenarios and generate a short report for presentations.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
