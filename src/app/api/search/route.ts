import { NextResponse } from "next/server";

interface SearchResult {
  id: string;
  patentNumber: string;
  title: string;
  abstract: string;
  assignee: string;
  filingDate: string;
  sourceApi: string;
  externalUrl: string;
}

interface SearchRequest {
  query: string;
  sources: string[];
  patentId?: string;
}

// ─── PatentsView (USPTO, free, no auth) ─────────────────────

async function searchPatentsView(query: string): Promise<SearchResult[]> {
  const url = "https://api.patentsview.org/patents/query";
  const body = {
    q: { _text_any: { patent_abstract: query } },
    f: [
      "patent_number",
      "patent_title",
      "patent_abstract",
      "patent_date",
      "assignee_organization",
    ],
    o: { per_page: 25 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`PatentsView returned ${res.status}`);
    return [];
  }

  const data = await res.json();
  if (!data.patents) return [];

  return data.patents.map(
    (p: {
      patent_number: string;
      patent_title: string;
      patent_abstract: string;
      patent_date: string;
      assignees?: { assignee_organization: string }[];
    }) => ({
      id: `pv-${p.patent_number}`,
      patentNumber: `US${p.patent_number}`,
      title: p.patent_title || "Untitled",
      abstract: p.patent_abstract || "",
      assignee:
        p.assignees?.[0]?.assignee_organization || "Unknown",
      filingDate: p.patent_date || "",
      sourceApi: "patentsview",
      externalUrl: `https://patents.google.com/patent/US${p.patent_number}`,
    })
  );
}

// ─── EPO OPS (worldwide, needs OAuth2) ──────────────────────

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

function extractTextFromXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractAllFromXmlTag(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].replace(/<[^>]+>/g, "").trim());
  }
  return results;
}

async function searchEpo(query: string): Promise<SearchResult[]> {
  const token = await getEpoToken();
  const encoded = encodeURIComponent(query);
  const url = `https://ops.epo.org/3.2/rest-services/published-data/search?q=ta%3D${encoded}&Range=1-25`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`EPO search returned ${res.status}`);
    return [];
  }

  const xml = await res.text();

  const docIds = extractAllFromXmlTag(xml, "document-id");
  const results: SearchResult[] = [];

  for (const docBlock of docIds.slice(0, 25)) {
    const country = extractTextFromXmlTag(docBlock, "country");
    const docNumber = extractTextFromXmlTag(docBlock, "doc-number");
    const kind = extractTextFromXmlTag(docBlock, "kind");
    if (!docNumber) continue;

    const patentNumber = `${country}${docNumber}${kind ? `.${kind}` : ""}`;

    results.push({
      id: `epo-${patentNumber}`,
      patentNumber,
      title: "",
      abstract: "",
      assignee: "",
      filingDate: "",
      sourceApi: "epo",
      externalUrl: `https://worldwide.espacenet.com/patent/search?q=pn%3D${encodeURIComponent(patentNumber)}`,
    });
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.patentNumber)) return false;
    seen.add(r.patentNumber);
    return true;
  });
}

// ─── Deduplication ──────────────────────────────────────────

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const map = new Map<string, SearchResult>();
  for (const r of results) {
    const normalised = r.patentNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (!map.has(normalised)) {
      map.set(normalised, r);
    }
  }
  return Array.from(map.values());
}

// ─── POST handler ───────────────────────────────────────────

const searchFunctions: Record<string, (q: string) => Promise<SearchResult[]>> =
  {
    patentsview: searchPatentsView,
    epo: searchEpo,
  };

export async function POST(req: Request) {
  try {
    const { query, sources, patentId } = (await req.json()) as SearchRequest;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const activeSources = (sources ?? Object.keys(searchFunctions)).filter(
      (s) => s in searchFunctions
    );

    const settled = await Promise.allSettled(
      activeSources.map((src) => searchFunctions[src](query.trim()))
    );

    const allResults: SearchResult[] = [];
    const errors: string[] = [];

    settled.forEach((outcome, idx) => {
      if (outcome.status === "fulfilled") {
        allResults.push(...outcome.value);
      } else {
        errors.push(`${activeSources[idx]}: ${outcome.reason?.message ?? "Unknown error"}`);
        console.error(`Search source ${activeSources[idx]} failed:`, outcome.reason);
      }
    });

    const deduplicated = deduplicateResults(allResults);

    return NextResponse.json({
      results: deduplicated,
      meta: {
        query: query.trim(),
        patentId: patentId || null,
        sources: activeSources,
        totalResults: deduplicated.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (err) {
    console.error("Search API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
