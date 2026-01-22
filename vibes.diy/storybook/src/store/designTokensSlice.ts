import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  ColorToken,
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  ShadowLayer,
  EffectToken,
  BreakpointToken,
} from '../components/TokensEditor/TokensEditor.types';

export type ButtonState = 'default' | 'hover' | 'active' | 'disabled';
export type IconPosition = 'left' | 'right' | 'top' | 'bottom' | 'none';

export interface ButtonIconConfig {
  type: 'fontawesome' | 'vibes' | 'custom' | 'none';
  name: string;
  customSvg: string;
  positionDesktop: IconPosition;
  positionMobile: IconPosition;
  size: string;
  gap: string;
}


export const FONTAWESOME_ICONS: Record<string, string> = {
  'arrow-right': '<path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/>',
  'arrow-left': '<path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"/>',
  'check': '<path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>',
  'xmark': '<path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>',
  'plus': '<path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/>',
  'minus': '<path d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z"/>',
  'heart': '<path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"/>',
  'star': '<path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>',
  'user': '<path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/>',
  'envelope': '<path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/>',
  'phone': '<path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/>',
  'search': '<path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>',
  'home': '<path d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"/>',
  'cog': '<path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/>',
  'cart-shopping': '<path d="M0 24C0 10.7 10.7 0 24 0H69.5c22 0 41.5 12.8 50.6 32h411c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3H170.7l5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5H488c13.3 0 24 10.7 24 24s-10.7 24-24 24H199.7c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5H24C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/>',
  'download': '<path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/>',
  'upload': '<path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64zM432 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/>',
  'trash': '<path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>',
  'edit': '<path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L680 phases.3 97.9-97.9L172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/>',
  'eye': '<path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>',
  'lock': '<path d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z"/>',
  'unlock': '<path d="M352 144c0-44.2 35.8-80 80-80s80 35.8 80 80v48c0 17.7 14.3 32 32 32s32-14.3 32-32V144C576 64.5 511.5 0 432 0S288 64.5 288 144v48H64c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V256c0-35.3-28.7-64-64-64H352V144z"/>',
  'bell': '<path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/>',
  'bookmark': '<path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"/>',
  'link': '<path d="M580.3 267.2c56.2-56.2 56.2-147.4 0-203.6S432.8 7.4 376.6 63.6L365.3 75l45.3 45.3 11.3-11.3c31.2-31.2 81.9-31.2 113.1 0s31.2 81.9 0 113.1L422.9 334.1c-31.2 31.2-81.9 31.2-113.1 0c-4.1-4.1-7.8-8.6-11.1-13.4l-45.3 45.3c5.4 6.7 11.3 13 17.7 18.8c56.2 47.6 143.4 43.1 194.1-13.4l115.1-104.2zM59.7 244.8C3.5 301 3.5 392.2 59.7 448.4s147.4 56.2 203.6 0L274.6 437l-45.3-45.3-11.3 11.3c-31.2 31.2-81.9 31.2-113.1 0s-31.2-81.9 0-113.1L217.1 177.9c31.2-31.2 81.9-31.2 113.1 0c4.1 4.1 7.8 8.6 11.1 13.4l45.3-45.3c-5.4-6.7-11.3-13-17.7-18.8C312.7 79.6 225.5 84.1 174.8 140.6L59.7 244.8z"/>',
  'share': '<path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2v64H176C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96h96v64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z"/>',
  'play': '<path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/>',
  'pause': '<path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/>',
  'stop': '<path d="M0 128C0 92.7 28.7 64 64 64H384c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128z"/>',
  'refresh': '<path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L430.6 79.8c-87.5-87.5-229.3-87.5-316.8 0C73.2 120.5 48 175.5 48 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-30.5 12.2-58.2 31.1-79.4zM406.9 309.4c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0L125.7 352H160c17.7 0 32-14.3 32-32s-14.3-32-32-32H32c-17.7 0-32 14.3-32 32V448c0 17.7 14.3 32 32 32s32-14.3 32-32V412.8l17.4 17.4c87.5 87.5 229.3 87.5 316.8 0c40.6-40.6 65.8-95.6 65.8-144c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 30.5-12.2 58.2-31.1 79.4z"/>',
  'spinner': '<path d="M304 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zm0 416a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM48 304a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm464-48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM142.9 437A48 48 0 1 0 75 369.1 48 48 0 1 0 142.9 437zm0-294.2A48 48 0 1 0 75 75a48 48 0 1 0 67.9 67.9zM369.1 437A48 48 0 1 0 437 369.1 48 48 0 1 0 369.1 437z"/>',
  'github': '<path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"/>',
  'twitter': '<path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"/>',
  'facebook': '<path d="M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256C0 376 82.7 476.8 194.2 504.5V334.2H141.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H287V510.1C413.8 494.8 512 386.9 512 256z"/>',
  'linkedin': '<path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"/>',
  'instagram': '<path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S searching339 319.5 339 255.9 searching287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/>',
};

export interface ButtonStateConfig {
  backgroundColor: string;
  borderColor: string;
  shadow: string;
  shadowColor: string;
  translateY: string;
  translateYDirection: 'up' | 'down' | 'none';
  opacity: number;
  iconColor: string;
}

export type WidthMode = 'auto' | 'fixed' | 'full';
export type HeightMode = 'auto' | 'fixed';
export type TextOverflow = 'visible' | 'ellipsis';

export interface ButtonVariantConfig {
  id: string;
  name: string;
  typography: string;
  borderStyle: string;
  borderWidth: string;
  borderRadius: string;
  paddingY: string;
  paddingX: string;
  effect: string;
  // Size options
  widthMode: WidthMode;
  width: string; // spacing token for fixed width
  heightMode: HeightMode;
  height: string; // spacing token for fixed height
  textOverflow: TextOverflow;
  icon: ButtonIconConfig;
  states: {
    default: ButtonStateConfig;
    hover: ButtonStateConfig;
    active: ButtonStateConfig;
    disabled: ButtonStateConfig;
  };
}

const DEFAULT_ICON_CONFIG: ButtonIconConfig = {
  type: 'none',
  name: '',
  customSvg: '',
  positionDesktop: 'left',
  positionMobile: 'left',
  size: '--spacing-md',
  gap: '--spacing-sm',
};

const createDefaultButtonVariant = (
  id: string,
  name: string,
  bgColor: string,
  borderColor: string,
  shadow: string = '--shadow-md',
  shadowHover: string = '--shadow-lg',
  shadowColor: string = 'var(--color-primary)'
): ButtonVariantConfig => ({
  id,
  name,
  typography: '--typography-body',
  borderStyle: 'solid',
  borderWidth: '--spacing-xs',
  borderRadius: '--radius-md',
  paddingY: '--spacing-md',
  paddingX: '--spacing-lg',
  effect: '--effect-hover-lift',
  // Size defaults - auto adapts to content
  widthMode: 'auto',
  width: '--spacing-3xl',
  heightMode: 'auto',
  height: '--spacing-2xl',
  textOverflow: 'visible',
  icon: { ...DEFAULT_ICON_CONFIG },
  states: {
    default: {
      backgroundColor: bgColor,
      borderColor: borderColor,
      shadow: shadow,
      shadowColor: shadowColor,
      translateY: '--spacing-none',
      translateYDirection: 'none',
      opacity: 1,
      iconColor: 'var(--color-text-primary)',
    },
    hover: {
      backgroundColor: bgColor,
      borderColor: borderColor,
      shadow: shadowHover,
      shadowColor: shadowColor,
      translateY: '--spacing-xs',
      translateYDirection: 'up',
      opacity: 1,
      iconColor: 'var(--color-text-primary)',
    },
    active: {
      backgroundColor: bgColor,
      borderColor: borderColor,
      shadow: shadow,
      shadowColor: shadowColor,
      translateY: '--spacing-none',
      translateYDirection: 'none',
      opacity: 1,
      iconColor: 'var(--color-text-primary)',
    },
    disabled: {
      backgroundColor: bgColor,
      borderColor: borderColor,
      shadow: 'none',
      shadowColor: shadowColor,
      translateY: '--spacing-none',
      translateYDirection: 'none',
      opacity: 0.5,
      iconColor: 'var(--color-text-secondary)',
    },
  },
});

const INITIAL_BUTTON_VARIANTS: ButtonVariantConfig[] = [
  createDefaultButtonVariant('btn-1', 'Primary', 'var(--color-primary)', 'var(--color-primary)', '--shadow-md', '--shadow-lg', 'var(--color-primary)'),
  createDefaultButtonVariant('btn-2', 'Secondary', 'var(--color-secondary)', 'var(--color-secondary)', '--shadow-md', '--shadow-lg', 'var(--color-secondary)'),
  createDefaultButtonVariant('btn-3', 'Accent', 'var(--color-accent)', 'var(--color-text-primary)', '--shadow-brutal', '--shadow-brutal-lg', 'var(--color-accent)'),
  createDefaultButtonVariant('btn-4', 'Success', 'var(--color-success)', 'var(--color-success)', '--shadow-md', '--shadow-lg', 'var(--color-success)'),
  createDefaultButtonVariant('btn-5', 'Error', 'var(--color-error)', 'var(--color-error)', '--shadow-md', '--shadow-lg', 'var(--color-error)'),
  {
    ...createDefaultButtonVariant('btn-6', 'Ghost', 'var(--color-bg-primary)', 'var(--color-border)'),
    icon: { ...DEFAULT_ICON_CONFIG },
    states: {
      default: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      hover: {
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
        shadow: '--shadow-sm',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      active: {
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      disabled: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.5,
        iconColor: 'var(--color-text-secondary)',
      },
    },
  },
  {
    id: 'btn-7',
    name: 'Brutal',
    typography: '--typography-body',
    borderStyle: 'solid',
    borderWidth: '--spacing-xs',
    borderRadius: '--radius-none',
    paddingY: '--spacing-md',
    widthMode: 'auto',
    width: '--spacing-3xl',
    heightMode: 'auto',
    height: '--spacing-2xl',
    textOverflow: 'visible',
    paddingX: '--spacing-lg',
    effect: '--effect-hover-lift',
    icon: { ...DEFAULT_ICON_CONFIG },
    states: {
      default: {
        backgroundColor: 'var(--color-accent)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-lg',
        shadowColor: 'var(--color-accent)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      hover: {
        backgroundColor: 'var(--color-accent)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-lg',
        shadowColor: 'var(--color-accent)',
        translateY: '--spacing-xs',
        translateYDirection: 'up',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      active: {
        backgroundColor: 'var(--color-accent)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal',
        shadowColor: 'var(--color-accent)',
        translateY: '--spacing-sm',
        translateYDirection: 'down',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      disabled: {
        backgroundColor: 'var(--color-accent)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal',
        shadowColor: 'var(--color-accent)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.5,
        iconColor: 'var(--color-text-secondary)',
      },
    },
  },
  // VibesButton style variants: Square, Flat, Flat-Rounded, Form
  {
    id: 'btn-8',
    name: 'Square',
    typography: '--typography-body',
    borderStyle: 'solid',
    borderWidth: '--spacing-xs',
    borderRadius: '--radius-lg',
    paddingY: '--spacing-md',
    paddingX: '--spacing-lg',
    effect: '--effect-hover-lift',
    // Fixed square size with ellipsis
    widthMode: 'fixed',
    width: '--spacing-3xl',
    heightMode: 'fixed',
    height: '--spacing-3xl',
    textOverflow: 'ellipsis',
    icon: { ...DEFAULT_ICON_CONFIG },
    states: {
      default: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-xl',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      hover: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-sm',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-xs',
        translateYDirection: 'down',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      active: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-sm',
        translateYDirection: 'down',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      disabled: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-xl',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.5,
        iconColor: 'var(--color-text-secondary)',
      },
    },
  },
  {
    id: 'btn-9',
    name: 'Flat',
    typography: '--typography-body',
    borderStyle: 'solid',
    borderWidth: '--spacing-xs',
    borderRadius: '--radius-lg',
    paddingY: '--spacing-md',
    paddingX: '--spacing-lg',
    effect: '--effect-hover-lift',
    widthMode: 'auto',
    width: '--spacing-3xl',
    heightMode: 'auto',
    height: '--spacing-2xl',
    textOverflow: 'visible',
    icon: { ...DEFAULT_ICON_CONFIG },
    states: {
      default: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-md',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      hover: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-sm',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-xs',
        translateYDirection: 'down',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      active: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-sm',
        translateYDirection: 'down',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      disabled: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-md',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.5,
        iconColor: 'var(--color-text-secondary)',
      },
    },
  },
  {
    id: 'btn-10',
    name: 'Flat-Rounded',
    typography: '--typography-body',
    borderStyle: 'solid',
    borderWidth: '--spacing-xs',
    borderRadius: '--radius-pill',
    paddingY: '--spacing-sm',
    paddingX: '--spacing-md',
    effect: '--effect-hover-lift',
    widthMode: 'auto',
    width: '--spacing-3xl',
    heightMode: 'auto',
    height: '--spacing-2xl',
    textOverflow: 'visible',
    icon: { ...DEFAULT_ICON_CONFIG },
    states: {
      default: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-md',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      hover: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-sm',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-xs',
        translateYDirection: 'down',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      active: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-sm',
        translateYDirection: 'down',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      disabled: {
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: '--shadow-brutal-md',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.5,
        iconColor: 'var(--color-text-secondary)',
      },
    },
  },
  {
    id: 'btn-11',
    name: 'Form',
    typography: '--typography-body',
    borderStyle: 'solid',
    borderWidth: '--spacing-3xs',
    borderRadius: '--radius-form',
    paddingY: '--spacing-3xs',
    paddingX: '--spacing-3xs',
    effect: '--effect-fade-in',
    // Form buttons typically extend full width
    widthMode: 'full',
    width: '--spacing-3xl',
    heightMode: 'auto',
    height: '--spacing-2xl',
    textOverflow: 'ellipsis',
    icon: { ...DEFAULT_ICON_CONFIG },
    states: {
      default: {
        backgroundColor: 'var(--color-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 1,
        iconColor: 'var(--color-text-primary)',
      },
      hover: {
        backgroundColor: 'var(--color-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.9,
        iconColor: 'var(--color-text-primary)',
      },
      active: {
        backgroundColor: 'var(--color-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.8,
        iconColor: 'var(--color-text-primary)',
      },
      disabled: {
        backgroundColor: 'var(--color-primary)',
        borderColor: 'var(--color-text-primary)',
        shadow: 'none',
        shadowColor: 'var(--color-primary)',
        translateY: '--spacing-none',
        translateYDirection: 'none',
        opacity: 0.5,
        iconColor: 'var(--color-text-secondary)',
      },
    },
  },
];

const INITIAL_COLOR_TOKENS: ColorToken[] = [
  { id: '1', name: 'Primary', variable: '--color-primary', lightValue: '#3b82f6', darkValue: '#60a5fa', category: 'Brand' },
  { id: '2', name: 'Secondary', variable: '--color-secondary', lightValue: '#8b5cf6', darkValue: '#a78bfa', category: 'Brand' },
  { id: '3', name: 'Accent', variable: '--color-accent', lightValue: '#f59e0b', darkValue: '#fbbf24', category: 'Brand' },
  { id: '4', name: 'Success', variable: '--color-success', lightValue: '#10b981', darkValue: '#34d399', category: 'Status' },
  { id: '5', name: 'Error', variable: '--color-error', lightValue: '#ef4444', darkValue: '#f87171', category: 'Status' },
  { id: '6', name: 'Background', variable: '--color-background', lightValue: '#000000', darkValue: '#000000', category: 'Background' },
  { id: '7', name: 'Background Primary', variable: '--color-bg-primary', lightValue: '#ffffff', darkValue: '#111827', category: 'Background' },
  { id: '8', name: 'Background Secondary', variable: '--color-bg-secondary', lightValue: '#f9fafb', darkValue: '#1f2937', category: 'Background' },
  { id: '9', name: 'Text Primary', variable: '--color-text-primary', lightValue: '#111827', darkValue: '#f9fafb', category: 'Text' },
  { id: '10', name: 'Text Secondary', variable: '--color-text-secondary', lightValue: '#6b7280', darkValue: '#d1d5db', category: 'Text' },
  { id: '11', name: 'Border', variable: '--color-border', lightValue: '#e5e7eb', darkValue: '#374151', category: 'Border' },
];

const INITIAL_TYPOGRAPHY_TOKENS: TypographyToken[] = [
  { id: '1', name: 'Heading 1', variable: '--typography-h1', color: '--color-text-primary', fontFamily: '--font-family-primary', fontSize: '--font-size-4xl', lineHeight: '--line-height-tight', fontWeight: '--font-weight-bold', letterSpacing: '--letter-spacing-tight' },
  { id: '2', name: 'Body', variable: '--typography-body', color: '--color-text-primary', fontFamily: '--font-family-primary', fontSize: '--font-size-base', lineHeight: '--line-height-normal', fontWeight: '--font-weight-normal', letterSpacing: '--letter-spacing-normal' },
];

const INITIAL_SPACING_TOKENS: SpacingToken[] = [
  { id: '0', name: 'None', variable: '--spacing-none', value: 0, unit: 'px', category: 'custom' },
  { id: '1', name: '3XS', variable: '--spacing-3xs', value: 3, unit: 'px', category: 'custom' },
  { id: '2', name: 'XS', variable: '--spacing-xs', value: 4, unit: 'px', category: 'custom' },
  { id: '3', name: 'SM', variable: '--spacing-sm', value: 8, unit: 'px', category: 'custom' },
  { id: '4', name: 'MD', variable: '--spacing-md', value: 16, unit: 'px', category: 'custom' },
  { id: '5', name: 'LG', variable: '--spacing-lg', value: 24, unit: 'px', category: 'custom' },
  { id: '6', name: 'XL', variable: '--spacing-xl', value: 32, unit: 'px', category: 'custom' },
  { id: '7', name: '2XL', variable: '--spacing-2xl', value: 48, unit: 'px', category: 'custom' },
  { id: '8', name: '3XL', variable: '--spacing-3xl', value: 64, unit: 'px', category: 'custom' },
];

const INITIAL_RADIUS_TOKENS: RadiusToken[] = [
  { id: '1', name: 'None', variable: '--radius-none', value: 0, unit: 'px', isIndividual: false },
  { id: '2', name: 'SM', variable: '--radius-sm', value: 4, unit: 'px', isIndividual: false },
  { id: '3', name: 'MD', variable: '--radius-md', value: 8, unit: 'px', isIndividual: false },
  { id: '4', name: 'LG', variable: '--radius-lg', value: 12, unit: 'px', isIndividual: false },
  { id: '5', name: 'XL', variable: '--radius-xl', value: 16, unit: 'px', isIndividual: false },
  { id: '6', name: 'Form', variable: '--radius-form', value: 20, unit: 'px', isIndividual: false },
  { id: '7', name: '2XL', variable: '--radius-2xl', value: 24, unit: 'px', isIndividual: false },
  { id: '8', name: 'Pill', variable: '--radius-pill', value: 50, unit: 'px', isIndividual: false },
  { id: '9', name: 'Full', variable: '--radius-full', value: 9999, unit: 'px', isIndividual: false },
];

const INITIAL_SHADOW_TOKENS: ShadowToken[] = [
  {
    id: '1',
    name: 'SM',
    variable: '--shadow-sm',
    layers: [
      { id: '1-1', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 1, unit: 'px' }, blur: { value: 2, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'rgba(0, 0, 0, 0.1)', inset: false }
    ]
  },
  {
    id: '2',
    name: 'MD',
    variable: '--shadow-md',
    layers: [
      { id: '2-1', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 4, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'rgba(0, 0, 0, 0.1)', inset: false },
      { id: '2-2', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 4, unit: 'px' }, blur: { value: 8, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'rgba(0, 0, 0, 0.15)', inset: false }
    ]
  },
  {
    id: '3',
    name: 'LG',
    variable: '--shadow-lg',
    layers: [
      { id: '3-1', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 4, unit: 'px' }, blur: { value: 8, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'rgba(0, 0, 0, 0.15)', inset: false },
      { id: '3-2', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 8, unit: 'px' }, blur: { value: 16, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'rgba(0, 0, 0, 0.2)', inset: false }
    ]
  },
  {
    id: '4',
    name: 'Brutal',
    variable: '--shadow-brutal',
    layers: [
      { id: '4-1', offsetX: { value: 4, unit: 'px' }, offsetY: { value: 4, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'var(--color-text-primary)', inset: false }
    ]
  },
  {
    id: '5',
    name: 'Brutal LG',
    variable: '--shadow-brutal-lg',
    layers: [
      { id: '5-1', offsetX: { value: 6, unit: 'px' }, offsetY: { value: 6, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'var(--color-text-primary)', inset: false }
    ]
  },
  {
    id: '6',
    name: 'Inset',
    variable: '--shadow-inset',
    layers: [
      { id: '6-1', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 4, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'rgba(0, 0, 0, 0.1)', inset: true }
    ]
  },
  // Brutal shadows for VibesButton styles (square, flat, flat-rounded)
  {
    id: '7',
    name: 'Brutal XL',
    variable: '--shadow-brutal-xl',
    layers: [
      { id: '7-1', offsetX: { value: 8, unit: 'px' }, offsetY: { value: 10, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'var(--color-primary)', inset: false },
      { id: '7-2', offsetX: { value: 8, unit: 'px' }, offsetY: { value: 10, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 2, unit: 'px' }, color: 'var(--color-text-primary)', inset: false }
    ]
  },
  {
    id: '8',
    name: 'Brutal MD',
    variable: '--shadow-brutal-md',
    layers: [
      { id: '8-1', offsetX: { value: 7, unit: 'px' }, offsetY: { value: 8, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'var(--color-primary)', inset: false },
      { id: '8-2', offsetX: { value: 7, unit: 'px' }, offsetY: { value: 8, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 2, unit: 'px' }, color: 'var(--color-text-primary)', inset: false }
    ]
  },
  {
    id: '9',
    name: 'Brutal SM',
    variable: '--shadow-brutal-sm',
    layers: [
      { id: '9-1', offsetX: { value: 2, unit: 'px' }, offsetY: { value: 3, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: 'var(--color-primary)', inset: false },
      { id: '9-2', offsetX: { value: 2, unit: 'px' }, offsetY: { value: 3, unit: 'px' }, blur: { value: 0, unit: 'px' }, spread: { value: 2, unit: 'px' }, color: 'var(--color-text-primary)', inset: false }
    ]
  },
];

const INITIAL_EFFECT_TOKENS: EffectToken[] = [
  {
    id: '1',
    name: 'Hover Lift',
    variable: '--effect-hover-lift',
    type: 'transition',
    transitionProperty: 'transform, box-shadow',
    transitionDuration: { value: 200, unit: 'px' },
    transitionTimingFunction: 'ease',
  },
  {
    id: '2',
    name: 'Fade In',
    variable: '--effect-fade-in',
    type: 'transition',
    transitionProperty: 'opacity',
    transitionDuration: { value: 300, unit: 'px' },
    transitionTimingFunction: 'ease-in-out',
  },
];

const INITIAL_BREAKPOINT_TOKENS: BreakpointToken[] = [
  { id: '1', name: 'Mobile', variable: '--breakpoint-mobile', maxWidth: { value: 639, unit: 'px' }, preset: 'mobile' },
  { id: '2', name: 'Tablet', variable: '--breakpoint-tablet', minWidth: { value: 640, unit: 'px' }, maxWidth: { value: 1023, unit: 'px' }, preset: 'tablet' },
  { id: '3', name: 'Desktop', variable: '--breakpoint-desktop', minWidth: { value: 1024, unit: 'px' }, maxWidth: { value: 1279, unit: 'px' }, preset: 'desktop' },
  { id: '4', name: 'Wide', variable: '--breakpoint-wide', minWidth: { value: 1280, unit: 'px' }, preset: 'wide' },
];

interface DesignTokensState {
  colorTokens: ColorToken[];
  typographyTokens: TypographyToken[];
  spacingTokens: SpacingToken[];
  radiusTokens: RadiusToken[];
  shadowTokens: ShadowToken[];
  effectTokens: EffectToken[];
  breakpointTokens: BreakpointToken[];
  buttonVariants: ButtonVariantConfig[];
  defaultFontFamily: string;
}

const initialState: DesignTokensState = {
  colorTokens: INITIAL_COLOR_TOKENS,
  typographyTokens: INITIAL_TYPOGRAPHY_TOKENS,
  spacingTokens: INITIAL_SPACING_TOKENS,
  radiusTokens: INITIAL_RADIUS_TOKENS,
  shadowTokens: INITIAL_SHADOW_TOKENS,
  effectTokens: INITIAL_EFFECT_TOKENS,
  breakpointTokens: INITIAL_BREAKPOINT_TOKENS,
  buttonVariants: INITIAL_BUTTON_VARIANTS,
  defaultFontFamily: '--font-family-primary',
};

const updateCSSVariable = (token: ColorToken) => {
  if (typeof document === 'undefined') return;

  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.documentElement.style.setProperty(`${token.variable}-light`, token.lightValue);
  document.documentElement.style.setProperty(`${token.variable}-dark`, token.darkValue);

  const activeValue = isDarkMode ? token.darkValue : token.lightValue;
  document.documentElement.style.setProperty(token.variable, activeValue);
};

// Helper to convert numeric value to CSS string
const toCSS = (value: number, unit: string): string => `${value}${unit}`;

const updateSpacingCSSVariable = (token: SpacingToken) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(token.variable, toCSS(token.value, token.unit));
};

const updateRadiusCSSVariable = (token: RadiusToken) => {
  if (typeof document === 'undefined') return;
  if (token.isIndividual && token.topLeft && token.topRight && token.bottomRight && token.bottomLeft) {
    const value = `${toCSS(token.topLeft.value, token.topLeft.unit)} ${toCSS(token.topRight.value, token.topRight.unit)} ${toCSS(token.bottomRight.value, token.bottomRight.unit)} ${toCSS(token.bottomLeft.value, token.bottomLeft.unit)}`;
    document.documentElement.style.setProperty(token.variable, value);
  } else {
    document.documentElement.style.setProperty(token.variable, toCSS(token.value, token.unit));
  }
};

const updateShadowCSSVariable = (token: ShadowToken) => {
  if (typeof document === 'undefined') return;
  const shadowValue = token.layers.map(layer => {
    const inset = layer.inset ? 'inset ' : '';
    return `${inset}${toCSS(layer.offsetX.value, layer.offsetX.unit)} ${toCSS(layer.offsetY.value, layer.offsetY.unit)} ${toCSS(layer.blur.value, layer.blur.unit)} ${toCSS(layer.spread.value, layer.spread.unit)} ${layer.color}`;
  }).join(', ');
  document.documentElement.style.setProperty(token.variable, shadowValue || 'none');
};

const designTokensSlice = createSlice({
  name: 'designTokens',
  initialState,
  reducers: {
    updateColorToken: (state, action: PayloadAction<{ id: string; field: keyof ColorToken; value: string }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.colorTokens.some(t =>
          t.id !== id && t.name.toLowerCase() === value.toLowerCase()
        );
        if (isDuplicate) {
          alert('Token name already exists. Please use a unique name.');
          return;
        }
      }

      const tokenIndex = state.colorTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.colorTokens[tokenIndex];

      if (field === 'name') {
        const variable = `--color-${value.toLowerCase().replace(/\s+/g, '-')}`;
        state.colorTokens[tokenIndex] = { ...token, name: value, variable };
        updateCSSVariable(state.colorTokens[tokenIndex]);
      } else {
        state.colorTokens[tokenIndex] = { ...token, [field]: value };
        if (field === 'lightValue' || field === 'darkValue') {
          updateCSSVariable(state.colorTokens[tokenIndex]);
        }
      }
    },

    addColorToken: (state) => {
      const newToken: ColorToken = {
        id: Date.now().toString(),
        name: 'New Color',
        variable: '--color-new-color',
        lightValue: '#000000',
        darkValue: '#ffffff',
        category: 'Custom',
      };
      state.colorTokens.unshift(newToken);
      updateCSSVariable(newToken);
    },

    deleteColorToken: (state, action: PayloadAction<string>) => {
      state.colorTokens = state.colorTokens.filter(token => token.id !== action.payload);
    },

    updateTypographyToken: (state, action: PayloadAction<{ id: string; field: keyof TypographyToken; value: string }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.typographyTokens.some(t =>
          t.id !== id && t.name.toLowerCase() === value.toLowerCase()
        );
        if (isDuplicate) {
          alert('Token name already exists. Please use a unique name.');
          return;
        }
      }

      const tokenIndex = state.typographyTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.typographyTokens[tokenIndex];

      if (field === 'name') {
        const variable = `--typography-${value.toLowerCase().replace(/\s+/g, '-')}`;
        state.typographyTokens[tokenIndex] = { ...token, name: value, variable };
      } else {
        state.typographyTokens[tokenIndex] = { ...token, [field]: value };
      }
    },

    addTypographyToken: (state) => {
      const newToken: TypographyToken = {
        id: Date.now().toString(),
        name: 'New Typography',
        variable: '--typography-new-typography',
        color: '--color-text-primary',
        fontFamily: state.defaultFontFamily,
        fontSize: '--font-size-base',
        lineHeight: '--line-height-normal',
        fontWeight: '--font-weight-normal',
        letterSpacing: '--letter-spacing-normal',
      };
      state.typographyTokens.unshift(newToken);
    },

    deleteTypographyToken: (state, action: PayloadAction<string>) => {
      state.typographyTokens = state.typographyTokens.filter(token => token.id !== action.payload);
    },

    updateDefaultFontFamily: (state, action: PayloadAction<string>) => {
      state.defaultFontFamily = action.payload;
    },

    // ============================================
    // SPACING TOKEN REDUCERS
    // ============================================
    updateSpacingToken: (state, action: PayloadAction<{ id: string; field: keyof SpacingToken; value: string | number }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.spacingTokens.some(t =>
          t.id !== id && t.name.toLowerCase() === String(value).toLowerCase()
        );
        if (isDuplicate) {
          alert('Token name already exists. Please use a unique name.');
          return;
        }
      }

      const tokenIndex = state.spacingTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.spacingTokens[tokenIndex];

      if (field === 'name') {
        const variable = `--spacing-${String(value).toLowerCase().replace(/\s+/g, '-')}`;
        state.spacingTokens[tokenIndex] = { ...token, name: String(value), variable };
      } else if (field === 'value') {
        state.spacingTokens[tokenIndex] = { ...token, value: Number(value) };
      } else {
        (state.spacingTokens[tokenIndex] as Record<string, unknown>)[field] = value;
      }
      updateSpacingCSSVariable(state.spacingTokens[tokenIndex]);
    },

    addSpacingToken: (state) => {
      const newToken: SpacingToken = {
        id: Date.now().toString(),
        name: 'New Spacing',
        variable: '--spacing-new-spacing',
        value: 16,
        unit: 'px',
        category: 'custom',
      };
      state.spacingTokens.unshift(newToken);
      updateSpacingCSSVariable(newToken);
    },

    deleteSpacingToken: (state, action: PayloadAction<string>) => {
      state.spacingTokens = state.spacingTokens.filter(token => token.id !== action.payload);
    },

    // ============================================
    // RADIUS TOKEN REDUCERS
    // ============================================
    updateRadiusToken: (state, action: PayloadAction<{ id: string; field: string; value: number | string | boolean }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.radiusTokens.some(t =>
          t.id !== id && t.name.toLowerCase() === String(value).toLowerCase()
        );
        if (isDuplicate) {
          alert('Token name already exists. Please use a unique name.');
          return;
        }
      }

      const tokenIndex = state.radiusTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.radiusTokens[tokenIndex];

      if (field === 'name') {
        const variable = `--radius-${String(value).toLowerCase().replace(/\s+/g, '-')}`;
        state.radiusTokens[tokenIndex] = { ...token, name: String(value), variable };
      } else if (field === 'value') {
        state.radiusTokens[tokenIndex] = { ...token, value: Number(value) };
      } else if (field === 'isIndividual') {
        state.radiusTokens[tokenIndex] = {
          ...token,
          isIndividual: Boolean(value),
          topLeft: token.topLeft || { value: token.value, unit: token.unit },
          topRight: token.topRight || { value: token.value, unit: token.unit },
          bottomRight: token.bottomRight || { value: token.value, unit: token.unit },
          bottomLeft: token.bottomLeft || { value: token.value, unit: token.unit },
        };
      } else {
        (state.radiusTokens[tokenIndex] as Record<string, unknown>)[field] = value;
      }
      updateRadiusCSSVariable(state.radiusTokens[tokenIndex]);
    },

    updateRadiusCorner: (state, action: PayloadAction<{ id: string; corner: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'; field: 'value' | 'unit'; value: number | string }>) => {
      const { id, corner, field, value } = action.payload;
      const tokenIndex = state.radiusTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.radiusTokens[tokenIndex];
      const cornerValue = token[corner] || { value: 0, unit: 'px' as const };

      state.radiusTokens[tokenIndex] = {
        ...token,
        [corner]: {
          ...cornerValue,
          [field]: field === 'value' ? Number(value) : value,
        },
      };
      updateRadiusCSSVariable(state.radiusTokens[tokenIndex]);
    },

    addRadiusToken: (state) => {
      const newToken: RadiusToken = {
        id: Date.now().toString(),
        name: 'New Radius',
        variable: '--radius-new-radius',
        value: 8,
        unit: 'px',
        isIndividual: false,
      };
      state.radiusTokens.unshift(newToken);
      updateRadiusCSSVariable(newToken);
    },

    deleteRadiusToken: (state, action: PayloadAction<string>) => {
      state.radiusTokens = state.radiusTokens.filter(token => token.id !== action.payload);
    },

    // ============================================
    // SHADOW TOKEN REDUCERS
    // ============================================
    updateShadowToken: (state, action: PayloadAction<{ id: string; field: keyof ShadowToken; value: string }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.shadowTokens.some(t =>
          t.id !== id && t.name.toLowerCase() === value.toLowerCase()
        );
        if (isDuplicate) {
          alert('Token name already exists. Please use a unique name.');
          return;
        }
      }

      const tokenIndex = state.shadowTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.shadowTokens[tokenIndex];

      if (field === 'name') {
        const variable = `--shadow-${value.toLowerCase().replace(/\s+/g, '-')}`;
        state.shadowTokens[tokenIndex] = { ...token, name: value, variable };
      }
      updateShadowCSSVariable(state.shadowTokens[tokenIndex]);
    },

    updateShadowLayer: (state, action: PayloadAction<{ tokenId: string; layerId: string; field: keyof ShadowLayer; value: unknown }>) => {
      const { tokenId, layerId, field, value } = action.payload;
      const tokenIndex = state.shadowTokens.findIndex(t => t.id === tokenId);
      if (tokenIndex === -1) return;

      const layerIndex = state.shadowTokens[tokenIndex].layers.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return;

      (state.shadowTokens[tokenIndex].layers[layerIndex] as Record<string, unknown>)[field] = value;
      updateShadowCSSVariable(state.shadowTokens[tokenIndex]);
    },

    addShadowLayer: (state, action: PayloadAction<string>) => {
      const tokenIndex = state.shadowTokens.findIndex(t => t.id === action.payload);
      if (tokenIndex === -1) return;

      const newLayer: ShadowLayer = {
        id: Date.now().toString(),
        offsetX: { value: 0, unit: 'px' },
        offsetY: { value: 4, unit: 'px' },
        blur: { value: 8, unit: 'px' },
        spread: { value: 0, unit: 'px' },
        color: 'rgba(0, 0, 0, 0.1)',
        inset: false,
      };
      state.shadowTokens[tokenIndex].layers.push(newLayer);
      updateShadowCSSVariable(state.shadowTokens[tokenIndex]);
    },

    deleteShadowLayer: (state, action: PayloadAction<{ tokenId: string; layerId: string }>) => {
      const { tokenId, layerId } = action.payload;
      const tokenIndex = state.shadowTokens.findIndex(t => t.id === tokenId);
      if (tokenIndex === -1) return;

      state.shadowTokens[tokenIndex].layers = state.shadowTokens[tokenIndex].layers.filter(l => l.id !== layerId);
      updateShadowCSSVariable(state.shadowTokens[tokenIndex]);
    },

    addShadowToken: (state) => {
      const newToken: ShadowToken = {
        id: Date.now().toString(),
        name: 'New Shadow',
        variable: '--shadow-new-shadow',
        layers: [
          {
            id: Date.now().toString() + '-1',
            offsetX: { value: 0, unit: 'px' },
            offsetY: { value: 4, unit: 'px' },
            blur: { value: 8, unit: 'px' },
            spread: { value: 0, unit: 'px' },
            color: 'rgba(0, 0, 0, 0.1)',
            inset: false,
          }
        ],
      };
      state.shadowTokens.unshift(newToken);
      updateShadowCSSVariable(newToken);
    },

    deleteShadowToken: (state, action: PayloadAction<string>) => {
      state.shadowTokens = state.shadowTokens.filter(token => token.id !== action.payload);
    },

    // ============================================
    // EFFECT TOKEN REDUCERS
    // ============================================
    updateEffectToken: (state, action: PayloadAction<{ id: string; field: keyof EffectToken; value: unknown }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.effectTokens.some(t =>
          t.id !== id && t.name.toLowerCase() === String(value).toLowerCase()
        );
        if (isDuplicate) {
          alert('Token name already exists. Please use a unique name.');
          return;
        }
      }

      const tokenIndex = state.effectTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.effectTokens[tokenIndex];

      if (field === 'name') {
        const variable = `--effect-${String(value).toLowerCase().replace(/\s+/g, '-')}`;
        state.effectTokens[tokenIndex] = { ...token, name: String(value), variable };
      } else {
        (state.effectTokens[tokenIndex] as Record<string, unknown>)[field] = value;
      }
    },

    addEffectToken: (state) => {
      const newToken: EffectToken = {
        id: Date.now().toString(),
        name: 'New Effect',
        variable: '--effect-new-effect',
        type: 'transition',
        transitionProperty: 'all',
        transitionDuration: { value: 200, unit: 'px' },
        transitionTimingFunction: 'ease',
      };
      state.effectTokens.unshift(newToken);
    },

    deleteEffectToken: (state, action: PayloadAction<string>) => {
      state.effectTokens = state.effectTokens.filter(token => token.id !== action.payload);
    },

    // ============================================
    // BREAKPOINT TOKEN REDUCERS
    // ============================================
    updateBreakpointToken: (state, action: PayloadAction<{ id: string; field: keyof BreakpointToken; value: unknown }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.breakpointTokens.some(t =>
          t.id !== id && t.name.toLowerCase() === String(value).toLowerCase()
        );
        if (isDuplicate) {
          alert('Token name already exists. Please use a unique name.');
          return;
        }
      }

      const tokenIndex = state.breakpointTokens.findIndex(t => t.id === id);
      if (tokenIndex === -1) return;

      const token = state.breakpointTokens[tokenIndex];

      if (field === 'name') {
        const variable = `--breakpoint-${String(value).toLowerCase().replace(/\s+/g, '-')}`;
        state.breakpointTokens[tokenIndex] = { ...token, name: String(value), variable };
      } else {
        (state.breakpointTokens[tokenIndex] as Record<string, unknown>)[field] = value;
      }
    },

    addBreakpointToken: (state) => {
      const newToken: BreakpointToken = {
        id: Date.now().toString(),
        name: 'New Breakpoint',
        variable: '--breakpoint-new-breakpoint',
        minWidth: { value: 768, unit: 'px' },
        preset: 'custom',
      };
      state.breakpointTokens.unshift(newToken);
    },

    deleteBreakpointToken: (state, action: PayloadAction<string>) => {
      state.breakpointTokens = state.breakpointTokens.filter(token => token.id !== action.payload);
    },

    updateButtonVariant: (state, action: PayloadAction<{ id: string; field: keyof ButtonVariantConfig; value: unknown }>) => {
      const { id, field, value } = action.payload;

      if (field === 'name') {
        const isDuplicate = state.buttonVariants.some(v =>
          v.id !== id && v.name.toLowerCase() === String(value).toLowerCase()
        );
        if (isDuplicate) {
          return;
        }
      }

      const variantIndex = state.buttonVariants.findIndex(v => v.id === id);
      if (variantIndex === -1) return;

      // Create new variant object to ensure reference change for React re-renders
      state.buttonVariants[variantIndex] = {
        ...state.buttonVariants[variantIndex],
        [field]: value,
      };
    },

    updateButtonVariantState: (state, action: PayloadAction<{
      variantId: string;
      stateName: ButtonState;
      field: keyof ButtonStateConfig;
      value: unknown;
    }>) => {
      const { variantId, stateName, field, value } = action.payload;
      const variantIndex = state.buttonVariants.findIndex(v => v.id === variantId);
      if (variantIndex === -1) return;

      // Create new variant object with new states to ensure reference change for React re-renders
      const currentVariant = state.buttonVariants[variantIndex];
      state.buttonVariants[variantIndex] = {
        ...currentVariant,
        states: {
          ...currentVariant.states,
          [stateName]: {
            ...currentVariant.states[stateName],
            [field]: value,
          },
        },
      };
    },

    updateButtonVariantIcon: (state, action: PayloadAction<{
      variantId: string;
      field: keyof ButtonIconConfig;
      value: unknown;
    }>) => {
      const { variantId, field, value } = action.payload;
      const variantIndex = state.buttonVariants.findIndex(v => v.id === variantId);
      if (variantIndex === -1) return;

      const currentVariant = state.buttonVariants[variantIndex];
      const currentIcon = currentVariant.icon || { ...DEFAULT_ICON_CONFIG };

      // Create new variant object with new icon to ensure reference change for React re-renders
      state.buttonVariants[variantIndex] = {
        ...currentVariant,
        icon: {
          ...currentIcon,
          [field]: value,
        },
      };
    },

    addButtonVariant: (state) => {
      const newVariant: ButtonVariantConfig = {
        id: `btn-${Date.now()}`,
        name: 'New Variant',
        typography: '--typography-body',
        borderStyle: 'solid',
        borderWidth: '--spacing-xs',
        borderRadius: '--radius-md',
        paddingY: '--spacing-md',
        paddingX: '--spacing-lg',
        effect: '--effect-hover-lift',
        widthMode: 'auto',
        width: '--spacing-3xl',
        heightMode: 'auto',
        height: '--spacing-2xl',
        textOverflow: 'visible',
        icon: { ...DEFAULT_ICON_CONFIG },
        states: {
          default: {
            backgroundColor: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            shadow: '--shadow-md',
            shadowColor: 'var(--color-primary)',
            translateY: '--spacing-none',
            translateYDirection: 'none',
            opacity: 1,
            iconColor: 'var(--color-text-primary)',
          },
          hover: {
            backgroundColor: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            shadow: '--shadow-lg',
            shadowColor: 'var(--color-primary)',
            translateY: '--spacing-xs',
            translateYDirection: 'up',
            opacity: 1,
            iconColor: 'var(--color-text-primary)',
          },
          active: {
            backgroundColor: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            shadow: '--shadow-md',
            shadowColor: 'var(--color-primary)',
            translateY: '--spacing-none',
            translateYDirection: 'none',
            opacity: 1,
            iconColor: 'var(--color-text-primary)',
          },
          disabled: {
            backgroundColor: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            shadow: 'none',
            shadowColor: 'var(--color-primary)',
            translateY: '--spacing-none',
            translateYDirection: 'none',
            opacity: 0.5,
            iconColor: 'var(--color-text-secondary)',
          },
        },
      };
      state.buttonVariants.push(newVariant);
    },

    duplicateButtonVariant: (state, action: PayloadAction<string>) => {
      const sourceVariant = state.buttonVariants.find(v => v.id === action.payload);
      if (!sourceVariant) return;

      const newVariant: ButtonVariantConfig = {
        ...JSON.parse(JSON.stringify(sourceVariant)),
        id: `btn-${Date.now()}`,
        name: `${sourceVariant.name} Copy`,
      };
      state.buttonVariants.push(newVariant);
    },

    deleteButtonVariant: (state, action: PayloadAction<string>) => {
      if (state.buttonVariants.length <= 1) return;
      state.buttonVariants = state.buttonVariants.filter(v => v.id !== action.payload);
    },

    resetToDefaults: (state) => {
      state.colorTokens = INITIAL_COLOR_TOKENS;
      state.typographyTokens = INITIAL_TYPOGRAPHY_TOKENS;
      state.spacingTokens = INITIAL_SPACING_TOKENS;
      state.radiusTokens = INITIAL_RADIUS_TOKENS;
      state.shadowTokens = INITIAL_SHADOW_TOKENS;
      state.effectTokens = INITIAL_EFFECT_TOKENS;
      state.breakpointTokens = INITIAL_BREAKPOINT_TOKENS;
      state.buttonVariants = INITIAL_BUTTON_VARIANTS;
      state.defaultFontFamily = '--font-family-primary';

      if (typeof document !== 'undefined') {
        INITIAL_COLOR_TOKENS.forEach(token => {
          updateCSSVariable(token);
        });
        INITIAL_SPACING_TOKENS.forEach(token => {
          updateSpacingCSSVariable(token);
        });
        INITIAL_RADIUS_TOKENS.forEach(token => {
          updateRadiusCSSVariable(token);
        });
        INITIAL_SHADOW_TOKENS.forEach(token => {
          updateShadowCSSVariable(token);
        });
      }
    },
  },
});

export const {
  updateColorToken,
  addColorToken,
  deleteColorToken,
  updateTypographyToken,
  addTypographyToken,
  deleteTypographyToken,
  updateDefaultFontFamily,
  updateSpacingToken,
  addSpacingToken,
  deleteSpacingToken,
  updateRadiusToken,
  updateRadiusCorner,
  addRadiusToken,
  deleteRadiusToken,
  updateShadowToken,
  updateShadowLayer,
  addShadowLayer,
  deleteShadowLayer,
  addShadowToken,
  deleteShadowToken,
  updateEffectToken,
  addEffectToken,
  deleteEffectToken,
  updateBreakpointToken,
  addBreakpointToken,
  deleteBreakpointToken,
  updateButtonVariant,
  updateButtonVariantState,
  updateButtonVariantIcon,
  addButtonVariant,
  duplicateButtonVariant,
  deleteButtonVariant,
  resetToDefaults,
} = designTokensSlice.actions;

export default designTokensSlice.reducer;
