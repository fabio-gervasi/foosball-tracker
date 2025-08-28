import React from 'react';
import { Home, User, Plus, BarChart3, Trophy, History } from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  currentUser?: any; // Keep for backward compatibility
}

export function Navigation({ currentView, onViewChange, currentUser }: NavigationProps) {
  // Define navigation items (keeping original design - admin stays in profile)
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'statistics', label: 'Stats', icon: BarChart3 },
    { id: 'match', label: 'Add', icon: Plus },
    { id: 'leaderboard', label: 'Rankings', icon: Trophy },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <nav className='fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex'>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const isAddMatch = item.id === 'match';

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex-1 py-3 md:py-4 px-2 md:px-4 flex flex-col items-center justify-center transition-colors ${
                  isAddMatch
                    ? 'bg-blue-600 text-white mx-2 my-2 rounded-full'
                    : isActive
                      ? 'text-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className={`w-5 h-5 md:w-6 md:h-6 mb-1 ${isAddMatch ? 'text-white' : ''}`} />
                <span className={`text-xs md:text-sm ${isAddMatch ? 'text-white' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
