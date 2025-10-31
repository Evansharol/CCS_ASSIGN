from flask import Flask, render_template_string, request, redirect, session, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import pyotp, qrcode, io, base64, sqlite3

app = Flask(__name__)
app.secret_key = "secret123"   # for session

# ---------- DATABASE ----------
def init_db():
    conn = sqlite3.connect("users.db")
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            otp_secret TEXT
        )
    """)
    conn.commit()
    conn.close()
init_db()

# ---------- REGISTER ----------
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        otp_secret = pyotp.random_base32()

        conn = sqlite3.connect("users.db")
        cur = conn.cursor()
        try:
            cur.execute("INSERT INTO users(username,password_hash,otp_secret) VALUES (?,?,?)",
                        (username, generate_password_hash(password), otp_secret))
            conn.commit()
        except sqlite3.IntegrityError:
            return "Username already exists!"
        finally:
            conn.close()

        # show QR code for authenticator app
        otp_uri = pyotp.totp.TOTP(otp_secret).provisioning_uri(name=username, issuer_name="2WayAuthApp")
        qr = qrcode.make(otp_uri)
        buffer = io.BytesIO()
        qr.save(buffer, format="PNG")
        qr_b64 = base64.b64encode(buffer.getvalue()).decode()
        return f"""
        <h3>Scan this QR code in Google Authenticator:</h3>
        <img src="data:image/png;base64,{qr_b64}"/><br>
        <p><a href="/login">Go to Login</a></p>
        """
    return '''
    <h2>Register</h2>
    <form method="post">
      Username: <input name="username"><br>
      Password: <input type="password" name="password"><br>
      <input type="submit" value="Register">
    </form>
    '''

# ---------- LOGIN (step 1: password) ----------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        conn = sqlite3.connect("users.db")
        cur = conn.cursor()
        cur.execute("SELECT password_hash, otp_secret FROM users WHERE username=?", (username,))
        row = cur.fetchone()
        conn.close()

        if row and check_password_hash(row[0], password):
            session["otp_secret"] = row[1]
            session["username"] = username
            return redirect(url_for("otp_verify"))
        else:
            return "Invalid credentials!"
    return '''
    <h2>Login</h2>
    <form method="post">
      Username: <input name="username"><br>
      Password: <input type="password" name="password"><br>
      <input type="submit" value="Next">
    </form>
    '''

# ---------- OTP VERIFY (step 2) ----------
@app.route("/verify", methods=["GET", "POST"])
def otp_verify():
    if "otp_secret" not in session:
        return redirect(url_for("login"))
    if request.method == "POST":
        otp = request.form["otp"]
        totp = pyotp.TOTP(session["otp_secret"])
        if totp.verify(otp):
            return f"<h3>Welcome, {session['username']}! Two-way authentication successful ✅</h3>"
        else:
            return "Invalid or expired OTP!"
    return '''
    <h2>Enter OTP</h2>
    <form method="post">
      OTP Code: <input name="otp"><br>
      <input type="submit" value="Verify">
    </form>
    '''

if __name__ == "__main__":
    app.run(debug=True)
