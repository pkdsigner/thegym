import { motion } from 'framer-motion'
import { fadeUp } from './motion'

export default function GlassCard({ className = '', hover = false, children, ...rest }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={hover ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`glass relative overflow-hidden ${hover ? 'transition-shadow duration-300 hover:shadow-glow' : ''} ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
