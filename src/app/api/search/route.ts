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

// ─── PatentsView (USPTO PatentSearch API, requires API key) ──

async function readErrorBody(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = await res.json();
      return JSON.stringify(json).slice(0, 300);
    } catch {
      return "Unable to parse JSON error body";
    }
  }

  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "Unable to read error body";
  }
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  attempts = 2
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      const isAbort =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("aborted"));
      if (!isAbort || attempt === attempts) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

function getUsptoDataApiKey(): string | null {
  return (
    process.env.USPTO_API_KEY?.trim() ||
    process.env.USPTO_ODP_API_KEY?.trim() ||
    process.env.PATENTSVIEW_API_KEY?.trim() ||
    null
  );
}

async function searchUsptoData(query: string): Promise<SearchResult[]> {
  const apiKey = getUsptoDataApiKey();
  if (!apiKey) {
    throw new Error(
      "USPTO data API key not configured (set USPTO_API_KEY or USPTO_ODP_API_KEY)"
    );
  }

  const url = "https://api.uspto.gov/api/v1/patent/applications/search";
  let res: Response;
  try {
    res = await fetchWithRetry(
      `${url}?q=${encodeURIComponent(query)}&offset=0&limit=25`,
      {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey,
        },
        signal: AbortSignal.timeout(30_000),
      },
      2
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`USPTO data request timed out or failed: ${message}`);
  }

  if (!res.ok) {
    const errorBody = await readErrorBody(res);
    throw new Error(
      `USPTO data search failed (${res.status}): ${errorBody || "No response body"}`
    );
  }

  type UsptoBagItem = {
    applicationNumberText?: string;
    applicationMetaData?: {
      inventionTitle?: string;
      filingDate?: string;
      effectiveFilingDate?: string;
    };
    assignmentBag?: Array<{
      assigneeBag?: Array<{ assigneeNameText?: string }>;
    }>;
  };

  const data = await res.json();
  const items: UsptoBagItem[] = Array.isArray(data?.patentFileWrapperDataBag)
    ? data.patentFileWrapperDataBag
    : [];

  return items
    .map((item) => {
      const appNo = item.applicationNumberText?.trim();
      if (!appNo) return null;

      const title = item.applicationMetaData?.inventionTitle?.trim() || "Untitled";
      const filingDate =
        item.applicationMetaData?.filingDate ||
        item.applicationMetaData?.effectiveFilingDate ||
        "";
      const assignee =
        item.assignmentBag?.[0]?.assigneeBag?.[0]?.assigneeNameText?.trim() ||
        "Unknown";

      return {
        id: `uspto-${appNo}`,
        patentNumber: appNo,
        title,
        abstract: "",
        assignee,
        filingDate,
        sourceApi: "patentsview",
        externalUrl: `https://patentcenter.uspto.gov/applications/${encodeURIComponent(appNo)}`,
      } satisfies SearchResult;
    })
    .filter((result): result is SearchResult => result !== null);
}

async function searchPatentsView(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.PATENTSVIEW_API_KEY?.trim();
  if (!apiKey) {
    return searchUsptoData(query);
  }

  const url = "https://search.patentsview.org/api/v1/patent/";
  const body = {
    q: {
      _or: [
        { _text_any: { patent_title: query } },
        { _text_any: { patent_abstract: query } },
      ],
    },
    f: [
      "patent_id",
      "patent_title",
      "patent_abstract",
      "patent_date",
      "assignees.assignee_organization",
    ],
    o: { size: 25 },
  };

  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
      2
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`PatentsView request timed out or failed: ${message}`);
  }

  if (!res.ok) {
    const errorBody = await readErrorBody(res);
    if (res.status === 403) {
      // If this key is actually a USPTO data key, use USPTO ODP search instead.
      return searchUsptoData(query);
    }
    throw new Error(
      `PatentsView search failed (${res.status}): ${errorBody || "No response body"}`
    );
  }

  const data = await res.json();
  const patents = Array.isArray(data?.patents)
    ? data.patents
    : Array.isArray(data?.data)
      ? data.data
      : [];
  if (patents.length === 0) return [];

  return patents.map(
    (p: {
      patent_id: string;
      patent_title: string;
      patent_abstract: string;
      patent_date: string;
      assignees?: { assignee_organization: string }[];
    }) => ({
      id: `pv-${p.patent_id}`,
      patentNumber: `US${p.patent_id}`,
      title: p.patent_title || "Untitled",
      abstract: p.patent_abstract || "",
      assignee:
        p.assignees?.[0]?.assignee_organization || "Unknown",
      filingDate: p.patent_date || "",
      sourceApi: "patentsview",
      externalUrl: `https://patents.google.com/patent/US${p.patent_id}`,
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

function extractXmlBlocksByTag(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[0]);
  }
  return results;
}

async function fetchEpoBiblio(
  token: string,
  docId: string
): Promise<{ title: string; abstract: string; assignee: string; filingDate: string }> {
  try {
    const cleanId = docId.replace(/\./g, "");
    const url = `https://ops.epo.org/3.2/rest-services/published-data/publication/epodoc/${cleanId}/biblio`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/xml",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return { title: "", abstract: "", assignee: "", filingDate: "" };

    const xml = await res.text();

    let title = "";
    const titleEnMatch = xml.match(
      /<invention-title[^>]*lang="en"[^>]*>([\s\S]*?)<\/invention-title>/i
    );
    if (titleEnMatch) {
      title = titleEnMatch[1].replace(/<[^>]+>/g, "").trim();
    } else {
      title = extractTextFromXmlTag(xml, "invention-title");
    }

    let abstract = "";
    const absEnMatch = xml.match(
      /<abstract[^>]*lang="en"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
    );
    if (absEnMatch) {
      abstract = absEnMatch[1].replace(/<[^>]+>/g, "").trim();
    } else {
      const absAny = xml.match(
        /<abstract[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
      );
      if (absAny) abstract = absAny[1].replace(/<[^>]+>/g, "").trim();
    }

    let assignee = "";
    const applicantMatch = xml.match(
      /<applicant[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>/i
    );
    if (applicantMatch) assignee = applicantMatch[1].trim();

    let filingDate = "";
    const dateMatch = xml.match(
      /<date-of-filing[^>]*>[\s\S]*?<date>([\s\S]*?)<\/date>/i
    );
    if (dateMatch) filingDate = dateMatch[1].trim();

    return { title, abstract, assignee, filingDate };
  } catch {
    return { title: "", abstract: "", assignee: "", filingDate: "" };
  }
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
    const errorBody = await readErrorBody(res);
    throw new Error(
      `EPO search failed (${res.status}): ${errorBody || "No response body"}`
    );
  }

  const xml = await res.text();

  const docIds = extractXmlBlocksByTag(xml, "document-id");
  const rawResults: { patentNumber: string; id: string; externalUrl: string }[] = [];

  const seen = new Set<string>();
  for (const docBlock of docIds.slice(0, 25)) {
    const country = extractTextFromXmlTag(docBlock, "country");
    const docNumber = extractTextFromXmlTag(docBlock, "doc-number");
    const kind = extractTextFromXmlTag(docBlock, "kind");
    if (!docNumber) continue;

    const patentNumber = `${country}${docNumber}${kind ? `.${kind}` : ""}`;
    if (seen.has(patentNumber)) continue;
    seen.add(patentNumber);

    rawResults.push({
      patentNumber,
      id: `epo-${patentNumber}`,
      externalUrl: `https://worldwide.espacenet.com/patent/search?q=pn%3D${encodeURIComponent(patentNumber)}`,
    });
  }

  const BATCH_SIZE = 5;
  const results: SearchResult[] = [];
  for (let i = 0; i < rawResults.length; i += BATCH_SIZE) {
    const batch = rawResults.slice(i, i + BATCH_SIZE);
    const biblioResults = await Promise.all(
      batch.map((r) => fetchEpoBiblio(token, r.patentNumber))
    );

    for (let j = 0; j < batch.length; j++) {
      const raw = batch[j];
      const biblio = biblioResults[j];
      results.push({
        id: raw.id,
        patentNumber: raw.patentNumber,
        title: biblio.title || "Untitled",
        abstract: biblio.abstract || "",
        assignee: biblio.assignee || "",
        filingDate: biblio.filingDate || "",
        sourceApi: "epo",
        externalUrl: raw.externalUrl,
      });
    }
  }

  return results;
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

    if (Array.isArray(sources) && sources.length === 0) {
      return NextResponse.json(
        { error: "At least one source must be selected" },
        { status: 400 }
      );
    }

    const requestedSources = Array.isArray(sources)
      ? sources
      : Object.keys(searchFunctions);
    const activeSources = requestedSources.filter((s) => s in searchFunctions);

    if (activeSources.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid search sources selected. Supported sources: patentsview, epo",
        },
        { status: 400 }
      );
    }

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
