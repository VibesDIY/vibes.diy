import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { MenuBar, MenuItem } from '../app/components/ui/menubar';
import {
  Home,
  Info,
  Star,
  Gamepad2,
  Activity,
  Users,
  GraduationCap,
  Flame,
  Code,
  Heart,
  User,
  Search,
  Zap,
  Cpu,
  Palette,
  Sparkles,
  Shield,
} from 'lucide-react';

const HomeIcon = () => <Home size={16} />;
const InfoIcon = () => <Info size={16} />;
const StarIcon = () => <Star size={16} />;
const GameIcon = () => <Gamepad2 size={16} />;
const HealthIcon = () => <Activity size={16} />;
const SocialIcon = () => <Users size={16} />;
const EducationIcon = () => <GraduationCap size={16} />;
const FireIcon = () => <Flame size={16} />;
const CodeIcon = () => <Code size={16} />;
const HeartIcon = () => <Heart size={16} />;
const UserIcon = () => <User size={16} />;
const SearchIcon = () => <Search size={16} />;
const ElectricIcon = () => <Zap size={16} />;
const CyberIcon = () => <Cpu size={16} />;
const RetroIcon = () => <Palette size={16} />;
const DreamIcon = () => <Sparkles size={16} />;
const DangerIcon = () => <Shield size={16} />;

const InteractiveMenuBar = ({
  variant = 'default',
  size = 'default',
  items = [
    { label: 'Home', icon: <HomeIcon /> },
    { label: 'About', icon: <InfoIcon /> },
    { label: 'Featured', icon: <StarIcon /> },
  ],
}: {
  variant?:
    | 'default'
    | 'contained'
    | 'electric'
    | 'hot'
    | 'cyber'
    | 'retro'
    | 'cool'
    | 'dream'
    | 'danger'
    | 'game'
    | 'health'
    | 'social'
    | 'education';
  size?: 'default' | 'sm' | 'lg';
  items?: Array<{ label: string; icon: React.ReactNode; variant?: string }>;
}) => {
  const [activeItem, setActiveItem] = useState(items[0]?.label);

  return (
    <MenuBar variant={variant as any} size={size}>
      {items.map((item) => (
        <MenuItem
          key={item.label}
          variant={(item.variant || variant) as any}
          size={size}
          active={activeItem === item.label}
          icon={item.icon}
          onClick={() => setActiveItem(item.label)}
        >
          {item.label}
        </MenuItem>
      ))}
    </MenuBar>
  );
};

const CollapsibleMenuBar = ({
  variant = 'contained',
  size = 'default',
  initialCollapsed = false,
}: {
  variant?: 'default' | 'contained';
  size?: 'default' | 'sm' | 'lg';
  initialCollapsed?: boolean;
}) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <MenuBar
      variant={variant as any}
      size={size}
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed(!collapsed)}
    >
      <MenuItem variant="game" icon={<GameIcon />}>
        GAME
      </MenuItem>
      <MenuItem variant="health" icon={<HealthIcon />}>
        HEALTH
      </MenuItem>
      <MenuItem variant="social" icon={<SocialIcon />}>
        SOCIAL
      </MenuItem>
      <MenuItem variant="education" icon={<EducationIcon />}>
        EDUCATION
      </MenuItem>
    </MenuBar>
  );
};

const meta = {
  title: 'Components/MenuBar',
  component: InteractiveMenuBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `A modern menu bar component with pill-shaped buttons featuring icons and text. Perfect for navigation bars, category selectors, or any interface requiring grouped actions.

**Key Features:**
- Pill-shaped buttons with rounded corners
- Icon + text combinations
- Individual button styling (each button can have its own color)
- Spacing between buttons for clean separation
- Neobrutalism styling with bold borders and shadows
- Interactive active state management
- Multiple size variants

**Design Elements:**
- Rounded pill shape with \`rounded-full\`
- Individual button borders and shadows
- Gap spacing between menu items
- Icon and text layout with proper spacing
- Vibrant color variants inspired by your design

**Usage:**
\`\`\`tsx
<MenuBar>
  <MenuItem variant="game" icon={<GameIcon />}>GAME</MenuItem>
  <MenuItem variant="health" icon={<HealthIcon />}>HEALTH</MenuItem>
  <MenuItem variant="social" icon={<SocialIcon />}>SOCIAL</MenuItem>
</MenuBar>
\`\`\``,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      description: 'Container style variant',
      control: 'select',
      options: ['default', 'contained'],
    },
    size: {
      description: 'Size variant affecting spacing and button sizes',
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
    items: {
      description: 'Array of menu items with labels and icons',
      control: 'object',
    },
  },
} satisfies Meta<typeof InteractiveMenuBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with simple navigation
export const Default: Story = {
  args: {
    variant: 'default',
    size: 'default',
    items: [
      { label: 'Home', icon: <HomeIcon /> },
      { label: 'About', icon: <InfoIcon /> },
      { label: 'Featured', icon: <StarIcon /> },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Basic pill-shaped menu bar with icons and text. Click items to see active state behavior.',
      },
    },
  },
};

export const CategoryNavigation: Story = {
  args: {
    variant: 'default',
    size: 'default',
    items: [
      { label: 'GAME', icon: <GameIcon />, variant: 'game' },
      { label: 'HEALTH', icon: <HealthIcon />, variant: 'health' },
      { label: 'SOCIAL', icon: <SocialIcon />, variant: 'social' },
      { label: 'EDUCATION', icon: <EducationIcon />, variant: 'education' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Recreating the colorful category navigation from your design with individual button colors.',
      },
    },
  },
};

export const IconNavigation: Story = {
  args: {
    variant: 'default',
    size: 'default',
    items: [
      { label: '', icon: <HomeIcon /> },
      { label: '', icon: <InfoIcon /> },
      { label: '', icon: <StarIcon /> },
      { label: '', icon: <FireIcon /> },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Icon-only navigation similar to your top design with circular pill buttons.',
      },
    },
  },
};

// Size variants
export const Small: Story = {
  args: {
    variant: 'default',
    size: 'sm',
    items: [
      { label: 'Home', icon: <HomeIcon /> },
      { label: 'Search', icon: <SearchIcon /> },
      { label: 'Profile', icon: <UserIcon /> },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact pill buttons perfect for secondary navigation or mobile interfaces.',
      },
    },
  },
};

export const Large: Story = {
  args: {
    variant: 'default',
    size: 'lg',
    items: [
      { label: 'Featured', icon: <StarIcon /> },
      { label: 'Popular', icon: <FireIcon /> },
      { label: 'Favorites', icon: <HeartIcon /> },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Large pill buttons for prominent navigation or call-to-action areas.',
      },
    },
  },
};

export const ColorVariants: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Individual Button Colors</h3>
      <p className="text-sm text-gray-600">
        Each button can have its own color variant for category-based navigation.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Category Navigation</h4>
          <MenuBar>
            <MenuItem variant="game" icon={<GameIcon />}>
              GAME
            </MenuItem>
            <MenuItem variant="health" icon={<HealthIcon />}>
              HEALTH
            </MenuItem>
            <MenuItem variant="social" icon={<SocialIcon />}>
              SOCIAL
            </MenuItem>
            <MenuItem variant="education" icon={<EducationIcon />}>
              EDUCATION
            </MenuItem>
          </MenuBar>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Neobrutalism Colors</h4>
          <MenuBar>
            <MenuItem variant="electric" icon={<ElectricIcon />}>
              Electric
            </MenuItem>
            <MenuItem variant="hot" icon={<FireIcon />}>
              Hot
            </MenuItem>
            <MenuItem variant="cyber" icon={<CyberIcon />}>
              Cyber
            </MenuItem>
            <MenuItem variant="retro" icon={<RetroIcon />}>
              Retro
            </MenuItem>
          </MenuBar>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">More Colors</h4>
          <MenuBar>
            <MenuItem variant="cool" icon={<StarIcon />}>
              Cool
            </MenuItem>
            <MenuItem variant="dream" icon={<DreamIcon />}>
              Dream
            </MenuItem>
            <MenuItem variant="danger" icon={<DangerIcon />}>
              Danger
            </MenuItem>
          </MenuBar>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of all available color variants for individual menu items.',
      },
    },
  },
};

export const ContainedMenuBar: Story = {
  render: () => {
    const [activeItem, setActiveItem] = useState('Dashboard');

    return (
      <MenuBar variant="contained" size="default">
        <MenuItem
          variant={activeItem === 'Dashboard' ? 'active' : 'game'}
          icon={<HomeIcon />}
          active={activeItem === 'Dashboard'}
          onClick={() => setActiveItem('Dashboard')}
        >
          Dashboard
        </MenuItem>
        <MenuItem
          variant={activeItem === 'Analytics' ? 'active' : 'health'}
          icon={<InfoIcon />}
          active={activeItem === 'Analytics'}
          onClick={() => setActiveItem('Analytics')}
        >
          Analytics
        </MenuItem>
        <MenuItem
          variant={activeItem === 'Settings' ? 'active' : 'education'}
          icon={<UserIcon />}
          active={activeItem === 'Settings'}
          onClick={() => setActiveItem('Settings')}
        >
          Settings
        </MenuItem>
      </MenuBar>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Menu bar with a contained white background and border. Inactive items use colorful backgrounds with black text, active items use black background with white text.',
      },
    },
  },
};

export const MobileNavigation: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Mobile Navigation Styles</h3>

      <div className="space-y-3">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Bottom Navigation (Icons Only)</h4>
          <MenuBar size="sm">
            <MenuItem variant="default" icon={<HomeIcon />}></MenuItem>
            <MenuItem variant="default" icon={<SearchIcon />}></MenuItem>
            <MenuItem variant="default" icon={<HeartIcon />}></MenuItem>
            <MenuItem variant="default" icon={<UserIcon />}></MenuItem>
          </MenuBar>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Category Pills</h4>
          <MenuBar size="sm">
            <MenuItem variant="game" icon={<GameIcon />} size="sm">
              Games
            </MenuItem>
            <MenuItem variant="social" icon={<SocialIcon />} size="sm">
              Social
            </MenuItem>
            <MenuItem variant="education" icon={<EducationIcon />} size="sm">
              Learn
            </MenuItem>
          </MenuBar>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Mobile-optimized navigation patterns with compact pill buttons.',
      },
    },
  },
};

export const AdvancedUsage: Story = {
  render: () => {
    const [activeCategory, setActiveCategory] = useState('GAME');
    const [activeNav, setActiveNav] = useState('home');

    return (
      <div className="space-y-8">
        <h3 className="text-lg font-bold">Complete Navigation System</h3>
        <p className="text-sm text-gray-600">
          Recreating navigation patterns from your design screenshots.
        </p>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Top Navigation</h4>
          <MenuBar>
            <MenuItem
              variant="default"
              icon={<HomeIcon />}
              active={activeNav === 'home'}
              onClick={() => setActiveNav('home')}
            ></MenuItem>
            <MenuItem
              variant="default"
              icon={<InfoIcon />}
              active={activeNav === 'info'}
              onClick={() => setActiveNav('info')}
            ></MenuItem>
            <MenuItem
              variant="default"
              icon={<StarIcon />}
              active={activeNav === 'star'}
              onClick={() => setActiveNav('star')}
            ></MenuItem>
            <MenuItem
              variant="default"
              icon={<FireIcon />}
              active={activeNav === 'fire'}
              onClick={() => setActiveNav('fire')}
            ></MenuItem>
          </MenuBar>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Category Navigation</h4>
          <MenuBar size="lg">
            <MenuItem
              variant="game"
              icon={<GameIcon />}
              active={activeCategory === 'GAME'}
              onClick={() => setActiveCategory('GAME')}
            >
              GAME
            </MenuItem>
            <MenuItem
              variant="health"
              icon={<HealthIcon />}
              active={activeCategory === 'HEALTH'}
              onClick={() => setActiveCategory('HEALTH')}
            >
              HEALTH
            </MenuItem>
            <MenuItem
              variant="social"
              icon={<SocialIcon />}
              active={activeCategory === 'SOCIAL'}
              onClick={() => setActiveCategory('SOCIAL')}
            >
              SOCIAL
            </MenuItem>
            <MenuItem
              variant="education"
              icon={<EducationIcon />}
              active={activeCategory === 'EDUCATION'}
              onClick={() => setActiveCategory('EDUCATION')}
            >
              EDUCATION
            </MenuItem>
          </MenuBar>
        </div>

        <div className="rounded-lg border-2 border-gray-200 p-4">
          <p className="text-sm">
            <strong>Active Navigation:</strong> {activeNav} | <strong>Active Category:</strong>{' '}
            {activeCategory}
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Complete navigation system matching your design screenshots with multiple navigation levels.',
      },
    },
  },
};

export const CollapsibleDefault: Story = {
  render: () => <CollapsibleMenuBar />,
  parameters: {
    docs: {
      description: {
        story:
          'Collapsible menu bar with VIBES logo and X button. Click the X to collapse or the expand button to open.',
      },
    },
  },
};

export const CollapsibleStartCollapsed: Story = {
  render: () => <CollapsibleMenuBar initialCollapsed={true} />,
  parameters: {
    docs: {
      description: {
        story: 'Menu bar that starts in collapsed state. Click the expand button (↔) to open it.',
      },
    },
  },
};

export const CollapsibleComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Collapsible Menu Bar States</h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Expanded State</h4>
          <MenuBar variant="contained" collapsible collapsed={false}>
            <MenuItem variant="game" icon={<GameIcon />}>
              GAME
            </MenuItem>
            <MenuItem variant="health" icon={<HealthIcon />}>
              HEALTH
            </MenuItem>
            <MenuItem variant="social" icon={<SocialIcon />}>
              SOCIAL
            </MenuItem>
            <MenuItem variant="education" icon={<EducationIcon />}>
              EDUCATION
            </MenuItem>
          </MenuBar>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Collapsed State</h4>
          <MenuBar variant="contained" collapsible collapsed={true}>
            <MenuItem variant="game" icon={<GameIcon />}>
              GAME
            </MenuItem>
            <MenuItem variant="health" icon={<HealthIcon />}>
              HEALTH
            </MenuItem>
            <MenuItem variant="social" icon={<SocialIcon />}>
              SOCIAL
            </MenuItem>
            <MenuItem variant="education" icon={<EducationIcon />}>
              EDUCATION
            </MenuItem>
          </MenuBar>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Interactive (Click to Toggle)</h4>
          <CollapsibleMenuBar />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of expanded vs collapsed states with interactive example.',
      },
    },
  },
};
