import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { STUDENT_CATEGORIES, ZONES, ASSOCIATE_WISE_INSTALLMENTS } from '../lib/constants';
import { studentsService } from '../services/students';

type FormState = {
  name: string;
  phone?: string;
  zone?: string;
  category?: string;
  intake_year?: string; // ISO date string (YYYY)
  source_of_student?: string;
  associate_wise_installments?: string;
};

const EditStudentPage = () => {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: '' });

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        if (!studentId) return;
        const { student } = await studentsService.get(studentId);
        setForm({
          name: student?.name || '',
          phone: student?.phone || '',
          zone: student?.zone || '',
          category: student?.category || '',
          intake_year: student?.intake_year || '',
          source_of_student: student?.source_of_student || '',
          associate_wise_installments: student?.associate_wise_installments || '',
        });
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load student');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [studentId]);

  const handleChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    try {
      setSaving(true);
      setError(null);
      await studentsService.update(studentId, {
        name: form.name,
        phone: form.phone || undefined,
        zone: form.zone || undefined,
        category: form.category || undefined,
        intake_year: form.intake_year || undefined,
        source_of_student: form.source_of_student || undefined,
        associate_wise_installments: form.associate_wise_installments || undefined,
      });
      navigate('/students');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-custom-600">Loading…</div>;
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-8">Edit Student</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
        <div className="space-y-10">
          <div>
            <h2 className="text-lg font-semibold leading-7 text-gray-custom-900">Personal Information</h2>
            <p className="mt-1 text-sm leading-6 text-gray-custom-600">Update the student's personal and contact details.</p>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-custom-900">Full Name</label>
                <div className="mt-2">
                  <input type="text" id="name" required value={form.name} onChange={handleChange('name')} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-custom-900">Phone</label>
                <div className="mt-2">
                  <input type="tel" id="phone" value={form.phone || ''} onChange={handleChange('phone')} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold leading-7 text-gray-custom-900">Enrollment Details</h2>
            <p className="mt-1 text-sm leading-6 text-gray-custom-600">Update enrollment category and timeline.</p>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="zone" className="block text-sm font-medium leading-6 text-gray-custom-900">Zone</label>
                <div className="mt-2">
                  <select id="zone" value={form.zone || ''} onChange={handleChange('zone')} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                    <option value="">Select Zone</option>
                    {ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="category" className="block text-sm font-medium leading-6 text-gray-custom-900">Student Category</label>
                <div className="mt-2">
                  <select id="category" value={form.category || ''} onChange={handleChange('category')} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                    <option value="">Select Category</option>
                    {STUDENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="intakeYear" className="block text-sm font-medium leading-6 text-gray-custom-900">Intake Year</label>
                <div className="mt-2">
                  <input type="number" id="intakeYear" value={form.intake_year || ''} onChange={handleChange('intake_year')} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="sourceOfStudent" className="block text-sm font-medium leading-6 text-gray-custom-900">Source of Student</label>
                <div className="mt-2">
                  <input type="text" id="sourceOfStudent" value={form.source_of_student || ''} onChange={handleChange('source_of_student')} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="associateWiseInstallments" className="block text-sm font-medium leading-6 text-gray-custom-900">Associate Wise Installments</label>
                <div className="mt-2">
                  <select id="associateWiseInstallments" value={form.associate_wise_installments || ''} onChange={handleChange('associate_wise_installments')} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                    <option value="">Select</option>
                    {ASSOCIATE_WISE_INSTALLMENTS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4 pt-8 mt-8 border-t border-gray-900/10">
          <button type="button" onClick={() => navigate('/students')} className="text-sm font-semibold leading-6 text-gray-custom-900">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-primary py-2 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditStudentPage;


