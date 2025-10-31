from werkzeug.security import check_password_hash
import sqlite3

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
            try:
                # Avoid passing Argon2 hashes into werkzeug's check_password_hash
                # which expects a different format (e.g. 'pbkdf2:sha256:...').
                h = hashv
                if isinstance(h, bytes):
                    h = h.decode('utf-8', errors='ignore')
                # argon2 hashes begin with "$argon2"; skip werkzeug check for those
                if isinstance(h, str) and h.startswith('$argon2'):
                    continue
                if check_password_hash(h, guess):
                    cracked.append((u, guess))
                    break
            except ValueError:
                # malformed hash for werkzeug (skip)
                continue
            except Exception:
                # any other error, skip this candidate
                continue

print(f"Total users: {len(users)}")
print(f"Cracked users: {len(cracked)}")
for c in cracked:
    # Avoid Unicode characters that may not print correctly in some Windows consoles
    print(f"{c[0]} -> cracked password: {c[1]}")

# Print users that were not cracked
cracked_usernames = {c[0] for c in cracked}
not_cracked = [u for u, _ in users if u not in cracked_usernames]
print(f"Not cracked users: {len(not_cracked)}")
for u in not_cracked:
    print(f"{u} -> NOT_CRACKED")
