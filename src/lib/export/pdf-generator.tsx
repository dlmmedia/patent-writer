import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PatentWithRelations, SectionType } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/types";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 12,
    lineHeight: 1.5,
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 108,
    paddingRight: 72,
  },
  titlePage: {
    fontFamily: "Helvetica",
    fontSize: 12,
    lineHeight: 1.5,
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 108,
    paddingRight: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 24,
    textTransform: "uppercase",
  },
  titleMeta: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: "justify",
  },
  numberedParagraph: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: "justify",
    flexDirection: "row",
  },
  paragraphNumber: {
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
    minWidth: 40,
  },
  paragraphContent: {
    flex: 1,
    textAlign: "justify",
  },
  claimText: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: "justify",
    paddingLeft: 24,
  },
  claimNumber: {
    fontFamily: "Helvetica-Bold",
    paddingLeft: 0,
  },
  abstractText: {
    fontSize: 12,
    textAlign: "justify",
    lineHeight: 1.5,
  },
  drawingPage: {
    fontFamily: "Helvetica",
    fontSize: 12,
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 108,
    paddingRight: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  drawingLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 12,
  },
  drawingDescription: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    color: "#555555",
  },
  pageNumber: {
    position: "absolute",
    fontSize: 10,
    bottom: 36,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#666666",
  },
  header: {
    position: "absolute",
    fontSize: 9,
    top: 36,
    left: 108,
    right: 72,
    textAlign: "right",
    color: "#999999",
  },
});

function getSectionContent(
  patent: PatentWithRelations,
  sectionType: SectionType
): string {
  const section = patent.sections.find((s) => s.sectionType === sectionType);
  return section?.plainText || "";
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatParagraphNumber(n: number): string {
  return `[${String(n).padStart(4, "0")}]`;
}

function TitlePage({ patent }: { patent: PatentWithRelations }) {
  const inventors = patent.inventors as { name: string; address?: string }[] | null;

  return (
    <Page size="LETTER" style={styles.titlePage}>
      <View>
        <Text style={{ fontSize: 11, textAlign: "center", marginBottom: 36, color: "#666" }}>
          PATENT APPLICATION
        </Text>
        <Text style={styles.titleText}>{patent.title}</Text>
        {inventors && inventors.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ ...styles.titleMeta, fontFamily: "Helvetica-Bold" }}>
              {inventors.length === 1 ? "Inventor:" : "Inventors:"}
            </Text>
            {inventors.map((inv, i) => (
              <Text key={i} style={styles.titleMeta}>
                {inv.name}
                {inv.address ? `, ${inv.address}` : ""}
              </Text>
            ))}
          </View>
        )}
        {patent.assignee && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ ...styles.titleMeta, fontFamily: "Helvetica-Bold" }}>
              Assignee:
            </Text>
            <Text style={styles.titleMeta}>{patent.assignee}</Text>
          </View>
        )}
      </View>
    </Page>
  );
}

function SectionBlock({
  title,
  content,
  numbered,
  startNumber,
}: {
  title: string;
  content: string;
  numbered?: boolean;
  startNumber?: number;
}) {
  if (!content) return null;
  const paragraphs = splitIntoParagraphs(content);
  if (paragraphs.length === 0) return null;

  return (
    <View>
      <Text style={styles.sectionHeading}>{title}</Text>
      {paragraphs.map((para, idx) =>
        numbered ? (
          <View key={idx} style={styles.numberedParagraph}>
            <Text style={styles.paragraphNumber}>
              {formatParagraphNumber((startNumber || 1) + idx)}
            </Text>
            <Text style={styles.paragraphContent}>{para}</Text>
          </View>
        ) : (
          <Text key={idx} style={styles.paragraph}>
            {para}
          </Text>
        )
      )}
    </View>
  );
}

export function PatentPDFDocument({ patent }: { patent: PatentWithRelations }) {
  const crossRef = getSectionContent(patent, "cross_reference");
  const fieldOfInv = getSectionContent(patent, "field_of_invention");
  const background = getSectionContent(patent, "background");
  const summary = getSectionContent(patent, "summary");
  const briefDrawings = getSectionContent(patent, "brief_description_drawings");
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

  for (const s of preSections) {
    paragraphCounter += splitIntoParagraphs(s.content).length;
  }

  const detailedStartNumber = paragraphCounter;

  return (
    <Document
      title={patent.title}
      author={
        (patent.inventors as { name: string }[] | null)?.[0]?.name || "Patent Writer"
      }
      subject="Patent Application"
    >
      <TitlePage patent={patent} />

      {/* Specification body */}
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.header} fixed>
          Patent Application — {patent.title}
        </Text>
        <Text style={styles.pageNumber} fixed render={({ pageNumber }) => `${pageNumber}`} />

        <Text style={styles.sectionHeading}>TITLE OF THE INVENTION</Text>
        <Text style={styles.paragraph}>{patent.title}</Text>

        {preSections.map((section, idx) => {
          const prevCount = preSections
            .slice(0, idx)
            .reduce(
              (sum, s) => sum + splitIntoParagraphs(s.content).length,
              0
            );
          return (
            <SectionBlock
              key={idx}
              title={section.title}
              content={section.content}
              numbered
              startNumber={1 + prevCount}
            />
          );
        })}

        {detailedDesc && (
          <SectionBlock
            title={SECTION_LABELS.detailed_description.toUpperCase()}
            content={detailedDesc}
            numbered
            startNumber={detailedStartNumber}
          />
        )}
      </Page>

      {/* Claims on a new page */}
      {patent.claims.length > 0 && (
        <Page size="LETTER" style={styles.page} wrap>
          <Text style={styles.header} fixed>
            Patent Application — {patent.title}
          </Text>
          <Text style={styles.pageNumber} fixed render={({ pageNumber }) => `${pageNumber}`} />

          <Text style={styles.sectionHeading}>CLAIMS</Text>
          <Text style={styles.paragraph}>What is claimed is:</Text>

          {patent.claims.map((claim) => (
            <View key={claim.id} style={{ marginBottom: 12 }}>
              <Text style={styles.claimText}>
                <Text style={styles.claimNumber}>{claim.claimNumber}. </Text>
                {claim.fullText}
              </Text>
            </View>
          ))}
        </Page>
      )}

      {/* Abstract on a new page */}
      {abstractText && (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.header} fixed>
            Patent Application — {patent.title}
          </Text>
          <Text style={styles.pageNumber} fixed render={({ pageNumber }) => `${pageNumber}`} />

          <Text style={styles.sectionHeading}>ABSTRACT</Text>
          <Text style={styles.abstractText}>
            {abstractText.split(/\s+/).slice(0, 150).join(" ")}
          </Text>
        </Page>
      )}

      {/* Drawing sheets */}
      {patent.drawings.map((drawing) => (
        <Page key={drawing.id} size="LETTER" style={styles.drawingPage}>
          <Text style={styles.header} fixed>
            Patent Application — {patent.title}
          </Text>
          <Text style={styles.pageNumber} fixed render={({ pageNumber }) => `${pageNumber}`} />

          <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
            <Text style={{ fontSize: 14, color: "#999", marginBottom: 8 }}>
              [Drawing Placeholder]
            </Text>
            <Text style={styles.drawingLabel}>
              FIG. {drawing.figureNumber}
            </Text>
            <Text style={styles.drawingDescription}>
              {drawing.figureLabel}
            </Text>
            {drawing.description && (
              <Text style={{ ...styles.drawingDescription, marginTop: 8, maxWidth: 400 }}>
                {drawing.description}
              </Text>
            )}
          </View>
        </Page>
      ))}
    </Document>
  );
}
