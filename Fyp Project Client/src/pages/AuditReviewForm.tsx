import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { CheckCircle, XCircle, FileText, AlertCircle, MessageSquare } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface FolderDetails {
  id: number;
  course_details?: { code?: string; title?: string };
  section?: string;
  faculty_name?: string;
  department_name?: string;
  program_name?: string | null;
  term_name?: string;
  status?: string;
  audit_member_feedback?: Record<string, string>;
}

const formatSectionName = (section: string) => {
  return section
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

export const AuditReviewForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { folderId } = useParams();
  const [folder, setFolder] = useState<FolderDetails | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [finalRemarks, setFinalRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFolder = async () => {
    if (!folderId) return;
    try {
      setLoading(true);
      const res = await courseFoldersAPI.getById(Number(folderId));
      setFolder(res.data);
    } catch (err) {
      console.error('Error loading folder:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFolder(); }, [folderId]);

  // Check if there's any feedback
  const sectionFeedback = folder?.audit_member_feedback || {};
  const hasFeedback = Object.values(sectionFeedback).some(
    fb => fb && String(fb).trim().length > 0
  );

  const handleSubmit = async () => {
    if (!folderId) return;

    // CRITICAL: Only prevent changes after folder has been reviewed by HOD (final approval/rejection)
    // Allow changes as long as folder is UNDER_AUDIT or AUDIT_COMPLETED (awaiting convener/HOD review)
    const folderStatus = folder?.status?.toUpperCase();
    if (folderStatus === 'SUBMITTED_TO_HOD' || folderStatus === 'APPROVED_BY_HOD' || folderStatus === 'REJECTED_BY_HOD') {
      alert('This folder has already been reviewed by HOD (approved or rejected). You cannot change your audit decision at this stage.');
      return;
    }

    // Validate final remarks
    if (!finalRemarks.trim()) {
      alert('Please provide final remarks before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      // Submit with final remarks
      const form = new FormData();
      form.append('overall_feedback', finalRemarks.trim());
      form.append('decision', decision);

      const res = await courseFoldersAPI.submitAuditReport(Number(folderId), form);

      // Show the generated report
      setShowReport(true);

      if (res.data.file_url) {
        setReportUrl(res.data.file_url);
        // Auto-download
        const link = document.createElement('a');
        link.href = res.data.file_url;
        link.setAttribute('download', ''); // Force download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Dispatch event to refresh sidebar folders
      window.dispatchEvent(new CustomEvent('foldersUpdated'));
      
      // Navigate to success page or dashboard
      navigate('/audit-member/reports');
    } catch (e: any) {
      console.error('Failed to submit audit report:', e);
      const errorMessage = e?.response?.data?.error || e?.message || 'Failed to submit audit report.';
      alert(`Failed to submit audit report: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Helper function to add text with word wrap
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + (lines.length * fontSize * 0.5);
    };

    // Header Section
    doc.setFillColor(79, 70, 229); // Indigo
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('AUDIT REPORT', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${folder?.course_details?.code} - ${folder?.course_details?.title} | Section ${folder?.section}`, pageWidth / 2, 30, { align: 'center' });

    yPos = 50;
    doc.setTextColor(0, 0, 0);

    // Status Badge
    const statusColor = decision === 'approve' ? [16, 185, 129] : [239, 68, 68]; // Green or Red
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(15, yPos, 80, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(decision === 'approve' ? '✓ APPROVED' : '✗ REJECTED', 20, yPos + 8);

    yPos += 20;
    doc.setTextColor(0, 0, 0);

    // Audit Summary Section
    doc.setFillColor(51, 65, 85); // Slate-700
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('AUDIT SUMMARY', 20, yPos + 7);

    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Summary details
    const summaryDetails = [
      `Course: ${folder?.course_details?.code} - ${folder?.course_details?.title}`,
      `Section: ${folder?.section}`,
      `Faculty: ${folder?.faculty_name || 'N/A'}`,
      `Department: ${folder?.department_name || 'N/A'}`,
      `Term: ${folder?.term_name || 'N/A'}`,
      `Auditor: ${user?.full_name || 'N/A'}`,
      `Decision: ${decision.toUpperCase()}`
    ];

    summaryDetails.forEach(detail => {
      doc.text(detail, 20, yPos);
      yPos += 6;
    });

    yPos += 5;

    // Final Remarks Section
    doc.setFillColor(51, 65, 85);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FINAL REMARKS', 20, yPos + 7);

    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Add final remarks with word wrap
    yPos = addText(finalRemarks, 20, yPos, pageWidth - 40, 10);
    yPos += 10;

    // Section-Specific Feedback
    if (hasFeedback) {
      // Check if we need a new page
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(51, 65, 85);
      doc.rect(15, yPos, pageWidth - 30, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SECTION-SPECIFIC FEEDBACK', 20, yPos + 7);

      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text('Detailed feedback for specific sections of the course folder:', 20, yPos);
      yPos += 10;

      // Add each section feedback
      Object.entries(sectionFeedback).forEach(([section, feedback]) => {
        if (!feedback || (typeof feedback === 'string' && !feedback.trim())) return;

        // Check if we need a new page
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }

        // Section badge
        doc.setFillColor(241, 245, 249); // Slate-100
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.roundedRect(20, yPos, 60, 8, 1, 1, 'FD');
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(formatSectionName(section).toUpperCase(), 22, yPos + 5.5);

        yPos += 12;
        doc.setTextColor(55, 65, 81); // Gray-700
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        // Add feedback with word wrap
        yPos = addText(String(feedback), 22, yPos, pageWidth - 44, 9);
        yPos += 8;
      });
    }

    // Footer
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth - 20, footerY, { align: 'right' });

    // Save the PDF
    const fileName = `Audit_Report_${folder?.course_details?.code}_${folder?.section}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  const handleBackToDashboard = () => {
    const basePath = user?.role === 'AUDIT_MEMBER' ? '/audit-member' : '/evaluator';
    navigate(`${basePath}/dashboard`);
  };

  if (loading) {
    return (
      <DashboardLayout userRole="audit" userName={user?.full_name || 'Audit Team'} userAvatar={user?.profile_picture || undefined}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (showReport) {
    // Show Audit Report (similar to FolderCoordinatorFeedback UI)
    return (
      <DashboardLayout userRole="audit" userName={user?.full_name || 'Audit Team'} userAvatar={user?.profile_picture || undefined}>
        <div className="p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Audit Report
              </h1>
              <p className="text-gray-600">
                {folder?.course_details?.code} - {folder?.course_details?.title} | Section {folder?.section}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (reportUrl) {
                    const link = document.createElement('a');
                    link.href = reportUrl;
                    link.setAttribute('download', '');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } else {
                    generatePDF();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-white border-2 border-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={handleBackToDashboard}
                className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          {/* Status Card */}
          <div className={`rounded-lg p-6 ${decision === 'approve'
            ? 'bg-green-50 border-l-4 border-green-500'
            : 'bg-red-50 border-l-4 border-red-500'
            }`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {decision === 'approve' ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <h2 className={`text-xl font-bold mb-2 ${decision === 'approve'
                  ? 'text-green-900'
                  : 'text-red-900'
                  }`}>
                  {decision === 'approve'
                    ? 'Audit Approved'
                    : 'Audit Rejected'}
                </h2>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${decision === 'approve'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                  }`}>
                  {decision.toUpperCase()}
                </div>
                {decision === 'reject' && (
                  <p className="mt-3 text-sm text-red-800">
                    ⚠️ The audit has identified issues. Please review the feedback below carefully.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Overall Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-700 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Audit Summary
              </h3>
            </div>
            <div className="p-6 bg-gray-50">
              <div className="bg-white rounded-md border border-gray-200 p-5">
                <div className="space-y-2">
                  <p className="text-gray-800"><span className="font-semibold">Course:</span> {folder?.course_details?.code} - {folder?.course_details?.title}</p>
                  <p className="text-gray-800"><span className="font-semibold">Section:</span> {folder?.section}</p>
                  <p className="text-gray-800"><span className="font-semibold">Faculty:</span> {folder?.faculty_name}</p>
                  <p className="text-gray-800"><span className="font-semibold">Department:</span> {folder?.department_name}</p>
                  <p className="text-gray-800"><span className="font-semibold">Term:</span> {folder?.term_name}</p>
                  <p className="text-gray-800"><span className="font-semibold">Auditor:</span> {user?.full_name}</p>
                  <p className="text-gray-800">
                    <span className="font-semibold">Decision:</span>{' '}
                    <span className={decision === 'approve' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                      {decision.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Final Remarks */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-700 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Final Remarks
              </h3>
            </div>
            <div className="p-6 bg-gray-50">
              <div className="bg-white rounded-md border border-gray-200 p-5">
                <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                  {finalRemarks}
                </p>
              </div>
            </div>
          </div>

          {/* Section-Specific Feedback */}
          {hasFeedback ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-slate-700 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Section-Specific Feedback
                </h3>
              </div>
              <div className="p-6 bg-gray-50">
                <p className="text-gray-700 mb-5 text-sm font-medium">
                  Detailed feedback for specific sections of the course folder:
                </p>
                <div className="space-y-3">
                  {Object.entries(sectionFeedback).map(([section, feedback]) => {
                    if (!feedback || (typeof feedback === 'string' && !feedback.trim())) return null;

                    return (
                      <div
                        key={section}
                        className="bg-white rounded-md border border-gray-200 p-5 hover:border-gray-300 transition-colors"
                      >
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wide border border-slate-200">
                            {formatSectionName(section)}
                          </span>
                        </h4>
                        <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed pl-1">
                          {String(feedback)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">
                    No Section-Specific Feedback
                  </h4>
                  <p className="text-blue-800 text-sm">
                    No detailed feedback was provided for specific sections during the audit.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 mb-1">
                  Report Submitted Successfully
                </h4>
                <p className="text-green-800 text-sm">
                  Your audit report has been submitted. The convener will review and take appropriate action.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show Decision Form
  return (
    <DashboardLayout userRole="audit" userName={user?.full_name || 'Audit Team'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-6 space-y-6">
        {/* Folder Contents Navigation - Always visible at top when folder is open */}
        {folderId && (
          <div className="mb-4">
            <FolderContentsNav 
              basePath="/audit-member" 
              folderId={Number(folderId)} 
              title="Folder Contents Navigation"
            />
          </div>
        )}
        
        {/* Header */}
        <div
          className="relative rounded-lg overflow-hidden"
          style={{ backgroundImage: 'url(/background-image.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '180px' }}
        >
          <div className="absolute inset-0 bg-primary/70" />
          <div className="relative z-10 flex flex-col items-center justify-center py-8 px-6 text-white">
            <h1 className="text-2xl font-bold">Audit Review</h1>
            {folder && (
              <p className="text-sm text-white/90 mt-1">{folder.course_details?.code} - {folder.course_details?.title} • Section {folder.section}</p>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">
                Review Section-Specific Feedback
              </h4>
              <p className="text-blue-800 text-sm mb-3">
                Before making your final decision, please ensure you have reviewed all sections of this course folder and added your feedback using the "Audit Member Feedback" boxes available on each page.
              </p>
              {hasFeedback ? (
                <p className="text-green-700 text-sm font-medium">
                  ✓ You have provided feedback for {Object.values(sectionFeedback).filter(fb => fb && String(fb).trim()).length} section(s).
                </p>
              ) : (
                <p className="text-amber-700 text-sm font-medium">
                  ⚠ No section-specific feedback has been added yet. You can still submit your decision.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Check if folder has been reviewed by HOD (final approval/rejection) - prevent decision changes */}
        {folder?.status && ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD'].includes(folder.status.toUpperCase()) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900 mb-1">
                  Decision Locked
                </h4>
                <p className="text-yellow-800 text-sm">
                  This folder has already been reviewed by HOD (approved or rejected). Your audit decision cannot be changed at this stage.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Decision Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Final Audit Decision</h2>

          <div className="space-y-6">
            {/* Decision Options */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Decision</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    const folderStatus = folder?.status?.toUpperCase();
                    if (folderStatus === 'SUBMITTED_TO_HOD' || folderStatus === 'APPROVED_BY_HOD' || folderStatus === 'REJECTED_BY_HOD') {
                      alert('This folder has already been reviewed by HOD. You cannot change your decision.');
                      return;
                    }
                    setDecision('approve');
                  }}
                  disabled={folder?.status && ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD'].includes(folder.status.toUpperCase())}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${decision === 'approve'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-300'
                    } ${folder?.status && ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD'].includes(folder.status.toUpperCase()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle className={`w-6 h-6 ${decision === 'approve' ? 'text-green-600' : 'text-gray-400'}`} />
                    <div className="text-left">
                      <div className={`font-semibold ${decision === 'approve' ? 'text-green-900' : 'text-gray-700'}`}>
                        Approve
                      </div>
                      <div className="text-xs text-gray-600">
                        Folder meets audit standards
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const folderStatus = folder?.status?.toUpperCase();
                    if (folderStatus === 'SUBMITTED_TO_HOD' || folderStatus === 'APPROVED_BY_HOD' || folderStatus === 'REJECTED_BY_HOD') {
                      alert('This folder has already been reviewed by HOD. You cannot change your decision.');
                      return;
                    }
                    setDecision('reject');
                  }}
                  disabled={folder?.status && ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD'].includes(folder.status.toUpperCase())}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${decision === 'reject'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 hover:border-red-300'
                    } ${folder?.status && ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD'].includes(folder.status.toUpperCase()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <XCircle className={`w-6 h-6 ${decision === 'reject' ? 'text-red-600' : 'text-gray-400'}`} />
                    <div className="text-left">
                      <div className={`font-semibold ${decision === 'reject' ? 'text-red-900' : 'text-gray-700'}`}>
                        Reject
                      </div>
                      <div className="text-xs text-gray-600">
                        Folder requires corrections
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Final Remarks */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Final Remarks <span className="text-red-600">*</span>
              </label>
              <textarea
                value={finalRemarks}
                onChange={(e) => setFinalRemarks(e.target.value)}
                rows={5}
                disabled={folder?.status && ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD'].includes(folder.status.toUpperCase())}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Provide your overall assessment and final remarks about this audit..."
                required
              />
              {!finalRemarks.trim() && (
                <p className="text-xs text-red-600 mt-1">Final remarks are required before submission.</p>
              )}
            </div>

            {/* Info about the decision */}
            <div className={`p-4 rounded-lg ${decision === 'approve' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
              <p className={`text-sm ${decision === 'approve' ? 'text-green-800' : 'text-red-800'}`}>
                {decision === 'approve'
                  ? '✓ By approving, you confirm that this course folder meets the required audit standards and can proceed to the next stage.'
                  : '⚠ By rejecting, you indicate that this folder has issues that need to be addressed. Make sure you have added section-specific feedback explaining the problems.'}
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={handleBackToDashboard}
                className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  submitting || 
                  !finalRemarks.trim() || 
                  (folder?.status && ['SUBMITTED_TO_HOD', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD'].includes(folder.status.toUpperCase()))
                }
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Submit Audit Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
