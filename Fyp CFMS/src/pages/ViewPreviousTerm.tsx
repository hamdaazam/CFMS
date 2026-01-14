
import React from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';

export const ViewPreviousTerm: React.FC = () => {
  const previousTerms = [
    { sr: 1, sessionTerm: '233', action: 'View' },
    { sr: 2, sessionTerm: '234', action: 'View' },
  ];

  return (
    <DashboardLayout userName="XYZ">
      <div className="p-6 space-y-6">
        {/* Create Term Card */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Create Term</h2>
          <Button variant="coral">
            Create
          </Button>
        </div>

        {/* Previous Terms Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-header px-6 py-4">
            <h3 className="text-primary-dark font-semibold">Previous Terms</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">sr.</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">session term</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {previousTerms.map((term) => (
                  <tr key={term.sr} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{term.sr}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{term.sessionTerm}</td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-gray-900 hover:text-primary font-medium">
                        {term.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
