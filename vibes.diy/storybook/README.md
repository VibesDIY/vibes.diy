# @vibes.diy/storybook

Component library and design system documentation for Vibes.

## Features

- **Design Tokens**: CSS variables from the Vibes design system
- **Alte Haas Grotesk Font**: Typography system
- **Clean Separation**: CSS, TypeScript types, and logic are completely separated
- **LLM-Friendly**: Easy for AI models to modify components as tools
- **Development Mode**: Visual indicator when components are in development mode

## Installation

```bash
# Install dependencies from monorepo root
pnpm install
```

## Usage

### Running Storybook

```bash
# From this directory
pnpm storybook

# Or from monorepo root
pnpm --filter @vibes.diy/storybook storybook
```

### Building Storybook

```bash
pnpm build-storybook
```

## Component Structure

Each component follows this structure for maximum modularity:

```
ComponentName/
├── ComponentName.tsx       # Logic only
├── ComponentName.css       # All styles
├── ComponentName.types.ts  # TypeScript interfaces
├── ComponentName.stories.tsx  # Storybook stories
└── index.ts               # Public exports
```

### Example: Button Component

```typescript
import { Button } from '@vibes.diy/storybook';

<Button variant="blue" size="large" onClick={() => {}}>
  Click Me
</Button>
```

## Development Mode Toggle

### Cómo cambiar entre Development y Production:

1. **Localiza el toolbar** en la parte superior de Storybook
2. **Busca el ícono de engranaje (⚙️)** con el texto "Environment"
3. **Haz click** en el botón
4. **Selecciona** una de las opciones:
   - **🔧 Development** - Muestra el indicador "D" en los componentes
   - **✓ Production** - Oculta el indicador
5. Los componentes se actualizarán inmediatamente

### Indicador Visual

Cuando está en modo **Development**, verás:
- Un badge amarillo con la letra "D" en la esquina superior derecha del componente
- Un mensaje en la consola: `🎨 Vibes Environment: DEVELOPMENT`

Cuando está en modo **Production**:
- No hay badge visible
- Un mensaje en la consola: `🎨 Vibes Environment: PRODUCTION`

### Acceso Programático

Los componentes acceden al modo actual mediante:
```typescript
const environment = (window as any).__VIBES_ENV__; // 'development' | 'production'
```

## Design Tokens

All design tokens are available as CSS variables:

```css
/* Use in your styles */
.my-element {
  background-color: var(--vibes-bg-primary);
  color: var(--vibes-text-primary);
  font-family: var(--vibes-font-family);
}
```

See `src/styles/tokens.css` for the complete list of available tokens.

## Adding New Components

1. Create a new directory in `src/components/`
2. Follow the component structure pattern
3. Import and use design tokens
4. Add Storybook stories
5. Export from `index.ts`

## TypeScript

All components are fully typed with TypeScript. Types are separated into `.types.ts` files for easy modification.
