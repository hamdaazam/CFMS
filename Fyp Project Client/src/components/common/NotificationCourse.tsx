import React from 'react';

interface FolderInfo {
  course_code?: string | null;
  course_title?: string | null;
}

interface Props {
  folder?: FolderInfo | null;
}

export const NotificationCourse: React.FC<Props> = ({ folder }) => {
  const code = folder?.course_code ? String(folder.course_code).trim() : '';
  const title = folder?.course_title ? String(folder.course_title).trim() : '';

  if (!code && !title) return null;

  // Compose text depending on what's available
  const text = code && title ? `${code} - ${title}` : code || title;

  return (
    <p className="text-xs text-gray-500">
      Course: {text}
    </p>
  );
};
