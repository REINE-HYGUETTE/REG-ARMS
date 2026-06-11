import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardRedirect from '@/pages/DashboardRedirect'
import NotFoundPage from '@/pages/NotFoundPage'

import AdminDashboard from '@/pages/admin/AdminDashboard'
import CustomerDashboard from '@/pages/customer/CustomerDashboard'
import OperatorDashboard from '@/pages/operator/OperatorDashboard'

import SubmitRequestPage from '@/pages/customer/SubmitRequestPage'
import MyRequestsPage from '@/pages/customer/MyRequestsPage'
import RequestsListPage from '@/pages/RequestsListPage'
import TechnicianTasksPage from '@/pages/TechnicianTasksPage'
import RequestDetailPage from '@/pages/RequestDetailPage'
import KanbanPage from '@/pages/KanbanPage'
import CompletedPage from '@/pages/CompletedPage'
import ReportsPage from '@/pages/ReportsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import AIPredictionsPage from '@/pages/AIPredictionsPage'
import NotificationsPage from '@/pages/NotificationsPage'
import ProfilePage from '@/pages/ProfilePage'
import UsersPage from '@/pages/admin/UsersPage'
import CategoriesPage from '@/pages/admin/CategoriesPage'
import TechniciansPage from '@/pages/TechniciansPage'
import AvailabilityPage from '@/pages/AvailabilityPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<AppLayout />}>
              {/* Redirect / to role-based dashboard */}
              <Route index element={<DashboardRedirect />} />

              {/* ── Admin only ── */}
              <Route path="dashboard/admin" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <UsersPage />
                </ProtectedRoute>
              } />
              <Route path="categories" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <CategoriesPage />
                </ProtectedRoute>
              } />
              <Route path="analytics" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AnalyticsPage />
                </ProtectedRoute>
              } />

              {/* ── Admin only (system oversight) ── */}
              <Route path="reports" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ReportsPage />
                </ProtectedRoute>
              } />
              <Route path="ai-predictions" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AIPredictionsPage />
                </ProtectedRoute>
              } />
              <Route path="technicians" element={
                <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                  <TechniciansPage />
                </ProtectedRoute>
              } />

              {/* ── Staff (full operations) ── */}
              <Route path="requests" element={
                <ProtectedRoute roles={['STAFF']}>
                  <RequestsListPage />
                </ProtectedRoute>
              } />

              {/* ── Operator dashboard (Staff / Technician) ── */}
              <Route path="dashboard/operator" element={
                <ProtectedRoute roles={['STAFF', 'TECHNICIAN']}>
                  <OperatorDashboard />
                </ProtectedRoute>
              } />

              {/* ── Technician only ── */}
              <Route path="tasks" element={
                <ProtectedRoute roles={['TECHNICIAN']}>
                  <TechnicianTasksPage />
                </ProtectedRoute>
              } />

              {/* ── Staff + Technician ── */}
              <Route path="kanban" element={
                <ProtectedRoute roles={['STAFF', 'TECHNICIAN']}>
                  <KanbanPage />
                </ProtectedRoute>
              } />
              <Route path="completed" element={
                <ProtectedRoute roles={['STAFF', 'TECHNICIAN']}>
                  <CompletedPage />
                </ProtectedRoute>
              } />
              <Route path="availability" element={
                <ProtectedRoute roles={['TECHNICIAN']}>
                  <AvailabilityPage />
                </ProtectedRoute>
              } />

              {/* ── Customer only ── */}
              <Route path="dashboard/customer" element={
                <ProtectedRoute roles={['CUSTOMER']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              } />
              <Route path="submit-request" element={
                <ProtectedRoute roles={['CUSTOMER']}>
                  <SubmitRequestPage />
                </ProtectedRoute>
              } />
              <Route path="my-requests" element={
                <ProtectedRoute roles={['CUSTOMER']}>
                  <MyRequestsPage />
                </ProtectedRoute>
              } />

              {/* ── All authenticated roles ── */}
              <Route path="requests/:id" element={
                <ProtectedRoute roles={['ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER']}>
                  <RequestDetailPage />
                </ProtectedRoute>
              } />
              <Route path="notifications" element={
                <ProtectedRoute roles={['ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER']}>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
              <Route path="profile" element={
                <ProtectedRoute roles={['ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER']}>
                  <ProfilePage />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
