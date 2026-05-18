const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

export function validateSignUpInput(name: string, email: string, password: string) {
  const trimmedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (!trimmedName || trimmedName.length < 2) {
    return { ok: false as const, message: "Please enter your full name." };
  }

  if (!isValidEmail(normalizedEmail)) {
    return { ok: false as const, message: "Please enter a valid email address." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false as const, message: passwordError };
  }

  return {
    ok: true as const,
    name: trimmedName,
    email: normalizedEmail,
    password,
  };
}

export function validateSignInInput(identity: string, password: string) {
  const trimmed = identity.trim();

  if (!trimmed || !password) {
    return { ok: false as const, message: "Please enter your email/phone and password." };
  }

  if (trimmed.includes("@") && !isValidEmail(trimmed)) {
    return { ok: false as const, message: "Please enter a valid email address." };
  }

  return { ok: true as const, identity: trimmed, password };
}
