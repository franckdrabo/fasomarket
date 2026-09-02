/**
 * Valide une adresse email avec une regex robuste (conforme RFC 5322 simplifié).
 * Vérifie la présence d'un @, d'un nom de domaine valide et d'une extension.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Regex RFC 5322 simplifiée pour usage mobile
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return EMAIL_REGEX.test(email.trim());
}
