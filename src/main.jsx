import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import './index.css'

// No <StrictMode>: its development-only double mount makes Recharts skip its grow-in animations,
// so the dev server would look different from the real app. Production behaves the same either way.
createRoot(document.getElementById('root')).render(
  <MotionConfig reducedMotion="user">
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </MotionConfig>,
)
