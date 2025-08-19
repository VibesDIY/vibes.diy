import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const menuBarVariants = cva('flex items-stretch transition-all duration-300 ease-in-out', {
  variants: {
    variant: {
      default: 'p-0',
      contained:
        'relative overflow-visible rounded-full border-2 border-black bg-white h-12 pl-0 pr-[3px] py-0',
    },
    size: { default: '', sm: 'p-[2px]', lg: 'p-2' },
    collapsed: { true: 'w-auto', false: '' },
  },
  defaultVariants: { variant: 'default', size: 'default', collapsed: false },
});

const menuItemVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-border shadow-[var(--shadow-shadow)]',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        active: 'bg-black text-white border-black hover:bg-gray-800',
        neutral: 'bg-secondary-background text-foreground hover:bg-secondary-background/80',
        electric: 'bg-yellow-300 text-black border-black hover:bg-yellow-400',
        hot: 'bg-pink-400 text-black border-black hover:bg-pink-300',
        cyber: 'bg-lime-400 text-black border-black hover:bg-lime-300',
        retro: 'bg-orange-400 text-black border-black hover:bg-orange-300',
        cool: 'bg-cyan-400 text-black border-black hover:bg-cyan-300',
        dream: 'bg-violet-400 text-black border-black hover:bg-violet-300',
        danger: 'bg-red-400 text-black border-black hover:bg-red-300',
        game: 'bg-pink-400 text-black border-black hover:bg-pink-300',
        health: 'bg-green-500 text-black border-black hover:bg-green-400',
        social: 'bg-yellow-400 text-black border-black hover:bg-yellow-300',
        education: 'bg-blue-500 text-black border-black hover:bg-blue-400',
        ghost:
          'bg-transparent border-transparent text-foreground hover:bg-accent hover:text-accent-foreground shadow-none',
      },
      size: {
        default: 'px-4 py-2 text-sm',
        sm: 'px-3 py-1 text-xs',
        lg: 'px-6 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface MenuBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof menuBarVariants> {
  children: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  logo?: React.ReactNode;
}

export interface MenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof menuItemVariants> {
  children?: React.ReactNode;
  active?: boolean;
  icon?: React.ReactNode;
}

// Change to the vibes logo later
const VibesLogo = ({
  className,
  fullHeight = false,
  rail = '#fff',
}: {
  className?: string;
  fullHeight?: boolean;
  rail?: string;
}) => {
  return (
    <div className={cn('flex items-center', className)}>
      <div
        className={cn(
          'relative isolate flex items-center justify-center overflow-visible rounded-l-full bg-black font-bold text-white',
          fullHeight ? 'h-full min-w-[96px] px-4' : 'h-10 px-3'
        )}
      >
        <span className="relative z-10 tracking-wide">VIBES</span>
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-0 z-10 aspect-square translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: rail,
            height: 'calc(100% + 2px)',
            clipPath: 'inset(0 50% 0 0)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-0 z-20 aspect-square translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            height: '100%',
            border: '2px solid #000',
            clipPath: 'inset(0 50% 0 0)',
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
};

const CloseButton = ({ onClick, className }: { onClick?: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      'mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white',
      className
    )}
  >
    <span className="text-sm font-bold">×</span>
  </button>
);

// Expand Button Component
const ExpandButton = ({ onClick, className }: { onClick?: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      'relative z-50 flex h-10 w-10 items-center justify-center rounded-r-full bg-white text-black',
      className
    )}
    aria-label="Expand"
  >
    <span className="text-2xl leading-none">↔</span>
  </button>
);

const MenuBar = React.forwardRef<HTMLDivElement, MenuBarProps>(
  (
    {
      className,
      variant,
      size,
      children,
      collapsible = false,
      collapsed = false,
      onToggleCollapse,
      logo,
      ...props
    },
    ref
  ) => {
    const [isCollapsed, setIsCollapsed] = React.useState(collapsed);

    const handleToggle = () => {
      setIsCollapsed(!isCollapsed);
      onToggleCollapse?.();
    };

    const actuallyCollapsed = collapsed !== undefined ? collapsed : isCollapsed;

    if (collapsible && actuallyCollapsed) {
      return (
        <div
          className={cn(
            'border-border bg-background flex h-12 w-fit items-center overflow-hidden rounded-full border-2 shadow-[var(--shadow-shadow)] transition-all duration-300 ease-in-out',
            className
          )}
          ref={ref}
          {...props}
        >
          {logo || <VibesLogo className="h-full" fullHeight rail="#fff" />}
          <ExpandButton onClick={handleToggle} className="h-full" />
        </div>
      );
    }

    return (
      <div
        className={cn(menuBarVariants({ variant, size }), 'gap-0', className)}
        ref={ref}
        {...props}
      >
        {collapsible && (logo || <VibesLogo className="h-full" fullHeight rail="#fff" />)}
        <div className="relative flex h-full flex-1 items-center gap-2 px-3 py-[3px]">
          {children}
          {collapsible && (
            <CloseButton
              onClick={handleToggle}
              className="absolute top-1/2 right-3 -translate-y-1/2"
            />
          )}
        </div>
      </div>
    );
  }
);
MenuBar.displayName = 'MenuBar';

const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ className, variant, size, active, icon, children, ...props }, ref) => {
    const itemVariant = active ? 'active' : variant;
    return (
      <button
        className={cn(menuItemVariants({ variant: itemVariant, size, className }))}
        ref={ref}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children && <span>{children}</span>}
      </button>
    );
  }
);
MenuItem.displayName = 'MenuItem';

export {
  MenuBar,
  MenuItem,
  menuBarVariants,
  menuItemVariants,
  VibesLogo,
  CloseButton,
  ExpandButton,
};
