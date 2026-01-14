import React from 'react';
import { UnifiedProfile } from '../components/features/profile/UnifiedProfile';

export const AuditTeamProfile: React.FC = () => {
  // Reuse the unified, data-backed profile component for a consistent UI
  return <UnifiedProfile role="audit" />;
};
