import {
  Document,
  Page,
  Text,
  View,
  Image,
} from "@react-pdf/renderer";
import type {
  PatentWithRelations,
  SectionType,
  ReferenceNumeral,
} from "@/lib/types";
import { SECTION_LABELS } from "@/lib/types";

export interface PdfExportOptions {
  pageSize: "LETTER" | "A4";
  fontSize: number;
  includeParagraphNumbers: boolean;
  includeHeadersFooters: boolean;
}

const DEFAULT_OPTIONS: PdfExportOptions = {
  pageSize: "LETTER",
  fontSize: 12,
  includeParagraphNumbers: true,
  includeHeadersFooters: true,
};

const F = "Times-Roman";
const FB = "Times-Bold";
const FI = "Times-Italic";

const RULE_LINE =
  "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500";

const SPEC_SECTIONS: SectionType[] = [
  "cross_reference",
  "field_of_invention",
  "background",
  "summary",
  "brief_description_drawings",
  "detailed_description",
];

function sortByFigureNumber(
  a: { figureNumber: string },
  b: { figureNumber: string }
): number {
  const parse = (s: string) => {
    const m = s.match(/^(\d+)([A-Za-z]?)$/);
    if (!m) return { n: 0, s: s };
    return { n: parseInt(m[1], 10), s: m[2] || "" };
  };
  const pa = parse(a.figureNumber);
  const pb = parse(b.figureNumber);
  return pa.n !== pb.n ? pa.n - pb.n : pa.s.localeCompare(pb.s);
}

function getSectionContent(
  patent: PatentWithRelations,
  type: SectionType
): string {
  return patent.sections.find((s) => s.sectionType === type)?.plainText || "";
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function fmtParaNum(n: number): string {
  return `[${String(n).padStart(4, "0")}]`;
}

function truncateStr(s: string, max = 50): string {
  return s.length <= max ? s : s.slice(0, max - 3) + "...";
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SectionBlock({
  title,
  content,
  numbered,
  startNumber,
  fs,
}: {
  title: string;
  content: string;
  numbered?: boolean;
  startNumber?: number;
  fs: number;
}) {
  if (!content) return null;
  const paragraphs = splitIntoParagraphs(content);
  if (paragraphs.length === 0) return null;

  return (
    <View>
      <Text
        style={{
          fontSize: fs + 1,
          fontFamily: FB,
          textTransform: "uppercase",
          marginTop: 24,
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      {paragraphs.map((para, idx) =>
        numbered ? (
          <View
            key={idx}
            style={{ flexDirection: "row", marginBottom: 10 }}
          >
            <Text
              style={{
                fontFamily: FB,
                fontSize: fs,
                marginRight: 8,
                minWidth: 40,
              }}
            >
              {fmtParaNum((startNumber || 1) + idx)}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: fs,
                textAlign: "justify",
                lineHeight: 1.5,
              }}
            >
              {para}
            </Text>
          </View>
        ) : (
          <Text
            key={idx}
            style={{
              fontSize: fs,
              marginBottom: 10,
              textAlign: "justify",
              lineHeight: 1.5,
            }}
          >
            {para}
          </Text>
        )
      )}
    </View>
  );
}

export function PatentPDFDocument({
  patent,
  options,
}: {
  patent: PatentWithRelations;
  options?: Partial<PdfExportOptions>;
}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pageSize = opts.pageSize;
  const fs = opts.fontSize;
  const numbered = opts.includeParagraphNumbers;
  const showHF = opts.includeHeadersFooters;

  const inventors = patent.inventors as
    | { name: string; address?: string }[]
    | null;

  const crossRef = getSectionContent(patent, "cross_reference");
  const fieldOfInv = getSectionContent(patent, "field_of_invention");
  const background = getSectionContent(patent, "background");
  const summary = getSectionContent(patent, "summary");
  const briefDrawings = getSectionContent(
    patent,
    "brief_description_drawings"
  );
  const detailedDesc = getSectionContent(patent, "detailed_description");
  const abstractText = getSectionContent(patent, "abstract");

  let paragraphCounter = 1;
  const preSections: { title: string; content: string }[] = [];
  if (crossRef)
    preSections.push({
      title: SECTION_LABELS.cross_reference.toUpperCase(),
      content: crossRef,
    });
  if (fieldOfInv)
    preSections.push({
      title: SECTION_LABELS.field_of_invention.toUpperCase(),
      content: fieldOfInv,
    });
  if (background)
    preSections.push({
      title: SECTION_LABELS.background.toUpperCase(),
      content: background,
    });
  if (summary)
    preSections.push({
      title: SECTION_LABELS.summary.toUpperCase(),
      content: summary,
    });
  if (briefDrawings)
    preSections.push({
      title: SECTION_LABELS.brief_description_drawings.toUpperCase(),
      content: briefDrawings,
    });

  if (numbered) {
    for (const sec of preSections) {
      paragraphCounter += splitIntoParagraphs(sec.content).length;
    }
  }
  const detailedStartNumber = paragraphCounter;

  const sortedDrawings = [...patent.drawings].sort(sortByFigureNumber);
  const totalSheets = sortedDrawings.length;
  const refNumerals = (patent.referenceNumerals || [])
    .slice()
    .sort(
      (a: ReferenceNumeral, b: ReferenceNumeral) => a.numeral - b.numeral
    );

  const abstractWords = abstractText
    ? abstractText.split(/\s+/).filter(Boolean).length
    : 0;
  const truncatedAbstract = abstractText
    ? abstractText.split(/\s+/).slice(0, 150).join(" ")
    : "";

  const pageStyle = {
    fontFamily: F,
    fontSize: fs,
    lineHeight: 1.5,
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 108,
    paddingRight: 72,
  };

  const titlePageStyle = {
    fontFamily: F,
    fontSize: fs,
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 108,
    paddingRight: 72,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  };

  const headerStyle = {
    position: "absolute" as const,
    fontSize: fs - 3,
    top: 36,
    left: 108,
    right: 72,
    textAlign: "right" as const,
    color: "#777777",
    fontFamily: FI,
  };

  const footerStyle = {
    position: "absolute" as const,
    fontSize: fs - 3,
    bottom: 36,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    color: "#777777",
    fontFamily: F,
  };

  const sectionHeadingStyle = {
    fontSize: fs + 1,
    fontFamily: FB,
    textTransform: "uppercase" as const,
    marginTop: 24,
    marginBottom: 12,
  };

  const metaRows: { label: string; value: string }[] = [];
  if (inventors && inventors.length > 0) {
    metaRows.push({
      label: inventors.length === 1 ? "Inventor:" : "Inventors:",
      value: inventors
        .map((i) => i.name + (i.address ? `, ${i.address}` : ""))
        .join("; "),
    });
  }
  if (patent.assignee)
    metaRows.push({ label: "Assignee:", value: patent.assignee });
  if (patent.filingDate)
    metaRows.push({ label: "Filed:", value: fmtDate(patent.filingDate) });
  if (patent.priorityDate)
    metaRows.push({
      label: "Priority:",
      value: fmtDate(patent.priorityDate),
    });
  if (patent.technologyArea)
    metaRows.push({ label: "Field:", value: patent.technologyArea });

  return (
    <Document
      title={patent.title}
      author={
        (patent.inventors as { name: string }[] | null)?.[0]?.name ||
        "Patent Writer"
      }
      subject="Patent Application"
      creator="Patent Writer"
    >
      {/* ── Title Page ───────────────────────────────────────── */}
      <Page size={pageSize} style={titlePageStyle}>
        <View>
          <Text
            style={{
              fontSize: fs - 1,
              textAlign: "center",
              color: "#555555",
              marginBottom: 2,
              fontFamily: F,
            }}
          >
            UNITED STATES
          </Text>
          <Text
            style={{
              fontSize: fs + 1,
              textAlign: "center",
              color: "#333333",
              marginBottom: 24,
              fontFamily: FB,
            }}
          >
            PATENT APPLICATION PUBLICATION
          </Text>

          <Text
            style={{
              textAlign: "center",
              color: "#333333",
              marginBottom: 20,
              fontSize: fs - 2,
            }}
          >
            {RULE_LINE}
          </Text>

          <Text
            style={{
              fontSize: fs + 6,
              fontFamily: FB,
              textAlign: "center",
              marginBottom: 20,
              textTransform: "uppercase",
              lineHeight: 1.4,
            }}
          >
            {patent.title}
          </Text>

          <Text
            style={{
              textAlign: "center",
              color: "#333333",
              marginBottom: 28,
              fontSize: fs - 2,
            }}
          >
            {RULE_LINE}
          </Text>

          {metaRows.map((row, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                marginBottom: 6,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: FB,
                  fontSize: fs - 1,
                  color: "#333333",
                  width: 80,
                  textAlign: "right",
                  marginRight: 12,
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  fontFamily: F,
                  fontSize: fs - 1,
                  color: "#333333",
                  width: 280,
                }}
              >
                {row.value}
              </Text>
            </View>
          ))}

          <Text
            style={{
              textAlign: "center",
              color: "#AAAAAA",
              marginTop: 28,
              marginBottom: 16,
              fontSize: fs - 3,
            }}
          >
            {"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"}
          </Text>

          <Text
            style={{
              fontSize: fs - 2,
              color: "#888888",
              textAlign: "center",
              fontFamily: F,
            }}
          >
            Docket No.: _______________
          </Text>
        </View>
      </Page>

      {/* ── Specification ─ each section on its own wrapping page ── */}
      <Page size={pageSize} style={pageStyle} wrap>
        {showHF && (
          <Text style={headerStyle} fixed>
            {truncateStr(patent.title)} {"\u2014"} Patent Application
          </Text>
        )}
        {showHF && (
          <Text
            style={footerStyle}
            fixed
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        )}

        <Text style={sectionHeadingStyle}>TITLE OF THE INVENTION</Text>
        <Text
          style={{
            fontSize: fs,
            marginBottom: 10,
            textAlign: "justify",
          }}
        >
          {patent.title}
        </Text>

        {preSections.length > 0 && (
          <SectionBlock
            title={preSections[0].title}
            content={preSections[0].content}
            numbered={numbered}
            startNumber={1}
            fs={fs}
          />
        )}
      </Page>

      {preSections.slice(1).map((section, idx) => {
        const prevCount = numbered
          ? preSections
              .slice(0, idx + 1)
              .reduce(
                (sum, sec) =>
                  sum + splitIntoParagraphs(sec.content).length,
                0
              )
          : 0;
        return (
          <Page key={idx} size={pageSize} style={pageStyle} wrap>
            {showHF && (
              <Text style={headerStyle} fixed>
                {truncateStr(patent.title)} {"\u2014"} Patent
                Application
              </Text>
            )}
            {showHF && (
              <Text
                style={footerStyle}
                fixed
                render={({ pageNumber, totalPages }) =>
                  `Page ${pageNumber} of ${totalPages}`
                }
              />
            )}
            <SectionBlock
              title={section.title}
              content={section.content}
              numbered={numbered}
              startNumber={1 + prevCount}
              fs={fs}
            />
          </Page>
        );
      })}

      {detailedDesc && (
        <Page size={pageSize} style={pageStyle} wrap>
          {showHF && (
            <Text style={headerStyle} fixed>
              {truncateStr(patent.title)} {"\u2014"} Patent Application
            </Text>
          )}
          {showHF && (
            <Text
              style={footerStyle}
              fixed
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          )}
          <SectionBlock
            title={SECTION_LABELS.detailed_description.toUpperCase()}
            content={detailedDesc}
            numbered={numbered}
            startNumber={detailedStartNumber}
            fs={fs}
          />
        </Page>
      )}

      {/* ── Claims ───────────────────────────────────────────── */}
      {patent.claims.length > 0 && (
        <Page size={pageSize} style={pageStyle} wrap>
          {showHF && (
            <Text style={headerStyle} fixed>
              {truncateStr(patent.title)} {"\u2014"} Patent Application
            </Text>
          )}
          {showHF && (
            <Text
              style={footerStyle}
              fixed
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          )}

          <Text style={sectionHeadingStyle}>CLAIMS</Text>
          <Text
            style={{
              fontSize: fs,
              marginBottom: 12,
            }}
          >
            What is claimed is:
          </Text>

          {patent.claims.map((claim) => {
            const dep = claim.isIndependent === false;
            return (
              <View key={claim.id} style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: fs,
                    textAlign: "justify",
                    lineHeight: 1.5,
                    paddingLeft: dep ? 36 : 0,
                  }}
                >
                  <Text style={{ fontFamily: FB }}>
                    {claim.claimNumber}.{" "}
                  </Text>
                  {claim.fullText}
                </Text>
              </View>
            );
          })}
        </Page>
      )}

      {/* ── Abstract ─────────────────────────────────────────── */}
      {abstractText && (
        <Page size={pageSize} style={pageStyle}>
          {showHF && (
            <Text style={headerStyle} fixed>
              {truncateStr(patent.title)} {"\u2014"} Patent Application
            </Text>
          )}
          {showHF && (
            <Text
              style={footerStyle}
              fixed
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          )}

          <Text style={sectionHeadingStyle}>ABSTRACT</Text>
          <Text
            style={{
              fontSize: fs,
              textAlign: "justify",
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            {truncatedAbstract}
          </Text>
          <Text
            style={{
              fontFamily: FI,
              fontSize: fs - 2,
              color: "#666666",
              textAlign: "center",
              marginTop: 12,
            }}
          >
            ({Math.min(abstractWords, 150)} words)
          </Text>
        </Page>
      )}

      {/* ── Reference Numerals ───────────────────────────────── */}
      {refNumerals.length > 0 && (
        <Page size={pageSize} style={pageStyle} wrap>
          {showHF && (
            <Text style={headerStyle} fixed>
              {truncateStr(patent.title)} {"\u2014"} Patent Application
            </Text>
          )}
          {showHF && (
            <Text
              style={footerStyle}
              fixed
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          )}

          <Text style={sectionHeadingStyle}>REFERENCE NUMERALS</Text>

          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: "#333333",
              paddingBottom: 4,
              marginBottom: 4,
            }}
          >
            <Text
              style={{ fontFamily: FB, fontSize: fs - 1, width: 80 }}
            >
              NO.
            </Text>
            <Text
              style={{ fontFamily: FB, fontSize: fs - 1, flex: 1 }}
            >
              ELEMENT
            </Text>
          </View>

          {refNumerals.map((rn) => (
            <View
              key={rn.id}
              style={{
                flexDirection: "row",
                borderBottomWidth: 1,
                borderBottomColor: "#DDDDDD",
                paddingTop: 3,
                paddingBottom: 3,
              }}
            >
              <Text
                style={{ fontFamily: FB, fontSize: fs - 1, width: 80 }}
              >
                {rn.numeral}
              </Text>
              <Text
                style={{ fontFamily: F, fontSize: fs - 1, flex: 1 }}
              >
                {rn.elementName}
              </Text>
            </View>
          ))}
        </Page>
      )}

      {/* ── Drawing Sheets ───────────────────────────────────── */}
      {sortedDrawings.length > 0 && (
        <>
          {sortedDrawings.map((drawing, idx) => {
            const imageUrl =
              drawing.processedUrl || drawing.originalUrl;
            return (
              <Page
                key={drawing.id}
                size={pageSize}
                style={{
                  fontFamily: F,
                  fontSize: fs,
                  paddingTop: 72,
                  paddingBottom: 72,
                  paddingLeft: 108,
                  paddingRight: 72,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {showHF && (
                  <Text style={headerStyle} fixed>
                    {idx === 0 ? "DRAWINGS \u2014 " : ""}Sheet{" "}
                    {idx + 1} of {totalSheets}
                  </Text>
                )}
                {showHF && (
                  <Text
                    style={footerStyle}
                    fixed
                    render={({ pageNumber, totalPages }) =>
                      `Page ${pageNumber} of ${totalPages}`
                    }
                  />
                )}

                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                  }}
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      style={{
                        width: 380,
                        height: "auto",
                        maxHeight: 480,
                      }}
                    />
                  ) : (
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#999",
                        marginBottom: 8,
                        fontFamily: FI,
                      }}
                    >
                      [Drawing Placeholder]
                    </Text>
                  )}
                  <Text
                    style={{
                      fontFamily: FB,
                      fontSize: fs,
                      textAlign: "center",
                      marginTop: 12,
                    }}
                  >
                    FIG. {drawing.figureNumber}
                  </Text>
                  {drawing.figureLabel && (
                    <Text
                      style={{
                        fontFamily: FI,
                        fontSize: fs - 2,
                        textAlign: "center",
                        marginTop: 4,
                        color: "#555555",
                      }}
                    >
                      {drawing.figureLabel}
                    </Text>
                  )}
                </View>
              </Page>
            );
          })}
        </>
      )}
    </Document>
  );
}
