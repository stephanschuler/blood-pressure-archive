/** EXIF-Aufnahmezeit, z. B. "2025:08:05 08:02:40" mit optionalem Versatz "+02:00". */
export function exifTime(exif: Record<string, unknown> | null | undefined): Date | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime;
  const m = typeof raw === 'string' && raw.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
  if (!m) return null;
  const offset = exif?.OffsetTimeOriginal ?? exif?.OffsetTime;
  if (typeof offset === 'string' && /^[+-]\d\d:\d\d$/.test(offset)) {
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset}`);
  }
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); // ohne Versatz: Ortszeit des Handys
}
