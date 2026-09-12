/** Live hint for the link field. The backend recomputes this independently for
 *  anything it stores, so this copy is presentation-only. */
export function detectLinkSource(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("spotify.com")) return "Spotify";
  if (u.includes("music.apple.com")) return "Apple Music";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  return "Link";
}
