import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';

export const orderCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  const intersections = rectIntersection(args);
  return intersections.length > 0 ? intersections : closestCenter(args);
};
