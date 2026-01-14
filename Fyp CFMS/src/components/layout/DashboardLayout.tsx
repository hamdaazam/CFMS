import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  userName?: string;
  userAvatar?: string;
  userRole?: 'admin' | 'faculty' | 'supervisor' | 'coordinator' | 'audit' | 'convener' | 'hod'; // Optional - Sidebar will auto-detect from AuthContext
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children,
  title,
  userName, 
  userAvatar,
  userRole // Optional prop, Sidebar will use AuthContext if not provided
}) => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F4F7FE' }}>
      <Sidebar userRole={userRole} />
      <div className="ml-0 lg:ml-64 transition-all duration-300">
        <Navbar userName={userName} userAvatar={userAvatar} />
        <main className="pt-20 lg:pt-24 p-3 sm:p-4 md:p-6">
          {title && (
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">{title}</h1>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};
