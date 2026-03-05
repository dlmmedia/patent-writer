"use client";

import { useMemo, forwardRef, useImperativeHandle } from "react";
import { Plate, PlateContent, createPlateEditor } from "@udecode/plate/react";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
} from "@udecode/plate-basic-marks/react";
import { HeadingPlugin } from "@udecode/plate-heading/react";
import {
  ListPlugin,
  BulletedListPlugin,
  NumberedListPlugin,
} from "@udecode/plate-list/react";
import { BlockquotePlugin } from "@udecode/plate-block-quote/react";
import { LinkPlugin } from "@udecode/plate-link/react";
import { HorizontalRulePlugin } from "@udecode/plate-horizontal-rule/react";
import { NodeIdPlugin } from "@udecode/plate-node-id";
import { EditorToolbar } from "./editor-toolbar";
import type { SectionType } from "@/lib/types";

interface PatentEditorProps {
  initialContent?: any;
  onChange?: (content: any) => void;
  sectionType: string;
  readOnly?: boolean;
}

export interface PatentEditorHandle {
  insertContent: (text: string) => void;
  replaceContent: (text: string) => void;
}

const DEFAULT_VALUE = [{ type: "p", children: [{ text: "" }] }];

const SECTION_PLACEHOLDERS: Partial<Record<SectionType, string>> = {
  title: "Enter the title of the invention...",
  field_of_invention: "The present invention relates to...",
  background: "Describe the background and prior approaches...",
  summary: "Provide a summary of the invention...",
  brief_description_drawings: "FIG. 1 illustrates...",
  detailed_description: "Referring now to FIG. 1...",
  claims: "1. A method comprising...",
  abstract: "A system and method for...",
  cross_reference: "This application claims the benefit of...",
};

function normalizeContent(content: any): any[] {
  if (Array.isArray(content) && content.length > 0) return content;
  return DEFAULT_VALUE;
}

export const PatentEditor = forwardRef<PatentEditorHandle, PatentEditorProps>(
  function PatentEditor(
    { initialContent, onChange, sectionType, readOnly = false },
    ref
  ) {
    const editor = useMemo(
      () =>
        createPlateEditor({
          plugins: [
            BoldPlugin,
            ItalicPlugin,
            UnderlinePlugin,
            StrikethroughPlugin,
            HeadingPlugin,
            ListPlugin,
            BulletedListPlugin,
            NumberedListPlugin,
            BlockquotePlugin,
            LinkPlugin,
            HorizontalRulePlugin,
            NodeIdPlugin,
          ],
          value: normalizeContent(initialContent),
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [sectionType]
    );

    useImperativeHandle(
      ref,
      () => ({
        insertContent(text: string) {
          if (!text.trim()) return;
          const paragraphs = text.split(/\n\n+/).filter(Boolean);
          const nodes = paragraphs.map((para) => ({
            type: "p" as const,
            children: [{ text: para.trim() }],
          }));
          editor.tf.insertNodes(nodes, { at: [editor.children.length] });
        },
        replaceContent(text: string) {
          const paragraphs = text.split(/\n\n+/).filter(Boolean);
          const nodes =
            paragraphs.length > 0
              ? paragraphs.map((para) => ({
                  type: "p" as const,
                  children: [{ text: para.trim() }],
                }))
              : DEFAULT_VALUE;
          editor.tf.removeNodes({ at: [], mode: "highest", match: () => true });
          editor.tf.insertNodes(nodes, { at: [0] });
        },
      }),
      [editor]
    );

    const placeholder =
      SECTION_PLACEHOLDERS[sectionType as SectionType] ?? "Start writing...";

    return (
      <Plate
        editor={editor}
        onChange={({ value }) => onChange?.(value)}
        readOnly={readOnly}
      >
        {!readOnly && <EditorToolbar />}
        <PlateContent
          className="min-h-[400px] p-4 focus:outline-none prose prose-sm dark:prose-invert max-w-none"
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </Plate>
    );
  }
);
