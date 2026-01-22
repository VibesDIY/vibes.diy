import React, { useState, useRef } from 'react';
import type { ButtonIconConfig, IconPosition } from './Button.tokens';
import { FONTAWESOME_ICONS } from './Button.tokens';
import type { SpacingToken } from '../TokensEditor/TokensEditor.types';
import { useAppSelector } from '../../store/hooks';

interface IconPickerProps {
  icon: ButtonIconConfig;
  onIconChange: (icon: ButtonIconConfig) => void;
}

const containerStyles: React.CSSProperties = {
  padding: '16px',
};

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

const tabsContainerStyles: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginBottom: '16px',
  borderBottom: '2px solid var(--color-border)',
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
});

const iconsGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
  gap: '8px',
  maxHeight: '200px',
  overflowY: 'auto',
  padding: '8px',
  backgroundColor: 'var(--color-bg-primary)',
  borderRadius: '4px',
  border: '1px solid var(--color-border)',
};

const getIconButtonStyles = (isSelected: boolean): React.CSSProperties => ({
  width: '48px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
  borderRadius: '4px',
  backgroundColor: isSelected ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
  cursor: 'pointer',
  padding: '8px',
});

const fieldRowStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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

const uploadAreaStyles: React.CSSProperties = {
  border: '2px dashed var(--color-border)',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center',
  cursor: 'pointer',
  backgroundColor: 'var(--color-bg-primary)',
  transition: 'all 0.2s ease',
};

const previewContainerStyles: React.CSSProperties = {
  padding: '16px',
  backgroundColor: 'var(--color-bg-primary)',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '24px',
};

const removeButtonStyles: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--color-error)',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: 'var(--color-error)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-primary)',
};

const renderIcon = (icon: ButtonIconConfig, size: number = 24): React.ReactNode => {
  if (icon.type === 'none') return null;

  if (icon.type === 'fontawesome' && icon.name && FONTAWESOME_ICONS[icon.name]) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="currentColor"
        dangerouslySetInnerHTML={{ __html: FONTAWESOME_ICONS[icon.name] }}
      />
    );
  }

  if (icon.type === 'custom' && icon.customSvg) {
    return (
      <span
        style={{ width: size, height: size, display: 'inline-flex' }}
        dangerouslySetInnerHTML={{ __html: icon.customSvg }}
      />
    );
  }

  return null;
};

const DEFAULT_ICON: ButtonIconConfig = {
  type: 'none',
  name: '',
  customSvg: '',
  positionDesktop: 'left',
  positionMobile: 'left',
  size: '--spacing-md',
  gap: '--spacing-sm',
};

export const IconPicker: React.FC<IconPickerProps> = ({ icon: iconProp, onIconChange }) => {
  const icon = iconProp || DEFAULT_ICON;
  const [activeTab, setActiveTab] = useState<'fontawesome' | 'custom'>(
    icon.type === 'custom' ? 'custom' : 'fontawesome'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const spacingTokens = useAppSelector(state => state.designTokens.spacingTokens);

  const handleUpdate = (field: keyof ButtonIconConfig, value: unknown) => {
    onIconChange({ ...icon, [field]: value });
  };

  const handleSelectFontAwesomeIcon = (iconName: string) => {
    onIconChange({
      ...icon,
      type: 'fontawesome',
      name: iconName,
      customSvg: '',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.svg')) {
      alert('Only SVG files are allowed');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const svgContent = event.target?.result as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');

      if (svgElement) {
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.style.fill = 'currentColor';

        onIconChange({
          ...icon,
          type: 'custom',
          name: file.name.replace('.svg', ''),
          customSvg: svgElement.outerHTML,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveIcon = () => {
    onIconChange({
      ...icon,
      type: 'none',
      name: '',
      customSvg: '',
    });
  };

  const iconNames = Object.keys(FONTAWESOME_ICONS);

  return (
    <div style={containerStyles}>
      {icon.type !== 'none' && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={sectionTitleStyles}>Current Icon</h4>
          <div style={previewContainerStyles}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                color: 'var(--color-text-primary)',
              }}>
                {renderIcon(icon, 32)}
              </div>
              <div style={{ marginTop: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {icon.name || 'Custom'}
              </div>
            </div>
            <button type="button" style={removeButtonStyles} onClick={handleRemoveIcon}>
              Remove Icon
            </button>
          </div>
        </div>
      )}

      <div style={sectionStyles}>
        <h4 style={sectionTitleStyles}>Select Icon</h4>

        <div style={tabsContainerStyles}>
          <button
            type="button"
            style={getTabStyles(activeTab === 'fontawesome')}
            onClick={() => setActiveTab('fontawesome')}
          >
            Font Awesome
          </button>
          <button
            type="button"
            style={getTabStyles(activeTab === 'custom')}
            onClick={() => setActiveTab('custom')}
          >
            Custom SVG
          </button>
        </div>

        {activeTab === 'fontawesome' && (
          <div style={iconsGridStyles}>
            {iconNames.map((name) => (
              <button
                key={name}
                type="button"
                style={getIconButtonStyles(icon.type === 'fontawesome' && icon.name === name)}
                onClick={() => handleSelectFontAwesomeIcon(name)}
                title={name}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 512 512"
                  fill="currentColor"
                  dangerouslySetInnerHTML={{ __html: FONTAWESOME_ICONS[name] }}
                />
              </button>
            ))}
          </div>
        )}

        {activeTab === 'custom' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div
              style={uploadAreaStyles}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'var(--color-border)';
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.svg')) {
                  const input = fileInputRef.current;
                  if (input) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    input.files = dataTransfer.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                Click or drag SVG file here
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Only .svg files are accepted
              </div>
            </div>
          </div>
        )}
      </div>

      {icon.type !== 'none' && (
        <div style={sectionStyles}>
          <h4 style={sectionTitleStyles}>Icon Position</h4>
          <div style={fieldRowStyles}>
            <div style={fieldStyles}>
              <label style={labelStyles}>Desktop Position</label>
              <select
                style={selectStyles}
                value={icon.positionDesktop}
                onChange={(e) => handleUpdate('positionDesktop', e.target.value as IconPosition)}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="none">Hidden</option>
              </select>
            </div>
            <div style={fieldStyles}>
              <label style={labelStyles}>Mobile Position</label>
              <select
                style={selectStyles}
                value={icon.positionMobile}
                onChange={(e) => handleUpdate('positionMobile', e.target.value as IconPosition)}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="none">Hidden</option>
              </select>
            </div>
          </div>
          <div style={fieldRowStyles}>
            <div style={fieldStyles}>
              <label style={labelStyles}>Icon Size</label>
              <select
                style={selectStyles}
                value={icon.size}
                onChange={(e) => handleUpdate('size', e.target.value)}
              >
                {spacingTokens.map((token: SpacingToken) => (
                  <option key={token.id} value={token.variable}>
                    {token.name} ({token.value}{token.unit})
                  </option>
                ))}
              </select>
            </div>
            <div style={fieldStyles}>
              <label style={labelStyles}>Gap (space between icon and text)</label>
              <select
                style={selectStyles}
                value={icon.gap}
                onChange={(e) => handleUpdate('gap', e.target.value)}
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
      )}
    </div>
  );
};

export { renderIcon };
IconPicker.displayName = 'IconPicker';
