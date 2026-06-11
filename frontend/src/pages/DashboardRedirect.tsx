import { useAuth } from '@/lib/auth'
import AdminDashboard from './admin/AdminDashboard'
import CustomerDashboard from './customer/CustomerDashboard'
import OperatorDashboard from './operator/OperatorDashboard'

export default function DashboardRedirect() {
  const { role } = useAuth()

  switch (role) {
    case 'ADMIN':
      return <AdminDashboard />
    case 'STAFF':
    case 'TECHNICIAN':
      return <OperatorDashboard />
    case 'CUSTOMER':
      return <CustomerDashboard />
    default:
      return <AdminDashboard />
  }
}
