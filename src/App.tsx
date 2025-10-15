import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './pages/DashboardLayout';
import LoginPage from './pages/Login';
import StudentsPage from './pages/Students';
import DashboardPage from './pages/Dashboard';
import PaymentsPage from './pages/Payments';
import ForgotPasswordPage from './pages/ForgotPassword';
import AddStudentPage from './pages/AddStudent';
import StudentDetailsPage from './pages/StudentDetails';
import AddPaymentPage from './pages/AddPayment';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/students" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/new" element={<AddStudentPage />} />
          <Route path="students/:studentId" element={<StudentDetailsPage />} />
          <Route path="students/:studentId/payments/new" element={<AddPaymentPage />} />
          <Route path="payments" element={<PaymentsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
