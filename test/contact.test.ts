import { describe, expect, test } from "bun:test";
import {
  CONTACT_CHANNELS,
  CONTACT_LINE,
  COPIED_LINE,
} from "../src/lib/contact";

describe("the contact line", () => {
  test("is the spec's wording, word for word", () => {
    expect(CONTACT_LINE).toBe(
      "Feel free to get in touch. I always love hearing what people are building, and whether I can help.",
    );
  });

  test("copying prints a plain confirmation line", () => {
    expect(COPIED_LINE).toBe("copied to clipboard");
  });
});

describe("the channels", () => {
  test("are email, linkedin, github and resume, in that order", () => {
    expect(CONTACT_CHANNELS.map((c) => c.label)).toEqual([
      "email",
      "linkedin",
      "github",
      "resume",
    ]);
  });

  test("show their real destinations as text", () => {
    expect(CONTACT_CHANNELS.map((c) => c.text)).toEqual([
      "shrujancheruku@gmail.com",
      "linkedin.com/in/shrujancheruku",
      "github.com/shrujancheruku",
      "shrujan-cheruku-resume.pdf",
    ]);
  });

  test("email is a mailto link that can be copied; the rest open their destination", () => {
    const [email, linkedin, github, resume] = CONTACT_CHANNELS;
    expect(email).toMatchObject({
      href: "mailto:shrujancheruku@gmail.com",
      copyable: true,
      newTab: false,
    });
    expect(linkedin).toMatchObject({
      href: "https://www.linkedin.com/in/shrujancheruku",
      copyable: false,
      newTab: true,
    });
    expect(github).toMatchObject({
      href: "https://github.com/shrujancheruku",
      copyable: false,
      newTab: true,
    });
    expect(resume).toMatchObject({
      href: "/shrujan-cheruku-resume.pdf",
      copyable: false,
      newTab: false,
    });
  });

  test("publish no phone number, form, booking or availability", () => {
    const all = CONTACT_CHANNELS.map((c) => c.href).join(" ");
    expect(all).not.toMatch(/^tel:/m);
    expect(all).not.toMatch(/\+?\d{7,}/);
    expect(all).not.toMatch(/calendly|cal\.com|book/i);
  });
});
