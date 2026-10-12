/**
 * Screenshots of the system used in the help articles. They are captured from a demo
 * database with fictitious people (never production data) and bundled with the app, so the
 * help also works offline in the desktop client. Only the URL is bundled eagerly; the image
 * is downloaded when an article shows it.
 */
const IMAGE_URLS = import.meta.glob('../assets/help/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function helpImageUrl(key: string): string | undefined {
  return IMAGE_URLS[`../assets/help/${key}.webp`];
}

export function helpImageKeys(): string[] {
  return Object.keys(IMAGE_URLS).map((path) => path.replace(/^.*\/(.+)\.webp$/, '$1'));
}

const DEFAULT_SIZE = { width: 1366, height: 768 } as const;
/** Screenshots that are crops instead of a full 1366x768 window. */
const SIZE_OVERRIDES: Record<string, { width: number; height: number }> = {
  'app-versao': { width: 385, height: 96 },
};

/** Intrinsic size, so the page does not jump while screenshots load. */
export function helpImageSize(key: string): { width: number; height: number } {
  return SIZE_OVERRIDES[key] ?? DEFAULT_SIZE;
}
