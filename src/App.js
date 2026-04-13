import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import ProtectedPaidMemberRoute from './components/ProtectedPaidMemberRoute';
import ProtectedRegisteredRoute from './components/ProtectedRegisteredRoute';
import HomePage from './pages/HomePage';
import RegistrationPage from './pages/RegistrationPage';
import PaymentPage from './pages/PaymentPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentPendingPage from './pages/PaymentPendingPage';
import LoginPage from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import MemberPortalPage from './pages/MemberPortalPage';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="register" element={<RegistrationPage />} />
            <Route
              path="payment"
              element={
                <ProtectedRegisteredRoute>
                  <PaymentPage />
                </ProtectedRegisteredRoute>
              }
            />
            <Route path="payment/success" element={<PaymentSuccessPage />} />
            <Route path="payment/pending" element={<PaymentPendingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route
              path="member"
              element={
                <ProtectedPaidMemberRoute>
                  <MemberPortalPage />
                </ProtectedPaidMemberRoute>
              }
            />
          </Route>
          <Route
            path="dashboard"
            element={
              <ProtectedAdminRoute>
                <AdminDashboardPage />
              </ProtectedAdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
