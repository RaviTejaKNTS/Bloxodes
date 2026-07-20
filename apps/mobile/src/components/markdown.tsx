import { useRouter } from "expo-router";
import { Fragment, useMemo } from "react";
import { Image, Linking, ScrollView, Text, View, type TextStyle } from "react-native";
import { radii, spacing } from "../theme";
import { useTheme } from "../theme-context";
import { routeForWebUrl } from "../links";

type InlineNode =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean; code?: boolean }
  | { type: "link"; children: InlineNode[]; url: string };

type Block =
  | { kind: "heading"; level: number; inline: InlineNode[] }
  | { kind: "paragraph"; inline: InlineNode[] }
  | { kind: "quote"; inline: InlineNode[] }
  | { kind: "list-item"; ordered: boolean; marker: string; depth: number; inline: InlineNode[] }
  | { kind: "image"; url: string; alt: string }
  | { kind: "code"; text: string }
  | { kind: "table"; header: InlineNode[][]; rows: InlineNode[][][] };

const INLINE_PATTERN =
  /(!\[[^\]]*\]\([^)]*\))|(\[[^\]]+\]\([^)]*\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(`[^`]+`)/;

function parseInline(text: string, inherited: { bold?: boolean; italic?: boolean } = {}): InlineNode[] {
  const nodes: InlineNode[] = [];
  let remaining = text;

  while (remaining.length) {
    const match = remaining.match(INLINE_PATTERN);
    if (!match || match.index === undefined) {
      nodes.push({ type: "text", text: remaining, ...inherited });
      break;
    }
    if (match.index > 0) {
      nodes.push({ type: "text", text: remaining.slice(0, match.index), ...inherited });
    }
    const token = match[0];
    remaining = remaining.slice(match.index + token.length);

    const inlineImage = token.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
    if (inlineImage) {
      if (inlineImage[1].trim()) nodes.push({ type: "text", text: inlineImage[1], ...inherited });
      continue;
    }
    const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)[^)]*\)$/);
    if (link) {
      nodes.push({ type: "link", children: parseInline(link[1], inherited), url: link[2] });
      continue;
    }
    const bold = token.match(/^(?:\*\*|__)(.+)(?:\*\*|__)$/);
    if (bold) {
      nodes.push(...parseInline(bold[1], { ...inherited, bold: true }));
      continue;
    }
    const italic = token.match(/^(?:\*|_)(.+)(?:\*|_)$/);
    if (italic) {
      nodes.push(...parseInline(italic[1], { ...inherited, italic: true }));
      continue;
    }
    const code = token.match(/^`(.+)`$/);
    if (code) {
      nodes.push({ type: "text", text: code[1], code: true, ...inherited });
      continue;
    }
    nodes.push({ type: "text", text: token, ...inherited });
  }

  return nodes;
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

export function parseMarkdownBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let codeFence: string[] | null = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ kind: "paragraph", inline: parseInline(paragraph.join(" ")) });
    paragraph = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (codeFence) {
      if (/^```/.test(line)) {
        blocks.push({ kind: "code", text: codeFence.join("\n") });
        codeFence = null;
      } else {
        codeFence.push(rawLine);
      }
      continue;
    }

    if (/^```/.test(line)) {
      flushParagraph();
      codeFence = [];
      continue;
    }

    if (!line) {
      flushParagraph();
      continue;
    }

    // Table: header row followed by a separator row.
    if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      flushParagraph();
      const header = splitTableRow(line).map((cell) => parseInline(cell));
      const rows: InlineNode[][][] = [];
      let cursor = index + 2;
      while (cursor < lines.length && lines[cursor].includes("|") && lines[cursor].trim()) {
        rows.push(splitTableRow(lines[cursor]).map((cell) => parseInline(cell)));
        cursor += 1;
      }
      blocks.push({ kind: "table", header, rows });
      index = cursor - 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", level: heading[1].length, inline: parseInline(heading[2].replace(/\s#+$/, "")) });
      continue;
    }

    const standaloneImage = line.match(/^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/);
    if (standaloneImage) {
      flushParagraph();
      blocks.push({ kind: "image", url: standaloneImage[2], alt: standaloneImage[1] });
      continue;
    }

    const indent = rawLine.match(/^(\s*)/)?.[1].length ?? 0;
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flushParagraph();
      blocks.push({
        kind: "list-item",
        ordered: Boolean(ordered),
        marker: ordered ? `${ordered[1]}.` : "•",
        depth: Math.min(3, Math.floor(indent / 2)),
        inline: parseInline(bullet ? bullet[1] : ordered![2])
      });
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      blocks.push({ kind: "quote", inline: parseInline(line.replace(/^>\s?/, "")) });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      continue;
    }

    paragraph.push(line);
  }

  if (codeFence) blocks.push({ kind: "code", text: codeFence.join("\n") });
  flushParagraph();
  return blocks;
}

function useMarkdownLinkHandler() {
  const router = useRouter();
  return (url: string) => {
    const absolute = /^https?:\/\//i.test(url) ? url : url.startsWith("/") ? `https://bloxodes.com${url}` : null;
    if (!absolute) return;
    const route = routeForWebUrl(absolute);
    if (route) {
      router.push(route as never);
    } else {
      void Linking.openURL(absolute);
    }
  };
}

function InlineText({
  nodes,
  baseStyle,
  linkColor,
  codeBackground,
  onLinkPress
}: {
  nodes: InlineNode[];
  baseStyle: TextStyle;
  linkColor: string;
  codeBackground: string;
  onLinkPress: (url: string) => void;
}) {
  return (
    <Text style={baseStyle}>
      {nodes.map((node, index) => {
        if (node.type === "link") {
          return (
            <Text
              key={index}
              style={{ color: linkColor, fontWeight: "600", textDecorationLine: "underline" }}
              onPress={() => onLinkPress(node.url)}
              suppressHighlighting
            >
              {node.children.map((child, childIndex) => (
                <Text
                  key={childIndex}
                  style={{
                    fontWeight: child.type === "text" && child.bold ? "700" : "600",
                    fontStyle: child.type === "text" && child.italic ? "italic" : "normal"
                  }}
                >
                  {child.type === "text" ? child.text : null}
                </Text>
              ))}
            </Text>
          );
        }
        return (
          <Text
            key={index}
            style={{
              fontWeight: node.bold ? "700" : baseStyle.fontWeight,
              fontStyle: node.italic ? "italic" : "normal",
              ...(node.code
                ? { fontFamily: "monospace" as const, backgroundColor: codeBackground, fontSize: (baseStyle.fontSize ?? 15) - 1 }
                : null)
            }}
          >
            {node.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function Markdown({ body }: { body: string }) {
  const { colors } = useTheme();
  const onLinkPress = useMarkdownLinkHandler();
  const blocks = useMemo(() => parseMarkdownBlocks(body), [body]);

  const bodyStyle: TextStyle = { color: colors.mutedStrong, fontSize: 15, lineHeight: 24 };

  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const size = block.level === 1 ? 24 : block.level === 2 ? 21 : block.level === 3 ? 18 : 16;
          return (
            <InlineText
              key={index}
              nodes={block.inline}
              baseStyle={{
                color: colors.foreground,
                fontSize: size,
                lineHeight: size + 7,
                fontWeight: "700",
                marginTop: index ? spacing.sm : 0
              }}
              linkColor={colors.accent}
              codeBackground={colors.surfaceMuted}
              onLinkPress={onLinkPress}
            />
          );
        }
        if (block.kind === "list-item") {
          return (
            <View key={index} style={{ flexDirection: "row", gap: spacing.sm, paddingLeft: spacing.sm + block.depth * spacing.lg }}>
              <Text style={{ color: colors.accent, fontSize: 15, lineHeight: 24, fontWeight: "700", minWidth: block.ordered ? 20 : 0 }}>
                {block.marker}
              </Text>
              <View style={{ flex: 1 }}>
                <InlineText
                  nodes={block.inline}
                  baseStyle={bodyStyle}
                  linkColor={colors.accent}
                  codeBackground={colors.surfaceMuted}
                  onLinkPress={onLinkPress}
                />
              </View>
            </View>
          );
        }
        if (block.kind === "quote") {
          return (
            <View key={index} style={{ borderLeftWidth: 3, borderLeftColor: colors.accentBorder, paddingLeft: spacing.md }}>
              <InlineText
                nodes={block.inline}
                baseStyle={{ ...bodyStyle, fontStyle: "italic" }}
                linkColor={colors.accent}
                codeBackground={colors.surfaceMuted}
                onLinkPress={onLinkPress}
              />
            </View>
          );
        }
        if (block.kind === "image") {
          return (
            <Image
              key={index}
              source={{ uri: block.url }}
              accessibilityLabel={block.alt}
              style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted }}
              resizeMode="cover"
            />
          );
        }
        if (block.kind === "code") {
          return (
            <ScrollView key={index} horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md }}>
                <Text style={{ color: colors.foreground, fontFamily: "monospace", fontSize: 13, lineHeight: 19 }}>{block.text}</Text>
              </View>
            </ScrollView>
          );
        }
        if (block.kind === "table") {
          const columnCount = Math.max(block.header.length, ...block.rows.map((row) => row.length));
          const columnWidth = columnCount > 2 ? 132 : 148;
          return (
            <ScrollView key={index} horizontal showsHorizontalScrollIndicator>
              <View
                style={{
                  minWidth: columnCount * columnWidth,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.lg,
                  overflow: "hidden"
                }}
              >
                <View style={{ flexDirection: "row", backgroundColor: colors.surfaceMuted }}>
                  {Array.from({ length: columnCount }, (_, column) => (
                    <View key={column} style={{ width: columnWidth, padding: spacing.md }}>
                      <InlineText
                        nodes={block.header[column] ?? []}
                        baseStyle={{ color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700", textTransform: "uppercase" }}
                        linkColor={colors.accent}
                        codeBackground={colors.surfaceMuted}
                        onLinkPress={onLinkPress}
                      />
                    </View>
                  ))}
                </View>
                {block.rows.map((row, rowIndex) => (
                  <View
                    key={rowIndex}
                    style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.borderMuted, backgroundColor: colors.surface }}
                  >
                    {Array.from({ length: columnCount }, (_, column) => (
                      <View key={column} style={{ width: columnWidth, padding: spacing.md }}>
                        <InlineText
                          nodes={row[column] ?? []}
                          baseStyle={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 19 }}
                          linkColor={colors.accent}
                          codeBackground={colors.surfaceMuted}
                          onLinkPress={onLinkPress}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        }
        return (
          <Fragment key={index}>
            <InlineText
              nodes={block.inline}
              baseStyle={bodyStyle}
              linkColor={colors.accent}
              codeBackground={colors.surfaceMuted}
              onLinkPress={onLinkPress}
            />
          </Fragment>
        );
      })}
    </View>
  );
}
