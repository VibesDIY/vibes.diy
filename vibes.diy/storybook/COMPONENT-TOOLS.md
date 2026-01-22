# Component Tools for LLMs

Este documento describe cómo los componentes de Storybook están diseñados para ser fácilmente modificables por LLMs.

## Arquitectura de Componentes

Cada componente sigue una estructura estricta de separación de responsabilidades:

```
ComponentName/
├── ComponentName.tsx       # Solo lógica React
├── ComponentName.css       # Solo estilos CSS
├── ComponentName.types.ts  # Solo tipos TypeScript
├── ComponentName.stories.tsx  # Solo historias de Storybook
└── index.ts               # Solo exportaciones
```

## Modificación por LLMs

### 1. Modificar Estilos

Para cambiar la apariencia de un componente:
- **Archivo**: `ComponentName.css`
- **Tokens disponibles**: Todas las variables CSS de `src/styles/tokens.css`

**Ejemplo**:
```css
/* Cambiar el color del botón primario */
.vibes-button--primary {
  background-color: var(--vibes-blue-accent);
  color: var(--vibes-white);
}
```

### 2. Modificar Tipos

Para agregar o cambiar propiedades del componente:
- **Archivo**: `ComponentName.types.ts`

**Ejemplo**:
```typescript
export interface ButtonProps {
  // Agregar nueva propiedad
  isLoading?: boolean;

  // Modificar tipo existente
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}
```

### 3. Modificar Lógica

Para cambiar el comportamiento del componente:
- **Archivo**: `ComponentName.tsx`

**Ejemplo**:
```typescript
export const Button: React.FC<ButtonProps> = ({
  children,
  isLoading = false, // Nueva prop
  ...props
}) => {
  if (isLoading) {
    return <button disabled>Loading...</button>;
  }

  return <button {...props}>{children}</button>;
};
```

## Modo Development/Production

### Indicador de Desarrollo

El indicador de desarrollo se controla globalmente desde Storybook:

1. **Variable global**: `window.__VIBES_ENV__`
   - Valores: `'development'` | `'production'`
   - Default: `'development'`

2. **Toggle en Storybook**:
   - Ubicación: Toolbar superior (ícono de engranaje ⚙️)
   - Opciones: 🔧 Development | ✓ Production

3. **Acceso en componentes**:
```typescript
const getEnvironment = (): 'development' | 'production' => {
  if (typeof window !== 'undefined' && (window as any).__VIBES_ENV__) {
    return (window as any).__VIBES_ENV__;
  }
  return 'production';
};

const isDevelopment = getEnvironment() === 'development';
```

### Crear Indicador en CSS

El indicador debe ser una clase separada que se renderiza condicionalmente:

```css
.component-name__dev-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background-color: var(--vibes-yellow-accent);
  border: 2px solid var(--vibes-near-black);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--vibes-near-black);
  z-index: 1;
}
```

### Renderizar Indicador

```tsx
{isDevelopment && (
  <span className="component-name__dev-indicator" title="Development Mode">
    D
  </span>
)}
```

## Design Tokens Disponibles

### Colores Base (nunca cambian)

```css
--vibes-blue: #3b82f6
--vibes-blue-accent: #009ace
--vibes-red: #ef4444
--vibes-red-accent: #da291c
--vibes-yellow: #eab308
--vibes-yellow-accent: #fedd00
--vibes-gray: #7A7A7A
--vibes-green: #51cf66
```

### Colores Semánticos (adaptan a dark mode)

```css
/* Backgrounds */
--vibes-bg-primary
--vibes-bg-secondary
--vibes-bg-tertiary

/* Text */
--vibes-text-primary
--vibes-text-secondary
--vibes-text-muted

/* Borders */
--vibes-border-primary
--vibes-border-secondary

/* Shadows */
--vibes-shadow-sm
--vibes-shadow-md
--vibes-shadow-lg
```

### Tipografía

```css
--vibes-font-family: 'Alte Haas Grotesk', sans-serif
```

## Workflow para LLMs

### Paso 1: Analizar Solicitud
Identificar qué archivo(s) necesitan modificarse:
- Cambio de estilo → `.css`
- Cambio de tipo → `.types.ts`
- Cambio de lógica → `.tsx`

### Paso 2: Leer Archivo Actual
```typescript
// Usar herramienta Read para leer el archivo completo
Read({ file_path: "/path/to/ComponentName.css" })
```

### Paso 3: Modificar Archivo
```typescript
// Usar herramienta Edit para hacer cambios específicos
Edit({
  file_path: "/path/to/ComponentName.css",
  old_string: "...",
  new_string: "..."
})
```

### Paso 4: Verificar en Storybook
El usuario puede verificar los cambios en tiempo real en Storybook (con hot reload).

## Mejores Prácticas

1. **Usa tokens CSS** en lugar de colores hardcodeados
2. **Mantén la separación** entre CSS, tipos y lógica
3. **Documenta cambios** con comentarios en el código
4. **Prueba en ambos modos** (development y production)
5. **Verifica dark mode** usando el toggle de background en Storybook

## Ejemplo Completo: Agregar Loading State al Button

### 1. Actualizar tipos
```typescript
// Button.types.ts
export interface ButtonProps {
  // ... props existentes
  isLoading?: boolean;
}
```

### 2. Actualizar estilos
```css
/* Button.css */
.vibes-button--loading {
  opacity: 0.7;
  cursor: wait;
}

.vibes-button__spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 3. Actualizar lógica
```tsx
// Button.tsx
export const Button: React.FC<ButtonProps> = ({
  children,
  isLoading = false,
  className = '',
  ...props
}) => {
  const classes = [
    'vibes-button',
    isLoading && 'vibes-button--loading',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button {...props} className={classes}>
      {isLoading && <span className="vibes-button__spinner" />}
      {children}
    </button>
  );
};
```

### 4. Agregar story
```tsx
// Button.stories.tsx
export const Loading: Story = {
  args: {
    children: 'Loading...',
    isLoading: true,
  },
};
```

## Debugging

Si los cambios no se reflejan:
1. Verifica que Storybook esté corriendo (`pnpm storybook`)
2. Revisa la consola del navegador para errores
3. Verifica que los tokens CSS estén correctamente importados
4. Asegúrate de que el archivo `.css` esté importado en el `.tsx`
