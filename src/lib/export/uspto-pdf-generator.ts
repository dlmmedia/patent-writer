import type { PatentWithRelations } from "@/lib/types";
import { generatePatentHtml, type UsptoExportOptions } from "./uspto-html-template";

async function prefetchImagesAsBase64(
  patent: PatentWithRelations
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const urls = new Set<string>();

  for (const drawing of patent.drawings) {
    const url = drawing.processedUrl || drawing.originalUrl;
    if (url) urls.add(url);
  }

  await Promise.allSettled(
    [...urls].map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/png";
        const b64 = Buffer.from(buffer).toString("base64");
        urlMap.set(url, `data:${contentType};base64,${b64}`);
      } catch {
        // skip unreachable images
      }
    })
  );

  return urlMap;
}

function replaceImageUrls(html: string, urlMap: Map<string, string>): string {
  for (const [original, base64] of urlMap) {
    html = html.replaceAll(
      original.replace(/&/g, "&amp;").replace(/"/g, "&quot;"),
      base64
    );
    html = html.replaceAll(original, base64);
  }
  return html;
}

export async function generateUsptoPdf(
  patent: PatentWithRelations,
  options?: Partial<UsptoExportOptions>
): Promise<Buffer> {
  const imageMap = await prefetchImagesAsBase64(patent);

  let html = generatePatentHtml(patent, options);
  html = replaceImageUrls(html, imageMap);

  const isDev = process.env.NODE_ENV === "development";

  let browser;
  try {
    if (isDev) {
      const puppeteer = await import("puppeteer-core");
      const possiblePaths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ];

      let execPath: string | undefined;
      const fs = await import("fs");
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          execPath = p;
          break;
        }
      }

      if (!execPath) {
        throw new Error(
          "Chrome/Chromium not found. Install Chrome or set CHROME_EXECUTABLE_PATH env var."
        );
      }

      execPath = process.env.CHROME_EXECUTABLE_PATH || execPath;

      browser = await puppeteer.default.launch({
        executablePath: execPath,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
    } else {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      const puppeteer = await import("puppeteer-core");

      browser = await puppeteer.default.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 900 },
        executablePath: await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar"
        ),
        headless: true,
      });
    }

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const pdfBuffer = await page.pdf({
      format: (options?.pageSize || "LETTER") === "LETTER" ? "Letter" : "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
