import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ArticleGenerationPage from './pages/ArticleGenerationPage';
import ArticleDetailPage from './pages/ArticleDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Root route - Simple Article Generation */}
          <Route
            path="/"
            element={
              <Layout>
                <ArticleGenerationPage />
              </Layout>
            }
          />
          
          {/* Article Detail Page - Standalone page without Layout */}
          <Route path="/article/:id" element={<ArticleDetailPage />} />
          
          {/* Redirect all other routes to homepage */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
