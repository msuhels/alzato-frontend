import  { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { studentsService, StudentListItem } from '../services/students';
import { paymentsService } from '../services/payments';
import ConfirmDialog from '../components/ConfirmDialog';
import TableSkeleton from '../components/TableSkeleton';
import { useAuth } from '../hooks/useAuth';

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
  const { user } = useAuth();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; failed: number; errors?: Array<{ rowNumber: number; message: string }> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputId = 'students-import-file';
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const showBulkUi = false; // feature temporarily hidden
  const showSampleCsv = false; // temporarily hide Sample CSV button

  const downloadBlob = (blob: Blob, fallbackName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (file: File) => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await paymentsService.importCsv(text);
      setImportResult(res);
      await fetchStudents();
    } catch (e: any) {
      setImportError(e?.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const triggerImportFile = () => {
    const input = document.getElementById(fileInputId) as HTMLInputElement | null;
    input?.click();
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await paymentsService.exportCsv({});
      downloadBlob(blob, `alzato-students-export-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const { blob, filename } = await paymentsService.downloadSampleCsv();
      downloadBlob(blob, filename || 'alzato-sample-import-export.csv');
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Sample download failed');
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, total } = await studentsService.list({
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
        q: searchTerm || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
      });
      setStudents(items);
      setTotal(total);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [currentPage, sortBy, sortDir]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy, sortDir]);
  useEffect(() => { if (currentPage === 1) fetchStudents(); }, [searchTerm]);

  const paginatedStudents = students;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const skeletonColumns = showBulkUi ? (user?.role === 'user' ? 8 : 9) : (user?.role === 'user' ? 7 : 8);

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

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown size={16} className="text-gray-custom-400" />;
    }
    return sortDir === 'asc' ? 
      <ArrowUp size={16} className="text-primary" /> : 
      <ArrowDown size={16} className="text-primary" />;
  };

  const askDelete = (id: string | number) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await studentsService.remove(deletingId);
      // Optimistically remove from list to avoid extra refetch
      setStudents(prev => prev.filter(s => s.id !== deletingId));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete student');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setDeletingId(null);
      // Ensure list stays in sync
      fetchStudents();
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await studentsService.bulkDelete(ids);
      setStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
      setTotal(prev => Math.max(0, prev - (res?.deleted ?? ids.length)));
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete selected students');
    } finally {
      setBulkDeleting(false);
      setBulkConfirmOpen(false);
      fetchStudents();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-custom-900">Students</h1>
        <div className="flex items-center gap-3">
          {user?.role !== 'user' && selectedIds.size > 0 && showBulkUi && (
            <button
              onClick={() => setBulkConfirmOpen(true)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              Delete Selected ({selectedIds.size})
            </button>
          )}
          {user?.role !== 'user' && (
            <>
              {showSampleCsv && (
                <button onClick={handleDownloadSample} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50">Sample CSV</button>
              )}
              <button onClick={handleExportCsv} disabled={exporting} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50 disabled:opacity-50">{exporting ? 'Exporting…' : 'Export CSV'}</button>
              <button onClick={() => setShowImportDialog(true)} disabled={importing} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50 disabled:opacity-50">{importing ? 'Importing…' : 'Import CSV'}</button>
              <input id={fileInputId} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { e.currentTarget.value = ''; handleImportCsv(f); } }} />
            </>
          )}
          <Link to="/students/new">
            <button className="flex items-center gap-2 rounded-lg bg-primary py-2 px-4 text-white font-semibold hover:bg-primary-dark transition-colors">
              <Plus size={20} />
              <span>Add New Student</span>
            </button>
          </Link>
        </div>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-custom-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, phone ..."
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
          {loading ? (
            <TableSkeleton rows={10} columns={skeletonColumns} />
          ) : students.length === 0 ? (
            <div className="text-center text-gray-custom-500 py-8">No records found.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-custom-200">
                  {showBulkUi && (
                    <th className="p-4">
                      <input
                        type="checkbox"
                        checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.has(s.id))}
                        onChange={(e) => {
                          e.stopPropagation();
                          const next = new Set(selectedIds);
                          const allOnPageIds = paginatedStudents.map(s => s.id);
                          const allSelected = allOnPageIds.every(id => next.has(id));
                          if (allSelected) {
                            allOnPageIds.forEach(id => next.delete(id));
                          } else {
                            allOnPageIds.forEach(id => next.add(id));
                          }
                          setSelectedIds(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                  )}
                  <th 
                    className="p-4 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                    onClick={() => handleSort('enrollment_number')}
                  >
                    <div className="flex items-center gap-2">
                      ENROLLMENT NO.
                      {getSortIcon('enrollment_number')}
                    </div>
                  </th>
                  <th 
                    className="p-4 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      STUDENT NAME
                      {getSortIcon('name')}
                    </div>
                  </th>
                  
                  <th 
                    className="p-4 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                    onClick={() => handleSort('zone')}
                  >
                    <div className="flex items-center gap-2">
                      ZONE
                      {getSortIcon('zone')}
                    </div>
                  </th>
                  <th 
                    className="p-4 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                    onClick={() => handleSort('associate_wise_installments')}
                  >
                    <div className="flex items-center gap-2">
                      ASSOCIATE WISE
                      {getSortIcon('associate_wise_installments')}
                    </div>
                  </th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">TOTAL</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">RECEIVED</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">NET PENDING</th>
                  {user?.role !== 'user' && (
                    <th className="p-4 text-sm font-semibold text-gray-custom-500">ACTIONS</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => (
                  <tr 
                    key={student.id}
                    className="border-b border-gray-custom-200 last:border-b-0 hover:bg-gray-custom-50 cursor-pointer"
                    onClick={() => navigate(`/students/${student.id}`)}
                  >
                    {showBulkUi && (
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) {
                              next.add(student.id);
                            } else {
                              next.delete(student.id);
                            }
                            setSelectedIds(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="p-4 text-gray-custom-600 font-mono">{student.enrollment_number || '-'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={student.name} />
                        <div>
                          <p className="font-medium text-gray-custom-800">{student.name}</p>
                          <p className="text-sm text-gray-custom-500">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 text-gray-custom-600">{student.zone || '-'}</td>
                    <td className="p-4 text-gray-custom-600">{student.associate_wise_installments || '-'}</td>
                    <td className="p-4 text-gray-custom-600">{(student.total_amount ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                    <td className="p-4 text-gray-custom-600">{(student.recieved_amount ?? student.received_amount ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                    <td className="p-4 text-gray-custom-600">{(student.net_amount ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                    {user?.role !== 'user' && (
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        {user?.role === 'admin' && (
                          <button onClick={() => navigate(`/students/${student.id}/edit`)} className="text-primary font-medium hover:underline">Edit</button>
                        )}
                        {user?.role !== 'user' && (
                          <button onClick={() => askDelete(student.id)} className="ml-4 text-red-500 font-medium hover:underline">Delete</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-custom-600">{total > 0 ? `Showing ${startItem}-${endItem} of ${total}` : 'Showing 0 of 0'}</p>
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
      <ConfirmDialog
        open={confirmOpen}
        title="Delete student?"
        description="This action cannot be undone. The student will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        confirming={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) { setConfirmOpen(false); setDeletingId(null); } }}
      />
      {showBulkUi && (
        <ConfirmDialog
          open={bulkConfirmOpen}
          title="Delete selected students?"
          description="This action cannot be undone. All selected students will be permanently removed."
          confirmText="Delete"
          cancelText="Cancel"
          confirming={bulkDeleting}
          onConfirm={confirmBulkDelete}
          onCancel={() => { if (!bulkDeleting) { setBulkConfirmOpen(false); } }}
        />
      )}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowImportDialog(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-custom-900">Import Payments CSV</h2>
              <p className="mt-1 text-sm text-gray-custom-500">Please read these instructions carefully before importing.</p>
            </div>
            <div className="rounded-lg border bg-gray-custom-50 p-4">
              <ul className="list-disc pl-5 text-sm text-gray-custom-700 space-y-2">
                <li>When importing for the first time, remove all existing students data before importing.</li>
                <li>Only CSV format is supported.</li>
                <li>Please follow the sample file format properly. Use the <button onClick={handleDownloadSample} className="text-primary underline">Sample CSV</button>.</li>
                <li><span className="font-semibold">Date format</span> should be <span className="font-mono">DD/MM/YYYY</span>.</li>
                <li><span className="font-semibold">enrollment_number</span> should look like: <span className="font-mono">#0001, #0002, … #0011 … #0102 … #2010 … #99999</span>.</li>
              </ul>
            </div>

            {(importing || importResult || importError) && (
              <div className="mt-4 rounded-lg border p-4">
                {importing && (
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-gray-custom-700">Importing… this may take a moment.</span>
                  </div>
                )}
                {!importing && importResult && (
                  <div className="text-sm text-gray-custom-700">
                    <p className="font-semibold text-gray-custom-900">Import completed</p>
                    <p className="mt-1">Inserted: <span className="font-mono">{importResult.inserted}</span>, Failed: <span className="font-mono">{importResult.failed}</span></p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-auto rounded bg-gray-custom-50 p-2">
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {importResult.errors.map((er, idx) => (
                            <li key={idx} className="font-mono">Row {er.rowNumber}: {er.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {!importing && importError && (
                  <div className="text-sm text-red-600">
                    <p className="font-semibold">Import failed</p>
                    <p className="mt-1">{importError}</p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => { setShowImportDialog(false); setImportResult(null); setImportError(null); }} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50">{importing ? 'Hide' : (importResult || importError) ? 'Done' : 'Cancel'}</button>
              <button onClick={() => { triggerImportFile(); }} disabled={importing} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">Choose CSV & Import</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default StudentsPage;
