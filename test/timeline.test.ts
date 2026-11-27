import { describe, expect, test } from "bun:test";
import {
  backOutPeak,
  comedicScore,
  cueText,
  education,
  hobbies,
  hobbyFades,
  JOKE_BACK,
  languages,
  phoneTrack,
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

  test("uses British spelling and carries no joke", () => {
    const text = JSON.stringify([timeline, education]);
    expect(text).toContain("visualisations");
    expect(text).toContain("Data Visualisation");
    expect(text).not.toMatch(/visualiz|organiz/i);
    expect(JSON.stringify(timeline)).not.toContain("10/10");
  });
});

describe("the timeline's wording", () => {
  const d = (org: string) =>
    timeline.find((e) => (e.organisation ?? e.roles[0]?.title) === org)
      ?.description;

  test("the sabbatical, OpenBench, Unsupervised, Ibotta and Orderly Health read as the spec words them", () => {
    expect(d("Sabbatical")).toBe(
      "After a decade of coding for work or class every day, I needed a break. I have spent it travelling and with family, and I kept building, this time for myself and to help others around me.",
    );
    expect(d("OpenBench")).toBe(
      "I joined as the first engineering hire and stayed the only engineer for three years, so the research, design, architecture and code were all mine. I learnt the science by shadowing the scientists, then built the screening pipeline that ran ML models across trillions of compounds. It found drug candidates, confirmed by experiment, in weeks rather than months and from about 1,000 compounds tested, where a standard screen tests about 100,000.",
    );
    expect(d("Unsupervised")).toBe(
      "I designed, built and owned the data ingestion pipeline while working within the web application and platform teams. It took in unstructured business data of any shape, hundreds of gigabytes a day, and ran inside each client's own cloud. I also rebuilt local development so that heavy Kubernetes workloads ran on a laptop, which the whole team adopted, and wrote the onboarding programme.",
    );
    expect(d("Ibotta")).toBe(
      "Ibotta was Denver's first unicorn, an app with over 23m downloads, and it is where I learnt how an established engineering team works, with services held to uptime SLAs. I worked on the platform behind transactions, from purchases to receipts, and my main piece was moving receipt processing, millions of receipts a day, out of a Ruby monolith and into separate services. They went live before I left, and were faster, more resilient and easier to observe than what they replaced.",
    );
    expect(d("Orderly Health")).toBe(
      "I joined a two-person engineering team and within six months I was the only engineer. I delivered an NLP chatbot pilot to major insurance companies in Colorado, and when the company pivoted to a data product I built its first APIs, visualisations, demos and scrapers. The company was acquired for that product in 2025.",
    );
  });

  test("Unsupervised's technologies are in the spec's order", () => {
    const u = timeline.find((e) => e.organisation === "Unsupervised");
    expect(u?.technologies).toEqual([
      "Airflow",
      "Python",
      "Kubernetes + Helm",
      "AWS",
      "React + TypeScript",
      "Go",
    ]);
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

  test("back.out's peak is the highest the ease reaches", () => {
    // sample GSAP's back.out(s): 1 + (s + 1)u³ + su², u = t - 1
    const ease = (t: number, s: number) =>
      1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
    for (const s of [1.70158, JOKE_BACK, 3]) {
      let most = 0;
      for (let i = 0; i <= 10_000; i++)
        most = Math.max(most, ease(i / 10_000, s));
      expect(backOutPeak(s)).toBeCloseTo(most, 6);
    }
    expect(backOutPeak(JOKE_BACK)).toBeCloseTo(1.154, 3);
  });

  test("on a phone the joke bar's peak ends inside its column", () => {
    for (const real of [skills, [{ name: "Python", score: 10 }]]) {
      const bars = skillBars(real);
      const longest = Math.max(...bars.map((b) => b.length));
      const peak = phoneTrack(bars) * longest * backOutPeak(JOKE_BACK);
      expect(peak).toBeLessThan(1);
      expect(peak).toBeGreaterThan(0.98);
    }
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
      ["making", ["photography", "cooking", "watchmaking", "guitar"]],
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
    ).toEqual(["cooking", "hiking", "photography", "reading"]);
    expect(hobbyFades.map((h) => h.name)).toEqual([
      "football",
      "watchmaking",
      "pub quizzes",
      "chess",
      "guitar",
    ]);
    const fg = hobbyFades.map((h) => h.fg);
    expect([...fg].sort((a, b) => b - a)).toEqual(fg);
    expect(new Set(fg).size).toBe(5);
  });
});
