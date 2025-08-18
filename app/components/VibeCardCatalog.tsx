import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VibeCard } from './VibeCard';
import type { LocalVibe } from '../utils/vibeUtils';
import { useVibes } from '../hooks/useVibes';

interface VibeCardCatalogProps {
  catalogVibe: LocalVibe;
}

export function VibeCardCatalog({ catalogVibe }: VibeCardCatalogProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toggleFavorite, deleteVibe } = useVibes();

  // Navigation functions
  const handleEditClick = (id: string, encodedTitle: string) => {
    navigate(`/chat/${id}/${encodedTitle}/app`);
  };

  const handleRemixClick = (slug: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/remix/${slug}`);
  };

  // Handle toggling the favorite status
  const handleToggleFavorite = async (vibeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      await toggleFavorite(vibeId);
    } catch (error) {
      // Error handling is managed by the useVibes hook
    }
  };

  // Handle deleting a vibe
  const handleDeleteClick = async (vibeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (confirmDelete === vibeId) {
      try {
        // Immediately set confirmDelete to null to prevent accidental clicks
        setConfirmDelete(null);
        // Delete the vibe
        await deleteVibe(vibeId);
      } catch (error) {
        // Error handling is managed by the useVibes hook
      }
    } else {
      setConfirmDelete(vibeId);

      // Prevent the global click handler from immediately clearing the confirmation
      // by stopping the event from bubbling up
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  // Clear confirmation when clicking elsewhere
  useEffect(() => {
    const handlePageClick = (e: MouseEvent) => {
      // Don't clear if the click originated from a delete button
      if (confirmDelete && !(e.target as Element).closest('button[data-action="delete"]')) {
        setConfirmDelete(null);
      }
    };

    // Use capture phase to handle document clicks before other handlers
    document.addEventListener('click', handlePageClick, true);
    return () => {
      document.removeEventListener('click', handlePageClick, true);
    };
  }, [confirmDelete]);

  return (
    <VibeCard
      vibe={catalogVibe}
      screenshot={catalogVibe.screenshot}
      confirmDelete={confirmDelete}
      onEditClick={handleEditClick}
      onToggleFavorite={handleToggleFavorite}
      onDeleteClick={handleDeleteClick}
      onRemixClick={handleRemixClick}
    />
  );
}
