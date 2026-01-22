import React, { useState } from 'react';
import type { ButtonVariantConfig, ButtonState, ButtonStateConfig } from './Button.tokens';
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  EffectToken,
} from '../TokensEditor/TokensEditor.types';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  updateButtonVariant,
  updateButtonVariantState,
  duplicateButtonVariant,
  deleteButtonVariant,
} from '../../store/designTokensSlice';
import { ButtonUI } from './Button.ui';
import '../TokensEditor/TokensEditor.css';

interface ButtonEditorProps {
  variantId: string;
  isDefault?: boolean;
}

const STATES: { key: ButtonState; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'hover', label: 'Hover' },
  { key: 'active', label: 'Active' },
  { key: 'disabled', label: 'Disabled' },
];

const tabContainerStyles: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginBottom: '16px',
  borderBottom: '2px solid var(--color-border)',
  paddingBottom: '0',
};

const getTabStyles = (isActive: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  border: 'none',
  background: isActive ? 'var(--color-primary)' : 'transparent',
  color: isActive ? 'white' : 'var(--color-text-secondary)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm)',
  fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
  fontFamily: 'var(--font-family-primary)',
  borderRadius: '4px 4px 0 0',
  transition: 'all 0.2s ease',
});

const sectionStyles: React.CSSProperties = {
  marginBottom: '16px',
  padding: '16px',
  backgroundColor: 'var(--color-bg-secondary)',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
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

const fieldRowStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '12px',
  marginBottom: '12px',
};

const fieldStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-family-primary)',
};

const selectStyles: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  backgroundColor: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-primary)',
};

const inputStyles: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  backgroundColor: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-primary)',
  width: '80px',
};

const previewContainerStyles: React.CSSProperties = {
  padding: '32px',
  backgroundColor: 'var(--color-bg-primary)',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '16px',
  marginBottom: '16px',
  overflow: 'visible',
};

const actionsContainerStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '16px',
  borderTop: '1px solid var(--color-border)',
};

const buttonGroupStyles: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const actionButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  backgroundColor: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-primary)',
  cursor: 'pointer',
};

const deleteButtonStyles: React.CSSProperties = {
  ...actionButtonStyles,
  backgroundColor: 'var(--color-error)',
  borderColor: 'var(--color-error)',
  color: 'white',
};

interface StateEditorProps {
  variant: ButtonVariantConfig;
  stateName: ButtonState;
  stateConfig: ButtonStateConfig;
  colorTokens: ColorToken[];
  spacingTokens: SpacingToken[];
  shadowTokens: ShadowToken[];
  onUpdate: (field: keyof ButtonStateConfig, value: unknown) => void;
  hasIcon: boolean;
}

const StateEditor: React.FC<StateEditorProps> = ({
  stateConfig,
  colorTokens,
  spacingTokens,
  shadowTokens,
  onUpdate,
  hasIcon,
}) => {
  return (
    <div>
      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Colors</h4>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Background Color</label>
            <select
              style={selectStyles}
              value={stateConfig.backgroundColor}
              onChange={(e) => onUpdate('backgroundColor', e.target.value)}
            >
              {colorTokens.map((token: ColorToken) => (
                <option key={token.id} value={`var(${token.variable})`}>
                  {token.name}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldStyles}>
            <label style={labelStyles}>Border Color</label>
            <select
              style={selectStyles}
              value={stateConfig.borderColor}
              onChange={(e) => onUpdate('borderColor', e.target.value)}
            >
              {colorTokens.map((token: ColorToken) => (
                <option key={token.id} value={`var(${token.variable})`}>
                  {token.name}
                </option>
              ))}
            </select>
          </div>
          {hasIcon && (
            <div style={fieldStyles}>
              <label style={labelStyles}>Icon Color</label>
              <select
                style={selectStyles}
                value={stateConfig.iconColor || 'var(--color-text-primary)'}
                onChange={(e) => onUpdate('iconColor', e.target.value)}
              >
                {colorTokens.map((token: ColorToken) => (
                  <option key={token.id} value={`var(${token.variable})`}>
                    {token.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Shadow</h4>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Shadow Style</label>
            <select
              style={selectStyles}
              value={stateConfig.shadow}
              onChange={(e) => onUpdate('shadow', e.target.value)}
            >
              <option value="none">None</option>
              {shadowTokens.map((token: ShadowToken) => (
                <option key={token.id} value={token.variable}>
                  {token.name}
                </option>
              ))}
            </select>
          </div>
          {stateConfig.shadow !== 'none' && (
            <div style={fieldStyles}>
              <label style={labelStyles}>Shadow Color</label>
              <select
                style={selectStyles}
                value={stateConfig.shadowColor || 'var(--color-primary)'}
                onChange={(e) => onUpdate('shadowColor', e.target.value)}
              >
                {colorTokens.map((token: ColorToken) => (
                  <option key={token.id} value={`var(${token.variable})`}>
                    {token.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Transform</h4>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Translate Y Direction</label>
            <select
              style={selectStyles}
              value={stateConfig.translateYDirection}
              onChange={(e) => onUpdate('translateYDirection', e.target.value)}
            >
              <option value="none">None</option>
              <option value="up">Up (-)</option>
              <option value="down">Down (+)</option>
            </select>
          </div>
          {stateConfig.translateYDirection !== 'none' && (
            <div style={fieldStyles}>
              <label style={labelStyles}>Translate Y Amount</label>
              <select
                style={selectStyles}
                value={stateConfig.translateY}
                onChange={(e) => onUpdate('translateY', e.target.value)}
              >
                {spacingTokens.map((token: SpacingToken) => (
                  <option key={token.id} value={token.variable}>
                    {token.name} ({token.value}{token.unit})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Opacity</h4>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Opacity (0-1)</label>
            <input
              type="number"
              style={inputStyles}
              value={stateConfig.opacity}
              min={0}
              max={1}
              step={0.1}
              onChange={(e) => onUpdate('opacity', parseFloat(e.target.value) || 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const ButtonEditor: React.FC<ButtonEditorProps> = ({ variantId, isDefault = false }) => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<ButtonState>('default');

  const buttonVariants = useAppSelector(state => state.designTokens.buttonVariants);
  const colorTokens = useAppSelector(state => state.designTokens.colorTokens);
  const typographyTokens = useAppSelector(state => state.designTokens.typographyTokens);
  const spacingTokens = useAppSelector(state => state.designTokens.spacingTokens);
  const radiusTokens = useAppSelector(state => state.designTokens.radiusTokens);
  const shadowTokens = useAppSelector(state => state.designTokens.shadowTokens);
  const effectTokens = useAppSelector(state => state.designTokens.effectTokens);

  const variant = buttonVariants.find((v: ButtonVariantConfig) => v.id === variantId);
  if (!variant) return null;

  const handleVariantUpdate = (field: keyof ButtonVariantConfig, value: unknown) => {
    dispatch(updateButtonVariant({ id: variantId, field, value }));
  };

  const handleStateUpdate = (stateName: ButtonState) => (field: keyof ButtonStateConfig, value: unknown) => {
    dispatch(updateButtonVariantState({ variantId, stateName, field, value }));
  };

  const handleDuplicate = () => {
    dispatch(duplicateButtonVariant(variantId));
  };

  const handleDelete = () => {
    if (isDefault || buttonVariants.length <= 1) return;
    dispatch(deleteButtonVariant(variantId));
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Variant Name</h4>
        <input
          type="text"
          style={{ ...selectStyles, width: '100%' }}
          value={variant.name}
          onChange={(e) => handleVariantUpdate('name', e.target.value)}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4 style={sectionTitleStyles}>Preview</h4>
        <div style={previewContainerStyles}>
          {STATES.map(({ key, label }) => (
            <div key={key} style={{ textAlign: 'center' }}>
              <ButtonUI variant={variant} forceState={key}>
                {label}
              </ButtonUI>
              <div style={{ marginTop: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Base Properties</h4>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Typography</label>
            <select
              style={selectStyles}
              value={variant.typography}
              onChange={(e) => handleVariantUpdate('typography', e.target.value)}
            >
              {typographyTokens.map((token: TypographyToken) => (
                <option key={token.id} value={token.variable}>
                  {token.name}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldStyles}>
            <label style={labelStyles}>Effect</label>
            <select
              style={selectStyles}
              value={variant.effect}
              onChange={(e) => handleVariantUpdate('effect', e.target.value)}
            >
              <option value="none">None</option>
              {effectTokens
                .filter((token: EffectToken) => token.type === 'transition' || token.type === 'animation')
                .map((token: EffectToken) => (
                  <option key={token.id} value={token.variable}>
                    {token.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Border Style</label>
            <select
              style={selectStyles}
              value={variant.borderStyle}
              onChange={(e) => handleVariantUpdate('borderStyle', e.target.value)}
            >
              <option value="none">None</option>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
          <div style={fieldStyles}>
            <label style={labelStyles}>Border Width</label>
            <select
              style={selectStyles}
              value={variant.borderWidth}
              onChange={(e) => handleVariantUpdate('borderWidth', e.target.value)}
            >
              {spacingTokens.map((token: SpacingToken) => (
                <option key={token.id} value={token.variable}>
                  {token.name} ({token.value}{token.unit})
                </option>
              ))}
            </select>
          </div>
          <div style={fieldStyles}>
            <label style={labelStyles}>Border Radius</label>
            <select
              style={selectStyles}
              value={variant.borderRadius}
              onChange={(e) => handleVariantUpdate('borderRadius', e.target.value)}
            >
              {radiusTokens.map((token: RadiusToken) => (
                <option key={token.id} value={token.variable}>
                  {token.name} ({token.value}{token.unit})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Padding Y</label>
            <select
              style={selectStyles}
              value={variant.paddingY}
              onChange={(e) => handleVariantUpdate('paddingY', e.target.value)}
            >
              {spacingTokens.map((token: SpacingToken) => (
                <option key={token.id} value={token.variable}>
                  {token.name} ({token.value}{token.unit})
                </option>
              ))}
            </select>
          </div>
          <div style={fieldStyles}>
            <label style={labelStyles}>Padding X</label>
            <select
              style={selectStyles}
              value={variant.paddingX}
              onChange={(e) => handleVariantUpdate('paddingX', e.target.value)}
            >
              {spacingTokens.map((token: SpacingToken) => (
                <option key={token.id} value={token.variable}>
                  {token.name} ({token.value}{token.unit})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Size & Overflow</h4>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Width Mode</label>
            <select
              style={selectStyles}
              value={variant.widthMode}
              onChange={(e) => handleVariantUpdate('widthMode', e.target.value)}
            >
              <option value="auto">Auto (adapts to content)</option>
              <option value="fixed">Fixed</option>
              <option value="full">Full Width (100%)</option>
            </select>
          </div>
          {variant.widthMode === 'fixed' && (
            <div style={fieldStyles}>
              <label style={labelStyles}>Fixed Width</label>
              <select
                style={selectStyles}
                value={variant.width}
                onChange={(e) => handleVariantUpdate('width', e.target.value)}
              >
                {spacingTokens.map((token: SpacingToken) => (
                  <option key={token.id} value={token.variable}>
                    {token.name} ({token.value}{token.unit})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Height Mode</label>
            <select
              style={selectStyles}
              value={variant.heightMode}
              onChange={(e) => handleVariantUpdate('heightMode', e.target.value)}
            >
              <option value="auto">Auto (adapts to content)</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
          {variant.heightMode === 'fixed' && (
            <div style={fieldStyles}>
              <label style={labelStyles}>Fixed Height</label>
              <select
                style={selectStyles}
                value={variant.height}
                onChange={(e) => handleVariantUpdate('height', e.target.value)}
              >
                {spacingTokens.map((token: SpacingToken) => (
                  <option key={token.id} value={token.variable}>
                    {token.name} ({token.value}{token.unit})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div style={fieldRowStyles}>
          <div style={fieldStyles}>
            <label style={labelStyles}>Text Overflow</label>
            <select
              style={selectStyles}
              value={variant.textOverflow}
              onChange={(e) => handleVariantUpdate('textOverflow', e.target.value)}
            >
              <option value="visible">Visible (text wraps)</option>
              <option value="ellipsis">Ellipsis (...)</option>
            </select>
          </div>
        </div>
      </div>

      <h4 style={sectionTitleStyles}>State-Specific Properties</h4>
      <div style={tabContainerStyles}>
        {STATES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            style={getTabStyles(activeTab === key)}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <StateEditor
        variant={variant}
        stateName={activeTab}
        stateConfig={variant.states[activeTab]}
        colorTokens={colorTokens}
        spacingTokens={spacingTokens}
        shadowTokens={shadowTokens}
        onUpdate={handleStateUpdate(activeTab)}
        hasIcon={variant.icon?.type !== 'none' && variant.icon?.type !== undefined}
      />

      <div style={actionsContainerStyles}>
        {!isDefault ? (
          <button
            type="button"
            style={deleteButtonStyles}
            onClick={handleDelete}
          >
            Delete Variant
          </button>
        ) : (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Default variant cannot be deleted
          </div>
        )}
        <div style={buttonGroupStyles}>
          <button type="button" style={actionButtonStyles} onClick={handleDuplicate}>
            Copy & Edit
          </button>
        </div>
      </div>
    </div>
  );
};

ButtonEditor.displayName = 'ButtonEditor';
