import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Safe, tiny password-cracking simulator for demo purposes.
// It attempts a small dictionary then a very small brute-force (digits+lowercase up to length 4 by default).

const DEFAULTS = {
  maxBruteLen: 4,
  charset: 'abcdefghijklmnopqrstuvwxyz0123456789',
  maxAttempts: 200000
};

const commonPasswords = [
  '123456','password','12345678','qwerty','abc123','letmein','monkey','dragon','iloveyou','admin'
];

export async function crackHash(targetHash, opts = {}) {
  const options = { ...DEFAULTS, ...opts };
  let attempts = 0;
  const start = Date.now();

  // If fast mode (sha256) is requested, use fast comparison
  if (options.useFast && options.fastSalt) {
    // helper: compute fast hash
    function fastHash(password, salt) {
      return crypto.createHash('sha256').update(salt + password).digest('hex');
    }

    // try common passwords first
    for (const pw of commonPasswords) {
      attempts++;
      if (fastHash(pw, options.fastSalt) === targetHash) {
        return { found: true, guess: pw, attempts, durationMs: Date.now() - start };
      }
      if (attempts >= options.maxAttempts) break;
    }

    const chars = options.charset.split('');
    for (let len = 1; len <= options.maxBruteLen; len++) {
      const indices = Array(len).fill(0);
      while (true) {
        let guess = '';
        for (let i = 0; i < len; i++) guess += chars[indices[i]];
        attempts++;
        if (fastHash(guess, options.fastSalt) === targetHash) {
          return { found: true, guess, attempts, durationMs: Date.now() - start };
        }
        if (attempts >= options.maxAttempts) return { found: false, attempts, durationMs: Date.now() - start };

        // increment indices
        let pos = len - 1;
        while (pos >= 0) {
          indices[pos]++;
          if (indices[pos] >= chars.length) {
            indices[pos] = 0;
            pos--;
          } else break;
        }
        if (pos < 0) break;
      }
    }

    return { found: false, attempts, durationMs: Date.now() - start };
  }

  // default: bcrypt-based (slow)
  // try common passwords first
  for (const pw of commonPasswords) {
    attempts++;
    if (await bcrypt.compare(pw, targetHash)) {
      return { found: true, guess: pw, attempts, durationMs: Date.now() - start };
    }
    if (attempts >= options.maxAttempts) break;
  }

  // tiny brute-force generator (depth-first)
  const chars = options.charset.split('');

  async function tryGuess(guess) {
    attempts++;
    if (await bcrypt.compare(guess, targetHash)) {
      return { found: true, guess, attempts, durationMs: Date.now() - start };
    }
    if (attempts >= options.maxAttempts) return { found: false, attempts, durationMs: Date.now() - start };
    return null;
  }

  // iterative by length to avoid recursion depth issues
  for (let len = 1; len <= options.maxBruteLen; len++) {
    const indices = Array(len).fill(0);
    while (true) {
      // build guess
      let guess = '';
      for (let i = 0; i < len; i++) guess += chars[indices[i]];
      const res = await tryGuess(guess);
      if (res) return res;

      // increment indices
      let pos = len - 1;
      while (pos >= 0) {
        indices[pos]++;
        if (indices[pos] >= chars.length) {
          indices[pos] = 0;
          pos--;
        } else break;
      }
      if (pos < 0) break; // exhausted this length
    }
  }

  return { found: false, attempts, durationMs: Date.now() - start };
}

export default { crackHash };
