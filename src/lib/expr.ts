/**
 * A deliberately small expression language for program templates.
 *
 * Program definitions are data, so their formulas ("beneficiaries + 2",
 * "ceil(bikes / 30)", "not bikes_go_home_same_day") arrive as strings. Using
 * eval() on them would let a template author execute arbitrary code, so this
 * is a real parser with a fixed grammar and a fixed function list instead.
 *
 * Grammar:
 *   expr    := or
 *   or      := and ( "or" and )*
 *   and     := not ( "and" not )*
 *   not     := "not" not | cmp
 *   cmp     := add ( ( "<=" | ">=" | "<" | ">" | "==" | "!=" ) add )?
 *   add     := mul ( ( "+" | "-" ) mul )*
 *   mul     := unary ( ( "*" | "/" | "%" ) unary )*
 *   unary   := "-" unary | primary
 *   primary := number | "true" | "false" | ident | call | "(" expr ")"
 */

export type Scalar = number | boolean;
export type Context = Record<string, Scalar>;

/** Build a context with no inherited properties. */
export function makeContext(entries: Record<string, Scalar> = {}): Context {
  return Object.assign(Object.create(null) as Context, entries);
}

const FUNCS: Record<string, (...a: number[]) => number> = {
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  abs: Math.abs,
  max: (...a) => Math.max(...a),
  min: (...a) => Math.min(...a),
};

export class ExprError extends Error {
  constructor(message: string, readonly source: string) {
    super(`${message}  (in: ${source})`);
    this.name = "ExprError";
  }
}

type Tok =
  | { k: "num"; v: number }
  | { k: "ident"; v: string }
  | { k: "op"; v: string }
  | { k: "("; }
  | { k: ")"; }
  | { k: ","; };

const OPS = ["<=", ">=", "==", "!=", "<", ">", "+", "-", "*", "/", "%"];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ k: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ k: ")" });
      i++;
      continue;
    }
    if (c === ",") {
      out.push({ k: "," });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!m) throw new ExprError(`bad number at ${i}`, src);
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ k: "ident", v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`unexpected character ${JSON.stringify(c)} at ${i}`, src);
    out.push({ k: "op", v: op });
    i += op.length;
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(private readonly toks: Tok[], private readonly src: string, private readonly ctx: Context) {}

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }

  private isOp(...vals: string[]): string | null {
    const t = this.peek();
    if (t?.k === "op" && vals.includes(t.v)) return t.v;
    return null;
  }

  private isWord(w: string): boolean {
    const t = this.peek();
    return t?.k === "ident" && t.v === w;
  }

  private take(): Tok {
    const t = this.toks[this.p];
    if (!t) throw new ExprError("unexpected end of expression", this.src);
    this.p++;
    return t;
  }

  private expect(k: Tok["k"]): void {
    const t = this.take();
    if (t.k !== k) throw new ExprError(`expected ${k}`, this.src);
  }

  parse(): Scalar {
    const v = this.or();
    if (this.p !== this.toks.length) throw new ExprError("trailing input", this.src);
    return v;
  }

  private or(): Scalar {
    let left = this.and();
    while (this.isWord("or")) {
      this.take();
      const right = this.and();
      left = bool(left, this.src) || bool(right, this.src);
    }
    return left;
  }

  private and(): Scalar {
    let left = this.not();
    while (this.isWord("and")) {
      this.take();
      const right = this.not();
      left = bool(left, this.src) && bool(right, this.src);
    }
    return left;
  }

  private not(): Scalar {
    if (this.isWord("not")) {
      this.take();
      return !bool(this.not(), this.src);
    }
    return this.cmp();
  }

  private cmp(): Scalar {
    const left = this.add();
    const op = this.isOp("<=", ">=", "<", ">", "==", "!=");
    if (!op) return left;
    this.take();
    const right = this.add();
    switch (op) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case "<":
        return num(left, this.src) < num(right, this.src);
      case "<=":
        return num(left, this.src) <= num(right, this.src);
      case ">":
        return num(left, this.src) > num(right, this.src);
      default:
        return num(left, this.src) >= num(right, this.src);
    }
  }

  private add(): Scalar {
    let left = this.mul();
    for (;;) {
      const op = this.isOp("+", "-");
      if (!op) return left;
      this.take();
      const right = this.mul();
      left = op === "+" ? num(left, this.src) + num(right, this.src) : num(left, this.src) - num(right, this.src);
    }
  }

  private mul(): Scalar {
    let left = this.unary();
    for (;;) {
      const op = this.isOp("*", "/", "%");
      if (!op) return left;
      this.take();
      const right = this.unary();
      const a = num(left, this.src);
      const b = num(right, this.src);
      if ((op === "/" || op === "%") && b === 0) throw new ExprError("division by zero", this.src);
      left = op === "*" ? a * b : op === "/" ? a / b : a % b;
    }
  }

  private unary(): Scalar {
    if (this.isOp("-")) {
      this.take();
      return -num(this.unary(), this.src);
    }
    return this.primary();
  }

  private primary(): Scalar {
    const t = this.take();
    if (t.k === "num") return t.v;
    if (t.k === "(") {
      const v = this.or();
      this.expect(")");
      return v;
    }
    if (t.k === "ident") {
      if (t.v === "true") return true;
      if (t.v === "false") return false;
      if (this.peek()?.k === "(") {
        // Own-property check again: FUNCS is a plain object, so a bracket
        // lookup of "constructor" would otherwise return a host function.
        const fn = Object.prototype.hasOwnProperty.call(FUNCS, t.v) ? FUNCS[t.v] : undefined;
        if (!fn) throw new ExprError(`unknown function ${t.v}`, this.src);
        this.expect("(");
        const args: number[] = [];
        if (this.peek()?.k !== ")") {
          args.push(num(this.or(), this.src));
          while (this.peek()?.k === ",") {
            this.take();
            args.push(num(this.or(), this.src));
          }
        }
        this.expect(")");
        return fn(...args);
      }
      // hasOwnProperty, not `in`: `in` walks the prototype chain, so a name
      // like "constructor" or "toString" would resolve to a host function.
      if (!Object.prototype.hasOwnProperty.call(this.ctx, t.v)) {
        throw new ExprError(`unknown identifier ${t.v}`, this.src);
      }
      const val = this.ctx[t.v];
      if (typeof val !== "number" && typeof val !== "boolean") {
        throw new ExprError(`identifier ${t.v} is not a number or boolean`, this.src);
      }
      return val;
    }
    throw new ExprError(`unexpected token`, this.src);
  }
}

function num(v: Scalar, src: string): number {
  if (typeof v !== "number") throw new ExprError(`expected a number, got ${typeof v}`, src);
  return v;
}

function bool(v: Scalar, src: string): boolean {
  if (typeof v !== "boolean") throw new ExprError(`expected a boolean, got ${typeof v}`, src);
  return v;
}

/** Evaluate an expression against a context. Throws ExprError on bad input. */
export function evaluate(src: string, ctx: Context): Scalar {
  return new Parser(tokenize(src), src, ctx).parse();
}

export function evalNumber(src: string, ctx: Context): number {
  const v = evaluate(src, ctx);
  if (typeof v !== "number") throw new ExprError("expression did not produce a number", src);
  return v;
}

export function evalBoolean(src: string, ctx: Context): boolean {
  const v = evaluate(src, ctx);
  if (typeof v !== "boolean") throw new ExprError("expression did not produce a boolean", src);
  return v;
}
