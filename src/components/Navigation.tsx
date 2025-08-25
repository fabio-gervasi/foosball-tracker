import React from 'react';
import { Home, User, Plus, BarChart3, Trophy, Shield, History } from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  currentUser?: any;
}

export function Navigation({ currentView, onViewChange, currentUser }: NavigationProps) {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'statistics', label: 'Stats', icon: BarChart3 },
    { id: 'match', label: 'Add', icon: Plus },
    { id: 'leaderboard', label: 'Rankings', icon: Trophy },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-screen sm:w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-6xl bg-white border-t border-gray-200 z-50">
      <div className="flex w-screen sm:w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto">
        {navItems.map((item) => {
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
    </nav>
  );
}