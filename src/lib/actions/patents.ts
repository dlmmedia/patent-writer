"use server";

import { db } from "@/lib/db";
import {
  patents,
  patentSections,
  patentClaims,
  patentDrawings,
  referenceNumerals,
  priorArtSearches,
  priorArtResults,
  patentVersions,
} from "@/lib/db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import type {
  NewPatent,
  NewPatentSection,
  NewPatentClaim,
  NewPatentDrawing,
  SectionType,
  PatentType,
  Jurisdiction,
} from "@/lib/types";
import { SECTION_ORDER, SECTION_LABELS } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function getPatents() {
  return db.query.patents.findMany({
    orderBy: [desc(patents.updatedAt)],
  });
}

export async function getPatent(id: string) {
  return db.query.patents.findFirst({
    where: eq(patents.id, id),
    with: {
      sections: { orderBy: [asc(patentSections.orderIndex)] },
      claims: { orderBy: [asc(patentClaims.claimNumber)] },
      drawings: { orderBy: [asc(patentDrawings.figureNumber)] },
      referenceNumerals: { orderBy: [asc(referenceNumerals.numeral)] },
    },
  });
}

export async function createPatent(data: {
  title: string;
  type: PatentType;
  jurisdiction: Jurisdiction;
  inventionDescription?: string;
  technologyArea?: string;
  entitySize?: "micro" | "small" | "large";
  aiModelConfig?: {
    draftingModel: string;
    claimsModel: string;
    analysisModel: string;
    imageModel: string;
  };
}) {
  const [patent] = await db.insert(patents).values(data).returning();

  const sectionsForType = getSectionsForPatentType(data.type);
  const sectionValues: NewPatentSection[] = sectionsForType.map(
    (sectionType, index) => {
      const isTitle = sectionType === "title";
      const initialText = isTitle ? data.title : "";
      return {
        patentId: patent.id,
        sectionType,
        title: SECTION_LABELS[sectionType],
        orderIndex: index,
        content: [{ type: "p", children: [{ text: initialText }] }] as unknown as Record<string, unknown>,
        plainText: initialText,
        wordCount: initialText ? initialText.split(/\s+/).filter(Boolean).length : 0,
      };
    }
  );

  if (sectionValues.length > 0) {
    await db.insert(patentSections).values(sectionValues);
  }

  revalidatePath("/patents");
  revalidatePath("/dashboard");
  return patent;
}

function getSectionsForPatentType(type: PatentType): SectionType[] {
  switch (type) {
    case "utility":
      return SECTION_ORDER;
    case "provisional":
      return [
        "title",
        "field_of_invention",
        "background",
        "summary",
        "detailed_description",
        "abstract",
      ];
    case "design":
      return ["title", "brief_description_drawings", "claims"];
    case "pct":
      return SECTION_ORDER;
    default:
      return SECTION_ORDER;
  }
}

export async function updatePatent(
  id: string,
  data: Partial<NewPatent>
) {
  const [updated] = await db
    .update(patents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(patents.id, id))
    .returning();

  revalidatePath(`/patents/${id}`);
  revalidatePath("/patents");
  revalidatePath("/dashboard");
  return updated;
}

export async function deletePatent(id: string) {
  await db.delete(patents).where(eq(patents.id, id));
  revalidatePath("/patents");
  revalidatePath("/dashboard");
}

export async function updateSection(
  id: string,
  data: { content?: Record<string, unknown>; plainText?: string }
) {
  const wordCount = data.plainText
    ? data.plainText.split(/\s+/).filter(Boolean).length
    : undefined;

  const [updated] = await db
    .update(patentSections)
    .set({ ...data, wordCount, updatedAt: new Date() })
    .where(eq(patentSections.id, id))
    .returning();

  return updated;
}

export async function getSections(patentId: string) {
  return db.query.patentSections.findMany({
    where: eq(patentSections.patentId, patentId),
    orderBy: [asc(patentSections.orderIndex)],
  });
}

export async function getClaims(patentId: string) {
  return db.query.patentClaims.findMany({
    where: eq(patentClaims.patentId, patentId),
    orderBy: [asc(patentClaims.claimNumber)],
  });
}

export async function createClaim(data: NewPatentClaim) {
  const [claim] = await db.insert(patentClaims).values(data).returning();
  revalidatePath(`/patents/${data.patentId}/claims`);
  return claim;
}

export async function updateClaim(
  id: string,
  data: Partial<NewPatentClaim>
) {
  const [updated] = await db
    .update(patentClaims)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(patentClaims.id, id))
    .returning();
  return updated;
}

export async function deleteClaim(id: string, patentId: string) {
  await db.delete(patentClaims).where(eq(patentClaims.id, id));
  revalidatePath(`/patents/${patentId}/claims`);
}

export async function getDrawings(patentId: string) {
  return db.query.patentDrawings.findMany({
    where: eq(patentDrawings.patentId, patentId),
    orderBy: [asc(patentDrawings.figureNumber)],
  });
}

export async function createDrawing(data: NewPatentDrawing) {
  const [drawing] = await db.insert(patentDrawings).values(data).returning();
  revalidatePath(`/patents/${data.patentId}/drawings`);
  return drawing;
}

export async function updateDrawing(
  id: string,
  data: Partial<NewPatentDrawing>
) {
  const [updated] = await db
    .update(patentDrawings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(patentDrawings.id, id))
    .returning();
  return updated;
}

export async function deleteDrawing(id: string, patentId: string) {
  await db.delete(patentDrawings).where(eq(patentDrawings.id, id));
  revalidatePath(`/patents/${patentId}/drawings`);
}

export async function getReferenceNumerals(patentId: string) {
  return db.query.referenceNumerals.findMany({
    where: eq(referenceNumerals.patentId, patentId),
    orderBy: [asc(referenceNumerals.numeral)],
  });
}

export async function createReferenceNumeral(data: {
  patentId: string;
  numeral: number;
  elementName: string;
  description?: string;
  firstFigureId?: string;
}) {
  const [numeral] = await db
    .insert(referenceNumerals)
    .values(data)
    .returning();
  return numeral;
}

export async function getPriorArtResults(patentId: string) {
  return db.query.priorArtResults.findMany({
    where: eq(priorArtResults.patentId, patentId),
    orderBy: [desc(priorArtResults.relevanceScore)],
  });
}

export async function createVersion(patentId: string, changeSummary: string) {
  const existingVersions = await db.query.patentVersions.findMany({
    where: eq(patentVersions.patentId, patentId),
    orderBy: [desc(patentVersions.versionNumber)],
    limit: 1,
  });

  const nextVersion = existingVersions.length > 0
    ? existingVersions[0].versionNumber + 1
    : 1;

  const patent = await getPatent(patentId);
  if (!patent) throw new Error("Patent not found");

  const [version] = await db
    .insert(patentVersions)
    .values({
      patentId,
      versionNumber: nextVersion,
      snapshot: patent as unknown as Record<string, unknown>,
      changeSummary,
    })
    .returning();

  return version;
}

export async function getDashboardStats() {
  const allPatents = await db.query.patents.findMany();

  const total = allPatents.length;
  const drafts = allPatents.filter((p) => p.status === "draft").length;
  const inProgress = allPatents.filter((p) => p.status === "in_progress").length;
  const readyToFile = allPatents.filter((p) => p.status === "ready_to_file").length;

  const recent = allPatents
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 5);

  return { total, drafts, inProgress, readyToFile, recent };
}

export async function checkApiKeyStatus(envVarName: string): Promise<boolean> {
  return !!process.env[envVarName];
}
