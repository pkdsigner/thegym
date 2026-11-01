// Demo data for the screens that aren't backed by the database yet (Progress, Classes, Profile badges).
// Dashboard, Library, Live Workout and landing stats come from /api.

export const user = {
  name: 'Alex Rivera',
  handle: '@alexlifts',
  initials: 'AR',
  membership: 'Pulse Elite',
  memberSince: 'March 2024',
  level: 14,
  xp: 7420,
  xpNext: 9000,
  streak: 12,
  bestStreak: 31,
  weeklyGoal: 5,
}

export const strengthHistory = [
  { month: 'Apr', bench: 70, squat: 100, deadlift: 130 },
  { month: 'May', bench: 72.5, squat: 105, deadlift: 137.5 },
  { month: 'Jun', bench: 75, squat: 110, deadlift: 142.5 },
  { month: 'Jul', bench: 77.5, squat: 117.5, deadlift: 150 },
  { month: 'Aug', bench: 80, squat: 122.5, deadlift: 155 },
  { month: 'Sep', bench: 85, squat: 130, deadlift: 165 },
  { month: 'Oct', bench: 90, squat: 137.5, deadlift: 172.5 },
]

export const personalRecords = [
  { lift: 'Deadlift', value: 172.5, unit: 'kg', date: 'Oct 18', delta: '+7.5', tier: 'gold' },
  { lift: 'Back Squat', value: 137.5, unit: 'kg', date: 'Oct 12', delta: '+7.5', tier: 'gold' },
  { lift: 'Bench Press', value: 90, unit: 'kg', date: 'Oct 21', delta: '+5', tier: 'silver' },
  { lift: '5K Run', value: '22:41', unit: '', date: 'Sep 30', delta: '−0:48', tier: 'silver' },
  { lift: 'Pull-Ups', value: 18, unit: 'reps', date: 'Sep 14', delta: '+3', tier: 'bronze' },
  { lift: 'Plank', value: '3:20', unit: '', date: 'Aug 29', delta: '+0:35', tier: 'bronze' },
]

export const classTypes = {
  // color: accents in both themes · ink: text colour on the light theme (≥4.5:1 contrast)
  Yoga: { color: '#9B7BFF', ink: '#5b3fd1', emoji: '🧘' },
  HIIT: { color: '#FF7A3D', ink: '#a3360a', emoji: '⚡' },
  Spin: { color: '#22E4F2', ink: '#00707f', emoji: '🚴' },
  Boxing: { color: '#C6FF3D', ink: '#3d6b00', emoji: '🥊' },
}

export const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const classes = [
  { id: 'c1', day: 'Mon', time: '06:30', type: 'HIIT', name: 'Sunrise Burn', coach: 'Maya Chen', duration: 45, spots: 4, capacity: 20, room: 'Studio A' },
  { id: 'c2', day: 'Mon', time: '12:15', type: 'Yoga', name: 'Lunch Flow', coach: 'Jonah Reed', duration: 50, spots: 9, capacity: 18, room: 'Zen Room' },
  { id: 'c3', day: 'Mon', time: '18:30', type: 'Boxing', name: 'Fight Club Fundamentals', coach: 'Dre Okafor', duration: 60, spots: 0, capacity: 16, room: 'Ring' },
  { id: 'c4', day: 'Tue', time: '07:00', type: 'Spin', name: 'Climb & Sprint', coach: 'Lena Kraus', duration: 45, spots: 2, capacity: 24, room: 'Ride Lab' },
  { id: 'c5', day: 'Tue', time: '19:00', type: 'HIIT', name: 'Tabata Inferno', coach: 'Maya Chen', duration: 30, spots: 11, capacity: 20, room: 'Studio A' },
  { id: 'c6', day: 'Wed', time: '06:45', type: 'Yoga', name: 'Mobility Reset', coach: 'Priya Nair', duration: 40, spots: 7, capacity: 18, room: 'Zen Room' },
  { id: 'c7', day: 'Wed', time: '18:00', type: 'Spin', name: 'Rhythm Ride', coach: 'Lena Kraus', duration: 45, spots: 5, capacity: 24, room: 'Ride Lab' },
  { id: 'c8', day: 'Wed', time: '19:30', type: 'Boxing', name: 'Pads & Power', coach: 'Dre Okafor', duration: 50, spots: 3, capacity: 16, room: 'Ring' },
  { id: 'c9', day: 'Thu', time: '12:00', type: 'HIIT', name: 'Express Shred', coach: 'Sam Ortiz', duration: 30, spots: 14, capacity: 20, room: 'Studio B' },
  { id: 'c10', day: 'Thu', time: '18:30', type: 'Yoga', name: 'Power Vinyasa', coach: 'Jonah Reed', duration: 60, spots: 1, capacity: 18, room: 'Zen Room' },
  { id: 'c11', day: 'Fri', time: '07:00', type: 'Boxing', name: 'Shadow & Shred', coach: 'Dre Okafor', duration: 45, spots: 8, capacity: 16, room: 'Ring' },
  { id: 'c12', day: 'Fri', time: '17:30', type: 'Spin', name: 'Friday Night Lights', coach: 'Lena Kraus', duration: 50, spots: 6, capacity: 24, room: 'Ride Lab' },
  { id: 'c13', day: 'Sat', time: '09:00', type: 'HIIT', name: 'Weekend Warrior', coach: 'Sam Ortiz', duration: 60, spots: 10, capacity: 24, room: 'Studio A' },
  { id: 'c14', day: 'Sat', time: '10:30', type: 'Yoga', name: 'Slow Burn Yin', coach: 'Priya Nair', duration: 75, spots: 12, capacity: 18, room: 'Zen Room' },
  // Sunday intentionally empty to show the empty state
]

export const achievements = [
  { id: 'a1', name: 'First Rep', desc: 'Complete your first workout', icon: 'Sparkles', unlocked: true },
  { id: 'a2', name: 'On Fire', desc: '7-day streak', icon: 'Flame', unlocked: true },
  { id: 'a3', name: 'Iron Will', desc: '50 workouts logged', icon: 'Dumbbell', unlocked: true },
  { id: 'a4', name: 'Early Bird', desc: '10 workouts before 7am', icon: 'Sunrise', unlocked: true },
  { id: 'a5', name: 'PR Machine', desc: 'Set 5 personal records', icon: 'Trophy', unlocked: true },
  { id: 'a6', name: 'Class Act', desc: 'Attend 20 classes', icon: 'Calendar', unlocked: false, progress: 0.65 },
  { id: 'a7', name: 'Marathoner', desc: '1,000 active minutes / month', icon: 'Timer', unlocked: false, progress: 0.42 },
  { id: 'a8', name: 'Legend', desc: '30-day streak', icon: 'Crown', unlocked: false, progress: 0.4 },
]

export const profileStats = [
  { label: 'Workouts', value: 186 },
  { label: 'Hours', value: 142 },
  { label: 'Classes', value: 13 },
  { label: 'PRs', value: 24 },
]

export const quotes = [
  { text: 'The only bad workout is the one that didn’t happen.', author: 'Unknown' },
  { text: 'Strength doesn’t come from what you can do. It comes from overcoming what you once thought you couldn’t.', author: 'Rikki Rogers' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Augusta F. Kantra' },
  { text: 'Success isn’t always about greatness. It’s about consistency.', author: 'Dwayne Johnson' },
  { text: 'Take care of your body. It’s the only place you have to live.', author: 'Jim Rohn' },
  { text: 'You don’t have to be extreme, just consistent.', author: 'Unknown' },
  { text: 'Sweat is just fat crying.', author: 'Gym folklore' },
]
