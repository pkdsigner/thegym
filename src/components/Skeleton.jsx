export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />
}

export function SkeletonCard({ className = '', children }) {
  return (
    <div className={`glass relative overflow-hidden p-6 ${className}`} aria-busy="true" aria-label="Loading">
      {children}
    </div>
  )
}
