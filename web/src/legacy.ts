import * as ts from "typescript";
import { z } from "zod";
import { type Project, projectSchema } from "./domain.ts";

// Data-only interpreter. No eval, module loading, property access or imported code execution.
export function extractLegacy(source: string): unknown {
  if (source.length > 5_000_000)
    throw Error("Song source exceeds the 5 MB import limit");
  const ast = ts.createSourceFile(
    "song.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    (ast as ts.SourceFile & { parseDiagnostics: unknown[] }).parseDiagnostics
      .length
  )
    throw Error("Invalid TypeScript syntax");
  const declarations = new Map<string, ts.Expression>(),
    cache = new Map<string, unknown>(),
    active = new Set<string>();
  let exported: ts.Expression | undefined;
  let budget = 100000;
  const fail = (node: ts.Node, message = "Unsupported expression"): never => {
    const loc = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    throw Error(
      `${message} at line ${loc.line + 1}: ${node.getText(ast).slice(0, 90)}`,
    );
  };
  for (const stmt of ast.statements) {
    if (ts.isVariableStatement(stmt)) {
      if (!(stmt.declarationList.flags & ts.NodeFlags.Const))
        fail(stmt, "Only const declarations are supported");
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer)
          fail(d, "Expected initialized const identifier");
        const name = d.name.getText(ast);
        if (declarations.has(name)) fail(d, "Duplicate declaration");
        declarations.set(name, d.initializer!);
      }
    } else if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      if (exported) fail(stmt, "Multiple default exports");
      exported = stmt.expression;
    } else if (
      !ts.isInterfaceDeclaration(stmt) &&
      !ts.isTypeAliasDeclaration(stmt) &&
      !ts.isEmptyStatement(stmt)
    )
      fail(stmt, "Unsupported top-level statement");
  }
  function reference(name: string): unknown {
    if (cache.has(name)) return cache.get(name);
    if (active.has(name)) throw Error(`Cyclic const reference: ${name}`);
    const expr = declarations.get(name);
    if (!expr) throw Error(`Unknown const reference: ${name}`);
    if (active.size >= 100) throw Error("Const reference depth limit exceeded");
    active.add(name);
    const value = literal(expr);
    active.delete(name);
    cache.set(name, value);
    return value;
  }
  function key(n: ts.PropertyName): string {
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n))
      return n.text;
    return fail(n, "Unsupported property name");
  }
  function literal(n: ts.Expression, depth = 0): unknown {
    if (--budget < 0 || depth > 100)
      fail(n, "Import complexity limit exceeded");
    if (
      ts.isAsExpression(n) ||
      ts.isSatisfiesExpression(n) ||
      ts.isParenthesizedExpression(n)
    )
      return literal(n.expression, depth + 1);
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
      return n.text;
    if (ts.isNumericLiteral(n)) return Number(n.text);
    if (ts.isIdentifier(n)) return reference(n.text);
    if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (n.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(n)) {
      const result: unknown[] = [];
      for (const e of n.elements) {
        const value = ts.isSpreadElement(e)
          ? literal(e.expression, depth + 1)
          : [literal(e as ts.Expression, depth + 1)];
        if (!Array.isArray(value))
          fail(e, "Array spread requires literal array");
        const entries = value as unknown[];
        if (result.length + entries.length > 100000)
          fail(e, "Expanded array exceeds import limit");
        for (const entry of entries) result.push(entry);
      }
      return result;
    }
    if (ts.isObjectLiteralExpression(n)) {
      const result: Record<string, unknown> = Object.create(null);
      for (const p of n.properties) {
        if (ts.isSpreadAssignment(p)) {
          const v = literal(p.expression, depth + 1);
          if (!v || Array.isArray(v) || typeof v !== "object")
            fail(p, "Object spread requires literal object");
          Object.assign(result, v);
        } else if (ts.isPropertyAssignment(p))
          result[key(p.name)] = literal(p.initializer, depth + 1);
        else if (ts.isShorthandPropertyAssignment(p))
          result[p.name.text] = reference(p.name.text);
        else fail(p, "Unsupported object member");
      }
      return result;
    }
    return fail(n);
  }
  if (!exported || !ts.isObjectLiteralExpression(exported))
    throw Error("Expected literal default song object");
  const metadata: Record<string, unknown> = Object.create(null);
  let getter = false;
  for (const p of exported.properties) {
    if (ts.isGetAccessorDeclaration(p) && key(p.name) === "lines") {
      // Allow only the established getter, parsed and compared as syntax. Never execute it.
      const compact = p
        .getText(ast)
        .replace(/\s+/gu, "")
        .replace(/;/g, "")
        // Python emits the equivalent single-identifier callback without parentheses.
        .replace(/TIMELINE\.map\((\w+)=>/, "TIMELINE.map(($1)=>")
        .replace(/,\)/g, ")")
        .replace(/,}/g, "}");
      if (
        !/^getlines\(\)\{returnTIMELINE\.map\(\((\w+)\)=>\(\{id:\1\.id,startMs:\1\.startMs,endMs:\1\.endMs,\.\.\.LYRICS_DICT\[\1\.lyricKey\]\}\)\)\}$/.test(
          compact,
        )
      )
        fail(
          p,
          "Unsupported lines getter; expected TIMELINE map and LYRICS_DICT lookup",
        );
      getter = true;
    } else if (ts.isPropertyAssignment(p))
      metadata[key(p.name)] = literal(p.initializer);
    else fail(p, "Unsupported default export member");
  }
  if (!getter) throw Error("Missing legacy lines getter");
  // Also validate unused constants so malicious/unsupported code is never quietly accepted.
  for (const name of declarations.keys()) reference(name);
  return {
    metadata,
    TIMELINE: reference("TIMELINE"),
    LYRICS_DICT: reference("LYRICS_DICT"),
  };
}
const legacyWord = z
  .object({
    hanzi: z.string(),
    pinyin: z.string(),
    translation: z.object({ en: z.string() }).strict(),
  })
  .strict();
const legacySchema = z
  .object({
    metadata: z.record(z.string(), z.string()),
    TIMELINE: z.array(
      z
        .object({
          id: z.string(),
          lyricKey: z.string(),
          startMs: z.number().int().nonnegative(),
          endMs: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    LYRICS_DICT: z.record(
      z.string(),
      z
        .object({
          translation: z.object({ en: z.string(), pl: z.string() }).strict(),
          words: z.array(legacyWord),
        })
        .strict(),
    ),
  })
  .strict();
export function importLegacy(source: string, filename = "song.ts"): Project {
  const data = legacySchema.parse(extractLegacy(source));
  const keys = Object.keys(data.LYRICS_DICT);
  return projectSchema.parse({
    schemaVersion: 1,
    format: "lyric-workbench",
    metadata: data.metadata,
    source: filename,
    phrases: keys.map((lyricKey, i) => ({
      ...data.LYRICS_DICT[lyricKey],
      id: `phrase-${i}`,
      lyricKey,
      words: data.LYRICS_DICT[lyricKey].words.map((w, j) => ({
        ...w,
        id: `phrase-${i}-word-${j}`,
      })),
      review: "pending",
      segmentationApproved: false,
      notes: "",
    })),
    occurrences: data.TIMELINE.map((o) => ({
      id: o.id,
      phraseId: `phrase-${keys.indexOf(o.lyricKey)}`,
      startMs: o.startMs,
      endMs: o.endMs,
    })),
  });
}
export function exportLegacy(project: Project): string {
  const p = projectSchema.parse(project);
  const dump = (value: unknown) => JSON.stringify(value, null, 2);
  const timeline = p.occurrences.map((o) => ({
    id: o.id,
    startMs: o.startMs ?? 0,
    endMs: o.endMs ?? 0,
    lyricKey: p.phrases.find((v) => v.id === o.phraseId)!.lyricKey,
  }));
  const dict = Object.fromEntries(
    p.phrases.map((v) => [
      v.lyricKey,
      {
        translation: v.translation,
        words: v.words.map((w) => ({
          hanzi: w.hanzi,
          pinyin: w.pinyin,
          translation: w.translation,
        })),
      },
    ]),
  );
  // Draft export preserves incomplete/manual data exactly, with UI warnings; no implicit corrections.
  return `// Lyric Workbench draft: review warnings and unassigned (zero) timings before rendering.\nconst TIMELINE = ${dump(timeline)} as const;\nconst LYRICS_DICT = ${dump(dict)};\nexport default {\n${Object.entries(
    p.metadata,
  )
    .map(([k, v]) => `${dump(k)}: ${dump(v)},`)
    .join(
      "\n",
    )}\nget lines() { return TIMELINE.map((item) => ({id: item.id, startMs: item.startMs, endMs: item.endMs, ...LYRICS_DICT[item.lyricKey]})); }\n};\n`;
}
