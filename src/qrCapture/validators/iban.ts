function normalize(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

function letterValue(ch: string): number {
  return ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
}

function mod97(numericString: string): number {
  // Process in 7-digit chunks to keep within Number safety.
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = String(remainder) + numericString.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder;
}

export function validateIban(iban: string): boolean {
  const s = normalize(iban);
  if (!/^(CH|LI)\d{19}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let numeric = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') numeric += ch;
    else if (ch >= 'A' && ch <= 'Z') numeric += String(letterValue(ch));
    else return false;
  }
  return mod97(numeric) === 1;
}

export function isQrIban(iban: string): boolean {
  if (!validateIban(iban)) return false;
  const s = normalize(iban);
  const iid = Number(s.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}
