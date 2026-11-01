import { Activity, Calendar, Dumbbell, LayoutDashboard, Timer, User } from 'lucide-react'

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { id: 'library', label: 'Workouts', short: 'Library', icon: Dumbbell },
  { id: 'live', label: 'Live Workout', short: 'Live', icon: Timer },
  { id: 'progress', label: 'Progress', short: 'Progress', icon: Activity },
  { id: 'classes', label: 'Classes', short: 'Classes', icon: Calendar },
  { id: 'profile', label: 'Profile', short: 'Profile', icon: User },
]
