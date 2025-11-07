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
