import React, { useState, useEffect } from 'react';
import type { ButtonProps } from './Button.types';
import type { ButtonVariantConfig, ButtonIconConfig } from './Button.tokens';
import { ButtonUI } from './Button.ui';
import { ButtonEditor } from './Button.editor';
import { IconPicker } from './IconPicker';
import { Modal } from '../Modal/Modal';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { addButtonVariant } from '../../store/designTokensSlice';
import { useIsDevelopment } from '../../utils';

const DEFAULT_ICON: ButtonIconConfig = {
  type: 'none',
  name: '',
  customSvg: '',
  positionDesktop: 'left',
  positionMobile: 'left',
  size: '--spacing-md',
  gap: '--spacing-sm',
};

const editButtonStyles: React.CSSProperties = {
  position: 'absolute',
  top: '-8px',
  right: '-8px',
  width: '20px',
  height: '20px',
  backgroundColor: 'var(--color-accent)',
  border: '2px solid var(--color-text-primary)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 1,
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  padding: 0,
};

const iconButtonStyles: React.CSSProperties = {
  position: 'absolute',
  bottom: '-8px',
  right: '-8px',
  width: '20px',
  height: '20px',
  backgroundColor: 'var(--color-primary)',
  border: '2px solid var(--color-text-primary)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 1,
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  padding: 0,
  color: 'white',
};

const variantSelectorStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '16px',
};

const variantButtonStyles = (isSelected: boolean, isAssigned: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  border: isAssigned ? '2px solid var(--color-success)' : isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
  borderRadius: '4px',
  backgroundColor: isAssigned ? 'var(--color-success)' : isSelected ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
  color: isAssigned ? 'white' : 'var(--color-text-primary)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-primary)',
  transition: 'all 0.2s ease',
});

const addVariantButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px dashed var(--color-border)',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const sectionTitleStyles: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: 'var(--font-family-primary)',
};

const assignedBadgeStyles: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: '8px',
  padding: '2px 6px',
  backgroundColor: 'var(--color-success)',
  color: 'white',
  fontSize: 'var(--font-size-xs)',
  borderRadius: '4px',
  fontWeight: 'var(--font-weight-bold)',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variantId: initialVariantId,
  icon: controlledIcon,
  disabled = false,
  onClick,
  className,
  type = 'button',
  showEditButton = true,
  onVariantChange,
  onIconChange,
}) => {
  const dispatch = useAppDispatch();
  const isDevelopment = useIsDevelopment();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [assignedVariantId, setAssignedVariantId] = useState<string | null>(initialVariantId || null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  // Icon is stored per-button, not per-variant (uncontrolled state)
  const [internalIcon, setInternalIcon] = useState<ButtonIconConfig>(controlledIcon || DEFAULT_ICON);

  // Support both controlled and uncontrolled icon
  const buttonIcon = controlledIcon !== undefined ? controlledIcon : internalIcon;
  const handleIconChange = (newIcon: ButtonIconConfig) => {
    setInternalIcon(newIcon);
    onIconChange?.(newIcon);
  };

  const buttonVariants = useAppSelector(state => state.designTokens.buttonVariants);
  const showDevTools = showEditButton && isDevelopment;

  const currentVariantId = assignedVariantId || buttonVariants[0]?.id;
  const currentVariant = buttonVariants.find((v: ButtonVariantConfig) => v.id === currentVariantId) || buttonVariants[0];

  useEffect(() => {
    if (!assignedVariantId && buttonVariants[0]) {
      setAssignedVariantId(buttonVariants[0].id);
    }
  }, [assignedVariantId, buttonVariants]);

  if (!currentVariant) return null;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVariantId(currentVariantId);
    setIsEditorOpen(true);
  };

  const handleAddVariant = () => {
    dispatch(addButtonVariant());
  };

  const handleSelectVariant = (id: string) => {
    setAssignedVariantId(id);
    setEditingVariantId(id);
    onVariantChange?.(id);
  };

  const handleEditVariant = (id: string) => {
    setEditingVariantId(id);
  };

  const editingVariant = editingVariantId
    ? buttonVariants.find((v: ButtonVariantConfig) => v.id === editingVariantId)
    : currentVariant;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <ButtonUI
        variant={currentVariant}
        icon={buttonIcon}
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={className}
      >
        {children}
      </ButtonUI>

      {showDevTools && (
        <>
          <button
            onClick={handleEditClick}
            style={editButtonStyles}
            title="Edit Button Style"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsIconPickerOpen(true);
            }}
            style={iconButtonStyles}
            title="Add Icon"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
        </>
      )}

      {showDevTools && (
        <Modal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          title="Edit Button Variants"
          maxWidth="1000px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={sectionTitleStyles}>
                Select Variant for This Button
                <span style={{ fontWeight: 'normal', textTransform: 'none', marginLeft: '8px', fontSize: 'var(--font-size-xs)' }}>
                  (click to assign, double-click to edit)
                </span>
              </h4>
              <div style={variantSelectorStyles}>
                {buttonVariants.map((variant: ButtonVariantConfig) => (
                  <button
                    key={variant.id}
                    type="button"
                    style={variantButtonStyles(editingVariantId === variant.id, assignedVariantId === variant.id)}
                    onClick={() => handleSelectVariant(variant.id)}
                    onDoubleClick={() => handleEditVariant(variant.id)}
                  >
                    {variant.name}
                    {assignedVariantId === variant.id && <span style={assignedBadgeStyles}>ASSIGNED</span>}
                  </button>
                ))}
                <button
                  type="button"
                  style={addVariantButtonStyles}
                  onClick={handleAddVariant}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Variant
                </button>
              </div>
            </div>

            {editingVariant && (
              <ButtonEditor
                variantId={editingVariant.id}
                isDefault={editingVariant.id === buttonVariants[0]?.id}
              />
            )}
          </div>
        </Modal>
      )}

      {showDevTools && (
        <Modal
          isOpen={isIconPickerOpen}
          onClose={() => setIsIconPickerOpen(false)}
          title="Add Icon"
          maxWidth="600px"
        >
          <IconPicker
            icon={buttonIcon}
            onIconChange={handleIconChange}
          />
        </Modal>
      )}
    </div>
  );
};

Button.displayName = 'Button';
