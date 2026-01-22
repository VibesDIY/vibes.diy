/**
 * TokensEditor Component
 *
 * Advanced editor for design tokens with color pickers, typography controls,
 * spacing, radii, shadows, effects, and responsive breakpoints.
 */

import React, { useState, useCallback } from 'react';
import type {
  TokensEditorProps,
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  ShadowLayer,
  EffectToken,
  BreakpointToken,
  CSSUnit,
} from './TokensEditor.types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  updateColorToken as updateColorTokenAction,
  addColorToken as addColorTokenAction,
  deleteColorToken as deleteColorTokenAction,
  updateTypographyToken as updateTypographyTokenAction,
  addTypographyToken as addTypographyTokenAction,
  deleteTypographyToken as deleteTypographyTokenAction,
  updateDefaultFontFamily as updateDefaultFontFamilyAction,
  updateSpacingToken as updateSpacingTokenAction,
  addSpacingToken as addSpacingTokenAction,
  deleteSpacingToken as deleteSpacingTokenAction,
  updateRadiusToken as updateRadiusTokenAction,
  updateRadiusCorner as updateRadiusCornerAction,
  addRadiusToken as addRadiusTokenAction,
  deleteRadiusToken as deleteRadiusTokenAction,
  updateShadowToken as updateShadowTokenAction,
  updateShadowLayer as updateShadowLayerAction,
  addShadowLayer as addShadowLayerAction,
  deleteShadowLayer as deleteShadowLayerAction,
  addShadowToken as addShadowTokenAction,
  deleteShadowToken as deleteShadowTokenAction,
  updateEffectToken as updateEffectTokenAction,
  addEffectToken as addEffectTokenAction,
  deleteEffectToken as deleteEffectTokenAction,
  updateBreakpointToken as updateBreakpointTokenAction,
  addBreakpointToken as addBreakpointTokenAction,
  deleteBreakpointToken as deleteBreakpointTokenAction,
  resetToDefaults as resetToDefaultsAction,
} from '../../store/designTokensSlice';
import './TokensEditor.css';

type TabType = 'colors' | 'typography' | 'spacing' | 'radius' | 'shadows' | 'effects' | 'breakpoints';

const CSS_UNITS: CSSUnit[] = ['px', '%', 'rem', 'em', 'vw', 'vh', 'vmin', 'vmax', 'ch'];

// Reusable Numeric Input with Unit Dropdown
interface NumericInputProps {
  value: number;
  unit: CSSUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: CSSUnit) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
}

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  unit,
  onValueChange,
  onUnitChange,
  label,
  min = -9999,
  max = 9999,
  step = 1,
}) => (
  <div className="vibes-token-field">
    {label && <label className="vibes-token-label">{label}</label>}
    <div className="vibes-numeric-input-wrapper">
      <input
        type="number"
        className="vibes-token-number-input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
      />
      <select
        className="vibes-token-unit-select"
        value={unit}
        onChange={(e) => onUnitChange(e.target.value as CSSUnit)}
      >
        {CSS_UNITS.map(u => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
    </div>
  </div>
);

export const TokensEditor: React.FC<TokensEditorProps> = ({ onTokenChange: _onTokenChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>('colors');
  const dispatch = useAppDispatch();

  // Get state from Redux
  const colorTokens = useAppSelector(state => state.designTokens.colorTokens);
  const typographyTokens = useAppSelector(state => state.designTokens.typographyTokens);
  const spacingTokens = useAppSelector(state => state.designTokens.spacingTokens);
  const radiusTokens = useAppSelector(state => state.designTokens.radiusTokens);
  const shadowTokens = useAppSelector(state => state.designTokens.shadowTokens);
  const effectTokens = useAppSelector(state => state.designTokens.effectTokens);
  const breakpointTokens = useAppSelector(state => state.designTokens.breakpointTokens);
  const defaultFontFamily = useAppSelector(state => state.designTokens.defaultFontFamily);

  // Color actions
  const updateColorToken = useCallback((id: string, field: keyof ColorToken, value: string) => {
    dispatch(updateColorTokenAction({ id, field, value }));
  }, [dispatch]);

  const addColorToken = useCallback(() => {
    dispatch(addColorTokenAction());
  }, [dispatch]);

  const deleteColorToken = useCallback((id: string) => {
    dispatch(deleteColorTokenAction(id));
  }, [dispatch]);

  // Typography actions
  const updateTypographyToken = useCallback((id: string, field: keyof TypographyToken, value: string) => {
    dispatch(updateTypographyTokenAction({ id, field, value }));
  }, [dispatch]);

  const addTypographyToken = useCallback(() => {
    dispatch(addTypographyTokenAction());
  }, [dispatch]);

  const deleteTypographyToken = useCallback((id: string) => {
    dispatch(deleteTypographyTokenAction(id));
  }, [dispatch]);

  const updateDefaultFontFamily = useCallback((fontFamily: string) => {
    dispatch(updateDefaultFontFamilyAction(fontFamily));
  }, [dispatch]);

  // Spacing actions
  const updateSpacingToken = useCallback((id: string, field: keyof SpacingToken, value: string | number) => {
    dispatch(updateSpacingTokenAction({ id, field, value }));
  }, [dispatch]);

  const addSpacingToken = useCallback(() => {
    dispatch(addSpacingTokenAction());
  }, [dispatch]);

  const deleteSpacingToken = useCallback((id: string) => {
    dispatch(deleteSpacingTokenAction(id));
  }, [dispatch]);

  // Radius actions
  const updateRadiusToken = useCallback((id: string, field: string, value: number | string | boolean) => {
    dispatch(updateRadiusTokenAction({ id, field, value }));
  }, [dispatch]);

  const updateRadiusCorner = useCallback((id: string, corner: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft', field: 'value' | 'unit', value: number | string) => {
    dispatch(updateRadiusCornerAction({ id, corner, field, value }));
  }, [dispatch]);

  const addRadiusToken = useCallback(() => {
    dispatch(addRadiusTokenAction());
  }, [dispatch]);

  const deleteRadiusToken = useCallback((id: string) => {
    dispatch(deleteRadiusTokenAction(id));
  }, [dispatch]);

  // Shadow actions
  const updateShadowToken = useCallback((id: string, field: keyof ShadowToken, value: string) => {
    dispatch(updateShadowTokenAction({ id, field, value }));
  }, [dispatch]);

  const updateShadowLayer = useCallback((tokenId: string, layerId: string, field: keyof ShadowLayer, value: unknown) => {
    dispatch(updateShadowLayerAction({ tokenId, layerId, field, value }));
  }, [dispatch]);

  const addShadowLayer = useCallback((tokenId: string) => {
    dispatch(addShadowLayerAction(tokenId));
  }, [dispatch]);

  const deleteShadowLayer = useCallback((tokenId: string, layerId: string) => {
    dispatch(deleteShadowLayerAction({ tokenId, layerId }));
  }, [dispatch]);

  const addShadowToken = useCallback(() => {
    dispatch(addShadowTokenAction());
  }, [dispatch]);

  const deleteShadowToken = useCallback((id: string) => {
    dispatch(deleteShadowTokenAction(id));
  }, [dispatch]);

  // Effect actions
  const updateEffectToken = useCallback((id: string, field: keyof EffectToken, value: unknown) => {
    dispatch(updateEffectTokenAction({ id, field, value }));
  }, [dispatch]);

  const addEffectToken = useCallback(() => {
    dispatch(addEffectTokenAction());
  }, [dispatch]);

  const deleteEffectToken = useCallback((id: string) => {
    dispatch(deleteEffectTokenAction(id));
  }, [dispatch]);

  // Breakpoint actions
  const updateBreakpointToken = useCallback((id: string, field: keyof BreakpointToken, value: unknown) => {
    dispatch(updateBreakpointTokenAction({ id, field, value }));
  }, [dispatch]);

  const addBreakpointToken = useCallback(() => {
    dispatch(addBreakpointTokenAction());
  }, [dispatch]);

  const deleteBreakpointToken = useCallback((id: string) => {
    dispatch(deleteBreakpointTokenAction(id));
  }, [dispatch]);

  const resetToDefaults = useCallback(() => {
    dispatch(resetToDefaultsAction());
  }, [dispatch]);

  const exportTokens = useCallback(() => {
    const data = {
      colors: colorTokens,
      typography: typographyTokens,
      spacing: spacingTokens,
      radius: radiusTokens,
      shadows: shadowTokens,
      effects: effectTokens,
      breakpoints: breakpointTokens,
      defaultFontFamily: defaultFontFamily,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-tokens.json';
    a.click();
  }, [colorTokens, typographyTokens, spacingTokens, radiusTokens, shadowTokens, effectTokens, breakpointTokens, defaultFontFamily]);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'colors', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'spacing', label: 'Spacing' },
    { id: 'radius', label: 'Radius' },
    { id: 'shadows', label: 'Shadows' },
    { id: 'effects', label: 'Effects' },
    { id: 'breakpoints', label: 'Breakpoints' },
  ];

  return (
    <div className="vibes-tokens-editor">
      {/* Tabs */}
      <div className="vibes-tokens-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`vibes-tokens-tab ${activeTab === tab.id ? 'vibes-tokens-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <div className="vibes-tokens-section">
          <div className="vibes-tokens-header">
            <h3 style={{ margin: 0, color: 'var(--vibes-text-primary)' }}>Color Tokens</h3>
            <button className="vibes-tokens-add-btn" onClick={addColorToken}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Color
            </button>
          </div>

          <div className="vibes-tokens-list">
            {colorTokens.map((token: ColorToken) => (
              <div key={token.id} className="vibes-token-card">
                <div className="vibes-token-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="text"
                      className="vibes-token-text-input"
                      style={{ width: '200px' }}
                      value={token.name}
                      onChange={(e) => updateColorToken(token.id, 'name', e.target.value)}
                      placeholder="Token Name"
                    />
                    <span className="vibes-token-variable-badge">{token.variable}</span>
                  </div>
                  <button
                    className="vibes-token-delete-btn"
                    onClick={() => deleteColorToken(token.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="vibes-token-row">
                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Light Mode</label>
                    <div className="vibes-token-color-input-wrapper">
                      <input
                        type="color"
                        className="vibes-token-color-picker"
                        value={token.lightValue}
                        onChange={(e) => updateColorToken(token.id, 'lightValue', e.target.value)}
                      />
                      <input
                        type="text"
                        className="vibes-token-text-input"
                        value={token.lightValue}
                        onChange={(e) => updateColorToken(token.id, 'lightValue', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Dark Mode</label>
                    <div className="vibes-token-color-input-wrapper">
                      <input
                        type="color"
                        className="vibes-token-color-picker"
                        value={token.darkValue}
                        onChange={(e) => updateColorToken(token.id, 'darkValue', e.target.value)}
                      />
                      <input
                        type="text"
                        className="vibes-token-text-input"
                        value={token.darkValue}
                        onChange={(e) => updateColorToken(token.id, 'darkValue', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Typography Tab */}
      {activeTab === 'typography' && (
        <div className="vibes-tokens-section">
          <div className="vibes-tokens-header">
            <h3 style={{ margin: 0, color: 'var(--vibes-text-primary)' }}>Typography Tokens</h3>
            <button className="vibes-tokens-add-btn" onClick={addTypographyToken}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Typography
            </button>
          </div>

          <div className="vibes-token-card" style={{ backgroundColor: 'var(--vibes-bg-tertiary)' }}>
            <div className="vibes-token-field">
              <label className="vibes-token-label">Default Font Family</label>
              <select
                className="vibes-token-select"
                value={defaultFontFamily}
                onChange={(e) => updateDefaultFontFamily(e.target.value)}
              >
                <option value="--font-family-primary">Primary (Alte Haas Grotesk)</option>
                <option value="--font-family-mono">Monospace (Monaco)</option>
              </select>
            </div>
          </div>

          <div className="vibes-tokens-list">
            {typographyTokens.map((token: TypographyToken) => (
              <div key={token.id} className="vibes-token-card">
                <div className="vibes-token-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="text"
                      className="vibes-token-text-input"
                      style={{ width: '200px' }}
                      value={token.name}
                      onChange={(e) => updateTypographyToken(token.id, 'name', e.target.value)}
                      placeholder="Typography Name"
                    />
                    <span className="vibes-token-variable-badge">{token.variable}</span>
                  </div>
                  <button
                    className="vibes-token-delete-btn"
                    onClick={() => deleteTypographyToken(token.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="vibes-token-row">
                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Font Family</label>
                    <select
                      className="vibes-token-select"
                      value={token.fontFamily}
                      onChange={(e) => updateTypographyToken(token.id, 'fontFamily', e.target.value)}
                    >
                      <option value="--font-family-primary">Primary (Alte Haas Grotesk)</option>
                      <option value="--font-family-mono">Monospace (Monaco)</option>
                    </select>
                  </div>

                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Font Size</label>
                    <select
                      className="vibes-token-select"
                      value={token.fontSize}
                      onChange={(e) => updateTypographyToken(token.id, 'fontSize', e.target.value)}
                    >
                      <option value="--font-size-xs">XS (12px)</option>
                      <option value="--font-size-sm">SM (14px)</option>
                      <option value="--font-size-base">Base (16px)</option>
                      <option value="--font-size-lg">LG (18px)</option>
                      <option value="--font-size-xl">XL (20px)</option>
                      <option value="--font-size-2xl">2XL (24px)</option>
                      <option value="--font-size-3xl">3XL (30px)</option>
                      <option value="--font-size-4xl">4XL (36px)</option>
                    </select>
                  </div>
                </div>

                <div className="vibes-token-row">
                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Font Weight</label>
                    <select
                      className="vibes-token-select"
                      value={token.fontWeight}
                      onChange={(e) => updateTypographyToken(token.id, 'fontWeight', e.target.value)}
                    >
                      <option value="--font-weight-normal">Normal (400)</option>
                      <option value="--font-weight-medium">Medium (500)</option>
                      <option value="--font-weight-semibold">Semibold (600)</option>
                      <option value="--font-weight-bold">Bold (700)</option>
                    </select>
                  </div>

                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Color</label>
                    <select
                      className="vibes-token-select"
                      value={token.color}
                      onChange={(e) => updateTypographyToken(token.id, 'color', e.target.value)}
                    >
                      {colorTokens.map((c: ColorToken) => (
                        <option key={c.id} value={c.variable}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="vibes-token-row">
                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Line Height</label>
                    <select
                      className="vibes-token-select"
                      value={token.lineHeight}
                      onChange={(e) => updateTypographyToken(token.id, 'lineHeight', e.target.value)}
                    >
                      <option value="--line-height-tight">Tight (1.25)</option>
                      <option value="--line-height-normal">Normal (1.5)</option>
                      <option value="--line-height-relaxed">Relaxed (1.75)</option>
                      <option value="--line-height-loose">Loose (2)</option>
                    </select>
                  </div>

                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Letter Spacing</label>
                    <select
                      className="vibes-token-select"
                      value={token.letterSpacing}
                      onChange={(e) => updateTypographyToken(token.id, 'letterSpacing', e.target.value)}
                    >
                      <option value="--letter-spacing-tight">Tight (-0.05em)</option>
                      <option value="--letter-spacing-normal">Normal (0)</option>
                      <option value="--letter-spacing-wide">Wide (0.05em)</option>
                    </select>
                  </div>
                </div>

                <div className="vibes-typography-preview">
                  <p style={{
                    margin: 0,
                    fontSize: `var(${token.fontSize})`,
                    fontWeight: `var(${token.fontWeight})`,
                    lineHeight: `var(${token.lineHeight})`,
                    letterSpacing: `var(${token.letterSpacing})`,
                    fontFamily: `var(${token.fontFamily})`,
                    color: `var(${token.color})`,
                  }}>
                    The quick brown fox jumps over the lazy dog
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacing Tab */}
      {activeTab === 'spacing' && (
        <div className="vibes-tokens-section">
          <div className="vibes-tokens-header">
            <h3 style={{ margin: 0, color: 'var(--vibes-text-primary)' }}>Spacing Tokens</h3>
            <button className="vibes-tokens-add-btn" onClick={addSpacingToken}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Spacing
            </button>
          </div>

          <div className="vibes-tokens-list">
            {spacingTokens.map((token: SpacingToken) => (
              <div key={token.id} className="vibes-token-card">
                <div className="vibes-token-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="text"
                      className="vibes-token-text-input"
                      style={{ width: '150px' }}
                      value={token.name}
                      onChange={(e) => updateSpacingToken(token.id, 'name', e.target.value)}
                      placeholder="Token Name"
                    />
                    <span className="vibes-token-variable-badge">{token.variable}</span>
                  </div>
                  <button
                    className="vibes-token-delete-btn"
                    onClick={() => deleteSpacingToken(token.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="vibes-token-row">
                  <NumericInput
                    label="Value"
                    value={token.value}
                    unit={token.unit}
                    onValueChange={(v) => updateSpacingToken(token.id, 'value', v)}
                    onUnitChange={(u) => updateSpacingToken(token.id, 'unit', u)}
                    min={0}
                  />

                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Category</label>
                    <select
                      className="vibes-token-select"
                      value={token.category}
                      onChange={(e) => updateSpacingToken(token.id, 'category', e.target.value)}
                    >
                      <option value="margin">Margin</option>
                      <option value="padding">Padding</option>
                      <option value="gap">Gap</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                {/* Preview */}
                <div className="vibes-spacing-preview">
                  <div
                    className="vibes-spacing-preview-box"
                    style={{ width: `${token.value}${token.unit}`, maxWidth: '100%' }}
                  />
                  <span className="vibes-spacing-preview-label">{token.value}{token.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Radius Tab */}
      {activeTab === 'radius' && (
        <div className="vibes-tokens-section">
          <div className="vibes-tokens-header">
            <h3 style={{ margin: 0, color: 'var(--vibes-text-primary)' }}>Border Radius Tokens</h3>
            <button className="vibes-tokens-add-btn" onClick={addRadiusToken}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Radius
            </button>
          </div>

          <div className="vibes-tokens-list">
            {radiusTokens.map((token: RadiusToken) => (
              <div key={token.id} className="vibes-token-card">
                <div className="vibes-token-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="text"
                      className="vibes-token-text-input"
                      style={{ width: '150px' }}
                      value={token.name}
                      onChange={(e) => updateRadiusToken(token.id, 'name', e.target.value)}
                      placeholder="Token Name"
                    />
                    <span className="vibes-token-variable-badge">{token.variable}</span>
                  </div>
                  <button
                    className="vibes-token-delete-btn"
                    onClick={() => deleteRadiusToken(token.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="vibes-token-row">
                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Mode</label>
                    <select
                      className="vibes-token-select"
                      value={token.isIndividual ? 'individual' : 'uniform'}
                      onChange={(e) => updateRadiusToken(token.id, 'isIndividual', e.target.value === 'individual')}
                    >
                      <option value="uniform">Uniform (All corners)</option>
                      <option value="individual">Individual Corners</option>
                    </select>
                  </div>
                </div>

                {!token.isIndividual ? (
                  <div className="vibes-token-row">
                    <NumericInput
                      label="Radius"
                      value={token.value}
                      unit={token.unit}
                      onValueChange={(v) => updateRadiusToken(token.id, 'value', v)}
                      onUnitChange={(u) => updateRadiusToken(token.id, 'unit', u)}
                      min={0}
                    />
                  </div>
                ) : (
                  <>
                    <div className="vibes-token-row">
                      <NumericInput
                        label="Top Left"
                        value={token.topLeft?.value || 0}
                        unit={token.topLeft?.unit || 'px'}
                        onValueChange={(v) => updateRadiusCorner(token.id, 'topLeft', 'value', v)}
                        onUnitChange={(u) => updateRadiusCorner(token.id, 'topLeft', 'unit', u)}
                        min={0}
                      />
                      <NumericInput
                        label="Top Right"
                        value={token.topRight?.value || 0}
                        unit={token.topRight?.unit || 'px'}
                        onValueChange={(v) => updateRadiusCorner(token.id, 'topRight', 'value', v)}
                        onUnitChange={(u) => updateRadiusCorner(token.id, 'topRight', 'unit', u)}
                        min={0}
                      />
                    </div>
                    <div className="vibes-token-row">
                      <NumericInput
                        label="Bottom Left"
                        value={token.bottomLeft?.value || 0}
                        unit={token.bottomLeft?.unit || 'px'}
                        onValueChange={(v) => updateRadiusCorner(token.id, 'bottomLeft', 'value', v)}
                        onUnitChange={(u) => updateRadiusCorner(token.id, 'bottomLeft', 'unit', u)}
                        min={0}
                      />
                      <NumericInput
                        label="Bottom Right"
                        value={token.bottomRight?.value || 0}
                        unit={token.bottomRight?.unit || 'px'}
                        onValueChange={(v) => updateRadiusCorner(token.id, 'bottomRight', 'value', v)}
                        onUnitChange={(u) => updateRadiusCorner(token.id, 'bottomRight', 'unit', u)}
                        min={0}
                      />
                    </div>
                  </>
                )}

                {/* Preview */}
                <div className="vibes-radius-preview">
                  <div
                    className="vibes-radius-preview-box"
                    style={{
                      borderRadius: token.isIndividual
                        ? `${token.topLeft?.value || 0}${token.topLeft?.unit || 'px'} ${token.topRight?.value || 0}${token.topRight?.unit || 'px'} ${token.bottomRight?.value || 0}${token.bottomRight?.unit || 'px'} ${token.bottomLeft?.value || 0}${token.bottomLeft?.unit || 'px'}`
                        : `${token.value}${token.unit}`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shadows Tab */}
      {activeTab === 'shadows' && (
        <div className="vibes-tokens-section">
          <div className="vibes-tokens-header">
            <h3 style={{ margin: 0, color: 'var(--vibes-text-primary)' }}>Shadow Tokens</h3>
            <button className="vibes-tokens-add-btn" onClick={addShadowToken}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Shadow
            </button>
          </div>

          <div className="vibes-tokens-list">
            {shadowTokens.map((token: ShadowToken) => (
              <div key={token.id} className="vibes-token-card">
                <div className="vibes-token-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="text"
                      className="vibes-token-text-input"
                      style={{ width: '150px' }}
                      value={token.name}
                      onChange={(e) => updateShadowToken(token.id, 'name', e.target.value)}
                      placeholder="Token Name"
                    />
                    <span className="vibes-token-variable-badge">{token.variable}</span>
                  </div>
                  <button
                    className="vibes-token-delete-btn"
                    onClick={() => deleteShadowToken(token.id)}
                  >
                    Delete
                  </button>
                </div>

                {/* Shadow Layers */}
                <div className="vibes-shadow-layers">
                  <div className="vibes-shadow-layers-header">
                    <span className="vibes-token-label">Shadow Layers</span>
                    <button
                      className="vibes-token-add-layer-btn"
                      onClick={() => addShadowLayer(token.id)}
                    >
                      + Add Layer
                    </button>
                  </div>

                  {token.layers.map((layer: ShadowLayer, layerIndex: number) => (
                    <div key={layer.id} className="vibes-shadow-layer">
                      <div className="vibes-shadow-layer-header">
                        <span>Layer {layerIndex + 1}</span>
                        {token.layers.length > 1 && (
                          <button
                            className="vibes-token-delete-layer-btn"
                            onClick={() => deleteShadowLayer(token.id, layer.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="vibes-token-row vibes-token-row--4col">
                        <NumericInput
                          label="X Offset"
                          value={layer.offsetX.value}
                          unit={layer.offsetX.unit}
                          onValueChange={(v) => updateShadowLayer(token.id, layer.id, 'offsetX', { ...layer.offsetX, value: v })}
                          onUnitChange={(u) => updateShadowLayer(token.id, layer.id, 'offsetX', { ...layer.offsetX, unit: u })}
                        />
                        <NumericInput
                          label="Y Offset"
                          value={layer.offsetY.value}
                          unit={layer.offsetY.unit}
                          onValueChange={(v) => updateShadowLayer(token.id, layer.id, 'offsetY', { ...layer.offsetY, value: v })}
                          onUnitChange={(u) => updateShadowLayer(token.id, layer.id, 'offsetY', { ...layer.offsetY, unit: u })}
                        />
                        <NumericInput
                          label="Blur"
                          value={layer.blur.value}
                          unit={layer.blur.unit}
                          onValueChange={(v) => updateShadowLayer(token.id, layer.id, 'blur', { ...layer.blur, value: v })}
                          onUnitChange={(u) => updateShadowLayer(token.id, layer.id, 'blur', { ...layer.blur, unit: u })}
                          min={0}
                        />
                        <NumericInput
                          label="Spread"
                          value={layer.spread.value}
                          unit={layer.spread.unit}
                          onValueChange={(v) => updateShadowLayer(token.id, layer.id, 'spread', { ...layer.spread, value: v })}
                          onUnitChange={(u) => updateShadowLayer(token.id, layer.id, 'spread', { ...layer.spread, unit: u })}
                        />
                      </div>

                      <div className="vibes-token-row">
                        <div className="vibes-token-field">
                          <label className="vibes-token-label">Color</label>
                          <select
                            className="vibes-token-select"
                            value={layer.color.startsWith('var(') ? layer.color : 'custom'}
                            onChange={(e) => {
                              if (e.target.value !== 'custom') {
                                updateShadowLayer(token.id, layer.id, 'color', e.target.value);
                              }
                            }}
                          >
                            <option value="custom">Custom RGBA</option>
                            {colorTokens.map((c: ColorToken) => (
                              <option key={c.id} value={`var(${c.variable})`}>{c.name}</option>
                            ))}
                          </select>
                          {!layer.color.startsWith('var(') && (
                            <input
                              type="text"
                              className="vibes-token-text-input"
                              value={layer.color}
                              onChange={(e) => updateShadowLayer(token.id, layer.id, 'color', e.target.value)}
                              placeholder="rgba(0, 0, 0, 0.1)"
                              style={{ marginTop: '4px' }}
                            />
                          )}
                        </div>

                        <div className="vibes-token-field">
                          <label className="vibes-token-label">Inset</label>
                          <select
                            className="vibes-token-select"
                            value={layer.inset ? 'true' : 'false'}
                            onChange={(e) => updateShadowLayer(token.id, layer.id, 'inset', e.target.value === 'true')}
                          >
                            <option value="false">Outset (default)</option>
                            <option value="true">Inset</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div className="vibes-shadow-preview">
                  <div
                    className="vibes-shadow-preview-box"
                    style={{
                      boxShadow: token.layers.map((layer: ShadowLayer) => {
                        const inset = layer.inset ? 'inset ' : '';
                        return `${inset}${layer.offsetX.value}${layer.offsetX.unit} ${layer.offsetY.value}${layer.offsetY.unit} ${layer.blur.value}${layer.blur.unit} ${layer.spread.value}${layer.spread.unit} ${layer.color}`;
                      }).join(', '),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Effects Tab */}
      {activeTab === 'effects' && (
        <div className="vibes-tokens-section">
          <div className="vibes-tokens-header">
            <h3 style={{ margin: 0, color: 'var(--vibes-text-primary)' }}>Effect Tokens</h3>
            <button className="vibes-tokens-add-btn" onClick={addEffectToken}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Effect
            </button>
          </div>

          <p style={{ color: 'var(--vibes-text-secondary)', fontSize: '14px', margin: '0 0 16px 0' }}>
            Define transitions, animations, and pseudo-element styles (::before, ::after)
          </p>

          <div className="vibes-tokens-list">
            {effectTokens.map((token: EffectToken) => (
              <div key={token.id} className="vibes-token-card">
                <div className="vibes-token-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="text"
                      className="vibes-token-text-input"
                      style={{ width: '150px' }}
                      value={token.name}
                      onChange={(e) => updateEffectToken(token.id, 'name', e.target.value)}
                      placeholder="Token Name"
                    />
                    <span className="vibes-token-variable-badge">{token.variable}</span>
                  </div>
                  <button
                    className="vibes-token-delete-btn"
                    onClick={() => deleteEffectToken(token.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="vibes-token-row">
                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Effect Type</label>
                    <select
                      className="vibes-token-select"
                      value={token.type}
                      onChange={(e) => updateEffectToken(token.id, 'type', e.target.value)}
                    >
                      <option value="transition">Transition</option>
                      <option value="animation">Animation</option>
                      <option value="before">Pseudo ::before</option>
                      <option value="after">Pseudo ::after</option>
                    </select>
                  </div>
                </div>

                {(token.type === 'transition' || token.type === 'animation') && (
                  <>
                    <div className="vibes-token-row">
                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Property</label>
                        <input
                          type="text"
                          className="vibes-token-text-input"
                          value={token.transitionProperty || 'all'}
                          onChange={(e) => updateEffectToken(token.id, 'transitionProperty', e.target.value)}
                          placeholder="all, transform, opacity..."
                        />
                      </div>

                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Duration (ms)</label>
                        <input
                          type="number"
                          className="vibes-token-text-input"
                          value={token.transitionDuration?.value || 200}
                          onChange={(e) => updateEffectToken(token.id, 'transitionDuration', { value: parseInt(e.target.value) || 0, unit: 'px' })}
                          min={0}
                        />
                      </div>
                    </div>

                    <div className="vibes-token-row">
                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Timing Function</label>
                        <select
                          className="vibes-token-select"
                          value={token.transitionTimingFunction || 'ease'}
                          onChange={(e) => updateEffectToken(token.id, 'transitionTimingFunction', e.target.value)}
                        >
                          <option value="linear">Linear</option>
                          <option value="ease">Ease</option>
                          <option value="ease-in">Ease In</option>
                          <option value="ease-out">Ease Out</option>
                          <option value="ease-in-out">Ease In Out</option>
                          <option value="cubic-bezier">Cubic Bezier (custom)</option>
                        </select>
                      </div>

                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Delay (ms)</label>
                        <input
                          type="number"
                          className="vibes-token-text-input"
                          value={token.transitionDelay?.value || 0}
                          onChange={(e) => updateEffectToken(token.id, 'transitionDelay', { value: parseInt(e.target.value) || 0, unit: 'px' })}
                          min={0}
                        />
                      </div>
                    </div>
                  </>
                )}

                {(token.type === 'before' || token.type === 'after') && (
                  <>
                    <div className="vibes-token-row">
                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Content</label>
                        <input
                          type="text"
                          className="vibes-token-text-input"
                          value={token.content || '""'}
                          onChange={(e) => updateEffectToken(token.id, 'content', e.target.value)}
                          placeholder='""'
                        />
                      </div>

                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Position</label>
                        <select
                          className="vibes-token-select"
                          value={token.position || 'absolute'}
                          onChange={(e) => updateEffectToken(token.id, 'position', e.target.value)}
                        >
                          <option value="absolute">Absolute</option>
                          <option value="relative">Relative</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                    </div>

                    <div className="vibes-token-row vibes-token-row--4col">
                      <NumericInput
                        label="Top"
                        value={token.top?.value || 0}
                        unit={token.top?.unit || 'px'}
                        onValueChange={(v) => updateEffectToken(token.id, 'top', { value: v, unit: token.top?.unit || 'px' })}
                        onUnitChange={(u) => updateEffectToken(token.id, 'top', { value: token.top?.value || 0, unit: u })}
                      />
                      <NumericInput
                        label="Right"
                        value={token.right?.value || 0}
                        unit={token.right?.unit || 'px'}
                        onValueChange={(v) => updateEffectToken(token.id, 'right', { value: v, unit: token.right?.unit || 'px' })}
                        onUnitChange={(u) => updateEffectToken(token.id, 'right', { value: token.right?.value || 0, unit: u })}
                      />
                      <NumericInput
                        label="Bottom"
                        value={token.bottom?.value || 0}
                        unit={token.bottom?.unit || 'px'}
                        onValueChange={(v) => updateEffectToken(token.id, 'bottom', { value: v, unit: token.bottom?.unit || 'px' })}
                        onUnitChange={(u) => updateEffectToken(token.id, 'bottom', { value: token.bottom?.value || 0, unit: u })}
                      />
                      <NumericInput
                        label="Left"
                        value={token.left?.value || 0}
                        unit={token.left?.unit || 'px'}
                        onValueChange={(v) => updateEffectToken(token.id, 'left', { value: v, unit: token.left?.unit || 'px' })}
                        onUnitChange={(u) => updateEffectToken(token.id, 'left', { value: token.left?.value || 0, unit: u })}
                      />
                    </div>

                    <div className="vibes-token-row">
                      <NumericInput
                        label="Width"
                        value={token.width?.value || 100}
                        unit={token.width?.unit || '%'}
                        onValueChange={(v) => updateEffectToken(token.id, 'width', { value: v, unit: token.width?.unit || '%' })}
                        onUnitChange={(u) => updateEffectToken(token.id, 'width', { value: token.width?.value || 100, unit: u })}
                        min={0}
                      />
                      <NumericInput
                        label="Height"
                        value={token.height?.value || 100}
                        unit={token.height?.unit || '%'}
                        onValueChange={(v) => updateEffectToken(token.id, 'height', { value: v, unit: token.height?.unit || '%' })}
                        onUnitChange={(u) => updateEffectToken(token.id, 'height', { value: token.height?.value || 100, unit: u })}
                        min={0}
                      />
                    </div>

                    <div className="vibes-token-row">
                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Background Color</label>
                        <select
                          className="vibes-token-select"
                          value={token.backgroundColor || 'transparent'}
                          onChange={(e) => updateEffectToken(token.id, 'backgroundColor', e.target.value)}
                        >
                          <option value="transparent">Transparent</option>
                          {colorTokens.map((c: ColorToken) => (
                            <option key={c.id} value={`var(${c.variable})`}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Border Radius</label>
                        <select
                          className="vibes-token-select"
                          value={token.borderRadius || '0'}
                          onChange={(e) => updateEffectToken(token.id, 'borderRadius', e.target.value)}
                        >
                          {radiusTokens.map((r: RadiusToken) => (
                            <option key={r.id} value={`var(${r.variable})`}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="vibes-token-row">
                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Opacity</label>
                        <input
                          type="number"
                          className="vibes-token-text-input"
                          value={token.opacity !== undefined ? token.opacity : 1}
                          onChange={(e) => updateEffectToken(token.id, 'opacity', parseFloat(e.target.value) || 0)}
                          min={0}
                          max={1}
                          step={0.1}
                        />
                      </div>

                      <div className="vibes-token-field">
                        <label className="vibes-token-label">Z-Index</label>
                        <input
                          type="number"
                          className="vibes-token-text-input"
                          value={token.zIndex !== undefined ? token.zIndex : 0}
                          onChange={(e) => updateEffectToken(token.id, 'zIndex', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakpoints Tab */}
      {activeTab === 'breakpoints' && (
        <div className="vibes-tokens-section">
          <div className="vibes-tokens-header">
            <h3 style={{ margin: 0, color: 'var(--vibes-text-primary)' }}>Breakpoint Tokens</h3>
            <button className="vibes-tokens-add-btn" onClick={addBreakpointToken}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Breakpoint
            </button>
          </div>

          <p style={{ color: 'var(--vibes-text-secondary)', fontSize: '14px', margin: '0 0 16px 0' }}>
            Define responsive breakpoints for mobile, tablet, and desktop layouts
          </p>

          <div className="vibes-tokens-list">
            {breakpointTokens.map((token: BreakpointToken) => (
              <div key={token.id} className="vibes-token-card">
                <div className="vibes-token-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="text"
                      className="vibes-token-text-input"
                      style={{ width: '150px' }}
                      value={token.name}
                      onChange={(e) => updateBreakpointToken(token.id, 'name', e.target.value)}
                      placeholder="Token Name"
                    />
                    <span className="vibes-token-variable-badge">{token.variable}</span>
                  </div>
                  <button
                    className="vibes-token-delete-btn"
                    onClick={() => deleteBreakpointToken(token.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="vibes-token-row">
                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Device Preset</label>
                    <select
                      className="vibes-token-select"
                      value={token.preset || 'custom'}
                      onChange={(e) => {
                        const preset = e.target.value as BreakpointToken['preset'];
                        updateBreakpointToken(token.id, 'preset', preset);
                        // Auto-fill values based on preset
                        if (preset === 'mobile') {
                          updateBreakpointToken(token.id, 'maxWidth', { value: 639, unit: 'px' });
                          updateBreakpointToken(token.id, 'minWidth', undefined);
                        } else if (preset === 'tablet') {
                          updateBreakpointToken(token.id, 'minWidth', { value: 640, unit: 'px' });
                          updateBreakpointToken(token.id, 'maxWidth', { value: 1023, unit: 'px' });
                        } else if (preset === 'desktop') {
                          updateBreakpointToken(token.id, 'minWidth', { value: 1024, unit: 'px' });
                          updateBreakpointToken(token.id, 'maxWidth', { value: 1279, unit: 'px' });
                        } else if (preset === 'wide') {
                          updateBreakpointToken(token.id, 'minWidth', { value: 1280, unit: 'px' });
                          updateBreakpointToken(token.id, 'maxWidth', undefined);
                        }
                      }}
                    >
                      <option value="mobile">Mobile (max: 639px)</option>
                      <option value="tablet">Tablet (640px - 1023px)</option>
                      <option value="desktop">Desktop (1024px - 1279px)</option>
                      <option value="wide">Wide (min: 1280px)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div className="vibes-token-field">
                    <label className="vibes-token-label">Orientation</label>
                    <select
                      className="vibes-token-select"
                      value={token.orientation || ''}
                      onChange={(e) => updateBreakpointToken(token.id, 'orientation', e.target.value || undefined)}
                    >
                      <option value="">Any</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>

                <div className="vibes-token-row">
                  <NumericInput
                    label="Min Width"
                    value={token.minWidth?.value || 0}
                    unit={token.minWidth?.unit || 'px'}
                    onValueChange={(v) => updateBreakpointToken(token.id, 'minWidth', v > 0 ? { value: v, unit: token.minWidth?.unit || 'px' } : undefined)}
                    onUnitChange={(u) => updateBreakpointToken(token.id, 'minWidth', { value: token.minWidth?.value || 0, unit: u })}
                    min={0}
                  />
                  <NumericInput
                    label="Max Width"
                    value={token.maxWidth?.value || 0}
                    unit={token.maxWidth?.unit || 'px'}
                    onValueChange={(v) => updateBreakpointToken(token.id, 'maxWidth', v > 0 ? { value: v, unit: token.maxWidth?.unit || 'px' } : undefined)}
                    onUnitChange={(u) => updateBreakpointToken(token.id, 'maxWidth', { value: token.maxWidth?.value || 0, unit: u })}
                    min={0}
                  />
                </div>

                {/* Media Query Preview */}
                <div className="vibes-breakpoint-preview">
                  <code>
                    @media {token.minWidth && `(min-width: ${token.minWidth.value}${token.minWidth.unit})`}
                    {token.minWidth && token.maxWidth && ' and '}
                    {token.maxWidth && `(max-width: ${token.maxWidth.value}${token.maxWidth.unit})`}
                    {token.orientation && ` and (orientation: ${token.orientation})`}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="vibes-tokens-actions">
        <button className="vibes-tokens-btn vibes-tokens-btn--reset" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
        <button className="vibes-tokens-btn vibes-tokens-btn--export" onClick={exportTokens}>
          Export Tokens JSON
        </button>
      </div>
    </div>
  );
};

TokensEditor.displayName = 'TokensEditor';
