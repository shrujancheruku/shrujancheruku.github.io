import { describe, expect, test } from "bun:test";
import { cueText, education, timeline } from "../src/lib/timeline";

describe("the timeline content", () => {
  test("holds the five career entries, newest first", () => {
    expect(timeline.map((e) => e.organisation ?? e.roles[0]?.title)).toEqual([
      "Sabbatical",
      "OpenBench",
      "Unsupervised",
      "Ibotta",
      "Orderly Health",
    ]);
  });

  test("words the dates as month and full year, Now for the sabbatical", () => {
    const dates = timeline.flatMap((e) => e.roles.map((r) => r.dates));
    expect(dates).toEqual([
      "Nov 2025 – Now",
      "Jan 2023 – Nov 2025",
      "May – Oct 2022",
      "Nov 2020 – Apr 2022",
      "Nov 2019 – Oct 2020",
      "Aug 2018 – Aug 2019",
    ]);
    for (const d of [
      ...dates,
      ...education.roles.flatMap((e) => e.roles.map((r) => r.dates)),
    ])
      expect(d).not.toMatch(/'\d\d/);
  });

  test("Unsupervised is one entry with two titles, each with its own dates", () => {
    const u = timeline.find((e) => e.organisation === "Unsupervised");
    expect(u?.roles).toEqual([
      { dates: "May – Oct 2022", title: "Senior Software Engineer" },
      { dates: "Nov 2020 – Apr 2022", title: "Full Stack Engineer" },
    ]);
  });

  test("OpenBench is the Lead Engineer entry, ending Nov 2025", () => {
    const o = timeline.find((e) => e.organisation === "OpenBench");
    expect(o?.roles[0]?.title).toBe("Lead Engineer");
    expect(o?.technologies).toEqual([
      "Machine Learning",
      "Kubernetes",
      "Airflow",
      "AWS",
      "Python",
      "React + TypeScript",
    ]);
  });

  test("uses British spelling and carries the sabbatical joke", () => {
    const text = JSON.stringify([timeline, education]);
    expect(text).toContain("visualisations");
    expect(text).toContain("Data Visualisation");
    expect(text).not.toMatch(/visualiz|organiz/i);
    expect(timeline[0]?.description).toContain(
      "10/10 would recommend to a friend.",
    );
  });

  test("leaves room for a resume-only description, empty for now", () => {
    for (const e of [...timeline, ...education.roles])
      expect(e.resumeDescription).toBeUndefined();
  });
});

describe("Education & Internships content", () => {
  test("has the degree heading", () => {
    expect(education.degree).toBe("B.Sc Computer Science");
    expect(education.university).toBe(
      "University of Illinois Urbana-Champaign",
    );
    expect(education.years).toBe("2014 – 2018");
    expect(education.college).toBe("College of Engineering");
    expect(education.concentrations).toEqual([
      "Human & Social Impact",
      "Computational Media",
    ]);
  });

  test("holds four earlier roles, newest first, each tagged", () => {
    expect(education.roles.map((e) => e.organisation)).toEqual([
      "Sandia National Laboratories",
      "University of Illinois Urbana-Champaign",
      "Indian School of Business",
      "EiQ Networks",
    ]);
    expect(education.roles.map((e) => e.tag)).toEqual([
      "Internship",
      "Teaching",
      "Internship",
      "Internship",
    ]);
  });

  test("the cue counts the roles", () => {
    expect(cueText(education, false)).toBe("4 earlier roles");
    expect(cueText(education, true)).toBe("hide");
    expect(education.cueNote).toBe("teaching, internships");
  });
});
