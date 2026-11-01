import { motion } from 'framer-motion'
import { fadeUp } from './motion'

export default function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <motion.header variants={fadeUp} className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="label mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-muted">{subtitle}</p>}
      </div>
      {children}
    </motion.header>
  )
}
