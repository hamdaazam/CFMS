import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Home,
    User,
    Calendar,
    BookOpen,
    Users,
    Building2,
    FolderKanban,
    LogOut,
    Check,
    AlertCircle,
    FileCheck,
    Bell,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Folder as FolderIcon,
    FileText,
    Star,
    Send,
    Menu,
    X,
} from 'lucide-react';
import { courseFoldersAPI } from '../../services/api';

interface SidebarProps {
    userRole?: 'admin' | 'faculty' | 'supervisor' | 'coordinator' | 'audit' | 'convener' | 'hod';
}

interface MenuItem {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    path: string;
    hasSubmenu?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ userRole }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [folders, setFolders] = useState<any[]>([]);
    const [myCoursesOpen, setMyCoursesOpen] = useState(true);
    const [completedOpen, setCompletedOpen] = useState(true);
    const [pendingOpen, setPendingOpen] = useState(true);
    const [submittedOpen, setSubmittedOpen] = useState(true);
    const [openFolderIds, setOpenFolderIds] = useState<Record<number, boolean>>({});
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const [folderAssignments, setFolderAssignments] = useState<Record<number, any[]>>({});
    const [folderQuizzes, setFolderQuizzes] = useState<Record<number, any[]>>({});
    // Coordinator: folders awaiting my review (SUBMITTED status, assigned_to_me)
    const [coordinatorReviewFolders, setCoordinatorReviewFolders] = useState<any[]>([]);
    const [coordinatorReviewOpen, setCoordinatorReviewOpen] = useState(true);
    // HOD: folders forwarded after convener review (SUBMITTED_TO_HOD status)
    const [hodReviewFolders, setHodReviewFolders] = useState<any[]>([]);
    const [hodReviewOpen, setHodReviewOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    // Determine the actual user role from context if not provided
    const getActualUserRole = (): 'admin' | 'faculty' | 'supervisor' | 'coordinator' | 'audit' | 'convener' | 'hod' => {
        if (userRole) {
            // Map legacy userRole prop to specific role
            if (userRole === 'faculty') {
                // Check actual user role to distinguish FACULTY from SUPERVISOR
                if (user?.role === 'SUPERVISOR') return 'supervisor';
                return 'faculty';
            }
            return userRole;
        }

        if (!user) return 'admin';

        // Map user roles to sidebar roles (now with separate faculty and supervisor)
        const roleMapping: Record<string, 'admin' | 'faculty' | 'supervisor' | 'coordinator' | 'audit' | 'convener' | 'hod'> = {
            'ADMIN': 'admin',
            'CONVENER': 'convener',
            'HOD': 'hod',
            'COORDINATOR': 'coordinator',
            'FACULTY': 'faculty',
            'AUDIT_TEAM': 'audit',
            // Treat AUDIT_MEMBER as faculty-first in the sidebar so they don't lose teaching features.
            // Audit features remain accessible via explicit Audit links.
            'AUDIT_MEMBER': 'faculty',
            'EVALUATOR': 'audit',
        };

        return roleMapping[user.role] || 'admin';
    };

    const actualRole = getActualUserRole();

    // Check if user has coordinator access (faculty member who is also a coordinator)
    const hasCoordinatorAccess = !!(user as any)?.has_coordinator_access || user?.role === 'COORDINATOR';
    
    // If user is faculty with coordinator access, hide folder contents from sidebar
    // ALWAYS hide folder content dropdowns in sidebar - all navigation is now on page top via FolderContentsNav
    const shouldHideFolderContents = true;

    // Fetch real-time folders for faculty and audit roles
    useEffect(() => {
        let mounted = true;
        if (actualRole === 'faculty' || actualRole === 'coordinator' || actualRole === 'audit' || actualRole === 'convener' || actualRole === 'hod') {
            setLoadingFolders(true);
            const apiCall = actualRole === 'audit'
                ? courseFoldersAPI.getMyAuditReports({ submitted: 0 })
                : courseFoldersAPI.getMyFolders();



            apiCall
                .then((res: any) => {
                    if (!mounted) return;
                    // Audit: we call my_audit_reports and get assignment objects; map to folder-like data
                    if (actualRole === 'audit') {
                        const items = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
                        const folderMap: Record<number, any> = {};
                        items.forEach((a: any) => {
                            const id = a.folder_id;
                            if (!id) return;
                            const f = {
                                id,
                                course_details: { code: a.course?.code, title: a.course?.title },
                                section: a.section,
                                faculty_name: a.faculty,
                                term_name: a.term,
                                status: a.folder_status,
                                assignment_id: a.assignment_id,
                                assignment_submitted: !!a.submitted,
                            };
                            // Prioritize pending (active) assignments over submitted ones
                            if (!folderMap[id] || (folderMap[id] && folderMap[id].assignment_submitted && !f.assignment_submitted)) {
                                folderMap[id] = f;
                            }
                        });
                        const data = Object.values(folderMap);
                        setFolders(data as any[]);

                    } else {
                        // Handle different response formats
                        let data: any[] = [];
                        if (Array.isArray(res.data)) {
                            data = res.data;
                        } else if (res.data && Array.isArray(res.data.results)) {
                            data = res.data.results;
                        } else if (res.data && Array.isArray(res.data.folders)) {
                            data = res.data.folders;
                        } else if (res.data && typeof res.data === 'object') {
                            // If it's a single object, wrap it in an array
                            data = [res.data];
                        }
                        setFolders(data);
                        console.log('[Sidebar] Folders loaded:', data.length, 'folders', data);
                    }
                })
                .catch((err) => {
                    if (!mounted) return;
                    console.error('[Sidebar] Error fetching folders:', err);
                    console.error('[Sidebar] Error details:', err.response?.data || err.message);
                    setFolders([]);
                })
                .finally(() => mounted && setLoadingFolders(false));
        }
        return () => {
            mounted = false;
        };
    }, [actualRole]);

    // Fetch folders assigned to coordinator for review (all statuses: SUBMITTED, APPROVED_COORDINATOR, REJECTED_COORDINATOR)
    // This applies to any user who has coordinator assignments (capability-based)
    // Note: Folders with APPROVED_BY_HOD status are filtered out in the render to hide from sidebar
    useEffect(() => {
        let mounted = true;
        // Only fetch if user has coordinator access (checked via has_coordinator_access flag from backend)
        if (user?.has_coordinator_access) {
            // Fetch all folders assigned to coordinator (assigned_to_me: 1) - includes SUBMITTED and folders they reviewed
            // Include all statuses including APPROVED_BY_HOD so dashboard can show them
            courseFoldersAPI
                .getAll({ assigned_to_me: 1 })
                .then((res) => {
                    if (!mounted) return;
                    const coordinatorData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                    setCoordinatorReviewFolders(coordinatorData);
                })
                .catch(() => {
                    if (mounted) setCoordinatorReviewFolders([]);
                });
        } else {
            setCoordinatorReviewFolders([]);
        }
        return () => { mounted = false; };
    }, [user?.has_coordinator_access]);

    // Fetch HOD review folders (SUBMITTED_TO_HOD status) - separate from coordinator review
    // This is for folders that came after convener review
    useEffect(() => {
        let mounted = true;
        // Only fetch for HOD role
        if (actualRole === 'hod' && user?.department) {
            const params: any = { status: 'SUBMITTED_TO_HOD' };
            params.department = user.department;
            courseFoldersAPI
                .getAll(params)
                .then((res) => {
                    if (!mounted) return;
                    const hodData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                    setHodReviewFolders(hodData);
                })
                .catch(() => {
                    if (mounted) setHodReviewFolders([]);
                });
        } else {
            setHodReviewFolders([]);
        }
        return () => { mounted = false; };
    }, [actualRole, user?.department]);

    // Fetch assignments for a specific folder
    const fetchAssignmentsForFolder = async (folderId: number) => {
        try {
            const response = await courseFoldersAPI.getBasic(folderId);
            const assignments = response.data.outline_content?.assignments || [];
            setFolderAssignments(prev => ({ ...prev, [folderId]: assignments }));
        } catch (err) {
            console.error(`Error fetching assignments for folder ${folderId}:`, err);
        }
    };

    // Fetch quizzes for a specific folder
    const fetchQuizzesForFolder = async (folderId: number) => {
        try {
            const response = await courseFoldersAPI.getBasic(folderId);
            const quizzes = response.data.outline_content?.quizzes || [];
            setFolderQuizzes(prev => ({ ...prev, [folderId]: quizzes }));
        } catch (err) {
            console.error(`Error fetching quizzes for folder ${folderId}:`, err);
        }
    };

    // Fetch assignments and quizzes for each folder
    useEffect(() => {
        if ((actualRole === 'faculty' || actualRole === 'coordinator' || actualRole === 'audit' || actualRole === 'convener' || actualRole === 'hod') && folders.length > 0) {
            folders.forEach((folder) => {
                fetchAssignmentsForFolder(folder.id);
                fetchQuizzesForFolder(folder.id);
            });
        }
    }, [folders, actualRole]);

    // Also fetch assignments/quizzes for coordinator review folders
    useEffect(() => {
        if (coordinatorReviewFolders.length > 0) {
            coordinatorReviewFolders.forEach((folder) => {
                // only fetch if not already present to avoid duplicate API calls
                if (!folderAssignments[folder.id]) fetchAssignmentsForFolder(folder.id);
                if (!folderQuizzes[folder.id]) fetchQuizzesForFolder(folder.id);
            });
        }
    }, [coordinatorReviewFolders]);

    // Listen for assignment updates
    useEffect(() => {
        const handleAssignmentsUpdate = (event: CustomEvent) => {
            const { folderId } = event.detail;
            if (folderId) {
                fetchAssignmentsForFolder(folderId);
            }
        };

        window.addEventListener('assignmentsUpdated', handleAssignmentsUpdate as EventListener);

        return () => {
            window.removeEventListener('assignmentsUpdated', handleAssignmentsUpdate as EventListener);
        };
    }, []);

    // Listen for quiz updates
    useEffect(() => {
        const handleQuizzesUpdate = (event: CustomEvent) => {
            const { folderId } = event.detail;
            if (folderId) {
                fetchQuizzesForFolder(folderId);
            }
        };

        window.addEventListener('quizzesUpdated', handleQuizzesUpdate as EventListener);

        return () => {
            window.removeEventListener('quizzesUpdated', handleQuizzesUpdate as EventListener);
        };
    }, []);

    // Listen for folder updates (status changes)
    useEffect(() => {
        const handleFoldersUpdate = () => {
            if (actualRole === 'faculty' || actualRole === 'audit') {
                setLoadingFolders(true);
                const apiCall = actualRole === 'audit'
                    ? courseFoldersAPI.getMyAuditReports({ submitted: 0 })
                    : courseFoldersAPI.getMyFolders();
                apiCall
                    .then((res: any) => {
                        if (actualRole === 'audit') {
                            const items = Array.isArray(res.data) ? res.data : (res.data?.results || res.data || []);
                            const folderMap: Record<number, any> = {};
                            items.forEach((a: any) => {
                                const id = a.folder_id;
                                if (!id) return;
                                const f = {
                                    id,
                                    course_details: { code: a.course?.code, title: a.course?.title },
                                    section: a.section,
                                    faculty_name: a.faculty,
                                    term_name: a.term,
                                    status: a.folder_status,
                                    assignment_id: a.assignment_id,
                                    assignment_submitted: !!a.submitted,
                                };
                                if (!folderMap[id] || (folderMap[id] && !folderMap[id].assignment_submitted && f.assignment_submitted)) {
                                    folderMap[id] = f;
                                }
                            });
                            setFolders(Object.values(folderMap));
                        } else {
                            // Handle different response formats
                            let data: any[] = [];
                            if (Array.isArray(res.data)) {
                                data = res.data;
                            } else if (res.data && Array.isArray(res.data.results)) {
                                data = res.data.results;
                            } else if (res.data && Array.isArray(res.data.folders)) {
                                data = res.data.folders;
                            } else if (res.data && typeof res.data === 'object') {
                                data = [res.data];
                            }
                            setFolders(data);
                        }
                    })
                    .catch(() => setFolders([]))
                    .finally(() => setLoadingFolders(false));
            }
        };

        window.addEventListener('foldersUpdated', handleFoldersUpdate);

        return () => {
            window.removeEventListener('foldersUpdated', handleFoldersUpdate);
        };
    }, [actualRole]);

    // Helper function to check if folder has final term content
    const hasFinalTermContent = (folder: any): boolean => {
        try {
            // Use backend-provided flag if available (most reliable)
            if (folder.has_final_term_content !== undefined) {
                return folder.has_final_term_content === true;
            }
            
            // Fallback: check files directly
            const has_required_files = !!(
                folder.project_report_file && 
                folder.course_result_file && 
                folder.folder_review_report_file
            );
            
            // Note: outline_content is not included in list serializer to avoid performance issues
            // So we rely on the backend's has_final_term_content field
            
            return has_required_files;
        } catch (e) {
            console.error('Error checking final term content:', e);
            return false;
        }
    };

    // Group folders by Pending, Completed, and Submitted
    const groups = useMemo(() => {
        if (actualRole === 'audit') {
            // For audit members:
            // Pending: Active tasks (UNDER_AUDIT) - Rendered in the main "Folders" list
            const pending = folders.filter((f: any) => (f.status || '').toUpperCase() === 'UNDER_AUDIT');

            // Completed: Finished tasks (AUDIT_COMPLETED) - Rendered in the "Completed" list
            const completed = folders.filter((f: any) => (f.status || '').toUpperCase() === 'AUDIT_COMPLETED');

            // Submitted: Not used for audit rendering
            const submitted: any[] = [];

            return { pending, completed, submitted };
        }
        const submittedStatuses = new Set<string>([
            'SUBMITTED',
            'UNDER_REVIEW_BY_COORDINATOR',
            'APPROVED_COORDINATOR',
            'UNDER_AUDIT',
            'AUDIT_COMPLETED',
            'SUBMITTED_TO_HOD',
            'UNDER_REVIEW_BY_HOD',
        ]);
        const submitted: any[] = [];
        const completed: any[] = [];
        const pending: any[] = [];

        for (const f of folders) {
            const status = (f.status || '').toUpperCase();
            
            // Handle APPROVED_BY_HOD folders specially based on deadline and final term content
            if (status === 'APPROVED_BY_HOD') {
                const firstActivityCompleted = f.first_activity_completed === true || f.first_activity_completed === 'true';
                const canEditForFinalSubmission = f.can_edit_for_final_submission === true || f.can_edit_for_final_submission === 'true';
                const hasFinal = hasFinalTermContent(f);
                
                if (firstActivityCompleted) {
                    // If deadline has passed (can edit for final submission), check if final term content exists
                    if (canEditForFinalSubmission) {
                        if (hasFinal) {
                            // Has final term → fully completed (second submission done)
                            completed.push(f);
                        } else {
                            // Deadline passed but no final term yet → ready for second submission (should be in pending)
                            pending.push(f);
                        }
                    } else {
                        // Deadline hasn't passed yet → treat as completed (first submission completed, waiting for deadline)
                        completed.push(f);
                    }
                } else {
                    // Shouldn't happen for new folders, but if first_activity_completed is false, treat as completed
                    completed.push(f);
                }
                // Also add to submitted for consistency
                submitted.push(f);
                continue;
            }
            
            // Standard status handling
            if (submittedStatuses.has(status)) {
                submitted.push(f);
            }
            
            // Add to completed if it's a completed status (but not APPROVED_BY_HOD, handled above)
            if (status === 'COMPLETED') {
                completed.push(f);
            }
            
            // Add to pending if it's a pending status (DRAFT, REJECTED, etc.)
            if (!submittedStatuses.has(status) && status !== 'COMPLETED' && status !== 'APPROVED_BY_HOD') {
                pending.push(f);
            }
        }
        return { pending, completed, submitted };
    }, [folders, actualRole]);

    const sectionKey = (folderId: number, key: string) => `${folderId}:${key}`;
    const toggleSection = (folderId: number, key: string) =>
        setOpenSections((m) => ({ ...m, [sectionKey(folderId, key)]: !m[sectionKey(folderId, key)] }));
    const isSectionOpen = (folderId: number, key: string) => !!openSections[sectionKey(folderId, key)];

    // Admin menu items
    const adminMenuItems: MenuItem[] = [
        { icon: User, label: 'My Profile', path: '/admin/profile' },
        { icon: Home, label: 'Dashboard', path: '/admin/dashboard' },
        { icon: Calendar, label: 'Terms Management', path: '/terms' },
        { icon: BookOpen, label: 'Course Allocation', path: '/course-allocation' },
        { icon: Users, label: 'Faculty Management', path: '/faculty-management' },
        { icon: Users, label: 'Pending Role Requests', path: '/faculty-management/pending' },
        { icon: Building2, label: 'Department', path: '/department' },
        { icon: FolderKanban, label: 'Program', path: '/program' },
        { icon: FileCheck, label: 'Approved Folders', path: '/admin/approved-folders' },
        { icon: Bell, label: 'Notifications', path: '/admin/notifications' },
        { icon: LogOut, label: 'Log Out', path: '/logout' },
    ];

    // Faculty menu items (for FACULTY role)
    const facultyMenuItems: MenuItem[] = [
        { icon: User, label: 'My Profile', path: '/faculty/profile' },
        { icon: Home, label: 'Dashboard', path: '/faculty/dashboard' },
        { icon: BookOpen, label: 'My Courses', path: '/faculty/courses' },
        { icon: FolderOpen, label: 'Create Course Folder', path: '/faculty/create-folder' },
        { icon: Check, label: 'My Folders', path: '/faculty/folders' },
        { icon: AlertCircle, label: 'Pending Folders', path: '/faculty/pending-folder' },
        { icon: FileCheck, label: 'Accepted Folders', path: '/faculty/accepted-folder' },
        { icon: Bell, label: 'Notifications', path: '/faculty/notifications' },
        // If this faculty is also a course coordinator for any course, enable coordinator review module too
        ...(user?.has_coordinator_access
            ? ([{ icon: FolderKanban, label: 'Folders to Review (as Coordinator)', path: '/coordinator/review' }] as MenuItem[])
            : []),
        // If this user is also assigned as an audit member, show audit module links too
        ...(user?.has_audit_access || user?.role === 'AUDIT_MEMBER'
            ? ([
                { icon: Home, label: 'Audit Dashboard', path: '/audit-member/dashboard' },
                { icon: FolderOpen, label: 'Audit Assigned Folders', path: '/audit-member/assigned-folders' },
                { icon: FileCheck, label: 'Audit Reports', path: '/audit-member/reports' },
                { icon: Bell, label: 'Audit Notifications', path: '/audit-member/notifications' },
            ] as MenuItem[])
            : []),
        { icon: LogOut, label: 'Log Out', path: '/logout' },
    ];

    // Supervisor menu items (for SUPERVISOR role - keeping separate from FACULTY)
    const supervisorMenuItems: MenuItem[] = [
        { icon: User, label: 'My Profile', path: '/supervisor/profile' },
        { icon: Home, label: 'Dashboard', path: '/supervisor/dashboard' },
        { icon: BookOpen, label: 'My Courses', path: '/supervisor/courses' },
        { icon: Check, label: 'Completed Folder', path: '/supervisor/completed-folder', hasSubmenu: true },
        { icon: AlertCircle, label: 'Pending Folder', path: '/supervisor/pending-folder', hasSubmenu: true },
        { icon: FileCheck, label: 'Accepted Folder', path: '/supervisor/submitted-folder' },
        { icon: Bell, label: 'Notifications', path: '/supervisor/notifications' },
        { icon: LogOut, label: 'Log Out', path: '/logout' },
    ];

    // Course Coordinator menu items
    const coordinatorMenuItems: MenuItem[] = [
        { icon: User, label: 'My Profile', path: '/coordinator/profile' },
        { icon: Home, label: 'Dashboard', path: '/coordinator/dashboard' },
        { icon: BookOpen, label: 'My Courses', path: '/coordinator/courses' },
        { icon: FolderOpen, label: 'Create Course Folder', path: '/coordinator/create-folder' },
        { icon: Check, label: 'My Folders', path: '/coordinator/folders' },
        { icon: AlertCircle, label: 'Pending Folders', path: '/coordinator/pending-folder' },
        { icon: FileCheck, label: 'Accepted Folders', path: '/coordinator/accepted-folder' },
        { icon: FolderKanban, label: 'Folders to Review', path: '/coordinator/review' },
        { icon: LogOut, label: 'Log Out', path: '/logout' },
    ];

    // Audit Team menu items (EVALUATOR)
    // Audit menu items: differentiate base path for AUDIT_MEMBER vs others
    const auditBase = user?.role === 'AUDIT_MEMBER' ? '/audit-member' : '/evaluator';
    const auditMenuItems: MenuItem[] = [
        { icon: User, label: 'My Profile', path: `${auditBase}/profile` },
        { icon: Home, label: 'Dashboard', path: `${auditBase}/dashboard` },
        { icon: FolderOpen, label: 'Assigned Folders', path: `${auditBase}/assigned-folders` },
        { icon: FileCheck, label: 'Audit Reports', path: `${auditBase}/reports` },
        { icon: Bell, label: 'Notifications', path: `${auditBase}/notifications` },
        { icon: LogOut, label: 'Log Out', path: '/logout' },
    ];

    // Convener menu items
    const convenerMenuItems: MenuItem[] = [
        { icon: User, label: 'My Profile', path: '/convener/profile' },
        { icon: Home, label: 'Dashboard', path: '/convener/dashboard' },
        { icon: Users, label: 'Audit Members', path: '/convener/audit-members' },
        { icon: FolderKanban, label: 'Assign Folders', path: '/convener/assign-courses' },
        { icon: FileCheck, label: 'Review Audits', path: '/convener/review-audits' },
        { icon: FileCheck, label: 'Accepted Folders', path: '/convener/accepted-folder' },
        // Only show coordinator review link if user has coordinator assignments
        ...(user?.has_coordinator_access
            ? [{ icon: FolderKanban, label: 'Folders to Review (as Coordinator)', path: '/coordinator/review' }] as MenuItem[]
            : []),
        { icon: Bell, label: 'Notifications', path: '/convener/notifications' },
        { icon: LogOut, label: 'Log Out', path: '/logout' },
    ];

    // HOD menu items
    const hodMenuItems: MenuItem[] = [
        { icon: User, label: 'My Profile', path: '/hod/profile' },
        { icon: Home, label: 'Dashboard', path: '/hod/dashboard' },
        { icon: FolderKanban, label: 'Review Folders', path: '/hod/review-folders' },
        { icon: FileCheck, label: 'Reviewed Folders', path: '/hod/reviewed-folders' },
        { icon: FileCheck, label: 'Final Approvals', path: '/hod/approvals' },
        { icon: Users, label: 'Role Requests', path: '/hod/role-requests' },
        { icon: FolderKanban, label: 'Department Overview', path: '/hod/overview' },
        { icon: AlertCircle, label: 'Pending Folders', path: '/hod/pending-folders' },
        { icon: FileCheck, label: 'Submitted Folders', path: '/hod/submitted-folders' },
        { icon: Check, label: 'Completed Folders', path: '/hod/completed-folders' },
        // Only show coordinator review link if user has coordinator assignments
        ...(user?.has_coordinator_access
            ? [{ icon: FolderKanban, label: 'Folders to Review (as Coordinator)', path: '/coordinator/review' }] as MenuItem[]
            : []),
        { icon: Bell, label: 'Notifications', path: '/hod/notifications' },
        { icon: LogOut, label: 'Log Out', path: '/logout' },
    ];

    // Select menu items based on role
    const getMenuItems = (): MenuItem[] => {
        switch (actualRole) {
            case 'faculty':
                return facultyMenuItems;
            case 'supervisor':
                return supervisorMenuItems;
            case 'coordinator':
                return coordinatorMenuItems;
            case 'audit':
                return auditMenuItems;
            case 'convener':
                return convenerMenuItems;
            case 'hod':
                return hodMenuItems;
            default:
                return adminMenuItems;
        }
    };

    const menuItems = getMenuItems();

    const isActive = (path: string) => location.pathname === path;

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar text-white rounded-md shadow-lg"
            >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                w-64 h-screen bg-sidebar text-white flex flex-col fixed left-0 top-0 z-40
                transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
            {/* Logo Section */}
            <div className="flex flex-col items-center py-6 border-b border-white/10">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-2">
                    <img
                        src="/cust-logo.png"
                        alt="CUST Logo"
                        className="w-14 h-14 object-contain"
                    />
                </div>
                <span className="text-xs font-medium">CUST CFMS</span>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 py-4 overflow-y-auto">
                {/* Faculty: render hierarchical My Courses tree */}
                {actualRole === 'faculty' ? (
                    <div>
                        {/* Profile & Dashboard */}
                        <Link
                            to="/faculty/profile"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/faculty/profile') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><User className="w-5 h-5 mr-3" />My Profile</div>
                        </Link>
                        <Link
                            to="/faculty/dashboard"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/faculty/dashboard') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Home className="w-5 h-5 mr-3" />Dashboard</div>
                        </Link>

                        {/* My Courses (parent) */}
                        <button
                            onClick={() => setMyCoursesOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/90 hover:bg-sidebar-hover"
                        >
                            <div className="flex items-center"><BookOpen className="w-5 h-5 mr-3" />My Courses</div>
                            {myCoursesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {myCoursesOpen && (
                            <div className="pl-4">
                                {/* Completed Folder group */}
                                <button
                                    onClick={() => setCompletedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><Check className="w-4 h-4 mr-3" />Completed Folder</div>
                                    {completedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {completedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && (
                                            <div className="px-6 py-2 text-xs text-white/60">Loading…</div>
                                        )}
                                        {!loadingFolders && groups.completed.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No completed folders</div>
                                        )}
                                        {groups.completed.map((f) => (
                                            <div key={f.id}>
                                                <Link
                                                    to={`/faculty/folder/${f.id}/title-page`}
                                                    className="w-full flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <FolderIcon className="w-4 h-4 mr-3" />
                                                    {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                                </Link>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        {/* Read-only minimal view for completed/submitted folders */}
                                                        <Link to={`/faculty/folder/${f.id}/title-page`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-outline`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-log`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/faculty/folder/${f.id}/attendance`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/faculty/folder/${f.id}/lecture-notes`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>

                                                        {/* Assignments (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/faculty/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Assignments
                                                                    </Link>
                                                                    {/* Dynamic Assignment List */}
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/faculty/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Quizzes
                                                                    </Link>
                                                                    {/* Dynamic Quiz List */}
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections */}
                                                        <Link to={`/faculty/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/faculty/folder/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>


                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pending Folder group */}
                                <button
                                    onClick={() => setPendingOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-3" />Pending Folder</div>
                                    {pendingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {pendingOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && (
                                            <div className="px-6 py-2 text-xs text-white/60">Loading…</div>
                                        )}
                                        {!loadingFolders && groups.pending.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No pending folders</div>
                                        )}
                                        {groups.pending.map((f) => (
                                            <div key={f.id}>
                                                <Link
                                                    to={`/faculty/folder/${f.id}/title-page`}
                                                    className="w-full flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <FolderIcon className="w-4 h-4 mr-3" />
                                                    {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                                </Link>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        {/* Primary components */}
                                                        {/* Coordinator Feedback - Show only if rejected */}
                                                        {(f.status === 'REJECTED_COORDINATOR' || f.status === 'REJECTED_BY_CONVENER' || f.status === 'REJECTED_BY_HOD') && (
                                                            <Link
                                                                to={`/faculty/folder/${f.id}/feedback`}
                                                                className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/feedback`) ? 'text-white font-semibold bg-red-600/30' : 'text-red-200 bg-red-600/20'}`}
                                                            >
                                                                <AlertCircle className="w-4 h-4 mr-2 animate-pulse" />
                                                                Feedback
                                                            </Link>
                                                        )}
                                                        <Link to={`/faculty/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/faculty/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/faculty/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>
                                                        {/* Assignments (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/faculty/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Assignments
                                                                    </Link>
                                                                    {/* Dynamic Assignment List */}
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/faculty/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Quizzes
                                                                    </Link>
                                                                    {/* Dynamic Quiz List */}
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections: Project Report, Course Result, CLO Assessment */}
                                                        <Link to={`/faculty/folder/${f.id}/report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/project-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/project-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-result`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/course-result`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/faculty/folder/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/clo-assessment`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/clo-assessment`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>

                                                        {/* Submit Folder - Always Last */}
                                                        <Link to={`/faculty/folder/${f.id}/submit`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/submit`) ? 'text-white font-semibold' : 'text-white/80'}`}><Send className="w-4 h-4 mr-2" />Submit Folder</Link>

                                                        {/* Submit Folder */}


                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Submitted Folder group */}
                                <button
                                    onClick={() => setSubmittedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><FileCheck className="w-4 h-4 mr-3" />Submitted Folder</div>
                                    {submittedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {submittedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && (
                                            <div className="px-6 py-2 text-xs text-white/60">Loading…</div>
                                        )}
                                        {!loadingFolders && groups.submitted.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No submitted folders</div>
                                        )}
                                        {groups.submitted.map((f) => (
                                            <div key={f.id}>
                                                <Link
                                                    to={`/faculty/folder/${f.id}/title-page`}
                                                    className="w-full flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <FolderIcon className="w-4 h-4 mr-3" />
                                                    {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                                </Link>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        {/* Read-only view for submitted folders */}
                                                        <Link to={`/faculty/folder/${f.id}/title-page`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-outline`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-log`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/faculty/folder/${f.id}/attendance`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/faculty/folder/${f.id}/lecture-notes`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>

                                                        {/* Assignments (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/faculty/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Assignments
                                                                    </Link>
                                                                    {/* Dynamic Assignment List */}
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/faculty/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Quizzes
                                                                    </Link>
                                                                    {/* Dynamic Quiz List */}
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/faculty/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/faculty/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/faculty/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections */}
                                                        <Link to={`/faculty/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/faculty/folder/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/faculty/folder/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/faculty/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>

                                                        <div className="px-6 py-1 text-xs text-white/60">Status: {f.status_display || f.status}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Accepted Folders */}
                        <Link
                            to="/faculty/accepted-folder"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/faculty/accepted-folder') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FileCheck className="w-5 h-5 mr-3" />Accepted Folders</div>
                        </Link>

                        {/* Accepted Folders: only show faculty link here (others will be in their role-specific sidebars) */}

                        {/* (Coordinator accepted link is shown only in Coordinator's sidebar) */}

                        {/* Notifications */}
                        <Link
                            to="/faculty/notifications"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/faculty/notifications') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Bell className="w-5 h-5 mr-3" />Notifications</div>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/80 hover:bg-sidebar-hover hover:text-white"
                        >
                            <div className="flex items-center"><LogOut className="w-5 h-5 mr-3" />Log Out</div>
                        </button>
                    </div>
                ) : actualRole === 'coordinator' ? (
                    // Coordinator: Sidebar similar to faculty (My Courses), plus Review Folders list
                    <div>
                        {/* Profile & Dashboard */}
                        <Link
                            to="/coordinator/profile"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/coordinator/profile') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><User className="w-5 h-5 mr-3" />My Profile</div>
                        </Link>
                        <Link
                            to="/coordinator/dashboard"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/coordinator/dashboard') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Home className="w-5 h-5 mr-3" />Dashboard</div>
                        </Link>

                        {/* My Courses (teaching as faculty) */}
                        <button
                            onClick={() => setMyCoursesOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/90 hover:bg-sidebar-hover"
                        >
                            <div className="flex items-center"><BookOpen className="w-5 h-5 mr-3" />My Courses</div>
                            {myCoursesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {myCoursesOpen && (
                            <div className="pl-4">
                                {/* Completed */}
                                <button
                                    onClick={() => setCompletedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><Check className="w-4 h-4 mr-3" />Completed Folder</div>
                                    {completedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {completedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && <div className="px-6 py-2 text-xs text-white/60">Loading…</div>}
                                        {!loadingFolders && groups.completed.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No completed folders</div>
                                        )}
                                        {groups.completed.map((f) => (
                                            <div key={f.id}>
                                                <button
                                                    onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <div className="flex items-center"><FolderIcon className="w-4 h-4 mr-3" />{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</div>
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        <Link to={`/coordinator/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>
                                                        {/* Assignments */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Assignments
                                                                    </Link>
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Quizzes
                                                                    </Link>
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {/* model-solution + records already shown above; avoid duplication */}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {/* model-solution + records already shown above; avoid duplication */}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New sections for Completed folders (coordinator) */}
                                                        <Link to={`/coordinator/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/folder-review-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                        {/* Removed submit link for coordinator completed folders - coordinators should not submit folders here */}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pending */}
                                <button
                                    onClick={() => setPendingOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-3" />Pending Folder</div>
                                    {pendingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {pendingOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && <div className="px-6 py-2 text-xs text-white/60">Loading…</div>}
                                        {!loadingFolders && groups.pending.filter((f) => f.status !== 'APPROVED_BY_HOD').length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No pending folders</div>
                                        )}
                                        {groups.pending
                                            .filter((f) => f.status !== 'APPROVED_BY_HOD') // Hide folders with final feedback from sidebar
                                            .map((f) => (
                                            <div key={f.id}>
                                                <div className="flex items-center w-full">
                                                    <Link
                                                        to={`/coordinator/folder/${f.id}/title-page?review=1`}
                                                        className="flex-1 flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <FolderIcon className="w-4 h-4 mr-3" />
                                                        <span className="flex-1">{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</span>
                                                    </Link>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }));
                                                        }}
                                                        className="px-2 py-2 text-sm text-white/90 hover:text-white"
                                                    >
                                                        {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        {/* Coordinator Feedback - Show only if rejected */}
                                                        {(f.status === 'REJECTED_COORDINATOR' || f.status === 'REJECTED_BY_CONVENER' || f.status === 'REJECTED_BY_HOD') && (
                                                            <Link
                                                                to={`/coordinator/folder/${f.id}/feedback`}
                                                                className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/feedback`) ? 'text-white font-semibold bg-red-600/30' : 'text-red-200 bg-red-600/20'}`}
                                                            >
                                                                <AlertCircle className="w-4 h-4 mr-2 animate-pulse" />
                                                                Feedback
                                                            </Link>
                                                        )}
                                                        <Link to={`/coordinator/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>
                                                        {/* Assignments */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Assignments
                                                                    </Link>
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Quizzes
                                                                    </Link>
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections */}
                                                        <Link to={`/coordinator/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/folder-review-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>

                                                        {/* Submit Folder - Always Last */}
                                                        <Link to={`/coordinator/folder/${f.id}/submit`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/submit`) ? 'text-white font-semibold' : 'text-white/80'}`}><Send className="w-4 h-4 mr-2" />Submit Folder</Link>

                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Submitted */}
                                <button
                                    onClick={() => setSubmittedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><FileCheck className="w-4 h-4 mr-3" />Submitted Folder</div>
                                    {submittedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {submittedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && <div className="px-6 py-2 text-xs text-white/60">Loading…</div>}
                                        {!loadingFolders && groups.submitted.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No submitted folders</div>
                                        )}
                                        {groups.submitted.map((f) => (
                                            <div key={f.id}>
                                                <button
                                                    onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <div className="flex items-center"><FolderIcon className="w-4 h-4 mr-3" />{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</div>
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        <Link to={`/coordinator/folder/${f.id}/title-page`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-outline`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-log`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Log</Link>

                                                        {/* Add full assessment tree for submitted folders: Assignments, Quizzes, Midterm, Final */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Assignments
                                                                    </Link>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Quizzes
                                                                    </Link>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/coordinator/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections */}
                                                        <Link to={`/coordinator/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/folder-review-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/coordinator/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                        <div className="px-6 py-1 text-xs text-white/60">Status: {f.status_display || f.status}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Review Folders (assigned to me as Coordinator) */}
                        <button
                            onClick={() => setCoordinatorReviewOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-3 mt-2 text-sm transition-colors text-white/90 hover:bg-sidebar-hover"
                        >
                            <div className="flex items-center"><FolderKanban className="w-5 h-5 mr-3" />Review Folders</div>
                            {coordinatorReviewOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {coordinatorReviewOpen && (
                            <div className="pl-4">
                                {coordinatorReviewFolders.filter((f: any) => f.status !== 'APPROVED_BY_HOD').length === 0 ? (
                                    <div className="px-6 py-2 text-xs text-white/60">No folders awaiting your review</div>
                                ) : (
                                    coordinatorReviewFolders
                                        .filter((f: any) => f.status !== 'APPROVED_BY_HOD') // Hide folders with final feedback from sidebar
                                        .map((f: any) => (
                                        <div key={f.id}>
                                            <div className="flex items-center w-full">
                                                <Link
                                                    to={`/coordinator/folder/${f.id}/title-page?review=1`}
                                                    className="flex-1 flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <FolderIcon className="w-4 h-4 mr-3" />
                                                    <span className="flex-1">{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</span>
                                                </Link>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }));
                                                    }}
                                                    className="px-2 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                <div className="ml-6 mb-2">
                                                    {/* All pages - full tree */}
                                                    <Link to={`/coordinator/folder/${f.id}/title-page?review=1`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/course-outline?review=1`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/course-log?review=1`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/attendance?review=1`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/lecture-notes?review=1`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/coordinator/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>
                                                    {/* Assignments */}
                                                    <div className="mt-1">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'assignments')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span className="flex items-center">Assignments</span>
                                                            {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'assignments') && (
                                                            <div>
                                                                <Link
                                                                    to={`/coordinator/folder/${f.id}/assignments/task?review=1`}
                                                                    className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                >
                                                                    View Assignments
                                                                </Link>
                                                                {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                    <div key={assignment.id} className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                            className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                        >
                                                                            <span>Assignment {index + 1}</span>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/question-paper?review=1`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Question Paper
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/model-solution?review=1`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Model Solution
                                                                                </Link>
                                                                                <button
                                                                                    onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                    className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                >
                                                                                    <span>Records</span>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                </button>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                    <div>
                                                                                        <Link
                                                                                            to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/best?review=1`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Best Record
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/average?review=1`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Average Record
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`/coordinator/folder/${f.id}/assignments/${assignment.id}/records/worst?review=1`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Worst Record
                                                                                        </Link>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Quizzes */}
                                                    <div className="mt-1">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'quizzes')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span className="flex items-center">Quizzes</span>
                                                            {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'quizzes') && (
                                                            <div>
                                                                <Link
                                                                    to={`/coordinator/folder/${f.id}/quizzes?review=1`}
                                                                    className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/coordinator/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                >
                                                                    View Quizzes
                                                                </Link>
                                                                {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                    <div key={quiz.id} className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                            className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                        >
                                                                            <span>Quiz {index + 1}</span>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/question-paper?review=1`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Question Paper
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/model-solution?review=1`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Model Solution
                                                                                </Link>
                                                                                <button
                                                                                    onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                    className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                >
                                                                                    <span>Records</span>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                </button>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                    <div>
                                                                                        <Link
                                                                                            to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/best?review=1`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Best
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/average?review=1`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Average
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`/coordinator/folder/${f.id}/quizzes/${quiz.id}/records/worst?review=1`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Worst
                                                                                        </Link>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Midterm */}
                                                    <div className="mt-2">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'midterm')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span>Midterm</span>
                                                            {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'midterm') && (
                                                            <div>
                                                                <Link
                                                                    to={`/coordinator/folder/${f.id}/midterm/question-paper?review=1`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Question Paper
                                                                </Link>
                                                                <Link
                                                                    to={`/coordinator/folder/${f.id}/midterm/model-solution?review=1`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Model Solution
                                                                </Link>
                                                                <div className="mt-1">
                                                                    <button
                                                                        onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                        className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                    >
                                                                        <span>Records</span>
                                                                        {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                    </button>
                                                                    {isSectionOpen(f.id, 'midterm-records') && (
                                                                        <div className="ml-2">
                                                                            <Link
                                                                                to={`/coordinator/folder/${f.id}/midterm/records/best?review=1`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Best
                                                                            </Link>
                                                                            <Link
                                                                                to={`/coordinator/folder/${f.id}/midterm/records/average?review=1`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Average
                                                                            </Link>
                                                                            <Link
                                                                                to={`/coordinator/folder/${f.id}/midterm/records/worst?review=1`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Worst
                                                                            </Link>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Final */}
                                                    <div className="mt-2">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'final')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span>Final</span>
                                                            {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'final') && (
                                                            <div>
                                                                <Link
                                                                    to={`/coordinator/folder/${f.id}/final/question-paper?review=1`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Question Paper
                                                                </Link>
                                                                <Link
                                                                    to={`/coordinator/folder/${f.id}/final/model-solution?review=1`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Model Solution
                                                                </Link>
                                                                <div className="mt-1">
                                                                    <button
                                                                        onClick={() => toggleSection(f.id, 'final-records')}
                                                                        className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                    >
                                                                        <span>Records</span>
                                                                        {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                    </button>
                                                                    {isSectionOpen(f.id, 'final-records') && (
                                                                        <div className="ml-2">
                                                                            <Link
                                                                                to={`/coordinator/folder/${f.id}/final/records/best?review=1`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Best
                                                                            </Link>
                                                                            <Link
                                                                                to={`/coordinator/folder/${f.id}/final/records/average?review=1`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Average
                                                                            </Link>
                                                                            <Link
                                                                                to={`/coordinator/folder/${f.id}/final/records/worst?review=1`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`/coordinator/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Worst
                                                                            </Link>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                        )}
                                                    </div>
                                                    {/* Submit Folder removed for review/decision context (coordinator shouldn't submit here) */}
                                                    <Link to={`/coordinator/folder/${f.id}/report?review=1`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/project-report?review=1`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/course-result?review=1`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/folder-review-report?review=1`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                    <Link to={`/coordinator/folder/${f.id}/clo-assessment?review=1`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                    {/* Folder Decision */}
                                                    <Link to={`/coordinator/folder/${f.id}/decision`} className="flex items-center px-6 py-1 mt-1 text-sm text-white/80 hover:text-white bg-indigo-700/30 rounded"><FileText className="w-4 h-4 mr-2" />Folder Decision</Link>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>


                        )}

                        {/* Accepted Folder */}

                        <Link
                            to="/coordinator/accepted-folder"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/coordinator/accepted-folder') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FileCheck className="w-5 h-5 mr-3" />Accepted Folders</div>
                        </Link>

                        {/* Notifications */}
                        <Link
                            to="/coordinator/notifications"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/coordinator/notifications') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Bell className="w-5 h-5 mr-3" />Notifications</div>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/80 hover:bg-sidebar-hover hover:text-white"
                        >
                            <div className="flex items-center"><LogOut className="w-5 h-5 mr-3" />Log Out</div>
                        </button>
                    </div>
                ) : actualRole === 'audit' ? (
                    // Audit Member: Sidebar similar to coordinator with folder tree structure
                    <div>
                        {/* Profile & Dashboard */}
                        <Link
                            to="/audit-member/profile"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/audit-member/profile') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><User className="w-5 h-5 mr-3" />My Profile</div>
                        </Link>
                        <Link
                            to="/audit-member/dashboard"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/audit-member/dashboard') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Home className="w-5 h-5 mr-3" />Dashboard</div>
                        </Link>

                        {/* Assigned Folders (with folder tree) */}
                        <button
                            onClick={() => setMyCoursesOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/90 hover:bg-sidebar-hover"
                        >
                            <div className="flex items-center"><FolderOpen className="w-5 h-5 mr-3" />Folders</div>
                            <div className="flex items-center gap-3">
                                {myCoursesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                        </button>

                        {myCoursesOpen && (
                            <div className="pl-4">
                                {loadingFolders && <div className="px-6 py-2 text-xs text-white/60">Loading…</div>}
                                {!loadingFolders && (groups.pending.length + groups.completed.length) === 0 && (
                                    <div className="px-6 py-2 text-xs text-white/60">No assigned folders</div>
                                )}
                                {groups.pending.map((f: any) => (
                                    <div key={f.id}>
                                        <div className="flex items-center w-full">
                                            <Link
                                                to={`/audit-member/folder/${f.id}/title-page`}
                                                className="flex-1 flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                            >
                                                <FolderIcon className="w-4 h-4 mr-3" />
                                                {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                            </Link>
                                            <button
                                                onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                className="px-2 py-1 text-white/80 hover:text-white"
                                            >
                                                {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {openFolderIds[f.id] && !shouldHideFolderContents && (
                                            <div className="ml-6 mb-2">
                                                <Link to={`/audit-member/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                <Link to={`/audit-member/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                <Link to={`/audit-member/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                <Link to={`/audit-member/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                <Link to={`/audit-member/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>
                                                {/* Assignments */}
                                                <div className="mt-1">
                                                    <button
                                                        onClick={() => toggleSection(f.id, 'assignments')}
                                                        className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <span className="flex items-center">Assignments</span>
                                                        {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                    {isSectionOpen(f.id, 'assignments') && (
                                                        <div>
                                                            <Link
                                                                to={`/audit-member/folder/${f.id}/assignments/task`}
                                                                className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/audit-member/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                            >
                                                                View Assignments
                                                            </Link>
                                                            {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                <div key={assignment.id} className="mt-1">
                                                                    <button
                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                        className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                    >
                                                                        <span>Assignment {index + 1}</span>
                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                    </button>
                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                        <div className="ml-2">
                                                                            <Link
                                                                                to={`/audit-member/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                            >
                                                                                Question Paper
                                                                            </Link>
                                                                            <Link
                                                                                to={`/audit-member/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                            >
                                                                                Model Solution
                                                                            </Link>
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Records</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                <div>
                                                                                    <Link
                                                                                        to={`/audit-member/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                        className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                    >
                                                                                        Best Record
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/audit-member/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                        className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                    >
                                                                                        Average Record
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/audit-member/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                        className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                    >
                                                                                        Worst Record
                                                                                    </Link>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Quizzes */}
                                                <div className="mt-1">
                                                    <button
                                                        onClick={() => toggleSection(f.id, 'quizzes')}
                                                        className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <span className="flex items-center">Quizzes</span>
                                                        {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                    {isSectionOpen(f.id, 'quizzes') && (
                                                        <div>
                                                            <Link
                                                                to={`/audit-member/folder/${f.id}/quizzes`}
                                                                className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/audit-member/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                            >
                                                                View Quizzes
                                                            </Link>
                                                            {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                <div key={quiz.id} className="mt-1">
                                                                    <button
                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                        className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                    >
                                                                        <span>Quiz {index + 1}</span>
                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                    </button>
                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                        <div className="ml-2">
                                                                            <Link
                                                                                to={`/audit-member/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                            >
                                                                                Question Paper
                                                                            </Link>
                                                                            <Link
                                                                                to={`/audit-member/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                            >
                                                                                Model Solution
                                                                            </Link>
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Records</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                <div>
                                                                                    <Link
                                                                                        to={`/audit-member/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                        className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                    >
                                                                                        Best Record
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/audit-member/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                        className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                    >
                                                                                        Average Record
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/audit-member/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                        className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                    >
                                                                                        Worst Record
                                                                                    </Link>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Midterm */}
                                                <div className="mt-2">
                                                    <button
                                                        onClick={() => toggleSection(f.id, 'midterm')}
                                                        className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <span>Midterm</span>
                                                        {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                    {isSectionOpen(f.id, 'midterm') && (
                                                        <div>
                                                            <Link
                                                                to={`/audit-member/folder/${f.id}/midterm/question-paper`}
                                                                className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                            >
                                                                Question Paper
                                                            </Link>
                                                            <Link
                                                                to={`/audit-member/folder/${f.id}/midterm/model-solution`}
                                                                className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                            >
                                                                Model Solution
                                                            </Link>
                                                            <div className="mt-1">
                                                                <button
                                                                    onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                    className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                >
                                                                    <span>Records</span>
                                                                    {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                </button>
                                                                {isSectionOpen(f.id, 'midterm-records') && (
                                                                    <div className="ml-2">
                                                                        <Link
                                                                            to={`/audit-member/folder/${f.id}/midterm/records/best`}
                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                        >
                                                                            Best
                                                                        </Link>
                                                                        <Link
                                                                            to={`/audit-member/folder/${f.id}/midterm/records/average`}
                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                        >
                                                                            Average
                                                                        </Link>
                                                                        <Link
                                                                            to={`/audit-member/folder/${f.id}/midterm/records/worst`}
                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                        >
                                                                            Worst
                                                                        </Link>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Final */}
                                                <div className="mt-2">
                                                    <button
                                                        onClick={() => toggleSection(f.id, 'final')}
                                                        className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <span>Final</span>
                                                        {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                    {isSectionOpen(f.id, 'final') && (
                                                        <div>
                                                            <Link
                                                                to={`/audit-member/folder/${f.id}/final/question-paper`}
                                                                className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                            >
                                                                Question Paper
                                                            </Link>
                                                            <Link
                                                                to={`/audit-member/folder/${f.id}/final/model-solution`}
                                                                className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                            >
                                                                Model Solution
                                                            </Link>
                                                            <div className="mt-1">
                                                                <button
                                                                    onClick={() => toggleSection(f.id, 'final-records')}
                                                                    className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                >
                                                                    <span>Records</span>
                                                                    {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                </button>
                                                                {isSectionOpen(f.id, 'final-records') && (
                                                                    <div className="ml-2">
                                                                        <Link
                                                                            to={`/audit-member/folder/${f.id}/final/records/best`}
                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                        >
                                                                            Best
                                                                        </Link>
                                                                        <Link
                                                                            to={`/audit-member/folder/${f.id}/final/records/average`}
                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                        >
                                                                            Average
                                                                        </Link>
                                                                        <Link
                                                                            to={`/audit-member/folder/${f.id}/final/records/worst`}
                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`/audit-member/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                        >
                                                                            Worst
                                                                        </Link>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* New Sections */}
                                                <Link to={`/audit-member/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                <Link to={`/audit-member/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                <Link to={`/audit-member/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                <Link to={`/audit-member/folder/${f.id}/folder-review-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                <Link to={`/audit-member/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>

                                                {/* Course Feedback (Ratings) - Highlighted */}
                                                <Link to={`/audit-member/folders/${f.id}/review`} className="flex items-center px-6 py-1 mt-1 text-sm text-white/80 hover:text-white bg-indigo-700/30 rounded"><Star className="w-4 h-4 mr-2" />Course Feedback</Link>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {groups.completed.length > 0 && (
                                    <>
                                        <div className="mt-2 px-6 py-1 text-xs text-white/70">Completed</div>
                                        {groups.completed.map((f: any) => (
                                            <div key={`completed-${f.id}`}>
                                                <div className="flex items-center w-full">
                                                    <Link
                                                        to={`/audit-member/folder/${f.id}/title-page`}
                                                        className="flex-1 flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <FolderIcon className="w-4 h-4 mr-3" />
                                                        {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                                    </Link>
                                                    <button
                                                        onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                        className="px-2 py-1 text-white/80 hover:text-white"
                                                    >
                                                        {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        <Link to={`/audit-member/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/audit-member/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/audit-member/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/audit-member/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>

                                                        {/* New Sections */}
                                                        <Link to={`/audit-member/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/audit-member/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/audit-member/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/audit-member/folder/${f.id}/folder-review-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Review Report</Link>
                                                        <Link to={`/audit-member/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Audit Reports */}
                        <Link
                            to="/audit-member/reports"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/audit-member/reports') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FileCheck className="w-5 h-5 mr-3" />Audit Reports</div>
                        </Link>

                        {/* Notifications */}
                        <Link
                            to="/audit-member/notifications"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/audit-member/notifications') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Bell className="w-5 h-5 mr-3" />Notifications</div>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/80 hover:bg-sidebar-hover hover:text-white"
                        >
                            <div className="flex items-center"><LogOut className="w-5 h-5 mr-3" />Log Out</div>
                        </button>
                    </div>
                ) : actualRole === 'convener' ? (
                    // Convener: Teaching folders tree + convener-specific links
                    <div>
                        {/* Profile & Dashboard */}
                        <Link
                            to="/convener/profile"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/convener/profile') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><User className="w-5 h-5 mr-3" />My Profile</div>
                        </Link>
                        <Link
                            to="/convener/dashboard"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/convener/dashboard') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Home className="w-5 h-5 mr-3" />Dashboard</div>
                        </Link>

                        {/* My Courses (teaching as convener) */}
                        <button
                            onClick={() => setMyCoursesOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/90 hover:bg-sidebar-hover"
                        >
                            <div className="flex items-center"><BookOpen className="w-5 h-5 mr-3" />My Courses</div>
                            {myCoursesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {myCoursesOpen && (
                            <div className="pl-4">
                                {/* Completed Folder */}
                                <button
                                    onClick={() => setCompletedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><Check className="w-4 h-4 mr-3" />Completed Folder</div>
                                    {completedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {completedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && <div className="px-6 py-2 text-xs text-white/60">Loading…</div>}
                                        {!loadingFolders && groups.completed.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No completed folders</div>
                                        )}
                                        {groups.completed.map((f) => (
                                            <div key={f.id}>
                                                <button
                                                    onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <div className="flex items-center"><FolderIcon className="w-4 h-4 mr-3" />{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</div>
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        <Link to={`/convener/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/convener/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/convener/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>

                                                        {/* Assignments */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/convener/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Assignments
                                                                    </Link>
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Quizzes */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/convener/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Quizzes
                                                                    </Link>
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Midterm */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Final */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New sections for Completed folders (convener) */}
                                                        <Link to={`/convener/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/convener/folder/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pending Folder */}
                                <button
                                    onClick={() => setPendingOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-3" />Pending Folder</div>
                                    {pendingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {pendingOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && <div className="px-6 py-2 text-xs text-white/60">Loading…</div>}
                                        {!loadingFolders && groups.pending.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No pending folders</div>
                                        )}
                                        {groups.pending.map((f) => (
                                            <div key={f.id}>
                                                <button
                                                    onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <div className="flex items-center"><FolderIcon className="w-4 h-4 mr-3" />{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</div>
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        {(f.status === 'REJECTED_COORDINATOR' || f.status === 'REJECTED_BY_CONVENER' || f.status === 'REJECTED_BY_HOD') && (
                                                            <Link
                                                                to={`/convener/folder/${f.id}/feedback`}
                                                                className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/feedback`) ? 'text-white font-semibold bg-red-600/30' : 'text-red-200 bg-red-600/20'}`}
                                                            >
                                                                <AlertCircle className="w-4 h-4 mr-2 animate-pulse" />
                                                                Feedback
                                                            </Link>
                                                        )}
                                                        <Link to={`/convener/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>

                                                        <Link to={`/convener/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/convener/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/convener/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>

                                                        {/* Assignments */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/convener/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Assignments
                                                                    </Link>
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Quizzes */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/convener/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Quizzes
                                                                    </Link>
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Midterm */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Final */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New sections for Submitted folders (convener) */}
                                                        <Link to={`/convener/folder/${f.id}/report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/project-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/project-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-result`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-result`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/convener/folder/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/clo-assessment`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/clo-assessment`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                        {/* Pending-specific: convener should be able to submit from pending folders */}
                                                        <Link to={`/convener/folder/${f.id}/submit`} className="flex items-center px-6 py-1 mt-2 text-sm text-white/80 hover:text-white"><Send className="w-4 h-4 mr-2" />Submit Folder</Link>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Submitted Folder */}
                                <button
                                    onClick={() => setSubmittedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><FileCheck className="w-4 h-4 mr-3" />Submitted Folder</div>
                                    {submittedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {submittedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && <div className="px-6 py-2 text-xs text-white/60">Loading…</div>}
                                        {!loadingFolders && groups.submitted.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No submitted folders</div>
                                        )}
                                        {groups.submitted.map((f) => (
                                            <div key={f.id}>
                                                <button
                                                    onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <div className="flex items-center"><FolderIcon className="w-4 h-4 mr-3" />{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</div>
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        <Link to={`/convener/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/convener/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/convener/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>

                                                        {/* Assignments */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/convener/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Assignments
                                                                    </Link>
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Quizzes */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/convener/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        View Quizzes
                                                                    </Link>
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/convener/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/convener/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Midterm */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Final */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/convener/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/convener/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`/convener/folder/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New sections for Pending folders (convener) */}
                                                        <Link to={`/convener/folder/${f.id}/report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/project-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/project-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/course-result`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/course-result`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/convener/folder/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/convener/folder/${f.id}/clo-assessment`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/convener/folder/${f.id}/clo-assessment`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                        <div className="px-6 py-1 text-xs text-white/60">Status: {f.status_display || f.status}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Review Folders (as Coordinator) - Convener can also be a course coordinator */}
                        <Link
                            to="/coordinator/review"
                            className={`flex items-center justify-between px-6 py-3 mt-2 text-sm transition-colors ${isActive('/coordinator/review')
                                ? 'bg-coral text-white'
                                : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center">
                                <FolderKanban className="w-5 h-5 mr-3" />
                                Folders to Review (as Coordinator)
                            </div>
                            {coordinatorReviewFolders.length > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                                    {coordinatorReviewFolders.length}
                                </span>
                            )}
                        </Link>

                        {/* Convener-specific links */}
                        <Link
                            to="/convener/audit-members"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/convener/audit-members') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Users className="w-5 h-5 mr-3" />Audit Members</div>
                        </Link>
                        <Link
                            to="/convener/assign-courses"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/convener/assign-courses') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FolderKanban className="w-5 h-5 mr-3" />Assign Folders</div>
                        </Link>
                        <Link
                            to="/convener/review-audits"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/convener/review-audits') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FileCheck className="w-5 h-5 mr-3" />Review Audits</div>
                        </Link>
                        {/* Accepted Folders */}
                        <Link
                            to="/convener/accepted-folder"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/convener/accepted-folder') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FileCheck className="w-5 h-5 mr-3" />Accepted Folders</div>
                        </Link>

                        <Link
                            to="/convener/notifications"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/convener/notifications') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Bell className="w-5 h-5 mr-3" />Notifications</div>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/80 hover:bg-sidebar-hover hover:text-white"
                        >
                            <div className="flex items-center"><LogOut className="w-5 h-5 mr-3" />Log Out</div>
                        </button>
                    </div>
                ) : actualRole === 'hod' ? (
                    // HOD: Department-level view (My Courses + Review + Approvals)
                    <div>
                        {/* Profile & Dashboard */}
                        <Link
                            to="/hod/profile"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/hod/profile') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><User className="w-5 h-5 mr-3" />My Profile</div>
                        </Link>
                        <Link
                            to="/hod/dashboard"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/hod/dashboard') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Home className="w-5 h-5 mr-3" />Dashboard</div>
                        </Link>

                        {/* My Courses (department) */}
                        <button
                            onClick={() => setMyCoursesOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/90 hover:bg-sidebar-hover"
                        >
                            <div className="flex items-center"><BookOpen className="w-5 h-5 mr-3" />My Courses</div>
                            {myCoursesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {myCoursesOpen && (
                            <div className="pl-4">
                                {/* Completed Folder group */}
                                <button
                                    onClick={() => setCompletedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><Check className="w-4 h-4 mr-3" />Completed Folder</div>
                                    {completedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {completedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && (
                                            <div className="px-6 py-2 text-xs text-white/60">Loading…</div>
                                        )}
                                        {!loadingFolders && groups.completed.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No completed folders</div>
                                        )}
                                        {groups.completed.map((f) => (
                                            <div key={f.id}>
                                                <div className="flex items-center w-full">
                                                    <Link
                                                        to={`/hod/folder/${f.id}/title-page`}
                                                        className="flex-1 flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <FolderIcon className="w-4 h-4 mr-3" />
                                                        {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                                    </Link>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }));
                                                        }}
                                                        className="px-2 py-1 text-white/80 hover:text-white"
                                                    >
                                                        {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        {/* Read-only minimal view for completed/submitted folders */}
                                                        <Link to={`/hod/folder/${f.id}/title-page`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-outline`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-log`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/hod/folder/${f.id}/attendance`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/hod/folder/${f.id}/lecture-notes`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>

                                                        {/* Assignments (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/hod/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Assignments
                                                                    </Link>
                                                                    {/* Dynamic Assignment List */}
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/hod/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Quizzes
                                                                    </Link>
                                                                    {/* Dynamic Quiz List */}
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections */}
                                                        <Link to={`/hod/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/hod/folder/${f.id}/folder-review-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>


                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pending Folder group */}
                                <button
                                    onClick={() => setPendingOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-3" />Pending Folder</div>
                                    {pendingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {pendingOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && (
                                            <div className="px-6 py-2 text-xs text-white/60">Loading…</div>
                                        )}
                                        {!loadingFolders && groups.pending.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No pending folders</div>
                                        )}
                                        {groups.pending.map((f) => (
                                            <div key={f.id}>
                                                <div className="flex items-center w-full">
                                                    <Link
                                                        to={`/hod/folder/${f.id}/title-page`}
                                                        className="flex-1 flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                    >
                                                        <FolderIcon className="w-4 h-4 mr-3" />
                                                        {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                                    </Link>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }));
                                                        }}
                                                        className="px-2 py-1 text-white/80 hover:text-white"
                                                    >
                                                        {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">

                                                        {/* Primary components */}

                                                        {/* Coordinator Feedback - Show only if rejected */}
                                                        {(f.status === 'REJECTED_COORDINATOR' || f.status === 'REJECTED_BY_CONVENER' || f.status === 'REJECTED_BY_HOD') && (
                                                            <Link
                                                                to={`/hod/folder/${f.id}/feedback`}
                                                                className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/feedback`) ? 'text-white font-semibold bg-red-600/30' : 'text-red-200 bg-red-600/20'}`}
                                                            >
                                                                <AlertCircle className="w-4 h-4 mr-2 animate-pulse" />
                                                                Feedback
                                                            </Link>
                                                        )}

                                                        <Link to={`/hod/folder/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>

                                                        <Link to={`/hod/folder/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/hod/folder/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/hod/folder/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>
                                                        {/* Assignments (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/hod/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Assignments
                                                                    </Link>
                                                                    {/* Dynamic Assignment List */}
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/faculty/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Quizzes
                                                                    </Link>
                                                                    {/* Dynamic Quiz List */}
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections: Project Report, Course Result, CLO Assessment */}
                                                        <Link to={`/hod/folder/${f.id}/report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/project-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/project-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-result`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/course-result`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/hod/folder/${f.id}/folder-review-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/clo-assessment`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/clo-assessment`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>

                                                        {/* Submit Folder - Always Last */}
                                                        <Link to={`/hod/folder/${f.id}/submit`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/submit`) ? 'text-white font-semibold' : 'text-white/80'}`}><Send className="w-4 h-4 mr-2" />Submit Folder</Link>

                                                        {/* Submit Folder */}


                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Submitted Folder group */}
                                <button
                                    onClick={() => setCompletedOpen((v) => !v)}
                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/80 hover:text-white"
                                >
                                    <div className="flex items-center"><Check className="w-4 h-4 mr-3" />Completed Folder</div>
                                    {completedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {completedOpen && (
                                    <div className="ml-6">
                                        {loadingFolders && (
                                            <div className="px-6 py-2 text-xs text-white/60">Loading…</div>
                                        )}
                                        {!loadingFolders && groups.completed.length === 0 && (
                                            <div className="px-6 py-2 text-xs text-white/60">No completed folders</div>
                                        )}
                                        {groups.completed.map((f) => (
                                            <div key={f.id}>
                                                <button
                                                    onClick={() => setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }))}
                                                    className="w-full flex items-center justify-between px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <div className="flex items-center"><FolderIcon className="w-4 h-4 mr-3" />{f.course_details?.title || f.course?.title || f.course_title || 'Folder'}</div>
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                                {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                    <div className="ml-6 mb-2">
                                                        {/* Read-only minimal view for completed/submitted folders */}
                                                        <Link to={`/hod/folder/${f.id}/title-page`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-outline`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-log`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                        <Link to={`/hod/folder/${f.id}/attendance`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                        <Link to={`/hod/folder/${f.id}/lecture-notes`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>

                                                        {/* Assignments (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'assignments')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Assignments</span>
                                                                {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'assignments') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/assignments/task`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/hod/folder/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Assignments
                                                                    </Link>
                                                                    {/* Dynamic Assignment List */}
                                                                    {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                        <div key={assignment.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Assignment {index + 1}</span>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/assignments/${assignment.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/assignments/${assignment.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average Record
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/assignments/${assignment.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst Record
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Quizzes (collapsible) */}
                                                        <div className="mt-1">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'quizzes')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span className="flex items-center">Quizzes</span>
                                                                {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'quizzes') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/quizzes`}
                                                                        className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `/hod/folder/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                    >
                                                                        Manage Quizzes
                                                                    </Link>
                                                                    {/* Dynamic Quiz List */}
                                                                    {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                        <div key={quiz.id} className="mt-1">
                                                                            <button
                                                                                onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                                className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                            >
                                                                                <span>Quiz {index + 1}</span>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                            </button>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                                <div className="ml-2">
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/quizzes/${quiz.id}/question-paper`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Question Paper
                                                                                    </Link>
                                                                                    <Link
                                                                                        to={`/hod/folder/${f.id}/quizzes/${quiz.id}/model-solution`}
                                                                                        className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                    >
                                                                                        Model Solution
                                                                                    </Link>
                                                                                    <button
                                                                                        onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                        className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                    >
                                                                                        <span>Records</span>
                                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                    </button>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                        <div>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/best`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Best
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/average`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Average
                                                                                            </Link>
                                                                                            <Link
                                                                                                to={`/hod/folder/${f.id}/quizzes/${quiz.id}/records/worst`}
                                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                            >
                                                                                                Worst
                                                                                            </Link>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Midterm (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'midterm')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Midterm</span>
                                                                {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'midterm') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/midterm/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/midterm/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'midterm-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/midterm/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Final (collapsible) */}
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => toggleSection(f.id, 'final')}
                                                                className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                            >
                                                                <span>Final</span>
                                                                {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            {isSectionOpen(f.id, 'final') && (
                                                                <div>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/final/question-paper`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Question Paper
                                                                    </Link>
                                                                    <Link
                                                                        to={`/hod/folder/${f.id}/final/model-solution`}
                                                                        className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                    >
                                                                        Model Solution
                                                                    </Link>

                                                                    {/* Records submenu */}
                                                                    <div className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, 'final-records')}
                                                                            className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                        >
                                                                            <span>Records</span>
                                                                            {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, 'final-records') && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/best`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Best
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/average`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Average
                                                                                </Link>
                                                                                <Link
                                                                                    to={`/hod/folder/${f.id}/final/records/worst`}
                                                                                    className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                >
                                                                                    Worst
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Sections */}
                                                        <Link to={`/hod/folder/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`/hod/folder/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`/hod/folder/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`/hod/folder/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                        <div className="px-6 py-1 text-xs text-white/60">Status: {f.status_display || f.status}</div>


                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}



                        {/* Review Folders - HOD only (SUBMITTED_TO_HOD status, after convener review) */}
                        <button
                            onClick={() => setHodReviewOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-3 mt-2 text-sm transition-colors text-white/90 hover:bg-sidebar-hover"
                        >
                            <div className="flex items-center"><FolderKanban className="w-5 h-5 mr-3" />Review Folders</div>
                            {hodReviewOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {hodReviewOpen && (
                            <div className="pl-4">
                                {hodReviewFolders.length === 0 ? (
                                    <div className="px-6 py-2 text-xs text-white/60">No folders awaiting your review</div>
                                ) : (
                                    hodReviewFolders.map((f: any) => {
                                        // HOD review folders are always SUBMITTED_TO_HOD status (after convener review)
                                        // These folders don't need ?review=1 parameter
                                        const basePath = '/hod/folder';
                                        const reviewParam = ''; // HOD folders don't need review parameter
                                        
                                        return (
                                        <div key={f.id}>
                                            <div className="flex items-center w-full">
                                                <Link
                                                    to={`${basePath}/${f.id}/title-page`}
                                                    className="flex-1 flex items-center px-6 py-2 text-sm text-white/90 hover:text-white"
                                                >
                                                    <FolderIcon className="w-4 h-4 mr-3" />
                                                    {f.course_details?.title || f.course?.title || f.course_title || 'Folder'}
                                                </Link>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setOpenFolderIds((m) => ({ ...m, [f.id]: !m[f.id] }));
                                                    }}
                                                    className="px-2 py-1 text-white/80 hover:text-white"
                                                >
                                                    {openFolderIds[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            {openFolderIds[f.id] && !shouldHideFolderContents && (
                                                <div className="ml-6 mb-2">
                                                    <Link to={`${basePath}/${f.id}/title-page`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`${basePath}/${f.id}/title-page`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Title Page</Link>
                                                    <Link to={`${basePath}/${f.id}/course-outline`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`${basePath}/${f.id}/course-outline`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Outline</Link>
                                                    <Link to={`${basePath}/${f.id}/course-log`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`${basePath}/${f.id}/course-log`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Log</Link>
                                                    <Link to={`${basePath}/${f.id}/attendance`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`${basePath}/${f.id}/attendance`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Attendance</Link>
                                                    <Link to={`${basePath}/${f.id}/lecture-notes`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`${basePath}/${f.id}/lecture-notes`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Lecture Notes</Link>
                                                    {/* Assignments */}
                                                    <div className="mt-1">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'assignments')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span className="flex items-center">Assignments</span>
                                                            {isSectionOpen(f.id, 'assignments') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'assignments') && (
                                                            <div>
                                                                <Link
                                                                    to={`${basePath}/${f.id}/assignments/task`}
                                                                    className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `${basePath}/${f.id}/assignments/task` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                >
                                                                    View Assignments
                                                                </Link>
                                                                {folderAssignments[f.id]?.map((assignment: any, index: number) => (
                                                                    <div key={assignment.id} className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, `assignment-${assignment.id}`)}
                                                                            className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                        >
                                                                            <span>Assignment {index + 1}</span>
                                                                            {isSectionOpen(f.id, `assignment-${assignment.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, `assignment-${assignment.id}`) && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`${basePath}/${f.id}/assignments/${assignment.id}/question-paper${reviewParam}`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/question-paper`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Question Paper
                                                                                </Link>
                                                                                <Link
                                                                                    to={`${basePath}/${f.id}/assignments/${assignment.id}/model-solution${reviewParam}`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/model-solution`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Model Solution
                                                                                </Link>
                                                                                <button
                                                                                    onClick={() => toggleSection(f.id, `assignment-${assignment.id}-records`)}
                                                                                    className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                >
                                                                                    <span>Records</span>
                                                                                    {isSectionOpen(f.id, `assignment-${assignment.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                </button>
                                                                                {isSectionOpen(f.id, `assignment-${assignment.id}-records`) && (
                                                                                    <div>
                                                                                        <Link
                                                                                            to={`${basePath}/${f.id}/assignments/${assignment.id}/records/best${reviewParam}`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/best`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Best Record
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`${basePath}/${f.id}/assignments/${assignment.id}/records/average${reviewParam}`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/average`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Average Record
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`${basePath}/${f.id}/assignments/${assignment.id}/records/worst${reviewParam}`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/assignments/${assignment.id}/records/worst`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Worst Record
                                                                                        </Link>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Quizzes */}
                                                    <div className="mt-1">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'quizzes')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span className="flex items-center">Quizzes</span>
                                                            {isSectionOpen(f.id, 'quizzes') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'quizzes') && (
                                                            <div>
                                                                <Link
                                                                    to={`${basePath}/${f.id}/quizzes${reviewParam}`}
                                                                    className={`flex items-center px-8 py-1 text-sm hover:text-white ${location.pathname === `${basePath}/${f.id}/quizzes` ? 'text-white font-semibold' : 'text-white/80'}`}
                                                                >
                                                                    View Quizzes
                                                                </Link>
                                                                {folderQuizzes[f.id]?.map((quiz: any, index: number) => (
                                                                    <div key={quiz.id} className="mt-1">
                                                                        <button
                                                                            onClick={() => toggleSection(f.id, `quiz-${quiz.id}`)}
                                                                            className="w-full text-left px-8 py-1 text-sm text-white/90 hover:text-white flex items-center justify-between"
                                                                        >
                                                                            <span>Quiz {index + 1}</span>
                                                                            {isSectionOpen(f.id, `quiz-${quiz.id}`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        {isSectionOpen(f.id, `quiz-${quiz.id}`) && (
                                                                            <div className="ml-2">
                                                                                <Link
                                                                                    to={`${basePath}/${f.id}/quizzes/${quiz.id}/question-paper${reviewParam}`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/question-paper`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Question Paper
                                                                                </Link>
                                                                                <Link
                                                                                    to={`${basePath}/${f.id}/quizzes/${quiz.id}/model-solution${reviewParam}`}
                                                                                    className={`block px-10 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/model-solution`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/70'}`}
                                                                                >
                                                                                    Model Solution
                                                                                </Link>
                                                                                <button
                                                                                    onClick={() => toggleSection(f.id, `quiz-${quiz.id}-records`)}
                                                                                    className="w-full text-left px-10 py-1 text-xs text-white/70 hover:text-white flex items-center justify-between"
                                                                                >
                                                                                    <span>Records</span>
                                                                                    {isSectionOpen(f.id, `quiz-${quiz.id}-records`) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                                </button>
                                                                                {isSectionOpen(f.id, `quiz-${quiz.id}-records`) && (
                                                                                    <div>
                                                                                        <Link
                                                                                            to={`${basePath}/${f.id}/quizzes/${quiz.id}/records/best${reviewParam}`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/best`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Best
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`${basePath}/${f.id}/quizzes/${quiz.id}/records/average${reviewParam}`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/average`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Average
                                                                                        </Link>
                                                                                        <Link
                                                                                            to={`${basePath}/${f.id}/quizzes/${quiz.id}/records/worst${reviewParam}`}
                                                                                            className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes(`/quizzes/${quiz.id}/records/worst`) && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                                        >
                                                                                            Worst
                                                                                        </Link>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Midterm */}
                                                    <div className="mt-2">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'midterm')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span>Midterm</span>
                                                            {isSectionOpen(f.id, 'midterm') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'midterm') && (
                                                            <div>
                                                                <Link
                                                                    to={`${basePath}/${f.id}/midterm/question-paper${reviewParam}`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/question-paper') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Question Paper
                                                                </Link>
                                                                <Link
                                                                    to={`${basePath}/${f.id}/midterm/model-solution${reviewParam}`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/model-solution') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Model Solution
                                                                </Link>
                                                                <div className="mt-1">
                                                                    <button
                                                                        onClick={() => toggleSection(f.id, 'midterm-records')}
                                                                        className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                    >
                                                                        <span>Records</span>
                                                                        {isSectionOpen(f.id, 'midterm-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                    </button>
                                                                    {isSectionOpen(f.id, 'midterm-records') && (
                                                                        <div className="ml-2">
                                                                            <Link
                                                                                to={`${basePath}/${f.id}/midterm/records/best${reviewParam}`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/best') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Best
                                                                            </Link>
                                                                            <Link
                                                                                to={`${basePath}/${f.id}/midterm/records/average${reviewParam}`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/average') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Average
                                                                            </Link>
                                                                            <Link
                                                                                to={`${basePath}/${f.id}/midterm/records/worst${reviewParam}`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/midterm/records/worst') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Worst
                                                                            </Link>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Final */}
                                                    <div className="mt-2">
                                                        <button
                                                            onClick={() => toggleSection(f.id, 'final')}
                                                            className="w-full flex items-center justify-between px-6 py-1 text-sm text-white/90 hover:text-white"
                                                        >
                                                            <span>Final</span>
                                                            {isSectionOpen(f.id, 'final') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                        {isSectionOpen(f.id, 'final') && (
                                                            <div>
                                                                <Link
                                                                    to={`${basePath}/${f.id}/final/question-paper${reviewParam}`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/question-paper') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Question Paper
                                                                </Link>
                                                                <Link
                                                                    to={`${basePath}/${f.id}/final/model-solution${reviewParam}`}
                                                                    className={`block px-8 py-1 text-xs hover:text-white ${location.pathname.includes('/final/model-solution') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                >
                                                                    Model Solution
                                                                </Link>
                                                                <div className="mt-1">
                                                                    <button
                                                                        onClick={() => toggleSection(f.id, 'final-records')}
                                                                        className="w-full flex items-center justify-between px-8 py-1 text-xs text-white/80 hover:text-white"
                                                                    >
                                                                        <span>Records</span>
                                                                        {isSectionOpen(f.id, 'final-records') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                    </button>
                                                                    {isSectionOpen(f.id, 'final-records') && (
                                                                        <div className="ml-2">
                                                                            <Link
                                                                                to={`${basePath}/${f.id}/final/records/best${reviewParam}`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/best') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Best
                                                                            </Link>
                                                                            <Link
                                                                                to={`${basePath}/${f.id}/final/records/average${reviewParam}`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/average') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Average
                                                                            </Link>
                                                                            <Link
                                                                                to={`${basePath}/${f.id}/final/records/worst${reviewParam}`}
                                                                                className={`block px-12 py-1 text-xs hover:text-white ${location.pathname.includes('/final/records/worst') && location.pathname.includes(`${basePath}/${f.id}`) ? 'text-white font-semibold' : 'text-white/60'}`}
                                                                            >
                                                                                Worst
                                                                            </Link>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* HOD review folders - show all sections including decision link */}
                                                    <>
                                                        <Link to={`${basePath}/${f.id}/report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Folder Report</Link>
                                                        <Link to={`${basePath}/${f.id}/project-report`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Project Report</Link>
                                                        <Link to={`${basePath}/${f.id}/course-result`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />Course Result</Link>
                                                        <Link to={`${basePath}/${f.id}/folder-review-report`} className={`flex items-center px-6 py-1 text-sm hover:text-white ${location.pathname.includes(`${basePath}/${f.id}/folder-review-report`) ? 'text-white font-semibold' : 'text-white/80'}`}><FileText className="w-4 h-4 mr-2" />Course Review Report</Link>
                                                        <Link to={`${basePath}/${f.id}/clo-assessment`} className="flex items-center px-6 py-1 text-sm text-white/80 hover:text-white"><FileText className="w-4 h-4 mr-2" />CLO Assessment</Link>
                                                        <Link to={`${basePath}/${f.id}/decision`} className="flex items-center px-6 py-1 mt-2 text-sm text-white/80 hover:text-white bg-indigo-700/30 rounded"><FileText className="w-4 h-4 mr-2" />Folder Decision</Link>
                                                    </>
                                                </div>
                                            )}
                                        </div>
                                    );
                                    })
                                )}
                            </div>
                        )}

                        {/* Reviewed Folders - HOD only (folders where decision has been made) */}
                        <Link
                            to="/hod/reviewed-folders"
                            className={`flex items-center justify-between px-6 py-3 mt-2 text-sm transition-colors ${isActive('/hod/reviewed-folders') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FileCheck className="w-5 h-5 mr-3" />Reviewed Folders</div>
                        </Link>

                        {/* Role Requests (HOD) */}
                        <Link
                            to="/hod/role-requests"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/hod/role-requests') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Users className="w-5 h-5 mr-3" />Role Requests</div>
                        </Link>


                        {/* Accepted Folder */}

                        <Link
                            to="/hod/accepted-folder"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/hod/accepted-folder') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><FileCheck className="w-5 h-5 mr-3" />Accepted Folders</div>
                        </Link>

                        {/* Notifications */}
                        <Link
                            to="/hod/notifications"
                            className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive('/hod/notifications') ? 'bg-coral text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                }`}
                        >
                            <div className="flex items-center"><Bell className="w-5 h-5 mr-3" />Notifications</div>
                        </Link>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/80 hover:bg-sidebar-hover hover:text-white"
                        >
                            <div className="flex items-center"><LogOut className="w-5 h-5 mr-3" />Log Out</div>
                        </button>
                    </div>
                ) : (
                    /* Default sidebar for other roles (existing static menu) */
                    <>
                        {menuItems.map((item, index) => {
                            const Icon = item.icon;
                            const showSubmenu = 'hasSubmenu' in item && item.hasSubmenu;
                            const isLogout = item.path === '/logout';

                            if (isLogout) {
                                return (
                                    <button
                                        key={index}
                                        onClick={handleLogout}
                                        className="w-full flex items-center justify-between px-6 py-3 text-sm transition-colors text-white/80 hover:bg-sidebar-hover hover:text-white"
                                    >
                                        <div className="flex items-center">
                                            <Icon className="w-5 h-5 mr-3" />
                                            <span>{item.label}</span>
                                        </div>
                                    </button>
                                );
                            }

                            return (
                                <Link
                                    key={index}
                                    to={item.path}
                                    className={`flex items-center justify-between px-6 py-3 text-sm transition-colors ${isActive(item.path)
                                        ? 'bg-coral text-white'
                                        : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center">
                                        <Icon className="w-5 h-5 mr-3" />
                                        <span className={showSubmenu ? 'underline' : ''}>{item.label}</span>
                                    </div>
                                    {showSubmenu && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </Link>
                            );
                        })}
                    </>
                )}
            </nav>
        </div>
        </>
    );
};



