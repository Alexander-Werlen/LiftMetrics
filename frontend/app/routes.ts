import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('./routes/today.tsx'),
  route('workout/:id', './routes/workout.tsx'),
  route('history/workouts/:id', './routes/history-workout-detail.tsx'),
  route('history/workouts', './routes/history-workouts.tsx'),
  route('history', './routes/history.tsx'),
  route('plan', './routes/plan.tsx'),
  route('*', './routes/not-found.tsx'),
] satisfies RouteConfig;
