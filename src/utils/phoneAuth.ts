/**
 * Phone and Password Shadow / Virtual Email Authentication System
 *
 * Converts a user's phone number into a deterministic, RFC-compliant
 * virtual/shadow email address for Better Auth emailAndPassword framework,
 * while presenting a pure native Phone & Password authentication experience to users.
 */

export interface CountryCode {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
}

export const AFRICAN_COUNTRY_CODES: CountryCode[] = [
  { code: 'ZW', dialCode: '+263', name: 'Zimbabwe', flag: '🇿🇼' },
  { code: 'ZA', dialCode: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: 'ZM', dialCode: '+260', name: 'Zambia', flag: '🇿🇲' },
  { code: 'BW', dialCode: '+267', name: 'Botswana', flag: '🇧🇼' },
  { code: 'MZ', dialCode: '+258', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'KE', dialCode: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: 'NG', dialCode: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'RW', dialCode: '+250', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'GH', dialCode: '+233', name: 'Ghana', flag: '🇬🇭' },
  { code: 'TZ', dialCode: '+255', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'UG', dialCode: '+256', name: 'Uganda', flag: '🇺🇬' },
  { code: 'NA', dialCode: '+264', name: 'Namibia', flag: '🇳🇦' },
];

export const SHADOW_EMAIL_DOMAIN = 'phone.wharunner.internal';

/**
 * Normalizes phone number into standard international format e.g. +263772123456
 */
export function normalizePhoneNumber(rawPhone: string, defaultDialCode = '+263'): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^\d+]/g, '').trim();

  // If starts with +, keep digits after +
  if (cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    return `+${digits}`;
  }

  // If starts with 0 (e.g. 0772123456 in Zimbabwe), replace leading 0 with default country dial code digits
  const dialDigits = defaultDialCode.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return `+${dialDigits}${cleaned.substring(1)}`;
  }

  // If already starts with dialDigits without plus
  if (cleaned.startsWith(dialDigits)) {
    return `+${cleaned}`;
  }

  return `+${dialDigits}${cleaned}`;
}

/**
 * Converts a phone number to a valid virtual/shadow email address
 * e.g. "+263772849102" -> "phone_263772849102@phone.wharunner.internal"
 */
export function phoneToShadowEmail(rawPhone: string, defaultDialCode = '+263'): string {
  const normalized = normalizePhoneNumber(rawPhone, defaultDialCode);
  const digits = normalized.replace(/\D/g, '');
  return `phone_${digits}@${SHADOW_EMAIL_DOMAIN}`;
}

/**
 * Checks whether an email address is a virtual/shadow email created for a phone user
 */
export function isShadowEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${SHADOW_EMAIL_DOMAIN}`) || email.toLowerCase().includes('wharunner.internal');
}

/**
 * Extracts the user-friendly formatted phone number from a shadow email address
 * e.g. "phone_263772849102@phone.wharunner.internal" -> "+263 77 284 9102"
 */
export function shadowEmailToPhone(email?: string | null): string {
  if (!email || !isShadowEmail(email)) return email || '';
  const match = email.match(/phone_(\d+)/i);
  if (!match || !match[1]) return email;

  const digits = match[1];
  // Format for Zimbabwe numbers (starts with 263)
  if (digits.startsWith('263') && digits.length >= 12) {
    return `+263 ${digits.substring(3, 5)} ${digits.substring(5, 8)} ${digits.substring(8)}`;
  }
  return `+${digits}`;
}
