import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const gapClasses = {
  0: 'gap-0',
  1: 'gap-1',
  1.5: 'gap-1.5',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
};

type LayoutProps = ComponentProps<'div'> & {
  asChild?: boolean;
  gap?: keyof typeof gapClasses;
};

/** Arranges children horizontally with centered cross-axis alignment. */
export function Row({
  asChild,
  gap = 2,
  wrap,
  className,
  ...props
}: LayoutProps & { wrap?: boolean }) {
  const Component = asChild ? Slot : 'div';
  return (
    <Component
      className={cn('flex items-center', gapClasses[gap], wrap && 'flex-wrap', className)}
      {...props}
    />
  );
}

/** Stacks children vertically and allows shrinking within a constrained parent. */
export function Col({ asChild, gap = 2, className, ...props }: LayoutProps) {
  const Component = asChild ? Slot : 'div';
  return (
    <Component
      className={cn('flex min-h-0 min-w-0 flex-col', gapClasses[gap], className)}
      {...props}
    />
  );
}

/** Provides shared spacing for a grid whose tracks are defined by the caller. */
export function Grid({ asChild, gap = 2, className, ...props }: LayoutProps) {
  const Component = asChild ? Slot : 'div';
  return <Component className={cn('grid min-w-0', gapClasses[gap], className)} {...props} />;
}
