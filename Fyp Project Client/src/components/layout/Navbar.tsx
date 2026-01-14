import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coursesAPI, facultyAPI, programsAPI, departmentsAPI, usersAPI, courseFoldersAPI, notificationsAPI } from '../../services/api';

interface NavbarProps {
  userName?: string;
  userAvatar?: string;
}

interface SearchResult {
  type: 'course' | 'faculty' | 'program' | 'department' | 'page' | 'user';
  id: number | string;
  title: string;
  subtitle?: string;
  route: string;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  userName, 
  userAvatar 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  const displayName = userName || user?.full_name || 'User';
  const displayAvatar = userAvatar ?? (user?.profile_picture || undefined);

  // Fetch unread notification count
  useEffect(() => {
    fetchUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getAll();
      const notifications = Array.isArray(response.data) ? response.data : response.data.results || [];
      const unread = notifications.filter((n: any) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery.trim());
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    try {
      // Get user role
      const userRole = user?.role || 'ADMIN';
      
      // Define role-specific searchable pages/routes
      const getRoleBasedPages = (role: string) => {
        const commonPages = [
          { title: 'My Profile', route: `/${role.toLowerCase().replace('_', '-')}/profile`, keywords: ['profile', 'my profile', 'account', 'settings'], roles: ['ADMIN', 'FACULTY', 'COORDINATOR', 'CONVENER', 'HOD', 'AUDIT_TEAM', 'AUDIT_MEMBER'] },
          { title: 'Dashboard', route: `/${role.toLowerCase().replace('_', '-')}/dashboard`, keywords: ['dashboard', 'home', 'main'], roles: ['FACULTY', 'COORDINATOR', 'CONVENER', 'HOD', 'AUDIT_TEAM', 'AUDIT_MEMBER'] },
          { title: 'Dashboard', route: '/admin-dashboard', keywords: ['dashboard', 'home', 'main'], roles: ['ADMIN'] },
        ];

        const adminPages = [
          { title: 'Departments', route: '/department/view', keywords: ['departments', 'department'], roles: ['ADMIN'] },
          { title: 'Create Department', route: '/department', keywords: ['create department', 'add department', 'new department'], roles: ['ADMIN'] },
          { title: 'Programs', route: '/program/view', keywords: ['programs', 'program'], roles: ['ADMIN'] },
          { title: 'Create Program', route: '/program', keywords: ['create program', 'add program', 'new program'], roles: ['ADMIN'] },
          { title: 'Courses', route: 'courses/view', keywords: ['courses', 'course'], roles: ['ADMIN'] },
          { title: 'Faculty', route: 'faculty-management/manage', keywords: ['faculty', 'teachers', 'staff'], roles: ['ADMIN'] },
          { title: 'Add Faculty', route: '/faculty-management', keywords: ['add faculty', 'create faculty', 'new faculty'], roles: ['ADMIN'] },
          { title: 'Terms', route: '/terms/view', keywords: ['terms', 'session', 'semester'], roles: ['ADMIN'] },
          { title: 'Create Term', route: '/terms/create', keywords: ['create term', 'add term', 'new term'], roles: ['ADMIN'] },
          { title: 'Course Allocations', route: '/course-allocation', keywords: ['allocations', 'assign courses'], roles: ['ADMIN'] },
        ];

        const facultyPages = [
          { title: 'My Courses', route: `/${role.toLowerCase().replace('_', '-')}/folders`, keywords: ['my courses', 'courses', 'folders'], roles: ['FACULTY', 'COORDINATOR', 'CONVENER', 'HOD'] },
          { title: 'Pending Folders', route: `/${role.toLowerCase().replace('_', '-')}/pending-folder`, keywords: ['pending', 'pending folders'], roles: ['FACULTY', 'COORDINATOR', 'CONVENER', 'HOD'] },
          { title: 'Completed Folders', route: `/${role.toLowerCase().replace('_', '-')}/completed-folder`, keywords: ['completed', 'completed folders'], roles: ['FACULTY', 'COORDINATOR', 'CONVENER', 'HOD'] },
          { title: 'Submitted Folders', route: `/${role.toLowerCase().replace('_', '-')}/submitted-folder`, keywords: ['submitted', 'submitted folders'], roles: ['FACULTY', 'COORDINATOR', 'CONVENER', 'HOD'] },
        ];

        const coordinatorPages = [
          { title: 'Review Folders', route: '/coordinator/review-folders', keywords: ['review', 'review folders'], roles: ['COORDINATOR'] },
        ];

        const convenerPages = [
          { title: 'Audit Members', route: '/convener/audit-members', keywords: ['audit members', 'auditors'], roles: ['CONVENER'] },
          { title: 'Assign Courses', route: '/convener/assign-courses', keywords: ['assign courses'], roles: ['CONVENER'] },
          { title: 'Review Audits', route: '/convener/review-audits', keywords: ['review audits', 'audit review'], roles: ['CONVENER'] },
        ];

        const auditPages = [
          { title: 'Assigned Folders', route: '/audit-member/folders', keywords: ['assigned folders', 'folders'], roles: ['AUDIT_MEMBER'] },
          { title: 'Audit Reports', route: '/audit-member/reports', keywords: ['audit reports', 'reports'], roles: ['AUDIT_MEMBER'] },
        ];

        const allPages = [...commonPages, ...adminPages, ...facultyPages, ...coordinatorPages, ...convenerPages, ...auditPages];
        return allPages.filter(page => page.roles.includes(role));
      };

      const pages = getRoleBasedPages(userRole);

      // Search Pages/Routes
      pages.forEach((page) => {
        const matchesTitle = page.title.toLowerCase().includes(lowerQuery);
        const matchesKeywords = page.keywords.some(keyword => keyword.includes(lowerQuery));
        if (matchesTitle || matchesKeywords) {
          results.push({
            type: 'page',
            id: page.route,
            title: page.title,
            subtitle: 'Page',
            route: page.route,
          });
        }
      });

      // Search Courses/Folders based on role
      try {
        if (userRole === 'ADMIN') {
          // Admin searches all courses
          const coursesResponse = await coursesAPI.getAll();
          const courses = Array.isArray(coursesResponse.data) ? coursesResponse.data : coursesResponse.data.results || [];
          courses.forEach((course: any) => {
            if (
              course.code?.toLowerCase().includes(lowerQuery) ||
              course.title?.toLowerCase().includes(lowerQuery)
            ) {
              results.push({
                type: 'course',
                id: course.id,
                title: `${course.code} - ${course.title}`,
                subtitle: course.department_details?.name || 'Course',
                route: `/courses/view`,
              });
            }
          });
        } else if (['FACULTY', 'COORDINATOR', 'HOD'].includes(userRole)) {
          // Teaching roles search their own course folders
          const foldersResponse = await courseFoldersAPI.getMyFolders();
          const folders = Array.isArray(foldersResponse.data) ? foldersResponse.data : foldersResponse.data.results || [];
          folders.forEach((folder: any) => {
            const courseCode = folder.course_details?.code || '';
            const courseTitle = folder.course_details?.title || '';
            const courseName = `${courseCode} - ${courseTitle}`;
            
            if (
              courseCode.toLowerCase().includes(lowerQuery) ||
              courseTitle.toLowerCase().includes(lowerQuery)
            ) {
              const rolePrefix = userRole.toLowerCase().replace('_', '-');
              
              results.push({
                type: 'course',
                id: folder.id,
                title: courseName,
                subtitle: `${folder.term_details?.name || 'Term'} - ${folder.status || 'N/A'}`,
                route: `/${rolePrefix}/folder/${folder.id}/title-page`,
              });
            }
          });
        } else if (userRole === 'CONVENER') {
          // Convener searches their own course folders (uses :id instead of :folderId)
          const foldersResponse = await courseFoldersAPI.getMyFolders();
          const folders = Array.isArray(foldersResponse.data) ? foldersResponse.data : foldersResponse.data.results || [];
          folders.forEach((folder: any) => {
            const courseCode = folder.course_details?.code || '';
            const courseTitle = folder.course_details?.title || '';
            const courseName = `${courseCode} - ${courseTitle}`;
            
            if (
              courseCode.toLowerCase().includes(lowerQuery) ||
              courseTitle.toLowerCase().includes(lowerQuery)
            ) {
              results.push({
                type: 'course',
                id: folder.id,
                title: courseName,
                subtitle: `${folder.term_details?.name || 'Term'} - ${folder.status || 'N/A'}`,
                route: `/convener/folder/${folder.id}/title-page`,
              });
            }
          });
        } else if (userRole === 'AUDIT_MEMBER') {
          // Audit members search their assigned folders
          const foldersResponse = await courseFoldersAPI.getAll({ assigned_to_me: true });
          const folders = Array.isArray(foldersResponse.data) ? foldersResponse.data : foldersResponse.data.results || [];
          folders.forEach((folder: any) => {
            const courseCode = folder.course_details?.code || '';
            const courseTitle = folder.course_details?.title || '';
            const courseName = `${courseCode} - ${courseTitle}`;
            
            if (
              courseCode.toLowerCase().includes(lowerQuery) ||
              courseTitle.toLowerCase().includes(lowerQuery)
            ) {
              results.push({
                type: 'course',
                id: folder.id,
                title: courseName,
                subtitle: `${folder.term_details?.name || 'Term'} - Assigned for Audit`,
                route: `/audit-member/folder/${folder.id}/title-page`,
              });
            }
          });
        }
      } catch (courseError) {
        console.error('Error searching courses:', courseError);
      }

      // Search Faculty (Admin only)
      if (userRole === 'ADMIN') {
        const facultyResponse = await facultyAPI.getAll();
        const faculty = Array.isArray(facultyResponse.data) ? facultyResponse.data : facultyResponse.data.results || [];
        faculty.forEach((f: any) => {
          const fullName = f.user_details?.full_name || '';
          const email = f.user_details?.email || '';
          if (
            fullName.toLowerCase().includes(lowerQuery) ||
            email.toLowerCase().includes(lowerQuery) ||
            f.designation?.toLowerCase().includes(lowerQuery)
          ) {
            results.push({
              type: 'faculty',
              id: f.id,
              title: fullName,
              subtitle: `${f.designation} - ${email}`,
              route: `/faculty-management/manage`,
            });
          }
        });
      }

      // Search Programs (Admin only)
      if (userRole === 'ADMIN') {
        const programsResponse = await programsAPI.getAll();
        const programs = Array.isArray(programsResponse.data) ? programsResponse.data : programsResponse.data.results || [];
        programs.forEach((program: any) => {
          if (
            program.title?.toLowerCase().includes(lowerQuery) ||
            program.short_code?.toLowerCase().includes(lowerQuery)
          ) {
            results.push({
              type: 'program',
              id: program.id,
              title: `${program.title} (${program.short_code})`,
              subtitle: 'Program',
              route: `/admin/program/view`,
            });
          }
        });
      }

      // Search Departments (Admin only)
      if (userRole === 'ADMIN') {
        const deptResponse = await departmentsAPI.getAll();
        const departments = Array.isArray(deptResponse.data) ? deptResponse.data : deptResponse.data.results || [];
        departments.forEach((dept: any) => {
          if (
            dept.name?.toLowerCase().includes(lowerQuery) ||
            dept.short_code?.toLowerCase().includes(lowerQuery)
          ) {
            results.push({
              type: 'department',
              id: dept.id,
              title: `${dept.name} (${dept.short_code})`,
              subtitle: 'Department',
              route: `/department/view`,
            });
          }
        });
      }

      // Search Users/Members (filtered by role)
      try {
        const usersResponse = await usersAPI.getAll();
        const users = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data.results || [];
        users.forEach((userItem: any) => {
          const fullName = userItem.full_name || '';
          const email = userItem.email || '';
          const cnic = userItem.cnic || '';
          const role = userItem.role || '';
          
          // Filter users based on logged-in user's role - FIRST check if user should be visible
          let shouldShow = false;
          if (userRole === 'ADMIN') {
            shouldShow = true; // Admin sees all users
          } else if (userRole === 'CONVENER') {
            // Convener sees audit members and teaching faculty
            shouldShow = ['CONVENER'].includes(role);
          } else if (userRole === 'COORDINATOR') {
            // Coordinator sees only faculty and coordinators (NOT audit members)
            shouldShow = ['FACULTY', 'COORDINATOR'].includes(role);
          } else if (userRole === 'HOD') {
            // HOD sees all department members (NOT audit members)
            shouldShow = ['FACULTY', 'COORDINATOR', 'CONVENER', 'HOD'].includes(role);
          } else if (userRole === 'AUDIT_MEMBER') {
            // Audit members see other audit members
            shouldShow = ['AUDIT_MEMBER', 'AUDIT_TEAM'].includes(role);
          } else {
            // Faculty sees only other faculty (NOT audit members)
            shouldShow = role === 'FACULTY';
          }
          
          // Only proceed if user should be visible to this role
          if (!shouldShow) {
            return; // Skip this user entirely
          }
          
          // Now check if search query matches
          if (
            fullName.toLowerCase().includes(lowerQuery) ||
            email.toLowerCase().includes(lowerQuery) ||
            cnic.includes(lowerQuery)
          ) {
            // Determine route based on logged-in user's role
            const userRoute = userRole === 'ADMIN' 
              ? '/faculty-management/manage' 
              : `/${userRole.toLowerCase().replace('_', '-')}/profile`;
            
            results.push({
              type: 'user',
              id: userItem.id,
              title: fullName,
              subtitle: `${role} - ${email}`,
              route: userRoute,
            });
          }
        });
      } catch (userError) {
        console.error('Error searching users:', userError);
      }

      setSearchResults(results.slice(0, 15)); // Limit to 15 results
      setShowResults(results.length > 0);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (route: string) => {
    navigate(route);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleProfileClick = () => {
    // Navigate to role-specific profile page
    const roleRouteMap: Record<string, string> = {
      'ADMIN': '/admin/profile',
      'FACULTY': '/faculty/profile',
      'COORDINATOR': '/coordinator/profile',
      'CONVENER': '/convener/profile',
      'HOD': '/hod/profile',
      'AUDIT_TEAM': '/audit-team/profile',
      'AUDIT_MEMBER': '/audit-member/profile',
      'SUPERVISOR': '/faculty/profile',
      'EVALUATOR': '/faculty/profile',
      'STUDENT': '/student/profile'
    };
    
    const profileRoute = user?.role ? roleRouteMap[user.role] || '/admin/profile' : '/admin/profile';
    navigate(profileRoute);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'course':
        return '📚';
      case 'faculty':
        return '👤';
      case 'program':
        return '🎓';
      case 'department':
        return '🏢';
      case 'page':
        return '📄';
      case 'user':
        return '👥';
      default:
        return '�';
    }
  };

  return (
    <div className="h-20 lg:h-24 border-b border-gray-200 flex items-center justify-between px-3 sm:px-4 md:px-6 fixed top-0 left-0 lg:left-64 right-0 z-30" style={{ backgroundColor: '#F4F7FE' }}>
      {/* Greeting */}
      <div className="hidden sm:block">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800">Hi, {displayName}!</h2>
      </div>

      {/* Spacer to push search bar to right side with proper distance */}
      <div className="flex-1 hidden sm:block"></div>

      {/* Right Side - All elements in ONE white container, positioned about half width from end */}
      <div className="flex items-center gap-2 sm:gap-3 bg-white px-2 sm:px-3 py-2 rounded-full shadow-sm mr-0 sm:mr-4 lg:mr-8">
        {/* Search Bar with #F4F7FE Background for differentiation */}
        <div 
          ref={searchRef}
          className="relative flex items-center px-2 sm:px-3 py-2 rounded-full"
          style={{ backgroundColor: '#F4F7FE' }}
        >
          <Search className={`w-4 h-4 mr-1 sm:mr-2 ${isSearching ? 'text-primary animate-pulse' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim().length >= 2 && searchResults.length > 0 && setShowResults(true)}
            className="bg-transparent border-none text-xs sm:text-sm focus:outline-none w-24 sm:w-40 md:w-64 placeholder-gray-400 text-gray-700"
          />
          
          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
              <div className="py-2">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}-${index}`}
                    onClick={() => handleResultClick(result.route)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-3"
                  >
                    <span className="text-xl">{getResultIcon(result.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </div>
                      {result.subtitle && (
                        <div className="text-xs text-gray-500 truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {showResults && searchResults.length === 0 && !isSearching && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No results found for "{searchQuery}"
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button 
          onClick={() => {
            const rolePrefix = user?.role?.toLowerCase().replace('_', '-') || 'faculty';
            navigate(`/${rolePrefix}/notifications`);
          }}
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors relative"
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-[10px] sm:text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Avatar - Clickable to navigate to profile */}
        <div 
          onClick={handleProfileClick}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-300 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
        >
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-semibold bg-primary">
              {displayName.charAt(0)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
