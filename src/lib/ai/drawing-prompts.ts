export const DRAWING_TYPES = [
  "perspective_view",
  "front_elevation",
  "rear_elevation",
  "side_elevation",
  "top_plan",
  "bottom_view",
  "cross_section",
  "sectional_view",
  "detail_view",
  "enlarged_detail",
  "exploded_view",
  "assembly_view",
  "block_diagram",
  "flowchart",
  "system_architecture",
  "data_flow",
  "schematic",
  "wiring_diagram",
  "ui_mockup",
  "screen_flow",
  "method_flowchart",
  "environmental_view",
] as const;

export type DrawingType = (typeof DRAWING_TYPES)[number];

export const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  perspective_view: "Perspective View",
  front_elevation: "Front Elevation",
  rear_elevation: "Rear Elevation",
  side_elevation: "Side Elevation",
  top_plan: "Top Plan View",
  bottom_view: "Bottom View",
  cross_section: "Cross-Section View",
  sectional_view: "Sectional View",
  detail_view: "Detail View",
  enlarged_detail: "Enlarged Detail View",
  exploded_view: "Exploded View",
  assembly_view: "Assembly View",
  block_diagram: "Block Diagram",
  flowchart: "Flowchart",
  system_architecture: "System Architecture Diagram",
  data_flow: "Data Flow Diagram",
  schematic: "Schematic Diagram",
  wiring_diagram: "Wiring Diagram",
  ui_mockup: "User Interface Mockup",
  screen_flow: "Screen Flow Diagram",
  method_flowchart: "Method/Process Flowchart",
  environmental_view: "Environmental View",
};

export const DRAWING_TYPE_GROUPS: { label: string; types: DrawingType[] }[] = [
  {
    label: "Mechanical / Physical Views",
    types: [
      "perspective_view",
      "front_elevation",
      "rear_elevation",
      "side_elevation",
      "top_plan",
      "bottom_view",
      "cross_section",
      "sectional_view",
      "detail_view",
      "enlarged_detail",
      "exploded_view",
      "assembly_view",
      "environmental_view",
    ],
  },
  {
    label: "Diagrams & Schematics",
    types: [
      "block_diagram",
      "flowchart",
      "method_flowchart",
      "system_architecture",
      "data_flow",
      "schematic",
      "wiring_diagram",
    ],
  },
  {
    label: "Software & UI",
    types: ["ui_mockup", "screen_flow"],
  },
];

const TYPE_SPECIFIC_INSTRUCTIONS: Record<DrawingType, string> = {
  perspective_view:
    "Three-dimensional perspective rendering with consistent vanishing points. Show depth, proportions, and spatial relationships. Include lead lines from reference numerals to each labeled component.",
  front_elevation:
    "Orthographic front elevation showing the device head-on with no perspective distortion. Use uniform line weight for outlines and thinner lines for internal features. All dimensions and proportions must be accurate.",
  rear_elevation:
    "Orthographic rear elevation view showing the back face of the device. Mirror the proportions of the front elevation. Expose any rear-mounted components, ports, or features.",
  side_elevation:
    "Orthographic side elevation view with no perspective foreshortening. Clearly depict the profile, thickness, and any protruding elements. Use hidden lines (dashed) for internal features behind the visible surface.",
  top_plan:
    "Orthographic top-down plan view showing the device from directly above. Reveal the plan layout, surface features, buttons, and openings. Use dashed lines for hidden features below the surface.",
  bottom_view:
    "Orthographic bottom view showing the underside of the device. Include any feet, mounting hardware, access panels, and ventilation openings.",
  cross_section:
    "Cross-sectional view cut along a clearly indicated section plane. Use standard section-line hatching (diagonal lines at 45 degrees) to indicate cut solid material. Show internal cavities, wall thicknesses, and internal component relationships.",
  sectional_view:
    "Partial sectional view revealing internal construction while keeping external context. Use section hatching on cut surfaces. Distinguish between different materials with varied hatching patterns.",
  detail_view:
    "Enlarged detail view of a specific area with a circular callout boundary. Increase scale to show fine features, tolerances, and small components. Reference the parent figure and indicate the scale factor.",
  enlarged_detail:
    "Highly magnified detail view of a critical area. Draw at a significantly larger scale to reveal intricate mechanisms, textures, or surface treatments. Include a scale indicator and the parent figure reference.",
  exploded_view:
    "Exploded assembly view showing all components separated along their assembly axes with dashed alignment lines connecting mating parts. Each part must be individually identifiable. Maintain spatial relationships and assembly order.",
  assembly_view:
    "Fully assembled view showing all components in their final positions. Use hidden lines for concealed parts. Include fasteners and connection points. Show the overall form factor.",
  block_diagram:
    "Rectangular blocks connected by directional arrows showing system components and their relationships. Each block must be clearly labeled. Use solid arrows for primary data/signal flow and dashed arrows for control/feedback paths.",
  flowchart:
    "Standard flowchart with rounded rectangles for start/end, rectangles for processes, diamonds for decisions, and parallelograms for I/O. Connect with directional arrows. Label decision branches Yes/No or True/False.",
  system_architecture:
    "Multi-tier system architecture diagram showing layers, components, and interfaces. Use distinct block shapes for different component types (databases, servers, clients, APIs). Show communication protocols on connection lines.",
  data_flow:
    "Data flow diagram showing how information moves through the system. Use circles/rounded rectangles for processes, open rectangles for data stores, and rectangles for external entities. Label all flows with data descriptions.",
  schematic:
    "Technical schematic using standard symbols (IEEE/IEC conventions). Show component values and identifiers. Use consistent line weights. Route connections cleanly with right-angle bends and junction dots.",
  wiring_diagram:
    "Wiring diagram with standard electrical symbols showing physical wire connections, terminal blocks, and connector pin assignments. Number each wire and label each terminal.",
  ui_mockup:
    "Clean wireframe-style user interface mockup showing screen layout, navigation elements, buttons, form fields, and content areas. Use placeholder text. Indicate interactive elements with standard UI conventions.",
  screen_flow:
    "Multi-screen flow diagram showing navigation between application screens. Each screen is a simplified wireframe thumbnail connected by labeled arrows indicating user actions or transitions.",
  method_flowchart:
    "Patent method/process flowchart showing sequential steps in numbered boxes. Use diamonds for conditional branches. Include step numbers (S100, S110, S120...) per patent convention. Show parallel paths where applicable.",
  environmental_view:
    "Environmental/contextual view showing the device being used by a person or in its operating environment. Use simplified human figures (phantom lines). Show the spatial relationship between the user and device.",
};

const BASE_STYLE =
  "Patent drawing in black and white line art style. Clean technical illustration suitable for patent filing. No shading, no color, no gradients. Precise engineering-quality lines with consistent line weights. White background.";

export interface FigureSpec {
  figureNumber: string;
  figureType: string;
  label: string;
  description: string;
  referenceNumerals: { numeral: number; elementName: string }[];
}

export function buildImagePrompt(
  figure: FigureSpec,
  patentTitle?: string
): string {
  const figType = figure.figureType as DrawingType;
  const typeLabel =
    DRAWING_TYPE_LABELS[figType] ?? figure.figureType.replace(/_/g, " ");
  const typeInstructions =
    TYPE_SPECIFIC_INSTRUCTIONS[figType] ?? "";

  let prompt = `${BASE_STYLE} ${typeLabel}. ${typeInstructions}`;
  prompt += ` Showing: ${figure.description}`;

  if (figure.referenceNumerals.length > 0) {
    const numeralList = figure.referenceNumerals
      .map((rn) => `${rn.numeral} - ${rn.elementName}`)
      .join(", ");
    prompt += ` Include labeled reference numerals with lead lines: ${numeralList}.`;
  }

  prompt += ` Title: FIG. ${figure.figureNumber} - ${figure.label}`;
  if (patentTitle) {
    prompt += ` (Patent: ${patentTitle})`;
  }

  return prompt;
}

export function buildSimplePrompt(
  figureType: DrawingType,
  description: string,
  opts?: { referenceImage?: boolean }
): string {
  const typeLabel = DRAWING_TYPE_LABELS[figureType] ?? figureType;
  const typeInstructions =
    TYPE_SPECIFIC_INSTRUCTIONS[figureType] ?? "";

  let prompt = `${BASE_STYLE} ${typeLabel}. ${typeInstructions} Showing: ${description}`;

  if (opts?.referenceImage) {
    prompt +=
      " Use the provided reference image as a visual guide for layout, structure, proportions, and style. Reproduce the key elements from the reference in patent line-art form.";
  }

  return prompt;
}

export function buildEditPrompt(
  editInstruction: string,
  originalDescription?: string
): string {
  let prompt = `${BASE_STYLE} Edit the provided patent drawing as follows: ${editInstruction}`;
  if (originalDescription) {
    prompt += ` The original drawing shows: ${originalDescription}`;
  }
  prompt +=
    " Maintain the same patent line-art style, proportions, and reference numeral positions where possible.";
  return prompt;
}
