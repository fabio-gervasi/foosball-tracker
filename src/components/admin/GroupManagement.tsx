import React, { useState, useEffect } from 'react';
import { Building2, Edit3, Save, X, Upload, Image, Trash2, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../../utils/supabase/client';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useDialogContext } from '../common/DialogProvider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';

interface GroupManagementProps {
  group: any;
  accessToken: string;
  onDataChange: () => void;
  onError: (error: string) => void;
  onGroupDeleted?: () => void;
}

export function GroupManagement({ 
  group, 
  accessToken, 
  onDataChange, 
  onError, 
  onGroupDeleted 
}: GroupManagementProps) {
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const { showSuccess, showError } = useDialogContext();
  const [groupEditData, setGroupEditData] = useState({ name: '', code: '' });
  const [groupEditError, setGroupEditError] = useState('');
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [groupDeleteConfirm, setGroupDeleteConfirm] = useState(false);
  const [groupDeleteInput, setGroupDeleteInput] = useState('');

  // Initialize edit data when group changes
  useEffect(() => {
    if (group) {
      setGroupEditData({
        name: group.name || '',
        code: group.code || ''
      });
    }
  }, [group]);

  const handleStartEditGroup = () => {
    setIsEditingGroup(true);
    setGroupEditError('');
    setGroupEditData({
      name: group?.name || '',
      code: group?.code || ''
    });
  };

  const handleCancelEditGroup = () => {
    setIsEditingGroup(false);
    setGroupEditError('');
    setGroupEditData({
      name: group?.name || '',
      code: group?.code || ''
    });
  };

  const handleUpdateGroup = async () => {
    try {
      setGroupEditError('');
      setIsUpdatingGroup(true);

      if (!groupEditData.name.trim() || groupEditData.name.length < 3) {
        setGroupEditError('Group name must be at least 3 characters');
        return;
      }

      if (!groupEditData.code.trim() || groupEditData.code.length < 3) {
        setGroupEditError('Group code must be at least 3 characters');
        return;
      }

      console.log('Updating group settings...');
      const response = await apiRequest('/groups/current', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: groupEditData.name.trim(),
          code: groupEditData.code.trim().toUpperCase()
        }),
      });

      console.log('Group update response:', response);

      // Refresh main app data - this will now properly reload group data
      onDataChange();
      setIsEditingGroup(false);
      await showSuccess('Group settings updated successfully!');

    } catch (error) {
      console.error('Failed to update group:', error);
      setGroupEditError(error.message || 'Failed to update group settings');
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingIcon(true);
      onError('');

      // Validate file
      if (!file.type.startsWith('image/')) {
        onError('Please select an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        onError('Image size must be less than 5MB');
        return;
      }

      const formData = new FormData();
      formData.append('icon', file);

      console.log('Uploading group icon...');
      console.log('FormData created with file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => [
          key, 
          value instanceof File ? `File(${value.name}, ${value.size}b)` : value
        ])
      });
      const response = await apiRequest('/groups/current/icon', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      console.log('Icon upload response:', response);

      // Refresh main app data - this will now properly reload group data
      onDataChange();
      await showSuccess('Group icon updated successfully!');

    } catch (error) {
      console.error('Failed to upload group icon:', error);
      onError('Failed to upload group icon: ' + error.message);
    } finally {
      setIsUploadingIcon(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleDeleteGroup = async () => {
    try {
      onError('');
      
      console.log('Deleting group:', group?.code);
      await apiRequest('/admin/group', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      await showSuccess('Group deleted successfully! You will now be redirected to group selection.');
      
      // Call the callback to handle group deletion (logout/redirect)
      if (onGroupDeleted) {
        onGroupDeleted();
      }
      
    } catch (error) {
      console.error('Failed to delete group:', error);
      onError('Failed to delete group: ' + error.message);
      setGroupDeleteConfirm(false);
      setGroupDeleteInput('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg text-gray-800 mb-4 flex items-center">
          <Building2 className="w-5 h-5 mr-2 text-purple-600" />
          Group Management
        </h3>
        
        {/* Group Settings */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base text-gray-800">Group Settings</h4>
            {!isEditingGroup ? (
              <button
                onClick={handleStartEditGroup}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleUpdateGroup}
                  disabled={isUpdatingGroup}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  <span>{isUpdatingGroup ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancelEditGroup}
                  disabled={isUpdatingGroup}
                  className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>

          {groupEditError && (
            <div className="mb-3 p-2 bg-red-100 border border-red-300 text-red-700 text-sm rounded">
              {groupEditError}
            </div>
          )}
          
          {/* Group Icon */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-2">Group Icon</label>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {group?.icon ? (
                  <ImageWithFallback
                    src={group.icon}
                    alt="Group Icon"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIconUpload}
                  disabled={isUploadingIcon}
                  className="hidden"
                  id="group-icon-upload"
                />
                <label
                  htmlFor="group-icon-upload"
                  className={`inline-flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded cursor-pointer hover:bg-blue-200 transition-colors ${
                    isUploadingIcon ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploadingIcon ? 'Uploading...' : 'Upload Icon'}</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Max 5MB. Supports JPG, PNG, GIF
                </p>
              </div>
            </div>
          </div>

          {/* Group Name and Code Fields */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Group Name</label>
              {isEditingGroup ? (
                <input
                  type="text"
                  value={groupEditData.name}
                  onChange={(e) => setGroupEditData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isUpdatingGroup}
                />
              ) : (
                <div className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm">
                  {group?.name || 'N/A'}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">Group Code</label>
              {isEditingGroup ? (
                <input
                  type="text"
                  value={groupEditData.code}
                  onChange={(e) => setGroupEditData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isUpdatingGroup}
                />
              ) : (
                <div className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm">
                  {group?.code || 'N/A'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <h4 className="text-base text-red-800">Danger Zone</h4>
          </div>
          
          <p className="text-sm text-red-700 mb-4">
            Permanently delete this group and all associated data. This action cannot be undone.
          </p>
          
          <AlertDialog open={groupDeleteConfirm} onOpenChange={setGroupDeleteConfirm}>
            <AlertDialogTrigger asChild>
              <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors">
                <Trash2 className="w-4 h-4" />
                <span>Delete Group</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Group</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Are you sure you want to delete the group <strong>"{group?.name}"</strong>?
                  </p>
                  <p className="text-red-600">
                    This will permanently delete:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 text-red-600">
                    <li>All match history and statistics</li>
                    <li>All user profiles and rankings</li>
                    <li>Group settings and configurations</li>
                    <li>All associated data</li>
                  </ul>
                  <p>
                    To confirm deletion, please type the group name <strong>"{group?.name}"</strong> below:
                  </p>
                  <input
                    type="text"
                    value={groupDeleteInput}
                    onChange={(e) => setGroupDeleteInput(e.target.value)}
                    placeholder="Type group name to confirm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setGroupDeleteInput('')}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteGroup}
                  disabled={groupDeleteInput !== group?.name}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Group Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}