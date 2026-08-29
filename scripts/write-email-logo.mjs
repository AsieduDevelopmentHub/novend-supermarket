import fs from "node:fs";
import sharp from "sharp";

const png = await sharp("public/branding/logo_horizontal.png")
  .resize({ width: 240, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toBuffer();

const source = `/** Compact PNG for CID inline email logos. Do not use as a remote URL. */
export const EMAIL_LOGO_PNG_BASE64 = "${png.toString("base64")}";
export const EMAIL_LOGO_CONTENT_ID = "novend-logo";
`;

fs.writeFileSync("convex/shared/emailLogoBase64.ts", source);
console.log(`wrote convex/shared/emailLogoBase64.ts (${png.length} bytes)`);
