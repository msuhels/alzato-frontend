// React import not required for JSX with modern TS config
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './pages/DashboardLayout';
import LoginPage from './pages/Login';
import StudentsPage from './pages/Students';
import DashboardPage from './pages/Dashboard';
import PaymentsPage from './pages/Payments';
import ForgotPasswordPage from './pages/ForgotPassword';
import AddStudentPage from './pages/AddStudent';
import EditStudentPage from './pages/EditStudent';
import StudentDetailsPage from './pages/StudentDetails';
import AddPaymentPage from './pages/AddPayment';
import EditPaymentPage from './pages/EditPayment.tsx';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/new" element={<AddStudentPage />} />
          <Route path="students/:studentId/edit" element={<EditStudentPage />} />
          <Route path="students/:studentId" element={<StudentDetailsPage />} />
          <Route path="students/:studentId/payments/new" element={<AddPaymentPage />} />
          <Route path="students/:studentId/payments/:paymentId/edit" element={<EditPaymentPage />} />
          <Route path="payments" element={<PaymentsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/students" replace />;
}
