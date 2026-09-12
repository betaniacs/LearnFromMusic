/**
 * Which service a reference link points at. Duplicated in the frontend so the
 * form can show a live hint, but recomputed here because anything stored in the
 * database is derived server-side rather than trusted from the client.
 */
export function detectLinkSource(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("spotify.com")) return "Spotify";
  if (u.includes("music.apple.com")) return "Apple Music";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  return "Link";
}
