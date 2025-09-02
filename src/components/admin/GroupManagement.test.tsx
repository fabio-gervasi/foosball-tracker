import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { GroupManagement } from './GroupManagement';
import { DialogProvider } from '../common/DialogProvider';

const mockGroup = {
  id: '1',
  name: 'Test Group',
  code: 'TEST',
  icon: 'test-icon.png',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  adminIds: ['user-1'],
};

const mockOnDataChange = vi.fn();
const mockOnError = vi.fn();
const mockOnGroupDeleted = vi.fn();

const renderComponent = (group = mockGroup) => {
  return render(
    <DialogProvider>
      <GroupManagement
        group={group}
        accessToken='test-token'
        onDataChange={mockOnDataChange}
        onError={mockOnError}
        onGroupDeleted={mockOnGroupDeleted}
      />
    </DialogProvider>
  );
};

describe('GroupManagement', () => {
  it('renders the group name', () => {
    renderComponent();
    expect(screen.getByText('Test Group')).toBeInTheDocument();
  });

  it('allows editing and canceling', async () => {
    renderComponent();
    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeInTheDocument();
    await userEvent.click(editButton);

    const saveButton = screen.getByRole('button', { name: /save/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(saveButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();

    await userEvent.click(cancelButton);

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});
