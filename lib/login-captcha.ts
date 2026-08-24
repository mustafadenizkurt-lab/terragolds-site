import { getD1 } from "./store-db";

type LoginAttemptRow = {
  email: string;
  failed_count: number;
  captcha_answer: string | null;
  captcha_expires_at: string | null;
};

export type LoginCaptchaChallenge = {
  question: string;
};

export async function ensureLoginAttemptsTable() {
  await getD1()
    .prepare(
      `CREATE TABLE IF NOT EXISTS login_attempts (
        email TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL DEFAULT 0,
        captcha_answer TEXT,
        captcha_expires_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

export async function readLoginAttempt(email: string) {
  await ensureLoginAttemptsTable();
  return getD1()
    .prepare(
      `SELECT email, failed_count, captcha_answer, captcha_expires_at
       FROM login_attempts WHERE email = ? LIMIT 1`,
    )
    .bind(email)
    .first<LoginAttemptRow>();
}

export function loginCaptchaRequired(row: LoginAttemptRow | null) {
  return Number(row?.failed_count ?? 0) >= 3;
}

export async function createLoginCaptcha(email: string) {
  const first = crypto.getRandomValues(new Uint32Array(1))[0] % 8 + 2;
  const second = crypto.getRandomValues(new Uint32Array(1))[0] % 7 + 3;
  const answer = String(first + second);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await ensureLoginAttemptsTable();
  await getD1()
    .prepare(
      `INSERT INTO login_attempts
        (email, failed_count, captcha_answer, captcha_expires_at, updated_at)
       VALUES (?, 3, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO UPDATE SET
        failed_count = MAX(login_attempts.failed_count, 3),
        captcha_answer = excluded.captcha_answer,
        captcha_expires_at = excluded.captcha_expires_at,
        updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(email, answer, expiresAt)
    .run();

  return { question: `${first} + ${second} = ?` };
}

export function verifyLoginCaptcha(
  row: LoginAttemptRow | null,
  answer: string,
) {
  if (!loginCaptchaRequired(row)) return true;
  if (!row?.captcha_answer || !row.captcha_expires_at) return false;
  if (new Date(row.captcha_expires_at).getTime() <= Date.now()) return false;
  return answer.trim() === row.captcha_answer;
}

export async function recordFailedLogin(email: string) {
  await ensureLoginAttemptsTable();
  const row = await readLoginAttempt(email);
  const nextCount = Number(row?.failed_count ?? 0) + 1;
  await getD1()
    .prepare(
      `INSERT INTO login_attempts
        (email, failed_count, captcha_answer, captcha_expires_at, updated_at)
       VALUES (?, ?, NULL, NULL, CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO UPDATE SET
        failed_count = ?,
        updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(email, nextCount, nextCount)
    .run();
  return nextCount;
}

export async function clearFailedLogins(email: string) {
  await ensureLoginAttemptsTable();
  await getD1()
    .prepare("DELETE FROM login_attempts WHERE email = ?")
    .bind(email)
    .run();
}
