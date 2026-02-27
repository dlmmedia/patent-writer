"use client";

import { useEditorRef } from "@udecode/plate/react";
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
}

function ToolbarButton({ icon, label, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className="h-8 w-8 p-0"
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

  const toggleMark = (type: string) => {
    editor.tf.addMark(type, true);
  };

  const toggleBlock = (type: string) => {
    editor.tf.setNodes({ type } as any, {
      match: (n: any) => editor.api.isBlock(n),
    });
  };

  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1">
      <ToolbarButton
        icon={<Bold className="size-4" />}
        label="Bold"
        onClick={() => toggleMark(BoldPlugin.key)}
      />
      <ToolbarButton
        icon={<Italic className="size-4" />}
        label="Italic"
        onClick={() => toggleMark(ItalicPlugin.key)}
      />
      <ToolbarButton
        icon={<Underline className="size-4" />}
        label="Underline"
        onClick={() => toggleMark(UnderlinePlugin.key)}
      />
      <ToolbarButton
        icon={<Strikethrough className="size-4" />}
        label="Strikethrough"
        onClick={() => toggleMark(StrikethroughPlugin.key)}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        icon={<Heading1 className="size-4" />}
        label="Heading 1"
        onClick={() => toggleBlock(HEADING_KEYS.h1)}
      />
      <ToolbarButton
        icon={<Heading2 className="size-4" />}
        label="Heading 2"
        onClick={() => toggleBlock(HEADING_KEYS.h2)}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        icon={<ListOrdered className="size-4" />}
        label="Ordered List"
        onClick={() => toggleBlock(NumberedListPlugin.key)}
      />
      <ToolbarButton
        icon={<List className="size-4" />}
        label="Unordered List"
        onClick={() => toggleBlock(BulletedListPlugin.key)}
      />
      <ToolbarButton
        icon={<Quote className="size-4" />}
        label="Block Quote"
        onClick={() => toggleBlock(BlockquotePlugin.key)}
      />
    </div>
  );
}
