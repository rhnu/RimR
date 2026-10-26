import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '@/app/router';
import { OrderPage } from '@/features/order/OrderPage';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/order',
  component: OrderPage,
});
