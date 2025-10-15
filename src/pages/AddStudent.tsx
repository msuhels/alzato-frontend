import React from 'react';
import { useNavigate } from 'react-router-dom';
import { STUDENT_CATEGORIES, ZONES, ASSOCIATE_WISE_INSTALLMENTS } from '../lib/constants';
import { studentsService } from '../services/students';

const AddStudentPage = () => {
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.querySelector('#name') as HTMLInputElement).value;
    const phone = (form.querySelector('#phone') as HTMLInputElement).value;
    const zone = (form.querySelector('#zone') as HTMLSelectElement).value;
    const category = (form.querySelector('#category') as HTMLSelectElement).value;
    const intakeYear = (form.querySelector('#intakeYear') as HTMLInputElement).value; // e.g., 2025
    const sourceOfStudent = (form.querySelector('#sourceOfStudent') as HTMLInputElement).value;
    const associateWiseInstallments = (form.querySelector('#associateWiseInstallments') as HTMLSelectElement).value;
    await studentsService.create({ 
      name, 
      phone, 
      zone, 
      category, 
      source_of_student: sourceOfStudent || undefined,
      associate_wise_installments: associateWiseInstallments || undefined,
      intake_year: intakeYear || undefined,
    });
    navigate('/students');
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-8">Add New Student</h1>
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
        <div className="space-y-10">
          <div>
            <h2 className="text-lg font-semibold leading-7 text-gray-custom-900">Personal Information</h2>
            <p className="mt-1 text-sm leading-6 text-gray-custom-600">Enter the student's personal and contact details.</p>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-custom-900">Full Name</label>
                <div className="mt-2">
                  <input type="text" id="name" required className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-custom-900">Phone</label>
                <div className="mt-2">
                  <input type="tel" id="phone" required className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold leading-7 text-gray-custom-900">Enrollment Details</h2>
            <p className="mt-1 text-sm leading-6 text-gray-custom-600">Specify the student's enrollment category and timeline.</p>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="zone" className="block text-sm font-medium leading-6 text-gray-custom-900">Zone</label>
                <div className="mt-2">
                  <select id="zone" required className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                    <option value="">Select Zone</option>
                    {ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="category" className="block text-sm font-medium leading-6 text-gray-custom-900">Student Category</label>
                <div className="mt-2">
                  <select id="category" required className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
                    <option value="">Select Category</option>
                    {STUDENT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="intakeYear" className="block text-sm font-medium leading-6 text-gray-custom-900">Intake Year</label>
                <div className="mt-2">
                  <input type="number" id="intakeYear" defaultValue={new Date().getFullYear()} className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="sourceOfStudent" className="block text-sm font-medium leading-6 text-gray-custom-900">Source of Student</label>
                <div className="mt-2">
                  <input type="text" id="sourceOfStudent" className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 placeholder:text-gray-custom-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="associateWiseInstallments" className="block text-sm font-medium leading-6 text-gray-custom-900">Associate Wise Installments</label>
                <div className="mt-2">
                  <select id="associateWiseInstallments" className="block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6">
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
          <button type="submit" className="rounded-md bg-primary py-2 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Save Student
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStudentPage;
