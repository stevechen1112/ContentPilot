import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProjectStore, useUIStore } from '../stores';
import { articleAPI, projectAPI } from '../lib/api';
import { Search, Loader2, Sparkles } from 'lucide-react';

export default function ArticleGenerationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, setProjects } = useProjectStore();
  const { setNotification } = useUIStore();

  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [generationStatus, setGenerationStatus] = useState('');
  const [initializing, setInitializing] = useState(true);

  // Auto-initialize project
  useEffect(() => {
    const initProject = async () => {
      if (currentProject) {
        setInitializing(false);
        return;
      }

      try {
        const res = await projectAPI.getAll();
        const projects = res.data.data || [];
        setProjects(projects);

        if (projects.length > 0) {
          setCurrentProject(projects[0]);
        } else {
          // Create a default project
          const newProjectRes = await projectAPI.create({
            name: '我的專案',
            description: 'Default project for quick generation'
          });
          const newProject = newProjectRes.data.data;
          setProjects([newProject]);
          setCurrentProject(newProject);
        }
      } catch (error) {
        console.error('Failed to initialize project:', error);
      } finally {
        setInitializing(false);
      }
    };

    initProject();
  }, [currentProject, setCurrentProject, setProjects]);

  const handleGenerateArticle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!keyword.trim()) {
      setNotification({ type: 'error', message: '請輸入關鍵字' });
      return;
    }

    if (!currentProject) {
       setNotification({ type: 'error', message: '系統初始化中，請稍後再試' });
       return;
    }

    setLoading(true);
    setGenerationStatus('正在分析關鍵字並生成大綱...');
    
    try {
      const defaultSettings = { 
        tone: '專業但易懂', 
        target_audience: '一般讀者',
        author_bio: '',
        author_values: ''
      };

      const outlineRes = await articleAPI.generateOutline(keyword, currentProject.id, null, defaultSettings);
      const rawOutline = outlineRes.data.data;

      if (!rawOutline || rawOutline.parse_error) {
        setNotification({ type: 'error', message: '大綱解析失敗，請重試' });
        setLoading(false);
        setGenerationStatus('');
        return;
      }

      setGenerationStatus('正在撰寫完整文章內容（預計 5-10 分鐘，請耐心等待）...');
      const articleRes = await articleAPI.generate(currentProject.id, null, rawOutline, defaultSettings);

      setNotification({ type: 'success', message: '文章生成成功！' });
      
      // 組合完整的 HTML 內容
      const article = articleRes.data.data;
      const content = article.content_draft || article.content;
      
      let fullHtml = '';
      if (content?.content) {
        // 組合: 引言 + 所有章節 + 結論
        if (content.content.introduction?.html) {
          fullHtml += `<div class="introduction">${content.content.introduction.html}</div>`;
        }
        if (content.content.sections && content.content.sections.length > 0) {
          content.content.sections.forEach((section: any) => {
            if (section.heading) {
              fullHtml += `<h2>${section.heading}</h2>`;
            }
            if (section.html) {
              fullHtml += `<div class="section">${section.html}</div>`;
            }
          });
        }
        if (content.content.conclusion?.html) {
          fullHtml += `<div class="conclusion">${content.content.conclusion.html}</div>`;
        }
      }
      
      // 將組合的 HTML 添加到文章對象中
      article.html_content = fullHtml;
      
      // 跳轉到獨立的文章詳情頁面
      const articleId = article.id;
      navigate(`/article/${articleId}`);
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.error || '文章生成失敗';
      setNotification({ type: 'error', message: errorMsg });
      setLoading(false);
      setGenerationStatus('');
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      {loading ? (
        <div className="w-full max-w-2xl text-center space-y-8 animate-fade-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary-100 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-white p-6 rounded-full shadow-sm border border-gray-100">
              <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-3xl font-bold text-gray-900">AI 正在為您撰寫</h3>
            <p className="text-xl text-gray-500">{generationStatus}</p>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden max-w-md mx-auto">
            <div className="bg-gradient-to-r from-primary-400 to-primary-600 h-full rounded-full animate-progress" style={{ width: '100%', animationDuration: '2s' }}></div>
          </div>
          
          <p className="text-sm text-gray-400">這可能需要幾分鐘，請勿關閉視窗</p>
        </div>
      ) : (
        <div className="w-full max-w-3xl flex flex-col items-center space-y-8 animate-fade-in-up">
          {/* Logo / Title */}
          <div className="text-center space-y-2 mb-4">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight">
              <span className="text-primary-600">Content</span>Pilot
            </h1>
            <p className="text-xl text-gray-500">SEO 自動化內容生產引擎</p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleGenerateArticle} className="w-full relative group">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="輸入關鍵字，開始生成文章..."
              className="block w-full pl-16 pr-6 py-5 text-xl text-gray-900 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:shadow-lg transition-all duration-300 outline-none"
              autoFocus
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <button 
                type="submit"
                disabled={!keyword.trim()}
                className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>
          </form>

          {/* Quick Tags */}
          <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-600">
            <span>試試看：</span>
            {['2024 日本旅遊', '健康飲食指南', '美股投資入門', 'AI 工具推薦'].map((tag) => (
              <button
                key={tag}
                onClick={() => setKeyword(tag)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
