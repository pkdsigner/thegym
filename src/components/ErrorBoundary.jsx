import { Component } from 'react'
import { HeartPulse, RotateCcw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('PulseFit crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div className="glass max-w-md p-8">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ember/15">
            <HeartPulse className="h-7 w-7 text-ember" />
          </div>
          <h2 className="text-2xl font-bold">Oof, we pulled a muscle.</h2>
          <p className="mt-2 text-muted">
            Something went wrong while loading this screen. Your progress is safe — give it a quick reload.
          </p>
          <button className="btn-primary mt-6" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" /> Reload PulseFit
          </button>
        </div>
      </div>
    )
  }
}
