"use client";

import { useMemo } from "react";
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
import { cn } from "@/lib/utils";

interface PatentEditorProps {
  initialContent?: any;
  onChange?: (content: any) => void;
  sectionType: string;
  readOnly?: boolean;
}

const DEFAULT_VALUE = [{ type: "p", children: [{ text: "" }] }];

export function PatentEditor({
  initialContent,
  onChange,
  sectionType,
  readOnly = false,
}: PatentEditorProps) {
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
        value: initialContent ?? DEFAULT_VALUE,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectionType]
  );

  return (
    <div className="flex flex-col rounded-md border bg-background">
      <Plate
        editor={editor}
        onChange={({ value }) => onChange?.(value)}
        readOnly={readOnly}
      >
        {!readOnly && <EditorToolbar />}
        <PlateContent
          className={cn(
            "min-h-[500px] p-6 focus:outline-none",
            "prose prose-sm dark:prose-invert max-w-none",
            "[&_p]:relative [&_p]:pl-16",
            "[counter-reset:patent-para]",
            "[&_p]:[counter-increment:patent-para]",
            "[&_p]:before:absolute [&_p]:before:left-0 [&_p]:before:top-0",
            "[&_p]:before:content-['['_counter(patent-para,decimal-leading-zero)_']']",
            "[&_p]:before:text-xs [&_p]:before:text-muted-foreground [&_p]:before:font-mono",
            "[&_p]:before:w-14 [&_p]:before:text-right",
            "[&_h1]:pl-16 [&_h2]:pl-16 [&_h3]:pl-16",
            "[&_blockquote]:pl-16 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30",
            "[&_ul]:pl-20 [&_ol]:pl-20"
          )}
          placeholder="Start writing..."
          readOnly={readOnly}
        />
      </Plate>
    </div>
  );
}
