-- PulseFit sample data. Safe to run repeatedly: exercises are upserted by name,
-- classes are unique per (title, start_time).

INSERT INTO exercises (name, muscle_group, sets, reps, difficulty, rest_seconds, description) VALUES
  -- Chest
  ('Barbell Bench Press',     'Chest', 4, '6–8',      'Advanced',     120, 'The king of upper-body pressing. Shoulder blades pinned, bar to mid-chest, drive through the floor.'),
  ('Incline Dumbbell Press',  'Chest', 3, '8–10',     'Intermediate',  90, 'Targets the upper chest. Set the bench to 30° and lower the dumbbells under control.'),
  ('Tempo Push-Up',           'Chest', 3, '12–15',    'Beginner',      60, 'Three seconds down, one second up. Keep a rigid plank from head to heels.'),
  ('Cable Fly',               'Chest', 3, '12',       'Intermediate',  60, 'Soft elbows, big hug. Squeeze the chest for a beat at the middle.'),
  ('Weighted Dips',           'Chest', 3, '8–10',     'Advanced',      90, 'Lean forward slightly to bias the chest. Lower until shoulders are just below elbows.'),
  -- Back
  ('Conventional Deadlift',   'Back',  5, '3–5',      'Advanced',     180, 'Brace hard, push the floor away and lock out with your glutes. Bar stays close.'),
  ('Weighted Pull-Up',        'Back',  4, '6–8',      'Advanced',     120, 'Full hang to chin over bar. Lead with the chest and avoid kipping.'),
  ('Single-Arm Dumbbell Row', 'Back',  3, '10/side',  'Beginner',      60, 'Pull the elbow toward your hip and pause at the top. Keep your back flat.'),
  ('Lat Pulldown',            'Back',  3, '10–12',    'Beginner',      75, 'Drive elbows down to your ribs. Control the bar on the way up.'),
  ('Chest-Supported Row',     'Back',  3, '10',       'Intermediate',  75, 'Removes the lower back from the equation so your lats and mid-back do all the work.'),
  -- Legs
  ('Back Squat',              'Legs',  5, '5',        'Advanced',     150, 'Big breath, brace, sit between your heels and stand up tall. Knees track over toes.'),
  ('Romanian Deadlift',       'Legs',  4, '8',        'Intermediate', 120, 'Hinge at the hips with soft knees until you feel a deep hamstring stretch.'),
  ('Walking Lunge',           'Legs',  3, '12/side',  'Beginner',      75, 'Long strides, upright torso, back knee kisses the floor.'),
  ('Bulgarian Split Squat',   'Legs',  3, '10/side',  'Intermediate',  90, 'Rear foot on a bench. Brutal, effective, and great for balance.'),
  ('Goblet Squat',            'Legs',  3, '12',       'Beginner',      60, 'Hold a dumbbell at your chest and squat deep with elbows inside your knees.'),
  -- Arms
  ('Incline Dumbbell Curl',   'Arms',  3, '10–12',    'Beginner',      60, 'Arms hang behind your body for a big biceps stretch. No swinging.'),
  ('EZ-Bar Skull Crusher',    'Arms',  3, '10',       'Intermediate',  75, 'Lower the bar toward your forehead, elbows pointing to the ceiling.'),
  ('Hammer Curl',             'Arms',  3, '12',       'Beginner',      60, 'Neutral grip hits the brachialis and forearms for thicker arms.'),
  ('Close-Grip Bench Press',  'Arms',  4, '6–8',      'Advanced',     120, 'Hands shoulder-width, elbows tucked. A heavy triceps builder.'),
  ('Cable Triceps Pushdown',  'Arms',  3, '12–15',    'Beginner',      45, 'Pin your elbows to your sides and squeeze at full lockout.'),
  -- Core
  ('RKC Plank',               'Core',  3, '30s',      'Beginner',      45, 'Squeeze glutes, quads and fists as hard as you can. Harder than it looks.'),
  ('Hanging Leg Raise',       'Core',  3, '10–12',    'Advanced',      60, 'From a dead hang, raise your legs to hip height without swinging.'),
  ('Pallof Press',            'Core',  3, '12/side',  'Intermediate',  45, 'Anti-rotation work. Press the cable straight out and resist the twist.'),
  ('Dead Bug',                'Core',  3, '10/side',  'Beginner',      45, 'Lower back glued to the floor while you extend opposite arm and leg.'),
  ('Ab Wheel Rollout',        'Core',  3, '8–10',     'Advanced',      60, 'Roll out as far as you can while keeping your hips from sagging.'),
  -- Cardio
  ('Row Erg Intervals',       'Cardio', 6, '250m',    'Intermediate',  60, 'Legs, body, arms. Hold a hard but repeatable pace on every interval.'),
  ('Sled Push',               'Cardio', 5, '20m',     'Advanced',      90, 'Low body angle, short powerful steps. Lungs and legs on fire.'),
  ('Assault Bike Sprints',    'Cardio', 8, '20s',     'Advanced',      40, 'All-out effort for 20 seconds. Push and pull with arms and legs.'),
  ('Jump Rope',               'Cardio', 5, '60s',     'Beginner',      30, 'Light on the balls of your feet with small, quick bounces.'),
  ('Incline Treadmill Walk',  'Cardio', 3, '5 min',   'Beginner',      30, 'Set a 10–12% incline and walk briskly. Low impact, high burn.')
ON CONFLICT (name) DO UPDATE SET
  muscle_group = EXCLUDED.muscle_group,
  sets         = EXCLUDED.sets,
  reps         = EXCLUDED.reps,
  difficulty   = EXCLUDED.difficulty,
  rest_seconds = EXCLUDED.rest_seconds,
  description  = EXCLUDED.description;

-- 10 classes spread across the current week (Monday-based).
INSERT INTO classes (title, coach_name, start_time, duration_minutes, capacity, intensity)
SELECT c.title, c.coach_name, date_trunc('week', now()) + c.offset_from_monday, c.duration_minutes, c.capacity, c.intensity
FROM (VALUES
  ('HIIT Sunrise Burn',      'Maya Chen',    INTERVAL '0 days 06:30', 45, 20, 'High'),
  ('Lunch Flow Yoga',        'Jonah Reed',   INTERVAL '0 days 12:15', 50, 18, 'Low'),
  ('Climb & Sprint Spin',    'Lena Kraus',   INTERVAL '1 day 07:00',  45, 24, 'High'),
  ('Boxing Fundamentals',    'Dre Okafor',   INTERVAL '1 day 18:30',  60, 16, 'Medium'),
  ('Strength Club',          'Sam Ortiz',    INTERVAL '2 days 18:00', 60, 14, 'Medium'),
  ('Mobility Reset Yoga',    'Priya Nair',   INTERVAL '3 days 06:45', 40, 18, 'Low'),
  ('Tabata Inferno HIIT',    'Maya Chen',    INTERVAL '3 days 19:00', 30, 20, 'High'),
  ('Friday Night Lights Spin','Lena Kraus',  INTERVAL '4 days 17:30', 50, 24, 'High'),
  ('Pads & Power Boxing',    'Dre Okafor',   INTERVAL '5 days 09:00', 50, 16, 'High'),
  ('Sunday Slow Burn Yoga',  'Priya Nair',   INTERVAL '6 days 10:30', 75, 18, 'Low')
) AS c (title, coach_name, offset_from_monday, duration_minutes, capacity, intensity)
ON CONFLICT (title, start_time) DO NOTHING;
