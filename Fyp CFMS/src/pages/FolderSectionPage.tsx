import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';

const toTitle = (s?: string) =>
  (s || '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Generic placeholder page for folder subsections.
 * Routes supported:
 *  - /faculty/folder/:folderId/:section
 *  - /faculty/folder/:folderId/:section/:subsection
 * This will later be replaced with real pages per section.
 */
const FolderSectionPage: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string; section?: string; subsection?: string }>();
  const folderId = params.folderId ?? params.id;
  const section = params.section;
  const subsection = params.subsection;
  const navigate = useNavigate();

  const sectionTitle = toTitle(section);
  const subTitle = toTitle(subsection);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-4 text-sm text-gray-500">
          <button className="underline" onClick={() => navigate(-1)}>Back</button>
          <span className="mx-2">/</span>
          <span>Folder #{folderId}</span>
          <span className="mx-2">/</span>
          <span>{sectionTitle}</span>
          {subsection ? (
            <>
              <span className="mx-2">/</span>
              <span>{subTitle}</span>
            </>
          ) : null}
        </div>

        <h1 className="text-2xl font-semibold mb-2">{subsection ? subTitle : sectionTitle}</h1>
        <p className="text-gray-600">
          This is a placeholder for <span className="font-medium">{sectionTitle}</span>
          {subsection ? (
            <>
              {' '}→ <span className="font-medium">{subTitle}</span>
            </>
          ) : null}{' '}
          in folder <span className="font-mono">#{folderId}</span>. We'll wire the full UI and APIs in the next step.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default FolderSectionPage;
