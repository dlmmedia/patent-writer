import { NextRequest, NextResponse } from "next/server";

interface PatentDetails {
  title: string;
  abstract: string;
  description: string;
  claims: string[];
  images: { url: string; label: string }[];
  filingDate: string;
  inventors: string[];
  assignee: string;
  patentNumber: string;
}

async function fetchGooglePatents(
  patentNumber: string
): Promise<Partial<PatentDetails>> {
  const cleanNumber = patentNumber.replace(/[^A-Z0-9]/gi, "");
  const url = `https://patents.google.com/patent/${cleanNumber}/en`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return {};

    const html = await res.text();

    const title = extractMeta(html, "dc.title") || extractTag(html, "title");
    const abstract = extractSection(html, "abstract") || extractMeta(html, "dc.description");
    const description = extractSection(html, "description");
    const inventors = extractMetaAll(html, "dc.contributor");
    const assignee = extractMeta(html, "assignee") || "";
    const filingDate = extractMeta(html, "dc.date") || "";

    const images: { url: string; label: string }[] = [];
    const imgRegex = /https:\/\/patentimages\.storage\.googleapis\.com\/[^"'\s]+/g;
    const imgMatches = html.match(imgRegex) || [];
    const seen = new Set<string>();
    for (const imgUrl of imgMatches) {
      const cleanUrl = imgUrl.replace(/&amp;/g, "&");
      if (!seen.has(cleanUrl)) {
        seen.add(cleanUrl);
        images.push({
          url: `/api/patents/image?url=${encodeURIComponent(cleanUrl)}`,
          label: `Figure ${images.length + 1}`,
        });
      }
      if (images.length >= 10) break;
    }

    const claimsText = extractSection(html, "claims");
    const claims = claimsText
      ? claimsText
          .split(/\n\s*\d+\.\s+/)
          .filter((c) => c.trim().length > 0)
          .map((c) => c.trim())
      : [];

    return {
      title: cleanHtml(title),
      abstract: cleanHtml(abstract),
      description: cleanHtml(description).slice(0, 5000),
      claims,
      images,
      filingDate,
      inventors,
      assignee: cleanHtml(assignee),
      patentNumber,
    };
  } catch (err) {
    console.error("Google Patents fetch error:", err);
    return {};
  }
}

async function fetchPatentsView(
  patentNumber: string
): Promise<Partial<PatentDetails>> {
  const cleanId = patentNumber.replace(/^US/i, "").replace(/[^0-9]/g, "");
  if (!cleanId) return {};

  const apiKey = process.env.PATENTSVIEW_API_KEY?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  try {
    const body = {
      q: { patent_id: cleanId },
      f: [
        "patent_id",
        "patent_title",
        "patent_abstract",
        "patent_date",
        "inventors.inventor_first_name",
        "inventors.inventor_last_name",
        "assignees.assignee_organization",
      ],
      o: { size: 1 },
    };

    const res = await fetch("https://search.patentsview.org/api/v1/patent/", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return {};

    const data = await res.json();
    const patents = data?.patents || data?.data || [];
    if (patents.length === 0) return {};

    const p = patents[0];
    return {
      title: p.patent_title || "",
      abstract: p.patent_abstract || "",
      filingDate: p.patent_date || "",
      inventors:
        p.inventors?.map(
          (i: any) =>
            `${i.inventor_first_name || ""} ${i.inventor_last_name || ""}`.trim()
        ) || [],
      assignee: p.assignees?.[0]?.assignee_organization || "",
      patentNumber,
    };
  } catch (err) {
    console.error("PatentsView fetch error:", err);
    return {};
  }
}

let epoTokenCache: { token: string; expiresAt: number } | null = null;

async function getEpoToken(): Promise<string> {
  if (epoTokenCache && Date.now() < epoTokenCache.expiresAt) {
    return epoTokenCache.token;
  }

  const key = process.env.EPO_CONSUMER_KEY;
  const secret = process.env.EPO_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("EPO credentials not configured");

  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch("https://ops.epo.org/3.2/auth/accesstoken", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`EPO auth failed: ${res.status}`);

  const data = await res.json();
  epoTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function fetchEpoDetails(
  patentNumber: string
): Promise<Partial<PatentDetails>> {
  try {
    const token = await getEpoToken();

    const docId = patentNumber.replace(/\./g, "");
    const biblioUrl = `https://ops.epo.org/3.2/rest-services/published-data/publication/epodoc/${docId}/biblio`;
    const biblioRes = await fetch(biblioUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    let title = "";
    let abstract = "";
    let assignee = "";
    let filingDate = "";
    const inventors: string[] = [];

    if (biblioRes.ok) {
      const xml = await biblioRes.text();
      title = extractXmlText(xml, "invention-title") || "";
      const abstractMatch = xml.match(
        /<abstract[^>]*lang="en"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
      );
      if (abstractMatch) {
        abstract = abstractMatch[1].replace(/<[^>]+>/g, "").trim();
      }
      if (!abstract) {
        const absAny = xml.match(
          /<abstract[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
        );
        if (absAny) abstract = absAny[1].replace(/<[^>]+>/g, "").trim();
      }

      const applicantMatch = xml.match(
        /<applicant[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i
      );
      if (applicantMatch) assignee = applicantMatch[1].trim();

      const inventorRegex =
        /<inventor[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/gi;
      let invMatch;
      while ((invMatch = inventorRegex.exec(xml)) !== null) {
        const name = invMatch[1].trim();
        if (name && !inventors.includes(name)) inventors.push(name);
      }

      const dateMatch = xml.match(
        /<date-of-filing[^>]*>[\s\S]*?<date>([\s\S]*?)<\/date>/i
      );
      if (dateMatch) filingDate = dateMatch[1].trim();
    }

    const images: { url: string; label: string }[] = [];
    try {
      const imgUrl = `https://ops.epo.org/3.2/rest-services/published-data/publication/epodoc/${docId}/images`;
      const imgRes = await fetch(imgUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/xml",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (imgRes.ok) {
        const imgXml = await imgRes.text();
        const linkRegex =
          /<ops:document-instance[^>]*link="([^"]+)"[^>]*desc="Drawing"[^>]*/gi;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(imgXml)) !== null) {
          const path = linkMatch[1];
          const fullUrl = `https://ops.epo.org/3.2/rest-services${path}`;
          images.push({
            url: `/api/patents/image?url=${encodeURIComponent(fullUrl)}&epo=1`,
            label: `Figure ${images.length + 1}`,
          });
          if (images.length >= 10) break;
        }
      }
    } catch {
      // images are optional
    }

    return {
      title,
      abstract,
      description: "",
      claims: [],
      images,
      filingDate,
      inventors,
      assignee,
      patentNumber,
    };
  } catch (err) {
    console.error("EPO details fetch error:", err);
    return {};
  }
}

function extractMeta(html: string, name: string): string {
  const regex = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match) return match[1];

  const regex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
    "i"
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1] : "";
}

function extractMetaAll(html: string, name: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "gi"
  );
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function extractTag(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

function extractSection(html: string, sectionName: string): string {
  const regex = new RegExp(
    `<section[^>]*itemprop=["']${sectionName}["'][^>]*>([\\s\\S]*?)</section>`,
    "i"
  );
  const match = html.match(regex);
  if (!match) return "";
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractXmlText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patentNumber = searchParams.get("patentNumber");
  const source = searchParams.get("source") || "auto";

  if (!patentNumber) {
    return NextResponse.json(
      { error: "patentNumber is required" },
      { status: 400 }
    );
  }

  let details: Partial<PatentDetails> = {};

  const isUSPatent =
    patentNumber.toUpperCase().startsWith("US") ||
    /^\d{6,}/.test(patentNumber);

  if (source === "epo" || (!isUSPatent && source === "auto")) {
    details = await fetchEpoDetails(patentNumber);
    if (!details.abstract && !details.title) {
      details = await fetchGooglePatents(patentNumber);
    }
  } else {
    details = await fetchGooglePatents(patentNumber);
    if (!details.abstract && !details.title) {
      details = await fetchPatentsView(patentNumber);
    }
  }

  return NextResponse.json({
    ...details,
    patentNumber,
    title: details.title || "No title available",
    abstract: details.abstract || "No abstract available",
    description: details.description || "",
    claims: details.claims || [],
    images: details.images || [],
    filingDate: details.filingDate || "",
    inventors: details.inventors || [],
    assignee: details.assignee || "",
  });
}
