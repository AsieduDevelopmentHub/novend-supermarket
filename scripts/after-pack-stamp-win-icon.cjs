/**
 * electron-builder afterPack hook — stamp Millie's ICO onto the Windows exe
 * before NSIS builds the Setup installer (so shortcuts get the brand icon).
 */
const { createRequire } = require("node:module");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const appOutDir = context.appOutDir;
  const productFilename =
    context.packager.platformSpecificBuildOptions.executableName ||
    context.packager.appInfo.productFilename;
  const exePath = join(appOutDir, `${productFilename}.exe`);
  const icoPath = join(context.packager.projectDir, "build", "icon.ico");

  if (!existsSync(exePath)) {
    console.warn(`[afterPack] skip icon stamp — missing ${exePath}`);
    return;
  }
  if (!existsSync(icoPath)) {
    console.warn(`[afterPack] skip icon stamp — missing ${icoPath}`);
    return;
  }

  const requireFromDesktop = createRequire(join(context.packager.projectDir, "package.json"));
  let rceditMod;
  try {
    rceditMod = requireFromDesktop("rcedit");
  } catch {
    console.warn("[afterPack] rcedit not installed — Windows exe keeps default Electron icon");
    return;
  }
  const rcedit = rceditMod.rcedit || rceditMod.default || rceditMod;
  const version = context.packager.appInfo.version || "1.0.0";
  await rcedit(exePath, {
    icon: icoPath,
    "version-string": {
      FileDescription: "Millie's Supermarket",
      ProductName: "Millie's Supermarket",
      CompanyName: "Asiedu Development Hub",
      LegalCopyright: "Asiedu Development Hub",
      OriginalFilename: `${productFilename}.exe`,
    },
    "product-version": version,
    "file-version": version,
  });
  console.log(`[afterPack] stamped Millie's icon onto ${exePath}`);
};
