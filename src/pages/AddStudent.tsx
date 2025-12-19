import React from 'react';
import { useNavigate } from 'react-router-dom';
import { STUDENT_CATEGORIES, ZONES, ASSOCIATE_WISE_INSTALLMENTS } from '../lib/constants';
import { studentsService } from '../services/students';
import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const AddStudentPage = () => {
  const navigate = useNavigate();
  const [enrollmentNumber, setEnrollmentNumber] = useState<string>('');
  const [loadingEnrollment, setLoadingEnrollment] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associateWiseInstallments, setAssociateWiseInstallments] = useState<string>('');
  const [installmentError, setInstallmentError] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');

  useEffect(() => {
    const fetchEnrollmentNumber = async () => {
      try {
        const response = await studentsService.getNextEnrollmentNumber();
        if (response.success) {
          setEnrollmentNumber(response.enrollment_number);
        }
      } catch (error) {
        console.error('Failed to fetch enrollment number:', error);
      } finally {
        setLoadingEnrollment(false);
      }
    };
    fetchEnrollmentNumber();
  }, []);

  const validateInstallmentPattern = (value: string): boolean => {
    // Remove whitespace
    const trimmed = value.replace(/\s/g, '');
    // Pattern: numbers/decimal numbers separated by dashes
    // Examples: "20-10-30.5", "20.3-10-44", "10-20"
    const pattern = /^(\d+(\.\d+)?-)*\d+(\.\d+)?$/;
    return trimmed === '' || pattern.test(trimmed);
  };

  const handleInstallmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove whitespace immediately
    const trimmed = value.replace(/\s/g, '');
    
    // Always update the value (removing whitespace), but show error if invalid
    setAssociateWiseInstallments(trimmed);
    
    // Validate the pattern
    if (trimmed === '' || validateInstallmentPattern(trimmed)) {
      setInstallmentError('');

      // Auto-calculate total amount from installments
      if (trimmed === '') {
        setTotalAmount('');
      } else {
        const parts = trimmed.split('-').map(part => Number(part));
        const validParts = parts.filter(part => !Number.isNaN(part));
        if (validParts.length > 0) {
          const total = validParts.reduce((acc, curr) => acc + curr, 0);
          setTotalAmount(Math.round(total * 100) / 100); // round to 2 decimal places
        } else {
          setTotalAmount('');
        }
      }
    } else {
      setInstallmentError('Invalid format. Use numbers, decimals, and dashes only (e.g., 100-50-30.5 or 105.7-47.3)');
    }
  };

  const handleTotalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setTotalAmount('');
    } else {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        setTotalAmount(num);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // prevent double submit
    
    // Validate installment pattern before submission
    if (associateWiseInstallments && !validateInstallmentPattern(associateWiseInstallments)) {
      setInstallmentError('Invalid format. Use numbers, decimals, and dashes only (e.g., 100-50-30.5 or 105.7-47.3)');
      return;
    }
    
    setIsSubmitting(true);
    const form = e.target as HTMLFormElement;
    const name = (form.querySelector('#name') as HTMLInputElement).value;
    const phone = (form.querySelector('#phone') as HTMLInputElement).value;
    const zone = (form.querySelector('#zone') as HTMLSelectElement).value;
    const category = (form.querySelector('#category') as HTMLSelectElement).value;
    const intakeYear = (form.querySelector('#intakeYear') as HTMLInputElement).value; // e.g., 2025
    const sourceOfStudent = (form.querySelector('#sourceOfStudent') as HTMLInputElement).value;
    try {
      await studentsService.create({ 
        name, 
        phone, 
        zone, 
        category, 
        source_of_student: sourceOfStudent || undefined,
        associate_wise_installments: associateWiseInstallments || undefined,
        intake_year: intakeYear || undefined,
        enrollment_number: enrollmentNumber,
        total_amount: totalAmount === '' ? undefined : Number(totalAmount),
      });
      navigate('/students');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-4">Add New Student</h1>
      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold leading-7 text-gray-custom-900 mb-1">Personal Information</h2>
              <p className="text-sm text-gray-custom-600 mb-4">Enter the student's personal and contact details.</p>
            </div>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-custom-900">Full Name</label>
              <div className="mt-1.5">
                <input type="text" id="name" required className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-custom-900">Phone</label>
              <div className="mt-1.5">
                <input type="tel" id="phone" required className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold leading-7 text-gray-custom-900 mb-1 mt-6">Enrollment Details</h2>
              <p className="text-sm text-gray-custom-600 mb-4">Specify the student's enrollment category and timeline.</p>
            </div>

            <div>
              <label htmlFor="enrollmentNumber" className="block text-sm font-medium leading-6 text-gray-custom-900">Enrollment Number</label>
              <div className="mt-1.5">
                {loadingEnrollment ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-gray-custom-500">Generating enrollment number...</span>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    id="enrollmentNumber" 
                    value={enrollmentNumber}
                    placeholder="Auto-generated (0001, 0002, etc.)" 
                    readOnly 
                    className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 bg-gray-custom-50 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" 
                  />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="zone" className="block text-sm font-medium leading-6 text-gray-custom-900">Zone</label>
              <div className="mt-1.5">
                <select id="zone" required className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                  <option value="">Select Zone</option>
                  {ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium leading-6 text-gray-custom-900">Student Category</label>
              <div className="mt-1.5">
                <select id="category" required className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                  <option value="">Select Category</option>
                  {STUDENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="intakeYear" className="block text-sm font-medium leading-6 text-gray-custom-900">Intake Year</label>
              <div className="mt-1.5">
                <input type="number" id="intakeYear" defaultValue={2026} className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
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
                <input type="text" id="sourceOfStudent" className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
              </div>
            </div>

            <div>
              <label htmlFor="associateWiseInstallments" className="block text-sm font-medium leading-6 text-gray-custom-900">Package</label>
              <div className="mt-1.5">
                <input
                  type="text"
                  id="associateWiseInstallments"
                  list="associateInstallmentOptions"
                  value={associateWiseInstallments}
                  onChange={handleInstallmentChange}
                  className={`block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ${
                    installmentError 
                      ? 'ring-red-300 focus:ring-red-500' 
                      : 'ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary'
                  } placeholder:text-gray-custom-400 sm:text-sm sm:leading-6`}
                  placeholder="Type or select a pattern (e.g., 20-25-35) - amounts in thousands"
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
                      <li>Enter amounts in thousands (e.g., 20 = ₹20,000)</li>
                      <li>Use a dash ( - ) to separate installments</li>
                      <li>The sum of all installments must equal the total amount</li>
                    </ul>
                  </div>

                  <div className="mb-2">
                    <p className="text-xs font-semibold text-gray-custom-800 mb-1">Examples</p>
                    <div className="text-xs text-gray-custom-600 space-y-0.5">
                      <p><span className="font-medium">100</span> → ₹1,00,000 (100 thousands)</p>
                      <p><span className="font-medium">50-30-20</span> → ₹50,000 + ₹30,000 + ₹20,000 (Total: 100)</p>
                      <p><span className="font-medium">20-25-35</span> → ₹20,000 + ₹25,000 + ₹35,000 (Total: 80)</p>
                      <p><span className="font-medium">100-50-30.5</span> → ₹1,00,000 + ₹50,000 + ₹30,500 (Total: 180.5)</p>
                      <p><span className="font-medium">47.3-33.3</span> → ₹47,300 + ₹33,300 (Total: 80.6)</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-custom-800 mb-1">Rules</p>
                    <ul className="text-xs text-gray-custom-600 space-y-0.5 ml-4 list-disc">
                      <li>Decimals are allowed (e.g., 30.5 = ₹30,500)</li>
                      <li>Do not enter commas or currency symbols</li>
                      <li>Installments should be entered in order</li>
                      <li>All amounts are in thousands</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium leading-6 text-gray-custom-900">Total Amount (in thousands)</label>
              <div className="mt-1.5">
                <input 
                  type="number" 
                  id="totalAmount" 
                  inputMode="decimal" 
                  step="0.01" 
                  min="0" 
                  value={totalAmount === '' ? '' : totalAmount} 
                  onChange={handleTotalAmountChange}
                  placeholder="e.g., 80 (represents ₹80,000)"
                  className="block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" 
                />
                {totalAmount !== '' && (
                  <p className="mt-1 text-xs text-gray-custom-600">
                    = ₹{(Number(totalAmount) * 1000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-4 pt-4 mt-6 border-t border-gray-900/10">
          <button type="button" onClick={() => navigate('/students')} className="text-sm font-semibold leading-6 text-gray-custom-900">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className={`rounded-md bg-primary py-2 px-4 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark'}`}>
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Saving...
              </span>
            ) : 'Save Student'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStudentPage;
