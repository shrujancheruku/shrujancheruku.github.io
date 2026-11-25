import { describe, expect, test } from "bun:test";
import {
  comedicScore,
  cueText,
  education,
  hobbies,
  hobbyFades,
  languages,
  skillBars,
  skills,
  timeline,
} from "../src/lib/timeline";

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

describe("the skill bars", () => {
  test("holds the four real bars highest to lowest, ties in the resume's order", () => {
    expect(skills.map((s) => [s.name, s.score])).toEqual([
      ["Python", 9],
      ["React + TypeScript", 9],
      ["Kubernetes + Helm", 8],
      ["Go", 7],
    ]);
  });

  test("Comedic Talent comes last and is the highest real score plus one", () => {
    const bars = skillBars(skills);
    expect(bars.map((b) => b.name)).toEqual([
      "Python",
      "React + TypeScript",
      "Kubernetes + Helm",
      "Go",
      "Comedic Talent",
    ]);
    expect(bars.map((b) => b.score)).toEqual([9, 9, 8, 7, 10]);
    expect(bars.map((b) => b.joke)).toEqual([false, false, false, false, true]);
  });

  test("Comedic Talent is never stored in the source", () => {
    expect(skills.some((s) => /comedic/i.test(s.name))).toBe(false);
  });

  test("a bar's length is its score out of 10; the joke runs past a full track", () => {
    expect(skillBars(skills).map((b) => b.length)).toEqual([
      0.9, 0.9, 0.8, 0.7, 1,
    ]);
    const tens = skillBars([{ name: "Python", score: 10 }]);
    expect(comedicScore([{ name: "Python", score: 10 }])).toBe(11);
    expect(tens[1]?.length).toBeCloseTo(1.1);
  });

  test("with no real bars Comedic Talent is 1", () => {
    expect(comedicScore([])).toBe(1);
  });
});

describe("languages and hobbies", () => {
  test("the five languages and their levels", () => {
    expect(languages.map((l) => [l.name, l.level])).toEqual([
      ["English", "native"],
      ["Telugu", "native"],
      ["Hindi", "proficient"],
      ["Japanese", "conversational"],
      ["French", "rudimentary"],
    ]);
  });

  test("three folders and nine hobbies as on the ticket", () => {
    expect(hobbies.map((f) => [f.folder, f.items.map((h) => h.name)])).toEqual([
      ["outdoors", ["hiking", "football"]],
      ["making", ["photography", "watchmaking", "cooking", "guitar"]],
      ["thinking", ["reading", "pub quizzes", "chess"]],
    ]);
  });

  test("the resume's four are accented, the other five fade in order", () => {
    const all = hobbies.flatMap((f) => f.items);
    expect(
      all
        .filter((h) => h.resume)
        .map((h) => h.name)
        .sort(),
    ).toEqual(["hiking", "photography", "reading", "watchmaking"]);
    expect(hobbyFades.map((h) => h.name)).toEqual([
      "football",
      "cooking",
      "pub quizzes",
      "chess",
      "guitar",
    ]);
    const fg = hobbyFades.map((h) => h.fg);
    expect([...fg].sort((a, b) => b - a)).toEqual(fg);
    expect(new Set(fg).size).toBe(5);
  });
});
