export const buttonColors: {
  primary: string;
  secondary: string;
  tertiary: string;
} = {
  primary: '#009ACE',
  secondary: '#DA291C',
  tertiary: '#FEDD00',
};

export function getButtonStyle(
  variant: keyof typeof buttonColors,
  isHovered: boolean,
  isActive: boolean
): React.CSSProperties {
  let transform = 'translate(0px, 0px)';
  let boxShadow = `4px 5px 0px 0px ${buttonColors[variant]}`;

  if (isHovered && !isActive) {
    transform = 'translate(2px, 2px)';
    boxShadow = `2px 3px 0px 0px ${buttonColors[variant]}`;
  }

  if (isActive) {
    transform = 'translate(4px, 5px)';
    boxShadow = 'none';
  }

  return {
    width: '100%',
    padding: '1rem 2rem',
    // background, color, and border moved to CSS classes for dark mode support
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    position: 'relative' as const,
    transform,
    boxShadow,
  };
}
