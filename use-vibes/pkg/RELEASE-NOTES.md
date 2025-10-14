# Release Notes for use-vibes Package

## Recent Changes

### DOM Preservation Fix for mountVibesApp

- **Fixed**: `mountVibesApp` now preserves original DOM nodes instead of cloning with `innerHTML`
- **Benefit**: Interactive elements (buttons, forms, React components) maintain their event handlers and state after mounting
- **Test**: Enhanced `MountVibesAppExample` with interactive test elements to verify DOM preservation

### Enhanced Test Coverage

- **Added**: Interactive test elements in `MountVibesAppExample.tsx`
- **Added**: Comprehensive Playwright tests for visual behavior validation
- **Improved**: Better verification that DOM wrapping preserves interactivity

### Code Quality Improvements

- **Fixed**: Removed unused imports and variables in `MountVibesAppExample.tsx`
- **Fixed**: Proper `ExampleKey` type definition to avoid broken imports
- **Enhanced**: CI/CD publishing pipeline with fail-fast behavior for atomic releases
