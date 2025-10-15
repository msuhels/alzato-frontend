// import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { studentsService } from '../services/students';
import { ChevronRight, ChevronLeft } from 'lucide-react';
// import { findStudentById } from '../lib/mockData';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const i = pathnames.findIndex(p => p === 'students');
      const studentId = i >= 0 ? pathnames[i + 1] : undefined;
      if (studentId && studentId !== 'new') {
        try {
          const { student } = await studentsService.get(studentId);
          setStudentName(student?.name || '');
        } catch {
          setStudentName('');
        }
      } else {
        setStudentName('');
      }
    };
    load();
  }, [location.pathname]);

  const getBreadcrumbName = (name: string, index: number) => {
    // Keep 'Students' label for the students list page
    if (name === 'students') {
      return 'Students';
    }
    // If this segment is the student id after '/students', show student name
    if (pathnames[index - 1] === 'students' && name !== 'new' && name !== 'payments') {
      return studentName || name;
    }
    if (name === 'new' && pathnames[index-1] === 'students') {
        return 'Add Student';
    }
    if (name === 'new' && pathnames[index-1] === 'payments') {
        return 'Add Payment';
    }
    if (name === 'payments' && pathnames[index + 1] && pathnames[index + 1] !== 'new') {
      return 'Payments';
    }
    if (pathnames[index - 1] === 'payments' && pathnames[index] !== 'new') {
      return 'Payment';
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <nav className="flex items-center" aria-label="Breadcrumb">
      {pathnames.length > 0 && (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="mr-2 md:mr-3 text-gray-custom-700 hover:text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {pathnames.length > 0 && (
          <li className="inline-flex items-center">
            <Link to="/" className="text-sm font-medium text-gray-custom-700 hover:text-primary">
              Home
            </Link>
          </li>
        )}
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          
          // Don't show 'payments' segment in breadcrumb for add payment under a student
          if (value === 'payments' && last && pathnames[index-2] === 'students') {
            return null;
          }

          return (
            <li key={to}>
              <div className="flex items-center">
                <ChevronRight className="h-5 w-5 text-gray-custom-400" />
                {last ? (
                  <span className="ml-1 text-sm font-medium text-gray-custom-500 md:ml-2">
                    {getBreadcrumbName(value, index)}
                  </span>
                ) : (
                  <Link
                    to={to}
                    className="ml-1 text-sm font-medium text-gray-custom-700 hover:text-primary md:ml-2"
                  >
                    {getBreadcrumbName(value, index)}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
