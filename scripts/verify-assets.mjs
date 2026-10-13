import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
const source = JSON.parse(fs.readFileSync("docs/assets.json", "utf8"));
const results = [];
for (const asset of source.assets) {
  const data = fs.readFileSync(asset.file);
  if (!data.length) throw new Error(`Empty asset: ${asset.file}`);
  let dimensions;
  if (asset.file.endsWith(".png")) {
    // Preserve the Figma export bytes; some supplied .png URLs contain JPEG data.
    const metadata = await sharp(data).metadata();
    if (!metadata.width || !metadata.height)
      throw new Error(`Invalid image: ${asset.file}`);
    dimensions = {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
    };
  } else {
    const svg = data.toString();
    if (!svg.includes("<svg")) throw new Error(`Invalid SVG: ${asset.file}`);
    dimensions = {
      viewBox: svg.match(/viewBox="([^"]+)"/)?.[1] ?? null,
      width: svg.match(/\bwidth="([^"]+)"/)?.[1] ?? null,
      height: svg.match(/\bheight="([^"]+)"/)?.[1] ?? null,
    };
  }
  results.push({ ...asset, bytes: data.length, ...dimensions });
}
const fonts = fs.readdirSync("public/assets/fonts").map((name) => ({
  file: path.posix.join("public/assets/fonts", name),
  bytes: fs.statSync(path.join("public/assets/fonts", name)).size,
}));
if (
  fonts.some((f) => !f.bytes) ||
  fonts.filter((f) => f.file.endsWith(".ttf")).length !== 5
)
  throw new Error("Missing font/license file");
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/asset-verification.json",
  JSON.stringify({ results, fonts }, null, 2),
);
console.log(
  `Verified ${results.length} Figma exports, 5 font files and 2 font licenses; geometry recorded in artifacts/asset-verification.json.`,
);
