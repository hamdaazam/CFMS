import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { useReviewMode } from '../hooks/useReviewMode';
import { courseFoldersAPI } from '../services/api';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FolderContentsNav } from '../components/common/FolderContentsNav';
import { canEditFolder } from '../utils/folderPermissions';

interface FolderDetail {
  id: number;
  section: string;
  status?: string;
  course_title?: string;
  course_code?: string;
  instructor_name?: string;
  semester?: string;
  outline_content?: OutlineContent;
}

interface CourseLogEntry {
  id: string;
  lectureNo: number;
  date: string;
  duration: string;
  topicsCovered: string;
  evaluationInstruments: string;
}

interface OutlineContent {
  courseLogEntries?: CourseLogEntry[];
  courseLogSchedule?: {
    startDate?: string;
    endDate?: string;
    lectureDays?: Record<string, number>; // e.g., { "Monday": 1, "Wednesday": 2 }
  };
}

const FolderCourseLog: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const [data, setData] = useState<FolderDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const submittedStatuses = new Set<string>([
    'SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED',
  ]);
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';

  // Course log entries state
  const [logEntries, setLogEntries] = useState<CourseLogEntry[]>([]);
  
  // Schedule generation state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [lectureDays, setLectureDays] = useState<Record<string, number>>({
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  });

  const id = Number(folderId);
  const idForNav = isNaN(id) ? (data?.id ?? id) : id;

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    // Use ultra-fast basic endpoint
    courseFoldersAPI.getBasic(id)
      .then((res) => {
        if (!mounted) return;
        setData(res.data);
        // Determine read-only based on status
        const s = res.data?.status as string | undefined;
        const firstActivityCompleted = res.data?.first_activity_completed || false;
        const canEditForFinalSubmission = res.data?.can_edit_for_final_submission || false;
        // Use utility function to determine if folder can be edited
        const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
        setReadOnly(!canEdit);
        // Load saved log entries from backend if exists
        if (res.data.outline_content?.courseLogEntries) {
          setLogEntries(res.data.outline_content.courseLogEntries);
        }
        
        // Load saved schedule settings if exists
        if (res.data.outline_content?.courseLogSchedule) {
          const schedule = res.data.outline_content.courseLogSchedule;
          if (schedule.startDate) setStartDate(schedule.startDate);
          if (schedule.endDate) setEndDate(schedule.endDate);
          if (schedule.lectureDays) {
            setLectureDays({
              Monday: schedule.lectureDays.Monday || 0,
              Tuesday: schedule.lectureDays.Tuesday || 0,
              Wednesday: schedule.lectureDays.Wednesday || 0,
              Thursday: schedule.lectureDays.Thursday || 0,
              Friday: schedule.lectureDays.Friday || 0,
              Saturday: schedule.lectureDays.Saturday || 0,
              Sunday: schedule.lectureDays.Sunday || 0,
            });
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setData(null);
        }
      });
    return () => { mounted = false; };
  }, [id]);

  const courseTitle = data?.course_title || '—';
  const courseCode = data?.course_code || '—';

  const handleAddEntry = (afterEntryId?: string) => {
    // Determine the date based on the entry after which we're adding, or the last entry
    let newDate = new Date().toISOString().split('T')[0]; // Default to today
    
    if (afterEntryId) {
      // Find the entry after which we're inserting
      const afterEntry = logEntries.find(e => e.id === afterEntryId);
      if (afterEntry?.date) {
        newDate = afterEntry.date;
      }
    } else if (logEntries.length > 0) {
      // Sort entries by date to get the last one
      const sortedEntries = [...logEntries].sort((a, b) => a.date.localeCompare(b.date));
      const lastEntry = sortedEntries[sortedEntries.length - 1];
      
      if (lastEntry.date) {
        // Use the last entry's date
        newDate = lastEntry.date;
      }
    }
    
    const newEntry: CourseLogEntry = {
      id: Date.now().toString(),
      lectureNo: logEntries.length + 1, // Will be renumbered
      date: newDate,
      duration: '50 minutes',
      topicsCovered: '',
      evaluationInstruments: ''
    };
    
    if (afterEntryId) {
      // Insert after the specified entry
      const afterIndex = logEntries.findIndex(e => e.id === afterEntryId);
      if (afterIndex >= 0) {
        const newEntries = [...logEntries];
        newEntries.splice(afterIndex + 1, 0, newEntry);
        // Renumber lectures
        const renumberedEntries = newEntries.map((entry, index) => ({
          ...entry,
          lectureNo: index + 1
        }));
        setLogEntries(renumberedEntries);
        setEditingId(newEntry.id);
      } else {
        // Fallback: add to end
        setLogEntries([...logEntries, newEntry]);
        setEditingId(newEntry.id);
      }
    } else {
      // Add to end
      setLogEntries([...logEntries, newEntry]);
      setEditingId(newEntry.id);
    }
  };

  const getDayOfWeek = (date: Date): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  const generateLectureSchedule = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      alert('Start date must be before end date');
      return;
    }

    const selectedDays = Object.entries(lectureDays).filter(([_, count]) => count > 0);
    if (selectedDays.length === 0) {
      alert('Please select at least one lecture day with number of lectures');
      return;
    }

    const newEntries: CourseLogEntry[] = [];
    let lectureCounter = 1;
    const currentDate = new Date(start);

    // Iterate through each day from start to end
    while (currentDate <= end) {
      const dayName = getDayOfWeek(currentDate);
      const lectureCount = lectureDays[dayName] || 0;

      // If this day has lectures scheduled, create entries
      if (lectureCount > 0) {
        for (let i = 0; i < lectureCount; i++) {
          newEntries.push({
            id: `${currentDate.getTime()}-${i}`,
            lectureNo: lectureCounter++,
            date: currentDate.toISOString().split('T')[0],
            duration: '50 minutes',
            topicsCovered: '',
            evaluationInstruments: ''
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Group existing entries by date
    const existingByDate = new Map<string, CourseLogEntry[]>();
    logEntries.forEach(entry => {
      if (!existingByDate.has(entry.date)) {
        existingByDate.set(entry.date, []);
      }
      existingByDate.get(entry.date)!.push(entry);
    });

    // Group generated entries by date
    const generatedByDate = new Map<string, CourseLogEntry[]>();
    newEntries.forEach(entry => {
      if (!generatedByDate.has(entry.date)) {
        generatedByDate.set(entry.date, []);
      }
      generatedByDate.get(entry.date)!.push(entry);
    });

    // Merge strategy: For each date in generated schedule
    const mergedEntries: CourseLogEntry[] = [];
    
    // Keep all existing entries that have content (topics or evaluation)
    logEntries.forEach(entry => {
      if (entry.topicsCovered || entry.evaluationInstruments) {
        mergedEntries.push(entry);
      }
    });

    // For each date in the generated schedule
    generatedByDate.forEach((generatedEntries, date) => {
      const existingEntries = existingByDate.get(date) || [];
      const existingWithContent = existingEntries.filter(e => e.topicsCovered || e.evaluationInstruments);
      
      // If we have existing entries with content, keep them and add missing slots
      if (existingWithContent.length > 0) {
        // Keep existing entries with content
        existingWithContent.forEach(entry => {
          if (!mergedEntries.find(e => e.id === entry.id)) {
            mergedEntries.push(entry);
          }
        });
        // Add missing slots if needed
        if (generatedEntries.length > existingWithContent.length) {
          const missing = generatedEntries.length - existingWithContent.length;
          for (let i = 0; i < missing; i++) {
            mergedEntries.push(generatedEntries[i + existingWithContent.length] || generatedEntries[i]);
          }
        }
      } else {
        // No existing entries with content for this date, use all generated entries
        generatedEntries.forEach(entry => {
          mergedEntries.push(entry);
        });
      }
    });

    // Sort by date, then by lecture number
    mergedEntries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.lectureNo - b.lectureNo;
    });

    // Renumber lectures sequentially
    const renumberedEntries = mergedEntries.map((entry, index) => ({
      ...entry,
      lectureNo: index + 1
    }));

    setLogEntries(renumberedEntries);
    alert(`Generated lecture schedule. Total: ${renumberedEntries.length} entries.`);
  };

  const handleLectureDayChange = (day: string, value: number) => {
    setLectureDays(prev => ({
      ...prev,
      [day]: Math.max(0, Math.min(10, value)) // Limit between 0 and 10
    }));
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm('Are you sure you want to delete this lecture entry?')) {
      setLogEntries(logEntries.filter(entry => entry.id !== entryId));
    }
  };

  const handleUpdateEntry = (entryId: string, field: keyof CourseLogEntry, value: string | number) => {
    setLogEntries(logEntries.map(entry =>
      entry.id === entryId ? { ...entry, [field]: value } : entry
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get existing outline_content and merge with course log entries
      const existingContent = data?.outline_content || {};
      const outlineContent = {
        ...existingContent,
        courseLogEntries: logEntries,
        courseLogSchedule: {
          startDate,
          endDate,
          lectureDays,
        },
      };

      await courseFoldersAPI.saveOutline(id, { outline_content: outlineContent });
      
      // Reload data from server to ensure it's persisted
      const freshData = await courseFoldersAPI.getBasic(id);
      if (freshData?.data) {
        setData(freshData.data);
        if (freshData.data.outline_content?.courseLogEntries) {
          setLogEntries(freshData.data.outline_content.courseLogEntries);
        }
        if (freshData.data.outline_content?.courseLogSchedule) {
          const schedule = freshData.data.outline_content.courseLogSchedule;
          if (schedule.startDate) setStartDate(schedule.startDate);
          if (schedule.endDate) setEndDate(schedule.endDate);
          if (schedule.lectureDays) {
            setLectureDays({
              Monday: schedule.lectureDays.Monday || 0,
              Tuesday: schedule.lectureDays.Tuesday || 0,
              Wednesday: schedule.lectureDays.Wednesday || 0,
              Thursday: schedule.lectureDays.Thursday || 0,
              Friday: schedule.lectureDays.Friday || 0,
              Saturday: schedule.lectureDays.Saturday || 0,
              Sunday: schedule.lectureDays.Sunday || 0,
            });
          }
        }
      }
      
      alert('Course log saved successfully!');
      setEditingId(null);
    } catch (error) {
      console.error('Error saving course log:', error);
      alert('Failed to save course log');
    } finally {
      setSaving(false);
    }
  };

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <FolderContentsNav basePath={basePath} folderId={Number(folderId)} />
        </div>
        {/* Course chip */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-200/60 text-indigo-900 text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base md:text-lg font-semibold text-indigo-900">Course Log</h2>
        </div>


        <div className="bg-white border border-gray-300 rounded-md shadow-sm overflow-hidden">
          {/* Schedule Generator Section - Moved to top */}
          <div className="border-b border-gray-300 bg-gray-50 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Generate Lecture Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-indigo-500 text-sm disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-indigo-500 text-sm disabled:bg-gray-100"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">Lecture Days & Count</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(lectureDays).map(([day, count]) => (
                  <div key={day} className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">{day}:</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={count}
                      onChange={(e) => handleLectureDayChange(day, parseInt(e.target.value) || 0)}
                      disabled={readOnly}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:border-indigo-500 text-sm disabled:bg-gray-100"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Enter number of lectures (50 min slots) per day</p>
            </div>
            <button
              onClick={generateLectureSchedule}
              disabled={readOnly || !startDate || !endDate}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Generate Lecture Schedule
            </button>
          </div>

          {/* Header */}
          <div className="border-b border-gray-300 bg-white px-6 py-4">
            <div className="flex items-start justify-between mb-3">
              <div className="text-left">
                <div className="text-lg font-bold text-gray-800 mb-1">Capital University of Science and Technology</div>
                <div className="text-base font-semibold text-gray-700 mb-0.5">Course Log: {courseTitle} ({courseCode})</div>
                <div className="text-sm text-gray-600">(Section-{data?.section || '—'}) {data?.semester || '—'}</div>
                <div className="text-sm text-gray-600 mt-2">Instructor: {data?.instructor_name || '—'}</div>
              </div>
              <img src="/cust-logo.png" alt="CUST Logo" className="w-20 h-20 opacity-90 ml-4 flex-shrink-0" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300">Lecture<br />No.</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300">Duration</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300">Topics Covered</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300">Evaluation<br />Instruments Used</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map((entry) => (
                  <tr key={entry.id} className={`border-b border-gray-300 ${editingId === entry.id ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 border-r border-gray-300">
                      <span className="text-gray-700">{entry.lectureNo}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-300">
                      {editingId === entry.id ? (
                        <input
                          type="date"
                          value={entry.date}
                          onChange={(e) => handleUpdateEntry(entry.id, 'date', e.target.value)}
                          disabled={readOnly}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-indigo-500 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                      ) : (
                        <span className="text-gray-700">{entry.date}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-300">
                      <span className="text-gray-700">{entry.duration}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-300">
                      {editingField?.id === entry.id && editingField?.field === 'topicsCovered' ? (
                        <textarea
                          value={entry.topicsCovered}
                          onChange={(e) => handleUpdateEntry(entry.id, 'topicsCovered', e.target.value)}
                          onBlur={() => setEditingField(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingField(null);
                          }}
                          disabled={readOnly}
                          autoFocus
                          className="w-full px-2 py-1 border border-indigo-500 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[60px] text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="Enter topics covered"
                        />
                      ) : (
                        <div
                          onClick={() => !readOnly && setEditingField({ id: entry.id, field: 'topicsCovered' })}
                          className={`min-h-[60px] px-2 py-1 cursor-text ${readOnly ? 'cursor-default' : 'hover:bg-gray-50 hover:border hover:border-gray-300 rounded'} ${!entry.topicsCovered ? 'text-gray-400' : 'text-gray-700'}`}
                          title={readOnly ? '' : 'Click to edit'}
                        >
                          {entry.topicsCovered || '—'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-300">
                      {editingField?.id === entry.id && editingField?.field === 'evaluationInstruments' ? (
                        <input
                          type="text"
                          value={entry.evaluationInstruments}
                          onChange={(e) => handleUpdateEntry(entry.id, 'evaluationInstruments', e.target.value)}
                          onBlur={() => setEditingField(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingField(null);
                            if (e.key === 'Enter') setEditingField(null);
                          }}
                          disabled={readOnly}
                          autoFocus
                          className="w-full px-2 py-1 border border-indigo-500 rounded focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="e.g., Quiz 1, Assignment 2"
                        />
                      ) : (
                        <div
                          onClick={() => !readOnly && setEditingField({ id: entry.id, field: 'evaluationInstruments' })}
                          className={`px-2 py-1 cursor-text ${readOnly ? 'cursor-default' : 'hover:bg-gray-50 hover:border hover:border-gray-300 rounded'} ${!entry.evaluationInstruments ? 'text-gray-400' : 'text-gray-700'}`}
                          title={readOnly ? '' : 'Click to edit'}
                        >
                          {entry.evaluationInstruments || '—'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {editingId === entry.id ? (
                          <>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={readOnly}
                              className="text-green-600 hover:text-green-700 font-medium text-xs disabled:text-gray-400"
                            >
                              Done
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={readOnly}
                              className="text-red-600 hover:text-red-700 disabled:text-gray-400"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingId(entry.id)}
                              disabled={readOnly}
                              className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:text-gray-400"
                              title="Edit Date"
                            >
                              <Pencil size={16} />
                              <span className="text-xs">Edit</span>
                            </button>
                            <button
                              onClick={() => handleAddEntry(entry.id)}
                              disabled={readOnly}
                              className="text-indigo-600 hover:text-indigo-700 disabled:text-gray-400"
                              title="Add Entry Below"
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={readOnly}
                              className="text-red-600 hover:text-red-700 disabled:text-gray-400"
                              title="Delete Entry"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {logEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No lecture entries yet. Click "Add Lecture" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-center pb-4">
            <button
              onClick={() => handleAddEntry()}
              disabled={readOnly}
              aria-disabled={readOnly}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-50 shadow-sm transition text-sm w-full md:w-auto ${readOnly ? 'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed' : ''}`}
            >
              <Plus size={14} />
              <span className="leading-none">Add Lecture</span>
            </button>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/course-outline${isReviewContext ? '?review=1' : ''}`)}
            className="px-5 py-2 rounded-full bg-gray-500 text-white hover:bg-gray-600"
          >
            Previous
          </button>
          <button
            onClick={handleSave}
            disabled={saving || readOnly}
            className="px-6 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : readOnly ? 'Read-only' : 'Save Changes'}
          </button>
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/attendance${isReviewContext ? '?review=1' : ''}`)}
            className="px-5 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Next
          </button>
        </div>

        {isReviewContext && submittedStatuses.has((data?.status || '').toUpperCase()) && (
          <CoordinatorFeedbackBox folderId={id} section="COURSE_LOG" />
        )}

        {isAuditMemberReview && submittedStatuses.has((data?.status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={id} section="COURSE_LOG" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderCourseLog;
