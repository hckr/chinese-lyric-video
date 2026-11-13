// Parse data only: never load or execute a song module.
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
function extract(source) {
  const ast = ts.createSourceFile('song.ts', source, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw Error('Invalid TypeScript syntax');
  function literal(n) {
    if (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) return literal(n.expression);
    if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return ts.isNumericLiteral(n) ? Number(n.text) : n.text;
    if (ts.isArrayLiteralExpression(n)) return n.elements.map(literal);
    if (ts.isObjectLiteralExpression(n)) {
      const result = {};
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) throw Error('Unsupported object property');
        const key = p.name.text;
        if (Object.hasOwn(result, key)) throw Error('Duplicate property: ' + key);
        Object.defineProperty(result, key, {value: literal(p.initializer), enumerable: true});
      }
      return result;
    }
    throw Error('Unsupported expression: ' + n.getText(ast).slice(0, 80));
  }
  const data = {};
  for (const stmt of ast.statements) {
    if (ts.isVariableStatement(stmt)) for (const d of stmt.declarationList.declarations) {
      if (['TIMELINE', 'LYRICS_DICT'].includes(d.name.getText(ast))) data[d.name.getText(ast)] = literal(d.initializer);
    }
    if (ts.isExportAssignment(stmt)) {
      if (!ts.isObjectLiteralExpression(stmt.expression)) throw Error('Expected literal default export');
      data.metadata = {};
      for (const p of stmt.expression.properties) {
        if (ts.isGetAccessorDeclaration(p) && p.name.getText(ast) === 'lines') continue;
        if (!ts.isPropertyAssignment(p)) throw Error('Unsupported metadata property');
        data.metadata[p.name.text] = literal(p.initializer);
      }
    }
  }
  if (!data.TIMELINE || !data.LYRICS_DICT || !data.metadata) throw Error('Missing song data');
  return data;
}
module.exports = {extract};
if (require.main === module) {
  try { console.log(JSON.stringify(extract(fs.readFileSync(process.argv[2] || path.join(__dirname, '../src/Macchiato_Special_Affection_for_You.ts'), 'utf8')))); }
  catch (e) { console.error(e.message); process.exit(1); }
}
