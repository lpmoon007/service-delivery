import { describe, expect, it } from "vitest";

import { ExprError, evalBoolean, evalNumber, evaluate } from "../expr";

const CTX = { beneficiaries: 108, teams: 13, bikes: 110, travels: true, same_day: false };

describe("arithmetic", () => {
  it("evaluates the template's own formulas", () => {
    expect(evalNumber("beneficiaries + 2", CTX)).toBe(110);
    expect(evalNumber("ceil(bikes / 30)", CTX)).toBe(4);
    expect(evalNumber("max(1, ceil(bikes / 30))", CTX)).toBe(4);
    expect(evalNumber("max(2, ceil(teams / 6))", CTX)).toBe(3);
    expect(evalNumber("ceil(beneficiaries / 40)", CTX)).toBe(3);
  });

  it("respects precedence and parentheses", () => {
    expect(evalNumber("2 + 3 * 4", CTX)).toBe(14);
    expect(evalNumber("(2 + 3) * 4", CTX)).toBe(20);
    expect(evalNumber("-3 + 10", CTX)).toBe(7);
    expect(evalNumber("10 % 3", CTX)).toBe(1);
  });
});

describe("conditions", () => {
  it("evaluates the template's own conditions", () => {
    expect(evalBoolean("beneficiary_travels", { beneficiary_travels: true })).toBe(true);
    expect(evalBoolean("not same_day", CTX)).toBe(true);
    expect(evalBoolean("beneficiaries > 20", CTX)).toBe(true);
    expect(evalBoolean("beneficiaries <= 8", CTX)).toBe(false);
    expect(evalBoolean("travels and not same_day", CTX)).toBe(true);
    expect(evalBoolean("teams == 13", CTX)).toBe(true);
    expect(evalBoolean("teams != 13", CTX)).toBe(false);
  });

  it("picks the first matching vehicle rule", () => {
    const rules = ["beneficiaries <= 8", "beneficiaries <= 20", "beneficiaries > 20"];
    const first = (n: number) => rules.findIndex((r) => evalBoolean(r, { beneficiaries: n }));
    expect(first(6)).toBe(0);
    expect(first(13)).toBe(1);
    expect(first(108)).toBe(2);
  });
});

describe("safety", () => {
  it("has no access to the host environment", () => {
    expect(() => evaluate("process", CTX)).toThrow(ExprError);
    expect(() => evaluate("globalThis", CTX)).toThrow(ExprError);
    expect(() => evaluate("constructor", CTX)).toThrow(ExprError);
    expect(() => evaluate("toString", CTX)).toThrow(ExprError);
    expect(() => evaluate("__proto__", CTX)).toThrow(ExprError);
    expect(() => evaluate("require('fs')", CTX)).toThrow(ExprError);
  });

  it("rejects unknown functions and identifiers", () => {
    expect(() => evaluate("exec(1)", CTX)).toThrow(/unknown function exec/);
    expect(() => evaluate("constructor(1)", CTX)).toThrow(/unknown function constructor/);
    expect(() => evaluate("valueOf(1)", CTX)).toThrow(/unknown function valueOf/);
    expect(() => evaluate("mystery + 1", CTX)).toThrow(/unknown identifier mystery/);
  });

  it("rejects malformed input rather than guessing", () => {
    expect(() => evaluate("1 +", CTX)).toThrow(ExprError);
    expect(() => evaluate("(1 + 2", CTX)).toThrow(ExprError);
    expect(() => evaluate("1 2", CTX)).toThrow(/trailing input/);
    expect(() => evaluate("1 & 2", CTX)).toThrow(/unexpected character/);
  });

  it("refuses to mix types silently", () => {
    expect(() => evalNumber("travels + 1", CTX)).toThrow(/expected a number/);
    expect(() => evalBoolean("teams", CTX)).toThrow(/did not produce a boolean/);
    expect(() => evalNumber("beneficiaries > 20", CTX)).toThrow(/did not produce a number/);
  });

  it("refuses division by zero instead of returning Infinity", () => {
    expect(() => evalNumber("teams / 0", CTX)).toThrow(/division by zero/);
  });

  it("reports the offending expression in the message", () => {
    expect(() => evaluate("nope", CTX)).toThrow(/in: nope/);
  });
});
