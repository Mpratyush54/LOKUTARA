export function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const value = ua || "";
  const os = value.includes("Android")
    ? "Android"
    : value.includes("iPhone") || value.includes("iPad")
      ? "iOS"
      : value.includes("Mac")
        ? "macOS"
        : value.includes("Win")
          ? "Windows"
          : value.includes("Linux")
            ? "Linux"
            : "Unknown";
  const browser = value.includes("Edg/")
    ? "Edge"
    : value.includes("Chrome/")
      ? "Chrome"
      : value.includes("Firefox/")
        ? "Firefox"
        : value.includes("Safari/")
          ? "Safari"
          : "Unknown";
  const device = /Mobi|Android|iPhone|iPad/i.test(value) ? "mobile" : "desktop";
  return { device, browser, os };
}
