from werkzeug.security import check_password_hash
import sqlite3

# sample small dictionary of guesses
wordlist = ["12345", "password", "admin", "test123", "hello", "welcome", "user123"]

conn = sqlite3.connect("users.db")
cur = conn.cursor()
cur.execute("SELECT username, password_hash FROM users")
users = cur.fetchall()
conn.close()

print("---- Password cracking test ----")
cracked = []
for u, hashv in users:
    for guess in wordlist:
        if check_password_hash(hashv, guess):
            cracked.append((u, guess))
            break

print(f"Total users: {len(users)}")
print(f"Cracked users: {len(cracked)}")
for c in cracked:
    print(f" {c[0]} → cracked password: {c[1]}")
