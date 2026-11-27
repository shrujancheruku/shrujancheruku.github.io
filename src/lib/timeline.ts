// The timeline's content: one source for the timeline window, Education &
// Internships and (later) the resume. Wording is final, from the "Timeline
// content" decision (#13): British/Indian spelling, month and full year.
// An entry may carry `resume`, wording the resume uses instead of
// `description` when it needs fewer words; the site ignores it. `resume.from`
// is the fingerprint of the site wording it was written from (src/lib/resume.ts):
// when `description` changes, `bun scripts/check-resume.ts` fails until the
// resume wording is updated or re-confirmed by copying the new fingerprint.

export interface Role {
  /** "Jan 2023 – Nov 2025"; "Now" for the sabbatical. */
  dates: string;
  title: string;
}

export interface Entry {
  /** One employer is one entry; a title progression stacks inside it, newest first. */
  roles: readonly Role[];
  organisation?: string;
  description: string;
  technologies: readonly string[];
  /** Education & Internships only. */
  tag?: "Internship" | "Teaching";
  /** Resume-only wording. Not shown on the site. */
  resume?: { description: string; from: string };
}

export interface Education {
  degree: string;
  university: string;
  years: string;
  college: string;
  concentrations: readonly string[];
  /** The part of the cue after the count. */
  cueNote: string;
  /** The teaching post and the internships, newest first. */
  roles: readonly Entry[];
}

export const timeline: readonly Entry[] = [
  {
    roles: [{ dates: "Nov 2025 – Now", title: "Sabbatical" }],
    description:
      "After a decade of coding for work or class every day, I needed a break. I have spent it travelling and with family, and I kept building, this time for myself and to help others around me.",
    technologies: [],
  },
  {
    roles: [{ dates: "Jan 2023 – Nov 2025", title: "Lead Engineer" }],
    organisation: "OpenBench",
    description:
      "I joined as the first engineering hire and stayed the only engineer for three years, so the research, design, architecture and code were all mine. I learnt the science by shadowing the scientists, then built the screening pipeline that ran ML models across trillions of compounds. It found drug candidates, confirmed by experiment, in weeks rather than months and from about 1,000 compounds tested, where a standard screen tests about 100,000.",
    technologies: [
      "Machine Learning",
      "Kubernetes",
      "Airflow",
      "AWS",
      "Python",
      "React + TypeScript",
    ],
  },
  {
    roles: [
      { dates: "May – Oct 2022", title: "Senior Software Engineer" },
      { dates: "Nov 2020 – Apr 2022", title: "Full Stack Engineer" },
    ],
    organisation: "Unsupervised",
    description:
      "I designed, built and owned the data ingestion pipeline while working within the web application and platform teams. It took in unstructured business data of any shape, hundreds of gigabytes a day, and ran inside each client's own cloud. I also rebuilt local development so that heavy Kubernetes workloads ran on a laptop, which the whole team adopted, and wrote the onboarding programme.",
    technologies: [
      "Airflow",
      "Python",
      "Kubernetes + Helm",
      "AWS",
      "React + TypeScript",
      "Go",
    ],
  },
  {
    roles: [{ dates: "Nov 2019 – Oct 2020", title: "Platform Engineer" }],
    organisation: "Ibotta",
    description:
      "Ibotta was Denver's first unicorn, an app with over 23m downloads, and it is where I learnt how an established engineering team works, with services held to uptime SLAs. I worked on the platform behind transactions, from purchases to receipts, and my main piece was moving receipt processing, millions of receipts a day, out of a Ruby monolith and into separate services. They went live before I left, and were faster, more resilient and easier to observe than what they replaced.",
    resume: {
      description:
        "I moved receipt processing, millions of receipts a day, out of a Ruby monolith and into separate services that were faster, more resilient and easier to observe. They went live before I left.",
      from: "97d15571dbad",
    },
    technologies: [
      "Kotlin + Spring",
      "Microservices",
      "AWS",
      "TypeScript",
      "GraphQL",
    ],
  },
  {
    roles: [{ dates: "Aug 2018 – Aug 2019", title: "Software Engineer" }],
    organisation: "Orderly Health",
    description:
      "I joined a two-person engineering team and within six months I was the only engineer. I delivered an NLP chatbot pilot to major insurance companies in Colorado, and when the company pivoted to a data product I built its first APIs, visualisations, demos and scrapers. The company was acquired for that product in 2025.",
    resume: {
      description:
        "Within six months of joining a two-person team I was the only engineer. I delivered an NLP chatbot pilot to major insurance companies in Colorado, then built the first version of the data product the company was acquired for in 2025.",
      from: "5499072027e1",
    },
    technologies: [
      "React + Redux",
      "Django + MySQL",
      "Data Visualisation",
      "Google Cloud",
      "Docker",
    ],
  },
];

export const education: Education = {
  degree: "B.Sc Computer Science",
  university: "University of Illinois Urbana-Champaign",
  years: "2014 – 2018",
  college: "College of Engineering",
  concentrations: ["Human & Social Impact", "Computational Media"],
  cueNote: "teaching, internships",
  roles: [
    {
      roles: [
        { dates: "May – Aug 2018", title: "Software Engineering Intern" },
      ],
      organisation: "Sandia National Laboratories",
      tag: "Internship",
      description:
        "Built web applications and data visualisations over large datasets for the US Department of Defense, through a programme with the UIUC Applied Research Institute.",
      technologies: [
        "Flask",
        "React",
        "Data Visualisation",
        "Jenkins",
        "Docker",
      ],
    },
    {
      roles: [{ dates: "Aug 2017 – May 2018", title: "Teaching Assistant" }],
      organisation: "University of Illinois Urbana-Champaign",
      tag: "Teaching",
      description:
        "Led discussion sections for CS 242: Programming Studio, where students build web and mobile apps and learn to write code that holds up to review.",
      technologies: [],
    },
    {
      roles: [{ dates: "Jun – Aug 2016", title: "Front-end Developer Intern" }],
      organisation: "Indian School of Business",
      tag: "Internship",
      description:
        "Redesigned the online course experience for the Centre for Innovation and Entrepreneurship's distance learning programmes: user research, wireframes, and a final report on ease of use.",
      technologies: ["Design Thinking", "Wireframing", "Balsamiq"],
    },
    {
      roles: [{ dates: "Mar – May 2013", title: "Web Design Intern" }],
      organisation: "EiQ Networks",
      tag: "Internship",
      description:
        "Helped redesign the company website, front end and back end.",
      technologies: ["HTML", "CSS", "PHP", "MySQL", "Git", "SVN"],
    },
  ],
};

/** The cue's label: the count of earlier roles, or "hide" while open. */
export const cueText = (e: Education, open: boolean): string =>
  open ? "hide" : `${e.roles.length} earlier roles`;

// ---- the skills window: bars, languages, hobbies (#26, #20). The resume reads
// the same data.

export interface Skill {
  name: string;
  /** Self-rated out of 10, whole numbers. Never shown as a number. */
  score: number;
}

/** The real bars, highest to lowest, ties in the resume's order. */
export const skills: readonly Skill[] = [
  { name: "Python", score: 9 },
  { name: "React + TypeScript", score: 9 },
  { name: "Kubernetes + Helm", score: 8 },
  { name: "Go", score: 7 },
];

export interface Bar extends Skill {
  /** Fraction of the track; above 1 the bar runs past the end. */
  length: number;
  /** Comedic Talent: the joke bar, which shoots in after the real ones. */
  joke: boolean;
}

/** Comedic Talent's score: the highest real score plus one. Derived, never stored. */
export const comedicScore = (real: readonly Skill[]): number =>
  Math.max(0, ...real.map((s) => s.score)) + 1;

/** The real bars followed by Comedic Talent, with their track lengths. */
export function skillBars(real: readonly Skill[]): Bar[] {
  const bar = (s: Skill, joke: boolean): Bar => ({
    ...s,
    length: s.score / 10,
    joke,
  });
  return [
    ...real.map((s) => bar(s, false)),
    bar({ name: "Comedic Talent", score: comedicScore(real) }, true),
  ];
}

/** The joke bar's ease, GSAP's back.out(JOKE_BACK): how far it overshoots. */
export const JOKE_BACK = 2.2;

/**
 * The most back.out(s) reaches, as a multiple of where it rests: with
 * u = t - 1 it is 1 + (s + 1)u³ + su², highest at u = -2s / (3(s + 1)).
 */
export function backOutPeak(s: number): number {
  const u = (-2 * s) / (3 * (s + 1));
  return 1 + (s + 1) * u ** 3 + s * u ** 2;
}

/**
 * The share of its column a phone gives a track: at the joke bar's peak the
 * longest bar ends 1% short of the column's edge, so its overshoot shows whole
 * and never widens the window (#127).
 */
export const phoneTrack = (bars: readonly Bar[]): number =>
  0.99 / (Math.max(1, ...bars.map((b) => b.length)) * backOutPeak(JOKE_BACK));

export type LanguageLevel =
  | "native"
  | "proficient"
  | "conversational"
  | "rudimentary";

export const languages: readonly { name: string; level: LanguageLevel }[] = [
  { name: "English", level: "native" },
  { name: "Telugu", level: "native" },
  { name: "Hindi", level: "proficient" },
  { name: "Japanese", level: "conversational" },
  { name: "French", level: "rudimentary" },
];

export interface Hobby {
  name: string;
  /** On the resume: bold in the accent. */
  resume: boolean;
}

/** `tree ~/hobbies`: three folders, nine hobbies. */
export const hobbies: readonly { folder: string; items: readonly Hobby[] }[] = [
  {
    folder: "outdoors",
    items: [
      { name: "hiking", resume: true },
      { name: "football", resume: false },
    ],
  },
  {
    folder: "making",
    items: [
      { name: "photography", resume: true },
      { name: "cooking", resume: true },
      { name: "watchmaking", resume: false },
      { name: "guitar", resume: false },
    ],
  },
  {
    folder: "thinking",
    items: [
      { name: "reading", resume: true },
      { name: "pub quizzes", resume: false },
      { name: "chess", resume: false },
    ],
  },
];

/** The five hobbies off the resume, in the founder's order, football strongest,
 *  each with its share (%) of the foreground colour over the background. */
export const hobbyFades: readonly { name: string; fg: number }[] = [
  "football",
  "watchmaking",
  "pub quizzes",
  "chess",
  "guitar",
].map((name, i) => ({ name, fg: 92 - i * 13 }));
