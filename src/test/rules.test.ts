import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { matchesMonth, normalizeArchiveText, recordMatchesQuery } from "@/data/arabicSearch";
import { dict } from "@/lib/i18n";

describe("Stage 2 public archive rules", () => {
  it("normalizes Arabic variants and finds Arabic or English names", () => {
    expect(normalizeArchiveText("إِبْرَاهِيمُ ــ أحمد")).toBe("ابراهيم احمد");
    expect(recordMatchesQuery("إبراهيم أحمد", "Ibrahim Ahmad", "ابراهيم")).toBe(true);
    expect(recordMatchesQuery("إبراهيم أحمد", "Ibrahim Ahmad", "ibrahim")).toBe(true);
    expect(recordMatchesQuery("إبراهيم أحمد", "Ibrahim Ahmad", "not-a-match")).toBe(false);
  });

  it("filters only by the verified ISO martyrdom-date format", () => {
    expect(matchesMonth("2024-01-15", "2024-01")).toBe(true);
    expect(matchesMonth("2024-02-15", "2024-01")).toBe(false);
    expect(matchesMonth(null, "2024-01")).toBe(false);
    expect(matchesMonth(null, "")).toBe(true);
  });

  it("keeps public labels available in Arabic and English", () => {
    expect(dict.ar.footerRights(2031)).toContain("2031");
    expect(dict.en.footerRights(2031)).toContain("2031");
    expect(dict.ar.nav.contribute).toBeTruthy();
    expect(dict.en.nav.contribute).toBeTruthy();
  });

  it("does not retain the bundled reference data as a production source", () => {
    expect(() => readFileSync(resolve(process.cwd(), "src/data/martyrs.json"), "utf8")).toThrow();
  });

  it("contains no Supabase mutation method in the public repository", () => {
    const repository = readFileSync(resolve(process.cwd(), "src/data/martyrRepository.ts"), "utf8");
    expect(repository).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);
  });
});
