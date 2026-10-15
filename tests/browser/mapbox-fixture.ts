import type { Page } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8FYAAAAASUVORK5CYII=",
  "base64",
);

/** Use the real GL renderer/gestures with a local, network-independent style. */
export async function stubMapboxRendering(page: Page) {
  await page.route("https://api.mapbox.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return path.startsWith("/styles/") && !path.includes("/static/")
      ? route.fulfill({
          json: {
            version: 8,
            sources: {},
            layers: [
              {
                id: "background",
                type: "background",
                paint: { "background-color": "#e8e3da" },
              },
            ],
          },
        })
      : route.fulfill({ contentType: "image/png", body: png });
  });
  await page.route("https://events.mapbox.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
}
