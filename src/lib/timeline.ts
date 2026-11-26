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
      "Travelling, time with family, and helping friends launch their products. 10/10 would recommend to a friend.",
    technologies: [],
  },
  {
    roles: [{ dates: "Jan 2023 – Nov 2025", title: "Lead Engineer" }],
    organisation: "OpenBench",
    description:
      "First engineering hire at a computational chemistry startup. I built the workflows that ran cutting-edge AI models across trillions of compounds to find new drug candidates.",
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
      "Helped design and build a new cloud-native microservice platform for unsupervised machine learning on unstructured customer data. I mentored other engineers and set up the tooling we used for documentation and architecture decisions.",
    technologies: [
      "AWS",
      "Go",
      "Docker",
      "Kubernetes + Helm",
      "gRPC",
      "React + TypeScript",
    ],
  },
  {
    roles: [{ dates: "Nov 2019 – Oct 2020", title: "Platform Engineer" }],
    organisation: "Ibotta",
    description:
      "Built high-throughput microservices for critical transaction data at Denver's first unicorn, an app with over 23m downloads, and kept them within their uptime SLAs.",
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
      "Joined a two-person engineering team at a health-tech startup and was the solo lead within six months. I delivered an NLP chatbot pilot to clients, then built the APIs, visualisations, demos and scrapers behind the pivot to a data science product.",
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
      { name: "watchmaking", resume: true },
      { name: "cooking", resume: false },
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
  "cooking",
  "pub quizzes",
  "chess",
  "guitar",
].map((name, i) => ({ name, fg: 92 - i * 13 }));
