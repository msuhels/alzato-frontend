import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { STUDENT_CATEGORIES, ZONES, ASSOCIATE_WISE_INSTALLMENTS } from '../lib/constants';
import { studentsService } from '../services/students';
import LoadingSpinner from '../components/LoadingSpinner';

type FormState = {
  name: string;
  phone?: string;
  zone?: string;
  category?: string;
  intake_year?: string; // ISO date string (YYYY)
  source_of_student?: string;
  associate_wise_installments?: string;
  total_amount?: number;
};

const EditStudentPage = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { fromUpdates?: boolean; activityId?: number } };
  const { studentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: '' });
  const [installmentError, setInstallmentError] = useState<string>('');

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
          total_amount: student?.total_amount,
        });
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load student');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [studentId]);

  const validateInstallmentPattern = (value: string): boolean => {
    // Remove whitespace
    const trimmed = value.replace(/\s/g, '');
    // Pattern: numbers/decimal numbers separated by dashes
    // Examples: "20-10-30.5", "20.3-10-44", "10-20"
    const pattern = /^(\d+(\.\d+)?-)*\d+(\.\d+)?$/;
    return trimmed === '' || pattern.test(trimmed);
  };

  const handleChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    if (key === 'total_amount') {
      setForm(prev => ({ ...prev, [key]: value === '' ? undefined : Number(value) }));
    } else {
      setForm(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleInstallmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove whitespace immediately
    const trimmed = value.replace(/\s/g, '');
    
    // Always update the value (removing whitespace), but show error if invalid
    setForm(prev => ({ ...prev, associate_wise_installments: trimmed }));
    
    // Validate the pattern
    if (trimmed === '' || validateInstallmentPattern(trimmed)) {
      setInstallmentError('');
    } else {
      setInstallmentError('Invalid format. Use numbers in thousands, decimals, and dashes only (e.g., 100-50-30.5 or 105.7-47.3)');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    
    // Validate installment pattern before submission
    if (form.associate_wise_installments && !validateInstallmentPattern(form.associate_wise_installments)) {
      setInstallmentError('Invalid format. Use numbers in thousands, decimals, and dashes only (e.g., 100-50-30.5 or 105.7-47.3)');
      return;
    }
    
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
        total_amount: form.total_amount,
      });
      if (location.state?.fromUpdates) {
        navigate('/updates');
      } else {
        navigate('/students');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-custom-500">Loading student data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-4">Edit Student</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold leading-7 text-gray-custom-900 mb-1">Personal Information</h2>
              <p className="text-sm text-gray-custom-600 mb-4">Update the student's personal and contact details.</p>
            </div>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-custom-900">Full Name</label>
              <div className="mt-1.5">
                <input type="text" id="name" required value={form.name} onChange={handleChange('name')} className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-custom-900">Phone</label>
              <div className="mt-1.5">
                <input type="tel" id="phone" value={form.phone || ''} onChange={handleChange('phone')} className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold leading-7 text-gray-custom-900 mb-1 mt-6">Enrollment Details</h2>
              <p className="text-sm text-gray-custom-600 mb-4">Update enrollment category and timeline.</p>
            </div>

            <div>
              <label htmlFor="zone" className="block text-sm font-medium leading-6 text-gray-custom-900">Zone</label>
              <div className="mt-1.5">
                <select id="zone" value={form.zone || ''} onChange={handleChange('zone')} className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                  <option value="">Select Zone</option>
                  {ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium leading-6 text-gray-custom-900">Student Category</label>
              <div className="mt-1.5">
                <select id="category" value={form.category || ''} onChange={handleChange('category')} className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                  <option value="">Select Category</option>
                  {STUDENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="intakeYear" className="block text-sm font-medium leading-6 text-gray-custom-900">Intake Year</label>
              <div className="mt-1.5">
                <input type="number" id="intakeYear" value={form.intake_year || ''} onChange={handleChange('intake_year')} className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold leading-7 text-gray-custom-900 mb-1">Additional Details</h2>
              <p className="text-sm text-gray-custom-600 mb-4">Enter additional student and payment information.</p>
            </div>

            <div>
              <label htmlFor="sourceOfStudent" className="block text-sm font-medium leading-6 text-gray-custom-900">Source of Student</label>
              <div className="mt-1.5">
                <input type="text" id="sourceOfStudent" value={form.source_of_student || ''} onChange={handleChange('source_of_student')} className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
              </div>
            </div>

            <div>
              <label htmlFor="associateWiseInstallments" className="block text-sm font-medium leading-6 text-gray-custom-900">Associate Wise Installments</label>
              <div className="mt-1.5">
                <input
                  type="text"
                  id="associateWiseInstallments"
                  list="associateInstallmentOptions"
                  value={form.associate_wise_installments || ''}
                  onChange={handleInstallmentChange}
                  className={`block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ${
                    installmentError 
                      ? 'ring-red-300 focus:ring-red-500' 
                      : 'ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary'
                  } placeholder:text-gray-custom-400 sm:text-sm sm:leading-6`}
                  placeholder="Type or select a pattern (e.g., 100-50-30.5)"
                />
                <datalist id="associateInstallmentOptions">
                  {ASSOCIATE_WISE_INSTALLMENTS.map(v => <option key={v} value={v} />)}
                </datalist>
                {installmentError && (
                  <p className="mt-1 text-sm text-red-600">{installmentError}</p>
                )}
                <div className="mt-2 p-3 bg-gray-custom-50 rounded-md border border-gray-custom-200">
                 
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-custom-800 mb-1">How to enter installments</p>
                    <ul className="text-xs text-gray-custom-600 space-y-0.5 ml-4 list-disc">
                      <li>Enter amounts in thousands only</li>
                      <li>Use a dash ( - ) to separate installments</li>
                      <li>The sum of all installments must equal the total amount</li>
                    </ul>
                  </div>

                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-custom-800 mb-1">Examples</p>
                    <div className="text-xs text-gray-custom-600 space-y-0.5">
                      <p><span className="font-medium">100</span> → ₹1,00,000</p>
                      <p><span className="font-medium">50-30-20</span> → ₹50,000 + ₹30,000 + ₹20,000</p>
                      <p><span className="font-medium">100-50-30.5</span> → ₹1,00,000 + ₹50,000 + ₹30,500</p>
                      <p><span className="font-medium">47.3-33.3</span> → ₹47,300 + ₹33,300</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-custom-800 mb-1">Rules</p>
                    <ul className="text-xs text-gray-custom-600 space-y-0.5 ml-4 list-disc">
                      <li>Decimals are allowed (e.g., 30.5 = ₹30,500)</li>
                      <li>Do not enter commas or currency symbols</li>
                      <li>Installments should be entered in order</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium leading-6 text-gray-custom-900">Total Amount</label>
              <div className="mt-1.5">
                <input 
                  type="number" 
                  id="totalAmount" 
                  inputMode="decimal" 
                  step="0.01" 
                  min="0" 
                  value={form.total_amount || ''} 
                  onChange={handleChange('total_amount')}
                  className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4 pt-4 mt-6 border-t border-gray-900/10">
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


