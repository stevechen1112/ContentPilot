import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProjectWizardPage from './pages/ProjectWizardPage';
import ArticleListPage from './pages/ArticleListPage';
import ArticleGenerationPage from './pages/ArticleGenerationPage';
import ArticleEditorPage from './pages/ArticleEditorPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />} 
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/wizard"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProjectWizardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/articles"
            element={
              <ProtectedRoute>
                <Layout>
                  <ArticleListPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/articles/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <ArticleGenerationPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/articles/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <ArticleEditorPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          {/* Redirect root to dashboard or login */}
          <Route
            path="/"
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
          />
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
