# Guía de Uso: Storybook de Componentes Vibes

## Inicio Rápido

### 1. Instalar dependencias (primera vez)
```bash
# Desde la raíz del monorepo
pnpm install
```

### 2. Iniciar Storybook

#### Opción A: Desde la raíz del monorepo (recomendado)
```bash
pnpm storybook:components
```

#### Opción B: Desde el directorio del storybook
```bash
cd vibes.diy/storybook
pnpm storybook
```

### 3. Abrir en el navegador
Storybook se abrirá automáticamente en: http://localhost:6006/

---

## Toggle de Modo Development/Production

### Ubicación del Toggle

El toggle se encuentra en el **toolbar superior** de Storybook:

```
┌─────────────────────────────────────────────────────────────┐
│  Storybook    [Docs] [Canvas]     🎨 ⚙️ Environment  📱 🌓  │  ← Aquí está el toggle (⚙️)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [<- Sidebar]        [Componente Preview]                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Cómo Usar el Toggle

#### Paso 1: Localizar el Control
Busca en el toolbar el botón con:
- **Ícono**: Engranaje (⚙️)
- **Texto**: "Environment" o el modo actual
- **Posición**: Parte superior derecha, junto a otros controles

#### Paso 2: Hacer Click
Haz click en el botón del engranaje

#### Paso 3: Seleccionar Modo
Se desplegará un menú con dos opciones:

```
┌──────────────────────────────────────┐
│ 🔧 Development                       │ ← Modo Development
│    (Shows dev indicators)            │
├──────────────────────────────────────┤
│ ✓ Production                         │ ← Modo Production
│    (Hides dev indicators)            │
└──────────────────────────────────────┘
```

#### Paso 4: Ver el Cambio
El componente se actualizará inmediatamente:

- **En Development**: Verás un badge amarillo "D" en la esquina del componente
- **En Production**: El badge desaparece

### Feedback Visual

#### En la Consola del Navegador
Cada vez que cambies el modo, verás un mensaje:
```
🎨 Vibes Environment: DEVELOPMENT
```
o
```
🎨 Vibes Environment: PRODUCTION
```

#### En el Componente
**Modo Development**:
```
┌─────────────────┐
│  [Button Text]  │ D  ← Badge amarillo con "D"
└─────────────────┘
```

**Modo Production**:
```
┌─────────────────┐
│  [Button Text]  │  ← Sin badge
└─────────────────┘
```

---

## Explorar Componentes

### Sidebar de Navegación

```
Components
└── Button
    ├── Primary         ← Variante por defecto
    ├── Blue           ← Variante azul
    ├── Red            ← Variante roja
    ├── Yellow         ← Variante amarilla
    ├── Gray           ← Variante gris
    ├── Small          ← Tamaño pequeño
    ├── Medium         ← Tamaño mediano
    ├── Large          ← Tamaño grande
    ├── Disabled       ← Estado deshabilitado
    ├── All Variants   ← Muestra todas las variantes
    └── All Sizes      ← Muestra todos los tamaños
```

### Controles Interactivos

En el panel inferior verás:

**Controls Tab**: Permite modificar las props del componente en tiempo real
```
┌─────────────────────────────────────────┐
│ Controls                                │
├─────────────────────────────────────────┤
│ children   │ [Text input]               │
│ variant    │ [Select: primary/blue/...] │
│ size       │ [Select: small/medium/...] │
│ disabled   │ [Checkbox]                 │
└─────────────────────────────────────────┘
```

**Actions Tab**: Muestra los eventos que se disparan
```
┌─────────────────────────────────────────┐
│ Actions                                 │
├─────────────────────────────────────────┤
│ onClick                                 │
│   ├─ Called at: 10:23:45                │
│   └─ Args: []                           │
└─────────────────────────────────────────┘
```

---

## Probar Diferentes Escenarios

### Cambiar Variante del Botón
1. Selecciona una story (ej: "Primary")
2. En el panel "Controls", cambia el dropdown "variant"
3. El botón se actualizará en vivo

### Cambiar a Dark Mode
1. Busca el ícono de luna (🌓) en el toolbar
2. Selecciona "dark" del menú
3. Los colores se ajustarán usando las variables CSS de dark mode

### Cambiar Background
1. Busca el ícono de paleta en el toolbar
2. Selecciona entre "light" o "dark"
3. El fondo del preview cambiará

### Probar Responsive
1. Busca el ícono de dispositivos (📱) en el toolbar
2. Selecciona un viewport (Mobile, Tablet, Desktop)
3. El componente se verá en ese tamaño

---

## Desarrollo de Nuevos Componentes

### 1. Crear Estructura
```bash
cd src/components
mkdir NewComponent
cd NewComponent
touch NewComponent.tsx NewComponent.css NewComponent.types.ts NewComponent.stories.tsx index.ts
```

### 2. Seguir la Convención

**NewComponent.types.ts**:
```typescript
export interface NewComponentProps {
  // Props aquí
}
```

**NewComponent.css**:
```css
.vibes-new-component {
  /* Estilos usando tokens CSS */
  color: var(--vibes-text-primary);
}
```

**NewComponent.tsx**:
```typescript
import type { NewComponentProps } from './NewComponent.types';
import './NewComponent.css';

export const NewComponent: React.FC<NewComponentProps> = (props) => {
  // Lógica aquí
};
```

**NewComponent.stories.tsx**:
```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { NewComponent } from './NewComponent';

const meta = {
  title: 'Components/NewComponent',
  component: NewComponent,
} satisfies Meta<typeof NewComponent>;

export default meta;
```

**index.ts**:
```typescript
export { NewComponent } from './NewComponent';
export type { NewComponentProps } from './NewComponent.types';
```

### 3. Ver en Storybook
El hot reload detectará el nuevo componente automáticamente.

---

## Tips para LLMs

### Modificar Solo Estilos
```bash
# Leer el archivo CSS actual
Read("vibes.diy/storybook/src/components/Button/Button.css")

# Hacer cambios específicos
Edit({
  file_path: "...",
  old_string: "background-color: var(--vibes-button-bg);",
  new_string: "background-color: var(--vibes-blue-accent);"
})
```

### Agregar Nueva Prop
1. Actualizar `ComponentName.types.ts`
2. Actualizar `ComponentName.tsx` para usar la prop
3. Opcionalmente actualizar `ComponentName.css` para estilos
4. Agregar story en `ComponentName.stories.tsx`

### Tokens CSS Disponibles
Ver archivo completo: `src/styles/tokens.css`

Categorías:
- Base Colors: `--vibes-blue`, `--vibes-red`, etc.
- Semantic Colors: `--vibes-bg-primary`, `--vibes-text-primary`, etc.
- Component Tokens: `--vibes-button-bg`, etc.
- Typography: `--vibes-font-family`

---

## Troubleshooting

### Storybook no inicia
```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules
pnpm install
```

### Los cambios no se reflejan
1. Verifica que hayas guardado el archivo
2. Revisa la consola del navegador por errores
3. Reinicia Storybook si es necesario

### Error de TypeScript
```bash
# Desde el directorio storybook
pnpm exec tsc --noEmit
```

### El toggle no funciona
1. Abre la consola del navegador
2. Verifica que veas el mensaje: `🎨 Vibes Environment: ...`
3. Si no lo ves, revisa que `.storybook/preview.tsx` esté correctamente configurado

---

## Recursos Adicionales

- **README.md**: Información general del proyecto
- **COMPONENT-TOOLS.md**: Guía detallada para modificación por LLMs
- **src/styles/tokens.css**: Todos los tokens CSS disponibles
- **Storybook Docs**: https://storybook.js.org/docs
