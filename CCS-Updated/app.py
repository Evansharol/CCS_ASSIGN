from flask import Flask, render_template, request, redirect, session, url_for, flash, abort, g
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import pyotp, qrcode, io, base64, sqlite3, logging, os, time

# --- Configuration ---
APP_SECRET = os.getenv('APP_SECRET', 'dev-secret-please-change')
DEV_SHOW_SECRET = os.getenv('DEV_SHOW_SECRET', '0') == '1'   # set to '1' only in dev
DATABASE = os.getenv('USERS_DB', 'users.db')

app = Flask(__name__)
app.secret_key = APP_SECRET
app.config['SESSION_COOKIE_HTTPONLY'] = True
# session cookie secure should be True in production (with HTTPS)
# app.config['SESSION_COOKIE_SECURE'] = True

# Rate limiter (by IP)
# flask-limiter v4's signature expects key_func as the first positional argument, so pass
# arguments by name to avoid positional conflicts across versions.
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"], app=app)

# Argon2 password hasher
ph = PasswordHasher()

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# --- Database helpers ---
def init_db():
    # create the DB file and table if missing. Use a short-lived connection here.
    conn = sqlite3.connect(DATABASE, timeout=10)
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            otp_secret TEXT
        )
    ''')
    conn.commit()

    # Migration: ensure optional columns exist (older DBs may lack them)
    try:
        cur.execute("PRAGMA table_info(users)")
        existing = [r[1] for r in cur.fetchall()]
        if 'failed_logins' not in existing:
            cur.execute("ALTER TABLE users ADD COLUMN failed_logins INTEGER DEFAULT 0")
            logger.info("Added missing column: failed_logins")
        if 'locked_until' not in existing:
            cur.execute("ALTER TABLE users ADD COLUMN locked_until INTEGER DEFAULT 0")
            logger.info("Added missing column: locked_until")
        conn.commit()
    except sqlite3.OperationalError:
        # If migration fails for any reason, continue but log it
        logger.exception('DB migration check failed')
    finally:
        conn.close()

def get_db():
    """Get a connection for the current request (stored on flask.g).

    Connections are opened with a timeout and WAL mode to reduce "database is locked"
    errors during concurrent access in the development server.
    """
    if 'db' not in g:
        # open connection with a reasonable timeout and return rows as sqlite3.Row
        conn = sqlite3.connect(DATABASE, timeout=10, detect_types=sqlite3.PARSE_DECLTYPES)
        conn.row_factory = sqlite3.Row
        try:
            # Enable WAL to allow concurrent readers/writers and turn on foreign keys
            conn.execute('PRAGMA journal_mode=WAL;')
            conn.execute('PRAGMA foreign_keys=ON;')
        except Exception:
            # pragma might fail on some environments; ignore if it does
            pass
        g.db = conn
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        try:
            db.close()
        except Exception:
            pass


def get_user(username):
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, username, password_hash, otp_secret, failed_logins, locked_until FROM users WHERE username=?', (username,))
    row = cur.fetchone()
    return row

def insert_user(username, password_hash, otp_secret):
    conn = get_db()
    cur = conn.cursor()
    cur.execute('INSERT INTO users(username,password_hash,otp_secret) VALUES (?,?,?)', (username, password_hash, otp_secret))
    conn.commit()

init_db()
# Ensure per-request DB connections are closed
app.teardown_appcontext(close_db)

# --- Routes ---
@app.route('/')
def home():
    return render_template('base.html')

@app.route('/register', methods=['GET', 'POST'])
@limiter.limit('10 per minute')
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if not username or not password:
            flash('Please provide both username and password', 'warning')
            return redirect(url_for('register'))

        # simple password policy
        if len(password) < 8:
            flash('Password must be at least 8 characters long', 'warning')
            return redirect(url_for('register'))

        otp_secret = pyotp.random_base32()
        try:
            password_hash = ph.hash(password)
            insert_user(username, password_hash, otp_secret)
            logger.info(f"New user registered: {username}")
        except sqlite3.IntegrityError:
            flash('Username already exists', 'danger')
            return redirect(url_for('register'))

        # Generate QR image (data URI)
        otp_uri = pyotp.totp.TOTP(otp_secret).provisioning_uri(name=username, issuer_name='TwoWayAuthApp')
        qr = qrcode.make(otp_uri)
        buffer = io.BytesIO()
        qr.save(buffer, format='PNG')
        qr_b64 = base64.b64encode(buffer.getvalue()).decode()

        # Render page showing QR + optional secret (dev-only)
        return render_template('register.html', username=username, qr_b64=qr_b64, otp_secret=(otp_secret if DEV_SHOW_SECRET else None))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit('20 per minute')
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        user = get_user(username)
        if not user:
            flash('Invalid credentials', 'danger')
            return redirect(url_for('login'))

        user_id, usern, pwd_hash, otp_secret, failed_logins, locked_until = user

        # Check for account lockout
        now = int(time.time())
        if locked_until and locked_until > now:
            flash('Account temporarily locked due to repeated failures', 'danger')
            return redirect(url_for('login'))

        try:
            ph.verify(pwd_hash, password)
            # success: reset failed attempts
            conn = get_db()
            cur = conn.cursor()
            cur.execute('UPDATE users SET failed_logins=0, locked_until=0 WHERE username=?', (username,))
            conn.commit()

            session['pre_2fa_user'] = username
            session['otp_secret'] = otp_secret
            return redirect(url_for('verify'))
        except VerifyMismatchError:
            # failed attempt: increment counter, maybe lock
            failed_logins = (failed_logins or 0) + 1
            lock_until = 0
            if failed_logins >= 5:
                lock_until = now + 300  # lock for 5 minutes
                flash('Too many failures — account locked for 5 minutes', 'danger')
            else:
                flash('Invalid credentials', 'danger')

            conn = get_db()
            cur = conn.cursor()
            cur.execute('UPDATE users SET failed_logins=?, locked_until=? WHERE username=?', (failed_logins, lock_until, username))
            conn.commit()
            return redirect(url_for('login'))

    return render_template('login.html')

@app.route('/verify', methods=['GET', 'POST'])
@limiter.limit('30 per minute')
def verify():
    if 'pre_2fa_user' not in session or 'otp_secret' not in session:
        flash('Please login first', 'warning')
        return redirect(url_for('login'))

    if request.method == 'POST':
        otp = request.form.get('otp', '').strip()
        totp = pyotp.TOTP(session['otp_secret'])
        # valid_window=1 allows 30s before/after to handle minor clock skew
        if totp.verify(otp, valid_window=1):
            username = session.pop('pre_2fa_user')
            session.pop('otp_secret', None)
            session['user'] = username
            flash('Two-way authentication successful', 'success')
            return redirect(url_for('home'))
        else:
            flash('Invalid or expired OTP', 'danger')
            return redirect(url_for('verify'))

    return render_template('verify.html')

# Dev-only admin view (exposes secrets; only enable DEV_SHOW_SECRET=1 in development)
@app.route('/admin')
def admin():
    if not DEV_SHOW_SECRET:
        abort(404)
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, username, otp_secret, failed_logins, locked_until FROM users')
    users = cur.fetchall()
    return render_template('admin.html', users=users)

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out', 'info')
    return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True)
