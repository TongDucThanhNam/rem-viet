#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule;

// --- CLI CONFIGURATION ---
const HELP_TEXT = `Usage: bun run ui-map [options]

Options:
  --src <path>             Source directory (default: apps/web/src)
  --entry <path>           Entry file (default: apps/web/src/components/admin-shell.tsx)
  --format <kind>          Output format: ascii|json (default: ascii)
  --rootComponent <name>   Root component name override
  --alias <key=value>      Path aliases, repeatable (default: @=src)
  --focus <name>           Focus on a specific component
  --scope <mode>           Focus scope: up|full|down (default: down)
                             up   = ancestors → target (children collapsed)
                             full = ancestors → target → full subtree
                             down = target as root → full subtree
  --layoutOnly             Keep only layout-relevant class/style signals
  --summaryOnly            Print metrics and diagnostics without the full tree
  --output <path>          Write output to a file instead of stdout
  -h, --help               Show this help
`;

const DEFAULT_SRC = "apps/web/src";
const DEFAULT_ENTRY = "apps/web/src/components/admin-shell.tsx";
const DEFAULT_ROOT_COMPONENT = "AdminShell";
const DEFAULT_ALIASES = ["@=apps/web/src"];
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const PROJECT_ROOT = process.cwd();

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    src: { type: "string", default: DEFAULT_SRC },
    entry: { type: "string", default: DEFAULT_ENTRY },
    format: { type: "string", default: "ascii" },
    rootComponent: { type: "string" },
    alias: { type: "string", multiple: true, default: DEFAULT_ALIASES },
    focus: { type: "string" },
    scope: { type: "string", default: "down" },
    layoutOnly: { type: "boolean", default: false },
    summaryOnly: { type: "boolean", default: false },
    output: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(HELP_TEXT);
  process.exit(0);
}

const validFormats = new Set(["ascii", "json"]);
if (!validFormats.has(values.format ?? "ascii")) {
  console.error(
    `Error: --format must be one of ${[...validFormats].join(", ")}`,
  );
  process.exit(1);
}

const validScopes = new Set(["up", "full", "down"]);
if (!validScopes.has(values.scope ?? "down")) {
  console.error(`Error: --scope must be one of ${[...validScopes].join(", ")}`);
  process.exit(1);
}

const srcDir = path.resolve(PROJECT_ROOT, values.src ?? DEFAULT_SRC);
const entryFile = path.resolve(PROJECT_ROOT, values.entry ?? DEFAULT_ENTRY);

const aliasMap = Object.fromEntries(
  (values.alias ?? DEFAULT_ALIASES).map((pair) => {
    const index = pair.indexOf("=");
    return index < 0
      ? [pair, ""]
      : [pair.slice(0, index), pair.slice(index + 1)];
  }),
);

async function emitOutput(output: string) {
  if (!values.output) {
    console.log(output);
    return;
  }
  const outputPath = path.resolve(PROJECT_ROOT, values.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${output}\n`, "utf8");
  console.error(`Wrote ${rel(outputPath)}`);
}

// --- LAYOUT & STYLE CONSTANTS ---
const LAYOUT_CLASS_EXACT = new Set([
  "absolute",
  "contents",
  "fixed",
  "flex",
  "grid",
  "grow",
  "hidden",
  "inline",
  "relative",
  "shrink",
  "static",
  "sticky",
]);

const LAYOUT_CLASS_PREFIXES = [
  "-bottom-",
  "-inset-",
  "-left-",
  "-m-",
  "-mb-",
  "-ml-",
  "-mr-",
  "-mt-",
  "-mx-",
  "-my-",
  "-right-",
  "-top-",
  "absolute",
  "aspect-",
  "basis-",
  "bottom-",
  "col-",
  "content-",
  "display-",
  "end-",
  "flex-",
  "gap-",
  "grid-",
  "grow-",
  "h-",
  "inset-",
  "items-",
  "justify-",
  "left-",
  "m-",
  "max-h-",
  "max-w-",
  "mb-",
  "min-h-",
  "min-w-",
  "ml-",
  "mr-",
  "mt-",
  "mx-",
  "my-",
  "order-",
  "overflow-",
  "overscroll-",
  "p-",
  "pb-",
  "pe-",
  "pl-",
  "place-",
  "pr-",
  "ps-",
  "pt-",
  "px-",
  "py-",
  "right-",
  "row-",
  "self-",
  "shrink-",
  "size-",
  "space-x-",
  "space-y-",
  "start-",
  "top-",
  "w-",
  "z-",
];

const STYLE_KEYS = new Set([
  "alignContent",
  "alignItems",
  "alignSelf",
  "aspectRatio",
  "bottom",
  "display",
  "end",
  "flex",
  "flexBasis",
  "flexDirection",
  "flexGrow",
  "flexShrink",
  "flexWrap",
  "gap",
  "height",
  "inset",
  "insetBlockEnd",
  "insetBlockStart",
  "insetInlineEnd",
  "insetInlineStart",
  "justifyContent",
  "left",
  "margin",
  "marginBottom",
  "marginHorizontal",
  "marginLeft",
  "marginRight",
  "marginTop",
  "marginVertical",
  "maxHeight",
  "maxWidth",
  "minHeight",
  "minWidth",
  "overflow",
  "padding",
  "paddingBottom",
  "paddingHorizontal",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingVertical",
  "position",
  "right",
  "start",
  "top",
  "width",
  "zIndex",
]);

// --- TYPES ---
type JSImport = {
  source: string;
  kind: "default" | "named" | "namespace";
  importedName: string;
};

type RenderFlow =
  | { kind: "expression"; node: any }
  | {
      kind: "branch";
      condition: any;
      thenFlow: RenderFlow | null;
      elseFlow: RenderFlow | null;
    };

type ComponentDefinition = {
  key: string;
  name: string;
  fileAbs: string;
  fileRel: string;
  rootRender: RenderFlow | null;
  imports: Map<string, JSImport>;
  bindings: Map<string, any>;
  source: string;
  acceptsChildren: boolean;
  isDefault: boolean;
  rootLayout: string | null;
};

type RouteDefinition = {
  path: string;
  componentName: string;
};

type TreeNode = {
  id: string;
  kind: "component" | "framework" | "text" | "branch" | "slot";
  name: string;
  fileRel?: string | null;
  module?: string | null;
  layout?: string | null;
  text?: string | null;
  recursive?: boolean;
  duplicate?: boolean;
  children: TreeNode[];
};

type UiDiagnostic = {
  code: "duplicate-admin-shell" | "raw-admin-anchor";
  file: string;
  line: number;
  message: string;
  snippet: string | null;
};

type UiMapMetrics = {
  components: number;
  disclosures: number;
  interactiveControls: number;
  maxDepth: number;
  nodes: number;
};

// --- UTILS ---
function rel(filePath: string) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function parseAst(source: string, filename: string) {
  return parse(source, {
    sourceType: "module",
    sourceFilename: filename,
    plugins: [
      "jsx",
      "typescript",
      "classProperties",
      "decorators-legacy",
      "dynamicImport",
      "topLevelAwait",
    ],
  });
}

function isComponentName(name: string | null | undefined) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name ?? "");
}

function inferComponentName(filePath: string) {
  const ext = path.extname(filePath);
  let base = path.basename(filePath, ext);
  if (base.toLowerCase() === "index")
    base = path.basename(path.dirname(filePath));
  return base
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((p) => `${p[0]?.toUpperCase() ?? ""}${p.slice(1)}`)
    .join("");
}

function unwrapExpression(node: any): any {
  let current = node;
  while (
    current &&
    [
      "ParenthesizedExpression",
      "TSAsExpression",
      "TSTypeAssertion",
      "TSNonNullExpression",
    ].includes(current.type)
  ) {
    current = current.expression;
  }
  return current;
}

function jsxNameToString(nameNode: any): string | null {
  if (!nameNode) return null;
  if (nameNode.type === "JSXIdentifier") return nameNode.name;
  if (nameNode.type === "JSXMemberExpression") {
    const left = jsxNameToString(nameNode.object);
    const right = jsxNameToString(nameNode.property);
    return left && right ? `${left}.${right}` : null;
  }
  return null;
}

function sourceSlice(source: string, node: any) {
  if (!node || typeof node.start !== "number" || typeof node.end !== "number")
    return null;
  return source.slice(node.start, node.end).replace(/\s+/g, " ").trim();
}

function pushClassTokens(out: string[], value: string | null | undefined) {
  if (!value) return;
  for (const token of value
    .split(/\s+/)
    .map((i) => i.trim())
    .filter(Boolean))
    out.push(token);
}

function normalizeClassTokens(tokens: string[]) {
  const seen = new Set<string>();
  return tokens.filter((t) => t && !seen.has(t) && seen.add(t)).join(" ");
}

function isLayoutClass(token: string) {
  const base = token.replace(/^(?:[a-zA-Z0-9_-]+:)+/, "");
  return (
    LAYOUT_CLASS_EXACT.has(base) ||
    LAYOUT_CLASS_PREFIXES.some((p) => base.startsWith(p))
  );
}

function filterLayoutClasses(className: string | null) {
  if (!className) return null;
  const filtered = className
    .split(/\s+/)
    .map((i) => i.trim())
    .filter(Boolean)
    .filter(isLayoutClass);
  return filtered.length > 0 ? filtered.join(" ") : null;
}

// --- AST EXTRACTION LOGIC ---
function collectImports(ast: any) {
  const imports = new Map<string, JSImport>();
  traverse(ast, {
    ImportDeclaration(nodePath: any) {
      const source = nodePath.node.source.value;
      for (const spec of nodePath.node.specifiers ?? []) {
        if (spec.type === "ImportDefaultSpecifier") {
          imports.set(spec.local.name, {
            source,
            kind: "default",
            importedName: "default",
          });
        } else if (spec.type === "ImportNamespaceSpecifier") {
          imports.set(spec.local.name, {
            source,
            kind: "namespace",
            importedName: "*",
          });
        } else if (spec.type === "ImportSpecifier") {
          imports.set(spec.local.name, {
            source,
            kind: "named",
            importedName:
              spec.imported.type === "Identifier"
                ? spec.imported.name
                : spec.imported.value,
          });
        }
      }
    },
  });
  return imports;
}

function collectBindings(ast: any) {
  const bindings = new Map<string, any>();
  traverse(ast, {
    VariableDeclarator(nodePath: any) {
      if (
        nodePath.node.id?.type === "Identifier" &&
        nodePath.node.init &&
        !bindings.has(nodePath.node.id.name)
      ) {
        bindings.set(nodePath.node.id.name, nodePath.node.init);
      }
    },
  });
  return bindings;
}

function hasChildrenParam(funcNode: any) {
  return (funcNode?.params ?? []).some(
    (param: any) =>
      param.type === "ObjectPattern" &&
      param.properties?.some(
        (prop: any) =>
          prop.type === "ObjectProperty" &&
          prop.key?.type === "Identifier" &&
          prop.key.name === "children",
      ),
  );
}

function findJsxInExpression(node: any): any | null {
  const current = unwrapExpression(node);
  if (!current) return null;
  if (current.type === "JSXElement" || current.type === "JSXFragment")
    return current;
  if (current.type === "CallExpression") {
    for (const arg of current.arguments ?? []) {
      const found = findJsxInExpression(arg);
      if (found) return found;
    }
    return findJsxInExpression(current.callee);
  }
  if (current.type === "ArrayExpression") {
    for (const el of current.elements ?? []) {
      const found = findJsxInExpression(el);
      if (found) return found;
    }
    return null;
  }
  if (
    ["ConditionalExpression", "LogicalExpression", "BinaryExpression"].includes(
      current.type,
    )
  ) {
    return (
      findJsxInExpression(current.left) ??
      findJsxInExpression(current.right) ??
      findJsxInExpression(current.consequent) ??
      findJsxInExpression(current.alternate)
    );
  }
  if (
    current.type === "ArrowFunctionExpression" ||
    current.type === "FunctionExpression"
  ) {
    return extractReturnJsx(current);
  }
  if (current.type === "ObjectExpression") {
    for (const prop of current.properties ?? []) {
      if (prop?.type === "ObjectProperty") {
        const found = findJsxInExpression(prop.value);
        if (found) return found;
      }
    }
  }
  return null;
}

function findReturnJsxInStatement(statement: any): any | null {
  if (!statement) return null;
  if (statement.type === "ReturnStatement")
    return statement.argument ? findJsxInExpression(statement.argument) : null;
  if (statement.type === "BlockStatement") {
    for (const child of statement.body ?? []) {
      const found = findReturnJsxInStatement(child);
      if (found) return found;
    }
    return null;
  }
  if (statement.type === "IfStatement")
    return (
      findReturnJsxInStatement(statement.consequent) ??
      findReturnJsxInStatement(statement.alternate)
    );
  if (statement.type === "SwitchStatement") {
    for (const switchCase of statement.cases ?? []) {
      for (const child of switchCase.consequent ?? []) {
        const found = findReturnJsxInStatement(child);
        if (found) return found;
      }
    }
    return null;
  }
  if (
    [
      "ForStatement",
      "ForInStatement",
      "ForOfStatement",
      "WhileStatement",
      "DoWhileStatement",
      "LabeledStatement",
      "TryStatement",
    ].includes(statement.type)
  ) {
    return (
      findReturnJsxInStatement(statement.body) ??
      findReturnJsxInStatement(statement.block) ??
      findReturnJsxInStatement(statement.handler?.body) ??
      findReturnJsxInStatement(statement.finalizer)
    );
  }
  return null;
}

function extractReturnJsx(funcNode: any): any | null {
  if (
    funcNode.type === "ArrowFunctionExpression" &&
    (funcNode.body.type === "JSXElement" ||
      funcNode.body.type === "JSXFragment")
  ) {
    return funcNode.body;
  }
  if (funcNode.body?.type !== "BlockStatement")
    return findJsxInExpression(funcNode.body);
  for (const statement of funcNode.body.body ?? []) {
    const found = findReturnJsxInStatement(statement);
    if (found) return found;
  }
  return null;
}

function createExpressionFlow(node: any): RenderFlow | null {
  const current = unwrapExpression(node);
  return current ? { kind: "expression", node: current } : null;
}

function buildRenderFlowFromStatements(
  statements: any[],
  source: string,
  fallbackFlow: RenderFlow | null = null,
): RenderFlow | null {
  let currentFlow = fallbackFlow;
  for (let index = statements.length - 1; index >= 0; index -= 1) {
    const nextFlow = buildRenderFlowFromStatement(
      statements[index],
      source,
      currentFlow,
    );
    if (nextFlow) currentFlow = nextFlow;
  }
  return currentFlow;
}

function buildRenderFlowFromStatement(
  statement: any,
  source: string,
  fallbackFlow: RenderFlow | null = null,
): RenderFlow | null {
  if (!statement) return fallbackFlow;
  if (statement.type === "ReturnStatement")
    return statement.argument ? createExpressionFlow(statement.argument) : null;
  if (statement.type === "BlockStatement")
    return buildRenderFlowFromStatements(
      statement.body ?? [],
      source,
      fallbackFlow,
    );

  if (statement.type === "IfStatement") {
    const thenFlow =
      buildRenderFlowFromStatement(
        statement.consequent,
        source,
        fallbackFlow,
      ) ?? fallbackFlow;
    const elseFlow = statement.alternate
      ? (buildRenderFlowFromStatement(
          statement.alternate,
          source,
          fallbackFlow,
        ) ?? fallbackFlow)
      : fallbackFlow;
    if (!thenFlow && !elseFlow) return fallbackFlow;
    return { kind: "branch", condition: statement.test, thenFlow, elseFlow };
  }
  if (statement.type === "SwitchStatement") {
    const discriminant =
      sourceSlice(source, statement.discriminant) ?? "switch";
    let currentFlow = fallbackFlow;
    for (
      let index = (statement.cases?.length ?? 0) - 1;
      index >= 0;
      index -= 1
    ) {
      const switchCase = statement.cases[index];
      const caseFlow =
        buildRenderFlowFromStatements(
          switchCase.consequent ?? [],
          source,
          currentFlow,
        ) ?? currentFlow;
      if (!switchCase.test) {
        currentFlow = caseFlow;
        continue;
      }
      currentFlow = {
        kind: "branch",
        condition: `${discriminant} === ${sourceSlice(source, switchCase.test) ?? "case"}`,
        thenFlow: caseFlow,
        elseFlow: currentFlow,
      };
    }
    return currentFlow;
  }
  if (statement.type === "TryStatement") {
    const finalizerFlow = statement.finalizer
      ? (buildRenderFlowFromStatement(
          statement.finalizer,
          source,
          fallbackFlow,
        ) ?? fallbackFlow)
      : fallbackFlow;
    const catchFlow = statement.handler?.body
      ? (buildRenderFlowFromStatement(
          statement.handler.body,
          source,
          finalizerFlow,
        ) ?? finalizerFlow)
      : finalizerFlow;
    return (
      buildRenderFlowFromStatement(statement.block, source, catchFlow) ??
      catchFlow
    );
  }
  if (
    [
      "ForStatement",
      "ForInStatement",
      "ForOfStatement",
      "WhileStatement",
      "DoWhileStatement",
      "LabeledStatement",
    ].includes(statement.type)
  ) {
    return (
      buildRenderFlowFromStatement(statement.body, source, fallbackFlow) ??
      fallbackFlow
    );
  }
  return fallbackFlow;
}

function extractRenderFlow(funcNode: any, source: string): RenderFlow | null {
  if (
    funcNode.type === "ArrowFunctionExpression" &&
    (funcNode.body.type === "JSXElement" ||
      funcNode.body.type === "JSXFragment")
  ) {
    return createExpressionFlow(funcNode.body);
  }
  if (funcNode.body?.type !== "BlockStatement")
    return createExpressionFlow(funcNode.body);
  return buildRenderFlowFromStatements(funcNode.body.body ?? [], source);
}

function unwrapComponentFunction(node: any): any | null {
  let current = unwrapExpression(node);
  while (current) {
    if (
      [
        "ArrowFunctionExpression",
        "FunctionExpression",
        "FunctionDeclaration",
      ].includes(current.type)
    )
      return current;
    if (current.type === "CallExpression") {
      const fnArg = (current.arguments ?? []).find((arg: any) =>
        ["ArrowFunctionExpression", "FunctionExpression"].includes(
          unwrapExpression(arg)?.type,
        ),
      );
      if (fnArg) return unwrapExpression(fnArg);
      current = unwrapExpression(
        (current.arguments ?? []).find((arg: any) => unwrapExpression(arg)),
      );
      continue;
    }
    break;
  }
  return null;
}

function resolveWrapperTarget(node: any): string | null {
  const current = unwrapExpression(node);
  if (!current || current.type !== "CallExpression") return null;
  for (const arg of current.arguments ?? []) {
    const unwrapped = unwrapExpression(arg);
    if (unwrapped?.type === "Identifier" && isComponentName(unwrapped.name))
      return unwrapped.name;
    if (unwrapped?.type === "CallExpression") {
      const nested = resolveWrapperTarget(unwrapped);
      if (nested) return nested;
    }
  }
  return null;
}

function extractTanStackRouteDefinition(
  node: any,
  imports: Map<string, JSImport>,
): RouteDefinition | null {
  const routeCall = unwrapExpression(node);
  if (routeCall?.type !== "CallExpression") return null;

  const factoryCall = unwrapExpression(routeCall.callee);
  if (factoryCall?.type !== "CallExpression") return null;
  const factoryName = unwrapExpression(factoryCall.callee);
  if (factoryName?.type !== "Identifier") return null;

  const factoryImport = imports.get(factoryName.name);
  if (
    factoryImport?.source !== "@tanstack/react-router" ||
    factoryImport.importedName !== "createFileRoute"
  )
    return null;

  const routePath = unwrapExpression(factoryCall.arguments?.[0]);
  const options = unwrapExpression(routeCall.arguments?.[0]);
  if (
    routePath?.type !== "StringLiteral" ||
    options?.type !== "ObjectExpression"
  )
    return null;

  for (const property of options.properties ?? []) {
    if (
      property?.type === "ObjectProperty" &&
      !property.computed &&
      ((property.key.type === "Identifier" &&
        property.key.name === "component") ||
        (property.key.type === "StringLiteral" &&
          property.key.value === "component")) &&
      property.value?.type === "Identifier"
    ) {
      return {
        path: routePath.value,
        componentName: property.value.name,
      };
    }
  }
  return null;
}

// --- FILE ANALYSIS ---
async function analyzeFile(filePath: string) {
  const source = await Bun.file(filePath).text();
  let ast: ReturnType<typeof parseAst>;
  try {
    ast = parseAst(source, filePath);
  } catch (parseError: any) {
    console.error(
      `[warn] skipping unparseable file ${rel(filePath)}: ${parseError?.message ?? String(parseError)}`,
    );
    return null;
  }

  const imports = collectImports(ast);
  const bindings = collectBindings(ast);
  const fileRel = rel(filePath);
  const components = new Map<string, ComponentDefinition>();
  let defaultName: string | null = null;

  function registerComponent(name: string, funcNode: any, isDefault = false) {
    if (!name || !isComponentName(name)) return;
    const rootRender = extractRenderFlow(funcNode, source);
    const key = `${name}@${fileRel}`;
    const rootLayout =
      rootRender?.kind === "expression" &&
      rootRender.node?.type === "JSXElement"
        ? summarizeElementLayout(rootRender.node, bindings, source, false)
        : null;

    components.set(name, {
      key,
      name,
      fileAbs: filePath,
      fileRel,
      rootRender,
      imports,
      bindings,
      source,
      acceptsChildren: hasChildrenParam(funcNode),
      isDefault,
      rootLayout,
    });
    if (isDefault) defaultName = name;
  }

  traverse(ast, {
    FunctionDeclaration(nodePath: any) {
      if (nodePath.node.id?.name)
        registerComponent(nodePath.node.id.name, nodePath.node);
    },
    VariableDeclarator(nodePath: any) {
      if (nodePath.node.id?.type !== "Identifier" || !nodePath.node.init)
        return;
      const componentFn = unwrapComponentFunction(nodePath.node.init);
      if (componentFn) registerComponent(nodePath.node.id.name, componentFn);
    },
    ExportDefaultDeclaration(nodePath: any) {
      const declaration = unwrapExpression(nodePath.node.declaration);
      if (!declaration) return;
      if (declaration.type === "Identifier") {
        defaultName = declaration.name;
      } else if (
        [
          "FunctionDeclaration",
          "FunctionExpression",
          "ArrowFunctionExpression",
        ].includes(declaration.type)
      ) {
        registerComponent(
          declaration.id?.name ??
            inferComponentName(filePath) ??
            "RootComponent",
          declaration,
          true,
        );
      }
    },
  });

  for (const [name, initNode] of bindings) {
    if (components.has(name) || !isComponentName(name)) continue;
    const referencedName = resolveWrapperTarget(initNode);
    const referencedComponent = referencedName
      ? components.get(referencedName)
      : null;
    if (referencedComponent) {
      components.set(name, {
        ...referencedComponent,
        key: `${name}@${fileRel}`,
        name,
        isDefault: false,
      });
    }
  }

  if (!defaultName) {
    for (const component of components.values()) {
      if (component.isDefault) {
        defaultName = component.name;
        break;
      }
    }
  }

  let route: RouteDefinition | null = null;
  for (const initNode of bindings.values()) {
    route = extractTanStackRouteDefinition(initNode, imports);
    if (route) break;
  }

  const diagnostics: UiDiagnostic[] = [];
  traverse(ast, {
    JSXElement(nodePath: any) {
      const jsxNode = nodePath.node;
      const tagName = jsxNameToString(jsxNode.openingElement?.name);
      if (!tagName) return;

      if (
        tagName === "AdminShell" &&
        fileRel !== "apps/web/src/routes/admin.tsx" &&
        imports.get("AdminShell")?.source.endsWith("/components/admin-shell")
      ) {
        diagnostics.push({
          code: "duplicate-admin-shell",
          file: fileRel,
          line: jsxNode.loc?.start.line ?? 1,
          message:
            "AdminShell is owned by a child component; mount it once in the /admin layout.",
          snippet: sourceSlice(source, jsxNode.openingElement),
        });
      }

      if (tagName !== "a") return;
      const hrefAttribute = (jsxNode.openingElement.attributes ?? []).find(
        (attribute: any) =>
          attribute.type === "JSXAttribute" &&
          attribute.name?.type === "JSXIdentifier" &&
          attribute.name.name === "href",
      );
      const href = hrefAttribute
        ? hrefAttribute.value?.type === "StringLiteral"
          ? hrefAttribute.value.value
          : sourceSlice(source, hrefAttribute.value)
        : null;
      const target = getStringJsxAttribute(jsxNode, "target");
      if (href?.includes("/admin") && target !== "_blank") {
        diagnostics.push({
          code: "raw-admin-anchor",
          file: fileRel,
          line: jsxNode.loc?.start.line ?? 1,
          message:
            "Internal Admin navigation must use TanStack Link or navigate; raw anchors remount the document.",
          snippet: sourceSlice(source, jsxNode.openingElement),
        });
      }
    },
  });

  return {
    fileAbs: filePath,
    fileRel,
    components,
    imports,
    defaultName,
    route,
    diagnostics,
  };
}

// --- FILE / MODULE RESOLUTION ---
function resolveAliasImport(source: string) {
  for (const [prefix, target] of Object.entries(aliasMap)) {
    if (!prefix || !target) continue;
    if (source === prefix) return path.resolve(PROJECT_ROOT, target);
    if (source.startsWith(`${prefix}/`))
      return path.resolve(
        PROJECT_ROOT,
        target,
        source.slice(prefix.length + 1),
      );
  }
  return null;
}

function isProjectImportSource(source: string) {
  if (!source) return false;
  if (source.startsWith(".")) return true;
  return Object.keys(aliasMap).some(
    (prefix) => source === prefix || source.startsWith(`${prefix}/`),
  );
}

async function resolveImportToFile(fromFile: string, source: string) {
  const basePath = source.startsWith(".")
    ? path.resolve(path.dirname(fromFile), source)
    : resolveAliasImport(source);
  if (!basePath) return null;
  if (await Bun.file(basePath).exists()) return basePath;
  for (const ext of EXTENSIONS) {
    if (await Bun.file(`${basePath}${ext}`).exists())
      return `${basePath}${ext}`;
  }
  for (const ext of EXTENSIONS) {
    if (await Bun.file(path.join(basePath, `index${ext}`)).exists())
      return path.join(basePath, `index${ext}`);
  }
  return null;
}

// --- STYLING & LAYOUT RESOLUTION ---
function collectClassTokensFromExpression(
  node: any,
  bindings: Map<string, any>,
  source: string,
  seen = new Set<string>(),
  out: string[] = [],
): string[] {
  const current = unwrapExpression(node);
  if (!current) return out;
  if (current.type === "StringLiteral") {
    pushClassTokens(out, current.value);
    return out;
  }
  if (current.type === "TemplateLiteral") {
    for (const quasi of current.quasis ?? [])
      pushClassTokens(out, quasi.value?.cooked ?? quasi.value?.raw ?? "");
    for (const expr of current.expressions ?? [])
      collectClassTokensFromExpression(expr, bindings, source, seen, out);
    return out;
  }
  if (current.type === "Identifier") {
    if (!bindings.has(current.name) || seen.has(current.name)) return out;
    seen.add(current.name);
    collectClassTokensFromExpression(
      bindings.get(current.name),
      bindings,
      source,
      seen,
      out,
    );
    seen.delete(current.name);
    return out;
  }
  if (current.type === "ArrayExpression") {
    for (const item of current.elements ?? [])
      collectClassTokensFromExpression(item, bindings, source, seen, out);
    return out;
  }
  if (current.type === "ObjectExpression") {
    for (const prop of current.properties ?? []) {
      if (prop?.type === "ObjectProperty") {
        if (!prop.computed && prop.key.type === "StringLiteral")
          pushClassTokens(out, prop.key.value);
        if (!prop.computed && prop.key.type === "Identifier")
          pushClassTokens(
            out,
            prop.key.name.includes("-") ? prop.key.name : "",
          );
        collectClassTokensFromExpression(
          prop.value,
          bindings,
          source,
          seen,
          out,
        );
      }
    }
    return out;
  }
  if (
    ["ConditionalExpression", "LogicalExpression", "BinaryExpression"].includes(
      current.type,
    )
  ) {
    collectClassTokensFromExpression(current.left, bindings, source, seen, out);
    collectClassTokensFromExpression(
      current.right,
      bindings,
      source,
      seen,
      out,
    );
    collectClassTokensFromExpression(
      current.consequent,
      bindings,
      source,
      seen,
      out,
    );
    collectClassTokensFromExpression(
      current.alternate,
      bindings,
      source,
      seen,
      out,
    );
    return out;
  }
  if (current.type === "CallExpression") {
    for (const arg of current.arguments ?? [])
      collectClassTokensFromExpression(arg, bindings, source, seen, out);
    return out;
  }
  if (
    current.type === "ArrowFunctionExpression" ||
    current.type === "FunctionExpression"
  ) {
    if (current.body?.type === "BlockStatement") {
      for (const st of current.body.body ?? [])
        if (st.type === "ReturnStatement" && st.argument)
          collectClassTokensFromExpression(
            st.argument,
            bindings,
            source,
            seen,
            out,
          );
      return out;
    }
    collectClassTokensFromExpression(current.body, bindings, source, seen, out);
    return out;
  }
  if (["MemberExpression", "OptionalMemberExpression"].includes(current.type)) {
    if (current.computed)
      collectClassTokensFromExpression(
        current.property,
        bindings,
        source,
        seen,
        out,
      );
    return out;
  }
  const raw = sourceSlice(source, current);
  if (raw && /^[A-Za-z0-9_ :/.[\]-]+$/.test(raw)) pushClassTokens(out, raw);
  return out;
}

function summarizeStyleExpression(
  node: any,
  bindings: Map<string, any>,
  source: string,
  seen = new Set<string>(),
  entries = new Map<string, string>(),
) {
  const current = unwrapExpression(node);
  if (!current) return entries;
  if (current.type === "Identifier") {
    if (!bindings.has(current.name) || seen.has(current.name)) return entries;
    seen.add(current.name);
    summarizeStyleExpression(
      bindings.get(current.name),
      bindings,
      source,
      seen,
      entries,
    );
    seen.delete(current.name);
    return entries;
  }
  if (current.type === "ArrayExpression") {
    for (const item of current.elements ?? [])
      summarizeStyleExpression(item, bindings, source, seen, entries);
    return entries;
  }
  if (current.type === "ObjectExpression") {
    for (const prop of current.properties ?? []) {
      if (prop?.type !== "ObjectProperty") continue;
      let key = null;
      if (!prop.computed && prop.key.type === "Identifier") key = prop.key.name;
      else if (!prop.computed && prop.key.type === "StringLiteral")
        key = prop.key.value;
      if (!key || !STYLE_KEYS.has(key)) continue;
      entries.set(
        key,
        prop.value.type === "StringLiteral"
          ? prop.value.value
          : (sourceSlice(source, prop.value) ?? "?"),
      );
    }
    return entries;
  }
  if (["ConditionalExpression", "LogicalExpression"].includes(current.type)) {
    summarizeStyleExpression(current.left, bindings, source, seen, entries);
    summarizeStyleExpression(current.right, bindings, source, seen, entries);
    summarizeStyleExpression(
      current.consequent,
      bindings,
      source,
      seen,
      entries,
    );
    summarizeStyleExpression(
      current.alternate,
      bindings,
      source,
      seen,
      entries,
    );
  }
  return entries;
}

function summarizeElementLayout(
  jsxNode: any,
  bindings: Map<string, any>,
  source: string,
  layoutOnly: boolean,
) {
  if (!jsxNode || jsxNode.type !== "JSXElement") return null;
  const segments: string[] = [];
  for (const attr of jsxNode.openingElement.attributes ?? []) {
    if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier")
      continue;
    const propName = attr.name.name;
    if (propName === "className" || propName.endsWith("ClassName")) {
      const tokens: string[] = [];
      if (attr.value?.type === "StringLiteral")
        pushClassTokens(tokens, attr.value.value);
      else if (
        attr.value?.type === "JSXExpressionContainer" &&
        attr.value.expression
      ) {
        collectClassTokensFromExpression(
          attr.value.expression,
          bindings,
          source,
          new Set(),
          tokens,
        );
      }
      const normalized = normalizeClassTokens(tokens);
      const filtered = layoutOnly
        ? filterLayoutClasses(normalized)
        : normalized;
      if (filtered)
        segments.push(
          propName === "className" ? filtered : `${propName}=${filtered}`,
        );
      continue;
    }
    if (
      propName.endsWith("Style") &&
      attr.value?.type === "JSXExpressionContainer" &&
      attr.value.expression
    ) {
      const entries = summarizeStyleExpression(
        attr.value.expression,
        bindings,
        source,
      );
      if (entries.size > 0)
        segments.push(
          `${propName}={${[...entries.entries()].map(([k, v]) => `${k}:${v}`).join(", ")}}`,
        );
    }
  }
  return segments.length > 0 ? segments.join(" | ") : null;
}

function summarizeCondition(node: any, source: string) {
  return typeof node === "string"
    ? node
    : (sourceSlice(source, node) ?? "condition");
}

function getStringJsxAttribute(jsxNode: any, attributeName: string) {
  if (!jsxNode || jsxNode.type !== "JSXElement") return null;
  for (const attr of jsxNode.openingElement.attributes ?? []) {
    if (
      attr.type === "JSXAttribute" &&
      attr.name.type === "JSXIdentifier" &&
      attr.name.name === attributeName
    ) {
      if (attr.value?.type === "StringLiteral") return attr.value.value;
      if (
        attr.value?.type === "JSXExpressionContainer" &&
        attr.value.expression?.type === "StringLiteral"
      )
        return attr.value.expression.value;
    }
  }
  return null;
}

// --- TREE BUILDING ---
let nextNodeId = 1;
function createNode(
  kind: TreeNode["kind"],
  name: string,
  overrides: Partial<TreeNode> = {},
): TreeNode {
  return { id: `n${nextNodeId++}`, kind, name, children: [], ...overrides };
}

function cloneTreeNode(node: TreeNode): TreeNode {
  return {
    ...node,
    id: `n${nextNodeId++}`,
    children: node.children.map(cloneTreeNode),
  };
}

function buildTextNode(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim();
  return text
    ? createNode("text", "text", {
        text: text.length > 80 ? `${text.slice(0, 77)}...` : text,
      })
    : null;
}

// --- MAIN EXECUTION ---
async function main() {
  const files: string[] = [];
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx}");
  for await (const matchedPath of glob.scan({
    cwd: srcDir,
    absolute: true,
    dot: true,
  })) {
    const norm = String(matchedPath).replaceAll("\\", "/");
    if (
      !norm.includes("/node_modules/") &&
      !norm.includes("/__tests__/") &&
      !norm.includes(".test.") &&
      !norm.includes(".spec.") &&
      !norm.endsWith(".d.ts")
    ) {
      files.push(path.resolve(String(matchedPath)));
    }
  }
  files.sort((a, b) => a.localeCompare(b));

  const rawAnalyses = await Promise.all(files.map((f) => analyzeFile(f)));
  const analyses = rawAnalyses.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  const componentsByKey = new Map<string, ComponentDefinition>();
  const componentsByFile = new Map<string, Map<string, ComponentDefinition>>();
  const defaultByFile = new Map<string, string | null>();
  const expandedComponents = new Set<string>();
  const routes: Array<{ path: string; component: ComponentDefinition }> = [];
  const diagnostics = analyses
    .flatMap((analysis) => analysis.diagnostics)
    .sort(
      (left, right) =>
        left.file.localeCompare(right.file) || left.line - right.line,
    );

  for (const analysis of analyses) {
    componentsByFile.set(analysis.fileAbs, analysis.components);
    defaultByFile.set(analysis.fileAbs, analysis.defaultName);
    for (const component of analysis.components.values())
      componentsByKey.set(component.key, component);
    if (analysis.route) {
      const routeComponent = analysis.components.get(
        analysis.route.componentName,
      );
      if (routeComponent)
        routes.push({ path: analysis.route.path, component: routeComponent });
    }
  }
  routes.sort((a, b) => {
    if (a.path === b.path) return 0;
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    return a.path.localeCompare(b.path);
  });

  async function resolveLocalComponentKey(
    tagName: string,
    fromComponent: ComponentDefinition,
  ): Promise<string | null> {
    if (!tagName.includes(".")) {
      const sameFile = componentsByFile
        .get(fromComponent.fileAbs)
        ?.get(tagName);
      if (sameFile) return sameFile.key;
    }
    const importLocal = tagName.split(".")[0] ?? tagName;
    const importRecord = fromComponent.imports.get(importLocal);
    if (!importRecord || !isProjectImportSource(importRecord.source))
      return null;

    const targetFile = await resolveImportToFile(
      fromComponent.fileAbs,
      importRecord.source,
    );
    if (!targetFile) return null;
    const targetComponents = componentsByFile.get(targetFile);
    if (!targetComponents) return null;

    if (tagName.includes(".") && importRecord.kind === "namespace") {
      const lastMember = tagName.split(".").pop() ?? "";
      if (targetComponents.has(lastMember))
        return targetComponents.get(lastMember)?.key ?? null;
      return targetComponents.size === 1
        ? ([...targetComponents.values()][0]?.key ?? null)
        : null;
    }
    if (importRecord.kind === "default") {
      const defName = defaultByFile.get(targetFile);
      if (defName && targetComponents.has(defName))
        return targetComponents.get(defName)?.key ?? null;
      return targetComponents.size === 1
        ? ([...targetComponents.values()][0]?.key ?? null)
        : null;
    }
    if (importRecord.kind === "named")
      return targetComponents.get(importRecord.importedName)?.key ?? null;
    return null;
  }

  async function resolveRouteFileFromName(
    routeName: string,
    fromComponent: ComponentDefinition,
  ) {
    const layoutDir = path.dirname(fromComponent.fileAbs);
    const candidates = [];
    if (routeName.startsWith("(") && routeName.endsWith(")"))
      candidates.push(path.join(layoutDir, routeName, "_layout"));
    candidates.push(path.join(layoutDir, routeName));

    for (const base of candidates) {
      if (await Bun.file(base).exists()) return base;
      for (const ext of EXTENSIONS)
        if (await Bun.file(`${base}${ext}`).exists()) return `${base}${ext}`;
      for (const ext of EXTENSIONS) {
        if (await Bun.file(path.join(base, `_layout${ext}`)).exists())
          return path.join(base, `_layout${ext}`);
        if (await Bun.file(path.join(base, `index${ext}`)).exists())
          return path.join(base, `index${ext}`);
      }
    }
    return null;
  }

  async function buildNodesFromRenderFlow(
    renderFlow: RenderFlow | null,
    context: ComponentDefinition,
    stack: string[],
    slotChildren: TreeNode[],
  ): Promise<TreeNode[]> {
    if (!renderFlow) return [];
    if (renderFlow.kind === "expression")
      return buildNodesFromExpression(
        renderFlow.node,
        context,
        stack,
        slotChildren,
      );

    const branchNode = createNode(
      "branch",
      summarizeCondition(renderFlow.condition, context.source),
    );
    const thenChildren = await buildNodesFromRenderFlow(
      renderFlow.thenFlow,
      context,
      stack,
      slotChildren,
    );
    const elseChildren = await buildNodesFromRenderFlow(
      renderFlow.elseFlow,
      context,
      stack,
      slotChildren,
    );
    if (thenChildren.length > 0)
      branchNode.children.push(
        createNode("branch", "then", { children: thenChildren }),
      );
    if (elseChildren.length > 0)
      branchNode.children.push(
        createNode("branch", "else", { children: elseChildren }),
      );
    return branchNode.children.length > 0 ? [branchNode] : [];
  }

  async function buildNodesFromExpression(
    expr: any,
    context: ComponentDefinition,
    stack: string[],
    slotChildren: TreeNode[],
  ): Promise<TreeNode[]> {
    const current = unwrapExpression(expr);
    if (!current) return [];
    if (current.type === "Identifier" && current.name === "children")
      return slotChildren.map(cloneTreeNode);
    if (current.type === "JSXElement" || current.type === "JSXFragment")
      return buildNodesFromJsx(current, context, stack, slotChildren);

    if (
      current.type === "ConditionalExpression" &&
      (current.consequent || current.alternate)
    ) {
      const branchNode = createNode(
        "branch",
        summarizeCondition(current.test, context.source),
      );
      const thenChildren = await buildNodesFromExpression(
        current.consequent,
        context,
        stack,
        slotChildren,
      );
      const elseChildren = await buildNodesFromExpression(
        current.alternate,
        context,
        stack,
        slotChildren,
      );
      if (thenChildren.length > 0)
        branchNode.children.push(
          createNode("branch", "then", { children: thenChildren }),
        );
      if (elseChildren.length > 0)
        branchNode.children.push(
          createNode("branch", "else", { children: elseChildren }),
        );
      return branchNode.children.length > 0 ? [branchNode] : [];
    }
    if (current.type === "LogicalExpression") {
      const children =
        (await buildNodesFromExpression(
          current.right,
          context,
          stack,
          slotChildren,
        )) ?? [];
      return children.length === 0
        ? []
        : [
            createNode(
              "branch",
              summarizeCondition(current.left, context.source),
              { children },
            ),
          ];
    }
    if (current.type === "ArrayExpression") {
      const out: TreeNode[] = [];
      for (const item of current.elements ?? [])
        out.push(
          ...(await buildNodesFromExpression(
            item,
            context,
            stack,
            slotChildren,
          )),
        );
      return out;
    }
    if (
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionExpression"
    ) {
      return buildNodesFromRenderFlow(
        extractRenderFlow(current, context.source),
        context,
        stack,
        slotChildren,
      );
    }
    if (current.type === "ObjectExpression") {
      const out: TreeNode[] = [];
      for (const prop of current.properties ?? []) {
        if (prop?.type === "ObjectProperty")
          out.push(
            ...(await buildNodesFromExpression(
              prop.value,
              context,
              stack,
              slotChildren,
            )),
          );
      }
      return out;
    }
    if (current.type === "CallExpression") {
      const out: TreeNode[] = [];
      for (const arg of current.arguments ?? [])
        out.push(
          ...(await buildNodesFromExpression(
            arg,
            context,
            stack,
            slotChildren,
          )),
        );
      return out;
    }
    return [];
  }

  async function buildChildrenFromJsxChildren(
    children: any[],
    context: ComponentDefinition,
    stack: string[],
    slotChildren: TreeNode[],
  ): Promise<TreeNode[]> {
    const out: TreeNode[] = [];
    for (const child of children ?? []) {
      if (!child) continue;
      if (child.type === "JSXText") {
        const textNode = buildTextNode(child.value);
        if (textNode) out.push(textNode);
        continue;
      }
      if (child.type === "JSXExpressionContainer") {
        out.push(
          ...(await buildNodesFromExpression(
            child.expression,
            context,
            stack,
            slotChildren,
          )),
        );
        continue;
      }
      out.push(
        ...(await buildNodesFromJsx(child, context, stack, slotChildren)),
      );
    }
    return out;
  }

  async function buildComponentNode(
    targetComponent: ComponentDefinition,
    stack: string[],
    slotChildren: TreeNode[],
  ): Promise<TreeNode> {
    const componentNode = createNode("component", targetComponent.name, {
      fileRel: targetComponent.fileRel,
      layout: targetComponent.rootLayout,
    });

    if (stack.includes(targetComponent.key)) {
      componentNode.recursive = true;
      return componentNode;
    }
    if (expandedComponents.has(targetComponent.key)) {
      componentNode.duplicate = true;
      componentNode.children = slotChildren;
      return componentNode;
    }

    expandedComponents.add(targetComponent.key);
    componentNode.children = await buildNodesFromRenderFlow(
      targetComponent.rootRender,
      targetComponent,
      [...stack, targetComponent.key],
      slotChildren,
    );
    if (!targetComponent.acceptsChildren && slotChildren.length > 0)
      componentNode.children.push(...slotChildren);
    return componentNode;
  }

  async function buildNodesFromJsx(
    jsxNode: any,
    context: ComponentDefinition,
    stack: string[],
    slotChildren: TreeNode[],
  ): Promise<TreeNode[]> {
    if (!jsxNode) return [];
    if (jsxNode.type === "JSXFragment")
      return buildChildrenFromJsxChildren(
        jsxNode.children ?? [],
        context,
        stack,
        slotChildren,
      );
    if (jsxNode.type !== "JSXElement") return [];

    const tagName = jsxNameToString(jsxNode.openingElement?.name);
    if (!tagName || tagName === "Fragment")
      return buildChildrenFromJsxChildren(
        jsxNode.children ?? [],
        context,
        stack,
        slotChildren,
      );

    const directChildren = await buildChildrenFromJsxChildren(
      jsxNode.children ?? [],
      context,
      stack,
      slotChildren,
    );
    const embeddedChildren: TreeNode[] = [];

    for (const attr of jsxNode.openingElement.attributes ?? []) {
      if (
        attr.type !== "JSXAttribute" ||
        attr.name.type !== "JSXIdentifier" ||
        !attr.value
      )
        continue;
      const propName = attr.name.name;
      if (propName.endsWith("ClassName") || propName.endsWith("Style"))
        continue;
      if (attr.value.type === "JSXExpressionContainer") {
        embeddedChildren.push(
          ...(await buildNodesFromExpression(
            attr.value.expression,
            context,
            stack,
            [],
          )),
        );
      }
    }

    const localKey = await resolveLocalComponentKey(tagName, context);
    if (localKey) {
      const targetComponent = componentsByKey.get(localKey);
      if (!targetComponent) return [];
      return [await buildComponentNode(targetComponent, stack, directChildren)];
    }

    const moduleName = context.imports.get(
      tagName.split(".")[0] ?? tagName,
    )?.source;
    const isModule = moduleName && !isProjectImportSource(moduleName);

    const frameworkNode = createNode("framework", tagName, {
      module: isModule ? moduleName : null,
      layout: summarizeElementLayout(
        jsxNode,
        context.bindings,
        context.source,
        Boolean(values.layoutOnly),
      ),
      children: [...directChildren, ...embeddedChildren],
    });

    if (
      isModule &&
      moduleName === "@tanstack/react-router" &&
      tagName === "Outlet"
    ) {
      for (const route of routes) {
        const routeNode = createNode("framework", `route ${route.path}`, {
          module: moduleName,
        });
        routeNode.children.push(
          await buildComponentNode(route.component, stack, []),
        );
        frameworkNode.children.push(routeNode);
      }
    }

    if (
      isModule &&
      moduleName === "expo-router" &&
      (tagName === "Stack.Screen" || tagName === "Tabs.Screen")
    ) {
      const routeName = getStringJsxAttribute(jsxNode, "name");
      if (routeName) {
        const routeFile = await resolveRouteFileFromName(routeName, context);
        if (routeFile) {
          const routeDefaultName = defaultByFile.get(routeFile);
          const firstComp = routeDefaultName
            ? componentsByFile.get(routeFile)?.get(routeDefaultName)
            : [...(componentsByFile.get(routeFile)?.values() ?? [])][0];
          if (firstComp) {
            const routeNode = createNode("component", firstComp.name, {
              fileRel: firstComp.fileRel,
              layout: firstComp.rootLayout,
            });
            routeNode.children = await buildNodesFromRenderFlow(
              firstComp.rootRender,
              firstComp,
              [...stack, firstComp.key],
              [],
            );
            frameworkNode.children.push(routeNode);
          }
        }
      }
    }
    return [frameworkNode];
  }

  // --- ASCII OUTPUT FORMATTING ---
  function formatAsciiLabel(node: TreeNode) {
    if (node.kind === "text") return `"${node.text ?? ""}"`;
    const parts = [`[${node.name}]`];
    if (node.fileRel) parts.push(node.fileRel);
    else if (node.module) parts.push(node.module);
    if (node.layout) parts.push(`(${node.layout})`);
    if (node.recursive) parts.push("↺");
    if (node.duplicate) parts.push("(see above)");
    return parts.join(" ");
  }

  function buildAsciiTree(rootNode: TreeNode) {
    const lines: string[] = [];
    function walk(node: TreeNode, depth: number) {
      lines.push(`${"  ".repeat(depth)}${formatAsciiLabel(node)}`);
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
    walk(rootNode, 0);
    return lines.join("\n");
  }

  function collectMetrics(rootNode: TreeNode): UiMapMetrics {
    const interactiveNames = new Set([
      "a",
      "button",
      "input",
      "select",
      "summary",
      "textarea",
      "Button",
      "Input",
      "Link",
      "Select",
      "Textarea",
    ]);
    const disclosureNames = new Set([
      "details",
      "Accordion",
      "Collapsible",
      "Dialog",
      "Drawer",
      "Sheet",
    ]);
    const metrics: UiMapMetrics = {
      components: 0,
      disclosures: 0,
      interactiveControls: 0,
      maxDepth: 0,
      nodes: 0,
    };
    function walk(node: TreeNode, depth: number) {
      metrics.nodes += 1;
      metrics.maxDepth = Math.max(metrics.maxDepth, depth);
      if (node.kind === "component") metrics.components += 1;
      if (interactiveNames.has(node.name)) metrics.interactiveControls += 1;
      if (disclosureNames.has(node.name)) metrics.disclosures += 1;
      for (const child of node.children) walk(child, depth + 1);
    }
    walk(rootNode, 0);
    return metrics;
  }

  function findPathToNode(
    node: TreeNode,
    targetId: string,
    pathAcc: TreeNode[] = [],
  ): TreeNode[] {
    const nextPath = [...pathAcc, node];
    if (node.id === targetId) return nextPath;
    for (const child of node.children) {
      const found = findPathToNode(child, targetId, nextPath);
      if (found.length > 0 && found[found.length - 1]?.id === targetId)
        return found;
    }
    return [];
  }

  function buildFocusedAsciiTree(
    rootNode: TreeNode,
    focusNodeId: string,
    scope: "up" | "full" | "down",
    freshSubtree: TreeNode | null = null,
  ) {
    const lines: string[] = [];
    const pathToFocus = findPathToNode(rootNode, focusNodeId);
    const focusTarget = pathToFocus[pathToFocus.length - 1] ?? rootNode;
    const subtreeRoot = freshSubtree ?? focusTarget;

    if (scope === "down") return buildAsciiTree(subtreeRoot);

    if (scope === "up") {
      if (pathToFocus.length > 1) {
        lines.push("Ancestor chain → target:");
        for (let i = 0; i < pathToFocus.length; i++) {
          const node = pathToFocus[i]!;
          const isTarget = i === pathToFocus.length - 1;
          lines.push(
            `${"  ".repeat(i + 1)}${isTarget ? "★ " : ""}${formatAsciiLabel(node)}${isTarget && node.children.length > 0 ? ` [${node.children.length} children]` : ""}`,
          );
        }
      } else {
        lines.push(
          `★ ${formatAsciiLabel(focusTarget)}${focusTarget.children.length > 0 ? ` [${focusTarget.children.length} children]` : ""}`,
        );
      }
      return lines.join("\n");
    }

    if (pathToFocus.length > 1) {
      lines.push("Ancestor chain (layout context):");
      for (let i = 0; i < pathToFocus.length; i++) {
        const node = pathToFocus[i]!;
        lines.push(
          `${"  ".repeat(i + 1)}${i === pathToFocus.length - 1 ? "★ " : ""}${formatAsciiLabel(node)}`,
        );
      }
      lines.push("");
    }
    lines.push(buildAsciiTree(subtreeRoot));
    return lines.join("\n");
  }

  // --- RESOLVE TARGET & OUTPUT ---
  let rootComponent = values.rootComponent
    ? [...componentsByKey.values()].find((c) => c.name === values.rootComponent)
    : componentsByFile.get(entryFile)?.get(DEFAULT_ROOT_COMPONENT);
  const entryDefaultName = defaultByFile.get(entryFile);
  if (!rootComponent && entryDefaultName)
    rootComponent = componentsByFile.get(entryFile)?.get(entryDefaultName);
  if (!rootComponent)
    rootComponent = [...componentsByKey.values()].find(
      (c) => c.fileAbs === entryFile,
    );

  if (!rootComponent)
    throw new Error(
      `Cannot determine root component for ${rel(entryFile)}. Use --rootComponent.`,
    );

  const rootNode = createNode("component", rootComponent.name, {
    fileRel: rootComponent.fileRel,
    layout: rootComponent.rootLayout,
  });
  rootNode.children = await buildNodesFromRenderFlow(
    rootComponent.rootRender,
    rootComponent,
    [rootComponent.key],
    [],
  );

  const focusNode = values.focus
    ? (function find(n: TreeNode): TreeNode | null {
        return n.name === values.focus
          ? n
          : n.children.reduce(
              (acc: TreeNode | null, c) => acc || find(c),
              null,
            );
      })(rootNode)
    : null;
  const scope = (values.scope ?? "down") as "up" | "full" | "down";
  let standaloneRoot: TreeNode | null = null;
  let freshFocusSubtree: TreeNode | null = null;

  if (focusNode && scope !== "up" && focusNode.kind === "component") {
    const focusDefinition = [...componentsByKey.values()].find(
      (component) =>
        component.name === focusNode.name &&
        component.fileRel === focusNode.fileRel,
    );
    if (focusDefinition) {
      expandedComponents.clear();
      freshFocusSubtree = await buildComponentNode(focusDefinition, [], []);
    }
  }

  if (values.focus && !focusNode) {
    const match = [...componentsByKey.values()].find(
      (c) => c.name === values.focus,
    );
    if (match) {
      expandedComponents.clear();
      standaloneRoot = createNode("component", match.name, {
        fileRel: match.fileRel,
        layout: match.rootLayout,
      });
      standaloneRoot.children = await buildNodesFromRenderFlow(
        match.rootRender,
        match,
        [match.key],
        [],
      );
      console.error(
        `Note: "${values.focus}" is not reachable from the main navigation tree. Showing standalone subtree.\n`,
      );
    } else {
      console.error(
        `Error: --focus "${values.focus}" not found in the component tree or registry.`,
      );
      process.exit(1);
    }
  }

  const selectedTree =
    standaloneRoot ?? freshFocusSubtree ?? focusNode ?? rootNode;
  const ancestorPath = focusNode
    ? findPathToNode(rootNode, focusNode.id).map((node) => ({
        kind: node.kind,
        name: node.name,
        fileRel: node.fileRel ?? null,
      }))
    : [];
  const metrics = collectMetrics(selectedTree);

  if ((values.format ?? "ascii") === "json") {
    await emitOutput(
      JSON.stringify(
        {
          version: 1,
          sourceDirectory: rel(srcDir),
          entryFile: rel(entryFile),
          rootComponent: rootComponent.name,
          focus: values.focus ?? null,
          scope,
          layoutOnly: Boolean(values.layoutOnly),
          ancestorPath,
          metrics,
          diagnostics,
          ...(values.summaryOnly ? {} : { tree: selectedTree }),
        },
        null,
        2,
      ),
    );
    return;
  }

  const ascii = standaloneRoot
    ? buildAsciiTree(standaloneRoot)
    : focusNode
      ? buildFocusedAsciiTree(rootNode, focusNode.id, scope, freshFocusSubtree)
      : buildAsciiTree(rootNode);

  const summary = [
    `nodes=${metrics.nodes}`,
    `components=${metrics.components}`,
    `interactive=${metrics.interactiveControls}`,
    `disclosures=${metrics.disclosures}`,
    `maxDepth=${metrics.maxDepth}`,
    `diagnostics=${diagnostics.length}`,
  ].join(" ");
  const diagnosticText = diagnostics.length
    ? `\n\nDiagnostics:\n${diagnostics
        .map(
          (item) =>
            `- ${item.code} ${item.file}:${item.line} — ${item.message}`,
        )
        .join("\n")}`
    : "";
  await emitOutput(
    values.summaryOnly
      ? `Summary: ${summary}${diagnosticText}`
      : `${ascii}\n\nSummary: ${summary}${diagnosticText}`,
  );
}

main().catch((error) => {
  console.error("generate-ui-map failed:", error?.message ?? error);
  process.exit(1);
});
