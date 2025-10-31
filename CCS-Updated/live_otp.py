import sqlite3, pyotp, time, os

username = input("Enter username: ")

conn = sqlite3.connect("users.db")
cur = conn.cursor()
cur.execute("SELECT otp_secret FROM users WHERE username=?", (username,))
row = cur.fetchone()
conn.close()

if not row:
    print("❌ No such user found.")
else:
    secret = row[0]
    totp = pyotp.TOTP(secret)
    while True:
        otp = totp.now()
        remaining = 30 - int(time.time()) % 30
        os.system('cls' if os.name == 'nt' else 'clear')
        print(f"Username: {username}")
        print(f"Secret: {secret}")
        print(f"Current OTP: {otp}")
        print(f"Expires in: {remaining} sec")
        time.sleep(1)
