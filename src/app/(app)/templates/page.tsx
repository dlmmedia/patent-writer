import { getTemplates } from "@/lib/actions/patents";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const templates = await getTemplates();
  return <TemplatesClient templates={templates} />;
}
