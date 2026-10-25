import { RouterProvider } from 'react-router'
import { AuthProvider } from '../auth/AuthContext'
import { PreferencesProvider } from '../context/PreferencesContext'
import { router } from './router'

export function App() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PreferencesProvider>
  )
}
