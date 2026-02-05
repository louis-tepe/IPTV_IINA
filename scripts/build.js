import esbuild from "esbuild";
import fs from "fs";
import path from "path";

// Ensure dist directory exists
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}

async function build() {
  console.log("🚧 Building IINA Plugin...");

  try {
    // 1. Build global.js (Plugin Backend)
    await esbuild.build({
      entryPoints: ["src/global/index.js"],
      outfile: "dist/global.js",
      bundle: true,
      platform: "neutral",
      target: ["es2020"],
      format: "iife",
      footer: { js: "" },
      logLevel: "info",
    });

    // 2. Build browser.js (UI Logic)
    await esbuild.build({
      entryPoints: ["src/browser/index.js"],
      outfile: "dist/browser.js",
      bundle: true,
      platform: "browser",
      target: ["es2020"],
      format: "iife",
      logLevel: "info",
    });

    // 3. Build main.js (Main Window Entry)
    await esbuild.build({
      entryPoints: ["src/main/index.js"],
      outfile: "dist/main.js",
      bundle: true,
      platform: "neutral",
      target: ["es2020"],
      format: "iife",
      logLevel: "info",
    });

    // 4. Copy Static Assets
    const staticFiles = ["browser.html", "connection.html", "styles.css"];
    staticFiles.forEach(file => {
      fs.copyFileSync(
        path.join("src/static", file),
        path.join("dist", file)
      );
      console.log(`COPY ${file} -> dist/${file}`);
    });

    console.log("✅ Build complete!");
  } catch (e) {
    console.error("❌ Build failed:", e);
    process.exit(1);
  }
}

build();
