import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");
  const isEpo = searchParams.get("epo") === "1";

  if (!imageUrl) {
    return NextResponse.json(
      { error: "url parameter is required" },
      { status: 400 }
    );
  }

  try {
    const parsedUrl = new URL(imageUrl);
    const allowedHosts = [
      "patentimages.storage.googleapis.com",
      "ops.epo.org",
      "worldwide.espacenet.com",
      "patents.google.com",
      "api.uspto.gov",
      "pimg-fpiw.uspto.gov",
      "assignment.uspto.gov",
    ];

    if (!allowedHosts.some((host) => parsedUrl.hostname.endsWith(host))) {
      return NextResponse.json(
        { error: "Image host not allowed" },
        { status: 403 }
      );
    }

    const headers: Record<string, string> = {};

    if (isEpo) {
      const key = process.env.EPO_CONSUMER_KEY;
      const secret = process.env.EPO_CONSUMER_SECRET;
      if (key && secret) {
        const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
        const tokenRes = await fetch(
          "https://ops.epo.org/3.2/auth/accesstoken",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
          }
        );

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          headers["Authorization"] = `Bearer ${tokenData.access_token}`;
        }
      }
      headers["Accept"] = "image/png,image/tiff,image/jpeg,*/*";
    }

    const res = await fetch(imageUrl, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Image proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
