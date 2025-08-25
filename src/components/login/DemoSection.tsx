import React from 'react';

interface DemoSectionProps {
  onDemoLogin?: () => void;
  isLoading?: boolean;
}

export function DemoSection({ onDemoLogin, isLoading = false }: DemoSectionProps) {
  // Demo section has been removed
  return null;
}