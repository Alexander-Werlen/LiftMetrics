import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('./routes/today.tsx'),
  route('history', './routes/history.tsx'),
  route('plan', './routes/plan.tsx'),
  route('*', './routes/not-found.tsx'),
] satisfies RouteConfig;
