const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5" /></>,
  instructor: <><path d="m2 8 10-5 10 5-10 5-10-5ZM5 10v6c4 3 10 3 14 0v-6M22 8v7" /></>,
  classes: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M7 8h10M7 12h6" /></>,
  enroll: <><circle cx="8" cy="8" r="3" /><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-12 2 2 4-5" /></>,
  chart: <><path d="M4 3v18h17M8 16v-4m5 4V7m5 9v-6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5M8 12h13" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5M5.7 7a7 7 0 0 1 12-1L20 9M4 15l2.3 3a7 7 0 0 0 12-1" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  book: <><path d="M12 6.5C9 4.5 5.5 4 2 5v14c3.5-1 7-.5 10 1.5 3-2 6.5-2.5 10-1.5V5c-3.5-1-7-.5-10 1.5Z" /><path d="M12 6.5v14M5.5 8.5l3 .5M15.5 9l3-.5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4.1M6.3 6.3A20 20 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5-1.2M10 10a3 3 0 0 0 4 4" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01" /></>,
  shield: <><path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z" /><path d="m8.5 11.5 2.5 2.5 4.5-5" /></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
}

export default function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
