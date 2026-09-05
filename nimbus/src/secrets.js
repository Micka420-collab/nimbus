const SECRET_PATTERNS = [
  { id: "pem_block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/ },
  { id: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "github_pat", re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { id: "slack_token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "openai_sk", re: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { id: "bearer", re: /\bBearer\s+[A-Za-z0-9._\-+/=]{12,}\b/i },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

const ASSIGNMENT_RE = /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*([^\s,;]+)/gi;

const PASSWORD_MANAGERS = new Set([
  "bitwarden",
  "1password",
  "onepassword",
  "lastpass",
  "keepass",
  "keepassxc",
  "vaultwarden",
  "dashlane",
  "nordpass",
  "protonpass",
  "proton-pass",
  "keeper",
  "enpass",
]);

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
  if (hasSecretAssignment(text)) {
    matches.push("assignment");
  }
  return { leaked: matches.length > 0, matches };
}

export function assertNoSecret(text, field, options = {}) {
  const inspection = inspectSecretLeak(text);
  if (inspection.leaked) {
    if (options.force === true) {
      return {
        ok: true,
        forced: true,
        field,
        matches: inspection.matches,
        warning:
          "ATTENTION : la valeur ressemble à un secret. --force l'enregistre quand même. Ne mets jamais un vrai mot de passe ici.",
      };
    }
    return {
      ok: false,
      code: "secret_refused",
      field,
      matches: inspection.matches,
      message:
        "Refus : la valeur ressemble à un secret. Nimbus ne l'enregistre pas. Si c'est un nom de gestionnaire (Bitwarden) et non un mot de passe, relance avec --force. Sinon place les identifiants dans le magasin de credentials local.",
    };
  }
  return { ok: true };
}

function hasSecretAssignment(text) {
  ASSIGNMENT_RE.lastIndex = 0;
  let matched = false;
  let hit;
  while ((hit = ASSIGNMENT_RE.exec(text)) !== null) {
    const keyword = String(hit[0].split(/[:=]/)[0] ?? "").toLowerCase();
    if (!assignmentLooksLikeSecret(hit[1], keyword)) {
      continue;
    }
    matched = true;
  }
  return matched;
}

function assignmentLooksLikeSecret(rawValue, keyword) {
  const value = String(rawValue ?? "")
    .replace(/^["'«]+|["'»]+$/g, "")
    .trim();
  const lowered = value.toLowerCase();
  if (PASSWORD_MANAGERS.has(lowered)) {
    return false;
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.re.test(value))) {
    return true;
  }
  const isPasswordLabel = keyword.includes("password") || keyword.includes("passwd");
  if (isPasswordLabel && /^[\p{L}][\p{L}'-]*$/u.test(value) && !/\d/.test(value)) {
    return false;
  }
  if (value.length >= 16) {
    return true;
  }
  if (/\d/.test(value) || (/[A-Z]/.test(value) && /[a-z]/.test(value))) {
    return true;
  }
  return !isPasswordLabel;
}
