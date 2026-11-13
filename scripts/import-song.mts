// Parse data only: never load or execute a song module.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Literal = string | number | Literal[] | { [key: string]: Literal };
export interface ExtractedSong {
  TIMELINE: Literal;
  LYRICS_DICT: Literal;
  metadata: Record<string, Literal>;
}
export function extract(source: string): ExtractedSong {
  const ast = ts.createSourceFile(
    "song.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  if (
    (ast as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
      .parseDiagnostics.length
  )
    throw Error("Invalid TypeScript syntax");
  function literal(node: ts.Expression): Literal {
    if (
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node)
    )
      return literal(node.expression);
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isArrayLiteralExpression(node))
      return node.elements.map((element) => literal(element));
    if (ts.isObjectLiteralExpression(node)) {
      const result: Record<string, Literal> = {};
      for (const property of node.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        )
          throw Error("Unsupported object property");
        const key = property.name.text;
        if (Object.prototype.hasOwnProperty.call(result, key))
          throw Error("Duplicate property: " + key);
        Object.defineProperty(result, key, {
          value: literal(property.initializer),
          enumerable: true,
        });
      }
      return result;
    }
    throw Error("Unsupported expression: " + node.getText(ast).slice(0, 80));
  }
  const data: Partial<ExtractedSong> = {};
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(ast);
        if (name === "TIMELINE" || name === "LYRICS_DICT") {
          if (!declaration.initializer)
            throw Error("Missing initializer: " + name);
          data[name] = literal(declaration.initializer);
        }
      }
    if (ts.isExportAssignment(statement)) {
      if (!ts.isObjectLiteralExpression(statement.expression))
        throw Error("Expected literal default export");
      const metadata: Record<string, Literal> = {};
      for (const property of statement.expression.properties) {
        if (
          ts.isGetAccessorDeclaration(property) &&
          property.name.getText(ast) === "lines"
        )
          continue;
        if (
          !ts.isPropertyAssignment(property) ||
          !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        )
          throw Error("Unsupported metadata property");
        metadata[property.name.text] = literal(property.initializer);
      }
      data.metadata = metadata;
    }
  }
  if (!data.TIMELINE || !data.LYRICS_DICT || !data.metadata)
    throw Error("Missing song data");
  return {
    TIMELINE: data.TIMELINE,
    LYRICS_DICT: data.LYRICS_DICT,
    metadata: data.metadata,
  };
}
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    console.log(
      JSON.stringify(
        extract(
          fs.readFileSync(
            process.argv[2] ||
              fileURLToPath(
                new URL(
                  "../src/Macchiato_Special_Affection_for_You.ts",
                  import.meta.url,
                ),
              ),
            "utf8",
          ),
        ),
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
