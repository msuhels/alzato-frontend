import  { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { studentsService, StudentListItem } from '../services/students';

const Avatar = ({ name }: { name: string }) => {
  const avatarColors = [
    'bg-orange-400', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-red-500'
  ];
  const code = name.charCodeAt(name.length - 1);
  const color = avatarColors[code % avatarColors.length];
  const avatarFallback = name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
  
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold ${color}`}>
      {avatarFallback}
    </div>
  );
};

const StudentsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, total } = await studentsService.list({
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
        q: searchTerm || undefined,
      });
      setStudents(items);
      setTotal(total);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [currentPage]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  useEffect(() => { if (currentPage === 1) fetchStudents(); }, [searchTerm]);

  const paginatedStudents = students;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, total || 0);
  const endItem = Math.min(currentPage * itemsPerPage, total || 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-custom-900">Students</h1>
        <Link to="/students/new">
          <button className="flex items-center gap-2 rounded-lg bg-primary py-2 px-4 text-white font-semibold hover:bg-primary-dark transition-colors">
            <Plus size={20} />
            <span>Add New Student</span>
          </button>
        </Link>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-custom-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, zone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border bg-white py-2.5 pl-12 pr-4 focus:border-primary focus:outline-none"
          />
        </div>
        
        <div className="overflow-x-auto">
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          {loading && <p className="text-sm text-gray-custom-500 mb-4">Loading…</p>}
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-custom-200">
                <th className="p-4"><input type="checkbox" className="rounded border-gray-custom-300 text-primary focus:ring-primary" /></th>
                
                <th className="p-4 text-sm font-semibold text-gray-custom-500">STUDENT NAME</th>
                <th className="p-4 text-sm font-semibold text-gray-custom-500">PHONE</th>
                <th className="p-4 text-sm font-semibold text-gray-custom-500">ZONE</th>
                <th className="p-4 text-sm font-semibold text-gray-custom-500">STUDENT CATEGORY</th>
                <th className="p-4 text-sm font-semibold text-gray-custom-500">INTAKE YEAR</th>
                <th className="p-4 text-sm font-semibold text-gray-custom-500">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => (
                <tr 
                  key={student.id}
                  className="border-b border-gray-custom-200 last:border-b-0 hover:bg-gray-custom-50 cursor-pointer"
                  onClick={() => navigate(`/students/${student.id}`)}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="rounded border-gray-custom-300 text-primary focus:ring-primary" /></td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={student.name} />
                      <div>
                        <p className="font-medium text-gray-custom-800">{student.name}</p>
                        <p className="text-sm text-gray-custom-500">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-custom-600">{student.phone || '-'}</td>
                  <td className="p-4 text-gray-custom-600">{student.zone || '-'}</td>
                  <td className="p-4 text-gray-custom-600">{student.category || '-'}</td>
                  <td className="p-4 text-gray-custom-600">{student.intake_year ? new Date(student.intake_year).getFullYear() : '-'}</td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <button className="text-primary font-medium hover:underline">Edit</button>
                    <button className="ml-4 text-red-500 font-medium hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-custom-600">Showing {startItem}-{endItem} of {total}</p>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-gray-custom-600 hover:bg-gray-custom-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button 
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-md border bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentsPage;
