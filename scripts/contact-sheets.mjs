import fs from "node:fs";
import sharp from "sharp";
const { manifest } = JSON.parse(
  fs.readFileSync("artifacts/screenshots/manifest.json", "utf8"),
);
const { results } = JSON.parse(
  fs.readFileSync("artifacts/screenshots/states/manifest.json", "utf8"),
);
fs.mkdirSync("artifacts/contact-sheets", { recursive: true });
for (const [kind, records] of [
  ["desktop", manifest.filter((r) => r.width === 1920)],
  ["mobile", manifest.filter((r) => r.width === 390)],
  ["states", results],
]) {
  for (let start = 0; start < records.length; start += 12) {
    const layers = await Promise.all(
      records.slice(start, start + 12).map(async (r, index) => {
        const meta = await sharp(r.file).metadata();
        const input = await sharp(r.file)
          .extract({
            left: 0,
            top: 0,
            width: meta.width,
            height: Math.min(meta.height, kind === "mobile" ? 2200 : 1500),
          })
          .resize(440, 380, { fit: "contain", background: "#f4efe7" })
          .png()
          .toBuffer();
        const title = Buffer.from(
          `<svg width="440" height="28"><rect width="440" height="28" fill="white"/><text x="8" y="19" font-family="sans-serif" font-size="13">${r.name.replaceAll("&", "&amp;")}</text></svg>`,
        );
        return [
          {
            input,
            left: (index % 4) * 450 + 5,
            top: Math.floor(index / 4) * 420 + 35,
          },
          {
            input: title,
            left: (index % 4) * 450 + 5,
            top: Math.floor(index / 4) * 420 + 5,
          },
        ];
      }),
    );
    await sharp({
      create: { width: 1800, height: 1260, channels: 3, background: "#ddd" },
    })
      .composite(layers.flat())
      .png()
      .toFile(`artifacts/contact-sheets/${kind}-${start / 12 + 1}.png`);
  }
}
console.log(
  "Generated contact sheets for all desktop/mobile routes and captured states.",
);
