import React, { useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { HeroBanner } from '../components/common/HeroBanner';
import { useNavigate } from 'react-router-dom';
import { AddAuditMemberModal } from '../components/modals/AddAuditMemberModal';
import { useAuth } from '../context/AuthContext';

export const ConvenerAuditTeam: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <DashboardLayout userName={user?.full_name || 'User'} userAvatar={user?.profile_picture || undefined}>
      <HeroBanner
        title="Audit Members"
        subtitle="Create new audit members and manage existing ones for your department"
      />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add Audit Member Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Create Audit Member</h2>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Create
            </button>
          </div>

          {/* Manage Audit Members Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Manage Audit Members</h2>
            <button
              onClick={() => navigate('/convener/audit-members/manage')}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      <AddAuditMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </DashboardLayout>
  );
};

export default ConvenerAuditTeam;
