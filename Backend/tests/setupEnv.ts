/**
 * Runs before every test file's imports. Values set here win over Backend/.env because
 * dotenv never overrides variables that already exist — so tests can never reach a real
 * database, SMTP server, OpenAI or GitHub.
 */
const testEnv: Record<string, string> = {
  NODE_ENV: "test",
  JWT_SECRET: "test-secret-that-is-long-enough-0123456789abcdef",
  MONGODB_URI: "mongodb://127.0.0.1:1/never-used-by-tests",
  FRONTEND_ORIGIN: "http://localhost:3000",
  API_PUBLIC_URL: "http://127.0.0.1:4999",
  // Trust X-Forwarded-For from loopback so helpers can give each simulated client its own IP.
  TRUST_PROXY: "loopback",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASS: "",
  MAIL_FROM: "",
  OPENAI_API_KEY: "",
  GITHUB_CLIENT_ID: "",
  GITHUB_CLIENT_SECRET: "",
  GITHUB_OAUTH_CALLBACK_URL: "",
  GITHUB_OAUTH_ENCRYPTION_KEY: "",
  ENABLE_API_DOCS: "true",
  SKIP_STARTER_ISSUES: "",
  MONGODB_URI_ATLAS: "",
  DB_USERNAME: "",
  DB_PASSWORD: "",
};
for (const [key, value] of Object.entries(testEnv)) process.env[key] = value;
// A test file can still override a value (e.g. TRUST_PROXY) at top level: the app modules
// are imported lazily by startApp(), after the file's own top-level code has run.
