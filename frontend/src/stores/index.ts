import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
interface User {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

interface Article {
  id: string;
  title: string;
  status: string;
  content_draft?: {
    content?: {
      sections?: any[];
    };
  };
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
}

interface ArticleState {
  currentArticle: Article | null;
  articles: Article[];
  outline: any | null;
  setCurrentArticle: (article: Article) => void;
  setArticles: (articles: Article[]) => void;
  setOutline: (outline: any) => void;
  updateArticleSection: (sectionIndex: number, content: any) => void;
}

interface UIState {
  sidebarOpen: boolean;
  loading: boolean;
  notification: { type: 'success' | 'error' | 'info'; message: string } | null;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  setNotification: (notification: { type: 'success' | 'error' | 'info'; message: string } | null) => void;
  clearNotification: () => void;
}

// Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        localStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

// Project Store
// Project Store
export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      projects: [],

      setCurrentProject: (project) => set({ currentProject: project }),
      setProjects: (projects) => set({ projects }),
      addProject: (project) => set((state) => ({
        projects: [...state.projects, project]
      })),
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),
      removeProject: (id) => set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      })),
    }),
    {
      name: 'project-storage',
    }
  )
);

// Article Store
export const useArticleStore = create<ArticleState>((set) => ({
  currentArticle: null,
  articles: [],
  outline: null,

  setCurrentArticle: (article) => set({ currentArticle: article }),
  setArticles: (articles) => set({ articles }),
  setOutline: (outline) => set({ outline }),

  updateArticleSection: (sectionIndex, content) => set((state) => {
    if (!state.currentArticle) return state;

    const updatedArticle = { ...state.currentArticle };
    if (updatedArticle.content_draft?.content?.sections?.[sectionIndex]) {
      updatedArticle.content_draft.content.sections[sectionIndex] = {
        ...updatedArticle.content_draft.content.sections[sectionIndex],
        ...content,
      };
    }

    return { currentArticle: updatedArticle };
  }),
}));

// UI Store
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  loading: false,
  notification: null,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setLoading: (loading) => set({ loading }),
  setNotification: (notification) => set({ notification }),
  clearNotification: () => set({ notification: null }),
}));
