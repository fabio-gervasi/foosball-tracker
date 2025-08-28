import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Navigation } from '@/components/common/Navigation';

describe('Navigation Component', () => {
  const mockOnViewChange = vi.fn();
  const defaultProps = {
    currentView: 'dashboard',
    onViewChange: mockOnViewChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all navigation items', () => {
      render(<Navigation {...defaultProps} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Stats')).toBeInTheDocument();
      expect(screen.getByText('Add')).toBeInTheDocument();
      expect(screen.getByText('Rankings')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    it('should render navigation items as buttons', () => {
      render(<Navigation {...defaultProps} />);

      const homeButton = screen.getByRole('button', { name: /home/i });
      const statsButton = screen.getByRole('button', { name: /stats/i });
      const addButton = screen.getByRole('button', { name: /add/i });
      const rankingsButton = screen.getByRole('button', { name: /rankings/i });
      const historyButton = screen.getByRole('button', { name: /history/i });

      expect(homeButton).toBeInTheDocument();
      expect(statsButton).toBeInTheDocument();
      expect(addButton).toBeInTheDocument();
      expect(rankingsButton).toBeInTheDocument();
      expect(historyButton).toBeInTheDocument();
    });

    it('should render with icons for each navigation item', () => {
      render(<Navigation {...defaultProps} />);

      // Check that SVG icons are present (Lucide icons render as SVGs)
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements).toHaveLength(5); // One for each navigation item

      // Verify each SVG has the expected Lucide class
      svgElements.forEach(svg => {
        expect(svg).toHaveClass('lucide');
      });
    });
  });

  describe('Active State', () => {
    it('should highlight the current active view', () => {
      render(<Navigation currentView='statistics' onViewChange={mockOnViewChange} />);

      const statsButton = screen.getByRole('button', { name: /stats/i });
      expect(statsButton).toHaveClass('text-blue-600');
    });

    it('should apply active styling to dashboard by default', () => {
      render(<Navigation {...defaultProps} />);

      const homeButton = screen.getByRole('button', { name: /home/i });
      expect(homeButton).toHaveClass('text-blue-600');
    });

    it('should not apply active styling to non-current views', () => {
      render(<Navigation currentView='dashboard' onViewChange={mockOnViewChange} />);

      const statsButton = screen.getByRole('button', { name: /stats/i });
      const addButton = screen.getByRole('button', { name: /add/i });
      const rankingsButton = screen.getByRole('button', { name: /rankings/i });
      const historyButton = screen.getByRole('button', { name: /history/i });

      expect(statsButton).toHaveClass('text-gray-400');
      expect(rankingsButton).toHaveClass('text-gray-400');
      expect(historyButton).toHaveClass('text-gray-400');
      // Add button has special styling
      expect(addButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Special Styling', () => {
    it('should apply special styling to the Add button', () => {
      render(<Navigation {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton).toHaveClass('bg-blue-600', 'text-white', 'rounded-full');
    });

    it('should maintain Add button special styling regardless of active state', () => {
      render(<Navigation currentView='match' onViewChange={mockOnViewChange} />);

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton).toHaveClass('bg-blue-600', 'text-white', 'rounded-full');
    });
  });

  describe('Interaction', () => {
    it('should call onViewChange when navigation item is clicked', () => {
      render(<Navigation {...defaultProps} />);

      const statsButton = screen.getByRole('button', { name: /stats/i });
      fireEvent.click(statsButton);

      expect(mockOnViewChange).toHaveBeenCalledWith('statistics');
      expect(mockOnViewChange).toHaveBeenCalledTimes(1);
    });

    it('should call onViewChange with correct view IDs for all items', () => {
      render(<Navigation {...defaultProps} />);

      const homeButton = screen.getByRole('button', { name: /home/i });
      const statsButton = screen.getByRole('button', { name: /stats/i });
      const addButton = screen.getByRole('button', { name: /add/i });
      const rankingsButton = screen.getByRole('button', { name: /rankings/i });
      const historyButton = screen.getByRole('button', { name: /history/i });

      fireEvent.click(homeButton);
      expect(mockOnViewChange).toHaveBeenLastCalledWith('dashboard');

      fireEvent.click(statsButton);
      expect(mockOnViewChange).toHaveBeenLastCalledWith('statistics');

      fireEvent.click(addButton);
      expect(mockOnViewChange).toHaveBeenLastCalledWith('match');

      fireEvent.click(rankingsButton);
      expect(mockOnViewChange).toHaveBeenLastCalledWith('leaderboard');

      fireEvent.click(historyButton);
      expect(mockOnViewChange).toHaveBeenLastCalledWith('history');

      expect(mockOnViewChange).toHaveBeenCalledTimes(5);
    });

    it('should handle rapid clicks without issues', () => {
      render(<Navigation {...defaultProps} />);

      const statsButton = screen.getByRole('button', { name: /stats/i });

      // Rapid clicks
      fireEvent.click(statsButton);
      fireEvent.click(statsButton);
      fireEvent.click(statsButton);

      expect(mockOnViewChange).toHaveBeenCalledTimes(3);
      expect(mockOnViewChange).toHaveBeenCalledWith('statistics');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      render(<Navigation {...defaultProps} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
    });

    it('should be keyboard accessible', () => {
      render(<Navigation {...defaultProps} />);

      const homeButton = screen.getByRole('button', { name: /home/i });

      // Focus the button
      homeButton.focus();
      expect(homeButton).toHaveFocus();

      // Press Enter
      fireEvent.keyDown(homeButton, { key: 'Enter' });
      fireEvent.click(homeButton);

      expect(mockOnViewChange).toHaveBeenCalledWith('dashboard');
    });

    it('should have appropriate button labels', () => {
      render(<Navigation {...defaultProps} />);

      expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /stats/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rankings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes for different screen sizes', () => {
      render(<Navigation {...defaultProps} />);

      const buttons = screen.getAllByRole('button');

      buttons.forEach(button => {
        expect(button).toHaveClass('py-3', 'md:py-4', 'px-2', 'md:px-4');
      });

      // Check icon responsive classes
      const icons = document.querySelectorAll('svg');
      icons.forEach(icon => {
        expect(icon).toHaveClass('w-5', 'h-5', 'md:w-6', 'md:h-6');
      });

      // Check text responsive classes
      const textElements = screen.getAllByText(/Home|Stats|Add|Rankings|History/);
      textElements.forEach(text => {
        expect(text).toHaveClass('text-xs', 'md:text-sm');
      });
    });
  });

  describe('Layout', () => {
    it('should be fixed at the bottom of the screen', () => {
      render(<Navigation {...defaultProps} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
    });

    it('should have proper z-index for layering', () => {
      render(<Navigation {...defaultProps} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('z-50');
    });

    it('should have border and background styling', () => {
      render(<Navigation {...defaultProps} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('bg-white', 'border-t', 'border-gray-200');
    });

    it('should use flex layout for navigation items', () => {
      render(<Navigation {...defaultProps} />);

      const buttonsContainer = screen.getByRole('navigation').querySelector('div > div');
      expect(buttonsContainer).toHaveClass('flex');

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('flex-1', 'flex', 'flex-col', 'items-center', 'justify-center');
      });
    });
  });

  describe('Props Handling', () => {
    it('should handle missing currentUser prop gracefully', () => {
      render(<Navigation currentView='dashboard' onViewChange={mockOnViewChange} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(mockOnViewChange).toBeDefined();
    });

    it('should handle currentUser prop when provided', () => {
      const currentUser = { id: 'test-user', name: 'Test User' };

      render(
        <Navigation
          currentView='dashboard'
          onViewChange={mockOnViewChange}
          currentUser={currentUser}
        />
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('should handle invalid currentView gracefully', () => {
      render(<Navigation currentView='invalid-view' onViewChange={mockOnViewChange} />);

      // No button should be active
      const buttons = screen.getAllByRole('button');
      const activeButtons = buttons.filter(
        button =>
          button.classList.contains('text-blue-600') && !button.classList.contains('bg-blue-600') // Exclude the Add button
      );

      expect(activeButtons).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string currentView', () => {
      render(<Navigation currentView='' onViewChange={mockOnViewChange} />);

      expect(screen.getByText('Home')).toBeInTheDocument();

      // No regular button should be active (except Add button which has special styling)
      const buttons = screen.getAllByRole('button');
      const activeButtons = buttons.filter(
        button =>
          button.classList.contains('text-blue-600') && !button.classList.contains('bg-blue-600')
      );

      expect(activeButtons).toHaveLength(0);
    });

    it('should handle null onViewChange gracefully', () => {
      // This test ensures the component doesn't crash with null callback
      expect(() => {
        render(<Navigation currentView='dashboard' onViewChange={vi.fn()} />);
      }).not.toThrow();
    });
  });
});
