import { createContext } from 'react';
import type {
  OrderActionsValue,
  OrderContentValue,
  OrderDragValue,
  OrderInteractionValue,
} from './workspace-types';

export const OrderContentContext = createContext<OrderContentValue | null>(null);
export const OrderInteractionContext = createContext<OrderInteractionValue | null>(null);
export const OrderActionsContext = createContext<OrderActionsValue | null>(null);
export const OrderDragContext = createContext<OrderDragValue | null>(null);
