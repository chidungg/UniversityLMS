import {
  Code2,
  Database,
  Globe,
  Cpu,
  Network,
  Layers,
  BookOpen,
} from "lucide-react";

/**
 * Subject theme palette for academic courses.
 * Uses refined, high-contrast WCAG AA compliant colors without garish gradients.
 */
export const courseThemes = {
  "DEMO-PRG101": {
    code: "DEMO-PRG101",
    shortName: "Programming",
    color: "#155E95", // Sapphire Academic Blue
    colorLight: "#EAF3FA",
    border: "#BAE6FD",
    icon: Code2,
    badgeBg: "#EFF6FF",
    badgeColor: "#1E40AF",
  },
  "DEMO-DB201": {
    code: "DEMO-DB201",
    shortName: "Databases",
    color: "#0F766E", // Academic Teal
    colorLight: "#F0FDFA",
    border: "#99F6E4",
    icon: Database,
    badgeBg: "#F0FDFA",
    badgeColor: "#0F766E",
  },
  "DEMO-WEB301": {
    code: "DEMO-WEB301",
    shortName: "Web Dev",
    color: "#4338CA", // Deep Indigo
    colorLight: "#EEF2FF",
    border: "#C7D2FE",
    icon: Globe,
    badgeBg: "#EEF2FF",
    badgeColor: "#4338CA",
  },
  "DEMO-AI201": {
    code: "DEMO-AI201",
    shortName: "Artificial Intelligence",
    color: "#B45309", // Warm Amber
    colorLight: "#FFFBEB",
    border: "#FDE68A",
    icon: Cpu,
    badgeBg: "#FFFBEB",
    badgeColor: "#92400E",
  },
  "DEMO-NET201": {
    code: "DEMO-NET201",
    shortName: "Networks",
    color: "#047857", // Forest Emerald
    colorLight: "#ECFDF5",
    border: "#A7F3D0",
    icon: Network,
    badgeBg: "#ECFDF5",
    badgeColor: "#047857",
  },
  "DEMO-SWE301": {
    code: "DEMO-SWE301",
    shortName: "Software Eng",
    color: "#334155", // Modern Slate
    colorLight: "#F1F5F9",
    border: "#CBD5E1",
    icon: Layers,
    badgeBg: "#F8FAFC",
    badgeColor: "#334155",
  },
};

const defaultTheme = {
  code: "COURSE",
  shortName: "Academic Course",
  color: "#155E95",
  colorLight: "#EAF3FA",
  border: "#BAE6FD",
  icon: BookOpen,
  badgeBg: "#EFF6FF",
  badgeColor: "#155E95",
};

/**
 * Returns subject theme tokens based on courseCode or course object.
 */
export const getCourseTheme = (courseOrCode) => {
  if (!courseOrCode) return defaultTheme;
  const code = typeof courseOrCode === "string" ? courseOrCode : courseOrCode.courseCode;
  return courseThemes[code] || defaultTheme;
};
