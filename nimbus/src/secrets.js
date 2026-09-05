const SECRET_PATTERNS = [
  { id: "pem_block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/ },
  { id: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "github_pat", re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { id: "slack_token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "openai_sk", re: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { id: "bearer", re: /\bBearer\s+[A-Za-z0-9._\-+/=]{12,}\b/i },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: "assignment", re: /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*\S+/i },
];

/**
 * Local-only secret gate. Prefers refusing storage over redacting into a
 * still-useful leak. Does not phone home.
 */
export function inspectSecretLeak(text) {
  if (typeof text !== "string" || text.length === 0) {
    return { leaked: false, matches: [] };
  }
  const matches = [];
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.re.test(text)) {
      matches.push(pattern.id);
    }
  }
  return { leaked: matches.length > 0, matches };
}

export function assertNoSecret(text, field) {
  const inspection = inspectSecretLeak(text);
  if (inspection.leaked) {
    return {
      ok: false,
      code: "secret_refused",
      field,
      matches: inspection.matches,
      message:
        "Refus : la valeur ressemble à un secret. Nimbus ne l'enregistre pas. Place les identifiants dans le magasin de credentials local, pas dans la mémoire.",
    };
  }
  return { ok: true };
}
