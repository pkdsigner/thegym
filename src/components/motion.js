// Shared Framer Motion variants so every screen animates the same way.
export const ease = [0.22, 1, 0.36, 1]

export const page = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease, staggerChildren: 0.06 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
