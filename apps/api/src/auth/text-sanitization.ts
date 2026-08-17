export function stripControlCharacters(value: string): string {
  let cleaned = '';

  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if ((codePoint >= 0 && codePoint <= 31) || (codePoint >= 127 && codePoint <= 159)) {
      continue;
    }

    cleaned += character;
  }

  return cleaned;
}
