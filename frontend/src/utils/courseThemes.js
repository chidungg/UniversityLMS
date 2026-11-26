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
 * Harmonious modern education subject accents.
 * All text remains 100% black (#111111); color is applied only to flat borders and pastel badges.
 */
export const courseThemes = {
  "DEMO-PRG101": {
    code: "DEMO-PRG101",
    shortName: "Programming",
    icon: Code2,
    color: "#2563EB",
    colorLight: "#DBEAFE",
    border: "#93C5FD",
    badgeBg: "#DBEAFE",
    badgeColor: "#111111",
  },
  "DEMO-DB201": {
    code: "DEMO-DB201",
    shortName: "Databases",
    icon: Database,
    color: "#0D9488",
    colorLight: "#CCFBF1",
    border: "#5EEAD4",
    badgeBg: "#CCFBF1",
    badgeColor: "#111111",
  },
  "DEMO-WEB301": {
    code: "DEMO-WEB301",
    shortName: "Web Dev",
    icon: Globe,
    color: "#4F46E5",
    colorLight: "#E0E7FF",
    border: "#A5B4FC",
    badgeBg: "#E0E7FF",
    badgeColor: "#111111",
  },
  "DEMO-AI201": {
    code: "DEMO-AI201",
    shortName: "Artificial Intelligence",
    icon: Cpu,
    color: "#7C3AED",
    colorLight: "#EDE9FE",
    border: "#C4B5FD",
    badgeBg: "#EDE9FE",
    badgeColor: "#111111",
  },
  "DEMO-NET201": {
    code: "DEMO-NET201",
    shortName: "Networks",
    icon: Network,
    color: "#0284C7",
    colorLight: "#E0F2FE",
    border: "#7DD3FC",
    badgeBg: "#E0F2FE",
    badgeColor: "#111111",
  },
  "DEMO-SWE301": {
    code: "DEMO-SWE301",
    shortName: "Software Eng",
    icon: Layers,
    color: "#059669",
    colorLight: "#D1FAE5",
    border: "#6EE7B7",
    badgeBg: "#D1FAE5",
    badgeColor: "#111111",
  },
};

const defaultTheme = {
  code: "COURSE",
  shortName: "Academic Course",
  icon: BookOpen,
  color: "#2563EB",
  colorLight: "#DBEAFE",
  border: "#93C5FD",
  badgeBg: "#DBEAFE",
  badgeColor: "#111111",
};

export const getCourseTheme = (courseOrCode) => {
  if (!courseOrCode) return defaultTheme;
  const code = typeof courseOrCode === "string" ? courseOrCode : courseOrCode.courseCode;
  return courseThemes[code] || defaultTheme;
};
