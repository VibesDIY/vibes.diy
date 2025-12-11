import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ImgGenModal, ImgGenModalProps } from '@vibes.diy/use-vibes-base';
import type { DocFileMeta } from '@fireproof/use-fireproof';

// Mock AsyncImg component
vi.mock('../base/components/ImgGenUtils/AsyncImg.js', () => ({
  AsyncImg: ({ alt, className, ...props }: { alt: string; file: unknown; className?: string }) => (
    <img data-testid="mock-async-img" alt={alt} className={className} {...props} />
  ),
}));

// // Mock createPortal to render content directly without portal
// vi.mock('react-dom', async () => {
//   const actual = await vi.importActual('react-dom');
//   return {
//     ...(actual as Record<string, unknown>),
//     createPortal: (children: React.ReactNode) => children,
//   };
// });

describe('ImgGenModal Component', () => {
  let mockFile: DocFileMeta;
  let mockProps: ImgGenModalProps;

  beforeEach(() => {
    // Create a mock DocFileMeta object instead of File
    const realFile = new File(['dummy content'], 'dummy.png', { type: 'image/png' });
    mockFile = {
      cid: { toString: () => 'mock-cid' },
      size: realFile.size,
      type: realFile.type,
      lastModified: realFile.lastModified,
      car: [],
      file: () => Promise.resolve(realFile),
    } as unknown as DocFileMeta;

    globalThis.document.body.innerHTML = ''; // Clear any existing modals in the document
    mockProps = {
      isOpen: true,
      onClose: vi.fn(),
      currentFile: mockFile,
      alt: 'Test image',
      promptText: 'Test prompt',
      editedPrompt: null,
      setEditedPrompt: vi.fn(),
      handlePromptEdit: vi.fn(),
      // toggleDeleteConfirm is no longer used
      // isDeleteConfirmOpen: false,
      handleDeleteConfirm: vi.fn(),
      // handleCancelDelete: vi.fn(),
      handlePrevVersion: vi.fn(),
      handleNextVersion: vi.fn(),
      handleRegen: vi.fn(),
      versionIndex: 0,
      totalVersions: 3,
      progress: 100,
    };
  });

  it('should render modal when isOpen is true', () => {
    const res = render(<ImgGenModal {...mockProps} />);

    // Check that modal is rendered
    expect(res.getByRole('presentation')).toBeInTheDocument();
    expect(res.getByTestId('mock-async-img')).toBeInTheDocument();
    expect(res.getByTestId('mock-async-img')).toHaveAttribute('alt', 'Test image');
  });

  it('should not render modal when isOpen is false', () => {
    const { container } = render(<ImgGenModal {...mockProps} isOpen={false} />);

    // Check that modal is not rendered
    expect(container).toBeEmptyDOMElement();
  });

  it('should call onClose when backdrop is clicked', () => {
    const res = render(<ImgGenModal {...mockProps} />);

    // Click backdrop (container with presentation role)
    fireEvent.click(res.getByRole('presentation'));

    // Check that onClose was called
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when figure is clicked (event should not propagate)', () => {
    const res = render(<ImgGenModal {...mockProps} />);

    // Click figure (wrapper that contains image and controls)
    fireEvent.click(res.getByRole('figure'));

    // Check that onClose was not called
    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  it('should include ImageOverlay with correct props', () => {
    const res = render(<ImgGenModal {...mockProps} />);

    // Check that prompt text is rendered (confirms ImageOverlay is included)
    expect(res.getByText('Test prompt')).toBeInTheDocument();

    // We can also verify that controls are present
    expect(res.getByLabelText('Regenerate image')).toBeInTheDocument();

    // Verify version navigation is present
    expect(res.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should call handleNextVersion when next button is clicked', () => {
    const res = render(<ImgGenModal {...mockProps} />);

    // Click next version button
    fireEvent.click(res.getByLabelText('Next version'));

    // Check that handleNextVersion was called
    expect(mockProps.handleNextVersion).toHaveBeenCalledTimes(1);
  });

  it('should call handlePrevVersion when previous button is clicked', () => {
    const res = render(<ImgGenModal {...mockProps} versionIndex={1} />);

    // Click previous version button
    fireEvent.click(res.getByLabelText('Previous version'));

    // Check that handlePrevVersion was called
    expect(mockProps.handlePrevVersion).toHaveBeenCalledTimes(1);
  });

  it('should call handleDeleteConfirm when delete button is clicked twice', () => {
    const res = render(<ImgGenModal {...mockProps} />);

    // First click shows confirmation
    fireEvent.click(res.getByLabelText('Delete image'));

    // We should see the confirmation button after first click
    expect(res.getByLabelText('Confirm delete')).toBeInTheDocument();
    expect(res.getByText('Delete image?')).toBeInTheDocument();

    // Click the confirm delete button
    fireEvent.click(res.getByLabelText('Confirm delete'));

    // Check that handleDeleteConfirm was called
    expect(mockProps.handleDeleteConfirm).toHaveBeenCalled();
  });
});
