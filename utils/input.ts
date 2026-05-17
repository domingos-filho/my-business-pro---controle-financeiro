export const normalizeText = (value: string, maxLength = 120) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

export const normalizeMultilineText = (value: string, maxLength = 2000) =>
  String(value || '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, maxLength);

export const normalizeEmail = (value: string) =>
  String(value || '').trim().toLowerCase().slice(0, 160);

export const isValidEmail = (value: string) => {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const normalizePhone = (value: string) =>
  String(value || '')
    .replace(/[^\d+]/g, '')
    .slice(0, 20);

export const parsePositiveInteger = (value: string, fallback = 0) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const parseNonNegativeInteger = (value: string, fallback = 0) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const parseNonNegativeFloat = (value: string, fallback = 0) => {
  const normalized = String(value || '').trim().replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const parseOptionalNonNegativeFloat = (value: string) => {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return undefined;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
