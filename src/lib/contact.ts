// The contact workspace's words and channels: pure, no DOM.
// Wording is from the spec (#29) and the contact mechanics ticket (#18).

/** The line under `$ contact`, before the channels. */
export const CONTACT_LINE =
  "Feel free to get in touch. I always love hearing what people are building, and whether I can help.";

/** Printed in the terminal after the email is copied. */
export const COPIED_LINE = "copied to clipboard";

export interface Channel {
  label: string;
  /** What the line shows. */
  text: string;
  href: string;
  /** The email gets a copy button beside it. */
  copyable: boolean;
  /** Opens in a new tab. */
  newTab: boolean;
}

/** Email, LinkedIn, GitHub and the resume, in that order. */
export const CONTACT_CHANNELS: readonly Channel[] = [
  {
    label: "email",
    text: "shrujancheruku@gmail.com",
    href: "mailto:shrujancheruku@gmail.com",
    copyable: true,
    newTab: false,
  },
  {
    label: "linkedin",
    text: "linkedin.com/in/shrujancheruku",
    href: "https://www.linkedin.com/in/shrujancheruku",
    copyable: false,
    newTab: true,
  },
  {
    label: "github",
    text: "github.com/shrujancheruku",
    href: "https://github.com/shrujancheruku",
    copyable: false,
    newTab: true,
  },
  {
    label: "resume",
    text: "shrujan-cheruku-resume.pdf",
    href: "/shrujan-cheruku-resume.pdf",
    copyable: false,
    newTab: false,
  },
];
