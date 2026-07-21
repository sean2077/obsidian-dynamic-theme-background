const MAX_PATH_LENGTH = 512;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

type Selector =
    | { key: string; kind: "property" }
    | { index: number; kind: "index" }
    | { end?: number; kind: "slice"; start?: number; step: number }
    | { kind: "wildcard" };

type Token = Selector | { kind: "recursive"; selector: Selector } | { kind: "union"; selectors: Selector[] };

function property(key: string): Selector {
    if (key.length === 0 || UNSAFE_KEYS.has(key)) {
        throw new Error("JSONPath contains an unsafe property");
    }
    return { key, kind: "property" };
}

function parseQuoted(value: string): string {
    const quote = value[0];
    if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) {
        throw new Error("JSONPath has an invalid quoted property");
    }
    if (quote === '"') return JSON.parse(value) as string;

    let result = "";
    for (let index = 1; index < value.length - 1; index += 1) {
        const character = value[index];
        if (character !== "\\") {
            result += character;
            continue;
        }
        index += 1;
        const escaped = value[index];
        if (escaped !== "\\" && escaped !== "'") {
            throw new Error("JSONPath has an unsupported escape");
        }
        result += escaped;
    }
    return result;
}

function splitUnion(value: string): string[] {
    const parts: string[] = [];
    let quote = "";
    let escaped = false;
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (escaped) {
            escaped = false;
        } else if (character === "\\" && quote) {
            escaped = true;
        } else if (quote) {
            if (character === quote) quote = "";
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === ",") {
            parts.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    if (quote || escaped) throw new Error("JSONPath has an unterminated quote");
    parts.push(value.slice(start).trim());
    return parts;
}

function parseSelector(value: string): Selector {
    if (value === "*") return { kind: "wildcard" };
    if (/^-?\d+$/u.test(value)) {
        return { index: Number(value), kind: "index" };
    }
    if (value.startsWith('"') || value.startsWith("'")) {
        return property(parseQuoted(value));
    }
    throw new Error("JSONPath contains an unsupported selector");
}

function parseBracket(value: string): Token {
    const union = splitUnion(value);
    if (union.length > 1) {
        return { kind: "union", selectors: union.map(parseSelector) };
    }
    const slice = value.match(/^(-?\d*)?:(-?\d*)?(?::(-?\d+))?$/u);
    if (slice) {
        const step = slice[3] ? Number(slice[3]) : 1;
        if (step <= 0) throw new Error("JSONPath slice step must be positive");
        return {
            end: slice[2] ? Number(slice[2]) : undefined,
            kind: "slice",
            start: slice[1] ? Number(slice[1]) : undefined,
            step,
        };
    }
    return parseSelector(value);
}

function parse(path: string): Token[] {
    if (path.length > MAX_PATH_LENGTH || path[0] !== "$") {
        throw new Error("JSONPath must start with $ and stay within the length limit");
    }
    const tokens: Token[] = [];
    let index = 1;
    while (index < path.length) {
        const recursive = path.startsWith("..", index);
        if (recursive || path[index] === ".") {
            index += recursive ? 2 : 1;
            const start = index;
            while (index < path.length && path[index] !== "." && path[index] !== "[") {
                index += 1;
            }
            const name = path.slice(start, index);
            const selector = name === "*" ? ({ kind: "wildcard" } as const) : property(name);
            tokens.push(recursive ? { kind: "recursive", selector } : selector);
            continue;
        }
        if (path[index] !== "[") {
            throw new Error("JSONPath contains unsupported syntax");
        }
        let end = index + 1;
        let quote = "";
        let escaped = false;
        for (; end < path.length; end += 1) {
            const character = path[end];
            if (escaped) {
                escaped = false;
            } else if (character === "\\" && quote) {
                escaped = true;
            } else if (quote) {
                if (character === quote) quote = "";
            } else if (character === '"' || character === "'") {
                quote = character;
            } else if (character === "]") {
                break;
            }
        }
        if (end >= path.length || quote) {
            throw new Error("JSONPath has an unterminated bracket");
        }
        tokens.push(parseBracket(path.slice(index + 1, end).trim()));
        index = end + 1;
    }
    return tokens;
}

function objectEntries(value: unknown): Array<[string, unknown]> {
    if (value === null || typeof value !== "object") return [];
    return Object.entries(value).filter(([key]) => !UNSAFE_KEYS.has(key));
}

function select(value: unknown, selector: Selector, limit: number): unknown[] {
    if (selector.kind === "property") {
        if (value !== null && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, selector.key)) {
            return [(value as Record<string, unknown>)[selector.key]];
        }
        return [];
    }
    if (selector.kind === "wildcard") {
        return objectEntries(value)
            .slice(0, limit)
            .map(([, item]) => item);
    }
    if (!Array.isArray(value)) return [];
    if (selector.kind === "index") {
        const index = selector.index < 0 ? value.length + selector.index : selector.index;
        return index >= 0 && index < value.length ? [value[index]] : [];
    }

    const start = Math.max(
        selector.start === undefined ? 0 : selector.start < 0 ? value.length + selector.start : selector.start,
        0
    );
    const end = Math.min(
        selector.end === undefined ? value.length : selector.end < 0 ? value.length + selector.end : selector.end,
        value.length
    );
    const result: unknown[] = [];
    for (let index = start; index < end && result.length < limit; index += selector.step) {
        result.push(value[index]);
    }
    return result;
}

function applyRecursive(value: unknown, selector: Selector, limit: number): unknown[] {
    const result: unknown[] = [];
    const stack = [value];
    const visited = new WeakSet<object>();
    while (stack.length > 0 && result.length < limit) {
        const current = stack.pop();
        if (current === null || typeof current !== "object" || visited.has(current)) continue;
        visited.add(current);
        result.push(...select(current, selector, limit - result.length));
        const entries = objectEntries(current);
        for (let index = entries.length - 1; index >= 0; index -= 1) {
            const child = entries[index][1];
            if (child !== null && typeof child === "object") stack.push(child);
        }
    }
    return result.slice(0, limit);
}

export function queryJsonPath(data: unknown, path: string, limit = 100): unknown[] {
    const safeLimit = Math.max(0, Math.min(Math.trunc(limit), 1000));
    let values = [data];
    for (const token of parse(path)) {
        const next: unknown[] = [];
        for (const value of values) {
            if (next.length >= safeLimit) break;
            if (token.kind === "recursive") {
                next.push(...applyRecursive(value, token.selector, safeLimit - next.length));
            } else if (token.kind === "union") {
                for (const selector of token.selectors) {
                    next.push(...select(value, selector, safeLimit - next.length));
                    if (next.length >= safeLimit) break;
                }
            } else {
                next.push(...select(value, token, safeLimit - next.length));
            }
        }
        values = next.slice(0, safeLimit);
    }
    return values;
}
