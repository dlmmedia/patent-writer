"use client";

import { useEditorRef, useEditorSelector } from "@udecode/plate/react";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
} from "@udecode/plate-basic-marks/react";
import { HEADING_KEYS } from "@udecode/plate-heading";
import { BlockquotePlugin } from "@udecode/plate-block-quote/react";
import {
  BulletedListPlugin,
  NumberedListPlugin,
} from "@udecode/plate-list/react";

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

function ToolbarButton({ icon, label, onClick, isActive }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={`h-8 w-8 p-0 ${isActive ? "bg-accent text-accent-foreground" : ""}`}
          type="button"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar() {
  const editor = useEditorRef();

  const marks = useEditorSelector((ed) => ed.api.marks?.() ?? {}, []);
  const blockType = useEditorSelector((ed) => {
    const entry = ed.api.block?.();
    return (entry?.[0] as any)?.type ?? "p";
  }, []);

  const toggleMark = (key: string) => {
    if (marks[key]) {
      editor.tf.removeMark(key);
    } else {
      editor.tf.addMark(key, true);
    }
    editor.tf.focus();
  };

  const toggleBlock = (type: string) => {
    const newType = blockType === type ? "p" : type;
    editor.tf.setNodes(
      { type: newType } as any,
      { match: (n: any) => editor.api.isBlock(n) }
    );
    editor.tf.focus();
  };

  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1">
      <ToolbarButton
        icon={<Bold className="size-4" />}
        label="Bold (Ctrl+B)"
        onClick={() => toggleMark(BoldPlugin.key)}
        isActive={!!marks[BoldPlugin.key]}
      />
      <ToolbarButton
        icon={<Italic className="size-4" />}
        label="Italic (Ctrl+I)"
        onClick={() => toggleMark(ItalicPlugin.key)}
        isActive={!!marks[ItalicPlugin.key]}
      />
      <ToolbarButton
        icon={<Underline className="size-4" />}
        label="Underline (Ctrl+U)"
        onClick={() => toggleMark(UnderlinePlugin.key)}
        isActive={!!marks[UnderlinePlugin.key]}
      />
      <ToolbarButton
        icon={<Strikethrough className="size-4" />}
        label="Strikethrough"
        onClick={() => toggleMark(StrikethroughPlugin.key)}
        isActive={!!marks[StrikethroughPlugin.key]}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        icon={<Heading1 className="size-4" />}
        label="Heading 1"
        onClick={() => toggleBlock(HEADING_KEYS.h1)}
        isActive={blockType === HEADING_KEYS.h1}
      />
      <ToolbarButton
        icon={<Heading2 className="size-4" />}
        label="Heading 2"
        onClick={() => toggleBlock(HEADING_KEYS.h2)}
        isActive={blockType === HEADING_KEYS.h2}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        icon={<ListOrdered className="size-4" />}
        label="Ordered List"
        onClick={() => toggleBlock(NumberedListPlugin.key)}
        isActive={blockType === NumberedListPlugin.key}
      />
      <ToolbarButton
        icon={<List className="size-4" />}
        label="Unordered List"
        onClick={() => toggleBlock(BulletedListPlugin.key)}
        isActive={blockType === BulletedListPlugin.key}
      />
      <ToolbarButton
        icon={<Quote className="size-4" />}
        label="Block Quote"
        onClick={() => toggleBlock(BlockquotePlugin.key)}
        isActive={blockType === BlockquotePlugin.key}
      />
    </div>
  );
}
