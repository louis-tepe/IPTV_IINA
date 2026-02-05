const esbuild = require("esbuild");
const fs = require("fs");

async function build() {
  console.log("🚧 Building IINA Plugin...");

  try {
    // Build global.js
    await esbuild.build({
      entryPoints: ["src/global/index.js"],
      outfile: "global.js",
      bundle: true,
      platform: "neutral", // IINA JS environment
      target: ["es2020"],
      format: "iife", // Global scope
      footer: {
        // Ensure globals are set if needed, though IIFE usually suffices.
        // IINA global.js runs in top-level scope.
        js: "",
      },
      logLevel: "info",
    });

    // Build browser.js
    await esbuild.build({
      entryPoints: ["src/browser/index.js"],
      outfile: "browser.js",
      bundle: true,
      platform: "browser",
      target: ["es2020"],
      format: "iife",
      logLevel: "info",
    });

    console.log("✅ Build complete!");
  } catch (e) {
    console.error("❌ Build failed:", e);
    process.exit(1);
  }
}

build();
