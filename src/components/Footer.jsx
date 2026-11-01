import Logo from './Logo'

export default function Footer({ navigate }) {
  return (
    <footer className="border-t border-line/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Logo onClick={() => navigate('home')} />
        <p>© {new Date().getFullYear()} PulseFit. Train smarter. Get stronger.</p>
      </div>
    </footer>
  )
}
