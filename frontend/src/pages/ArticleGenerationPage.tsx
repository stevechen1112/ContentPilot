import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProjectStore, useUIStore } from '../stores';
import { articleAPI, projectAPI, researchAPI } from '../lib/api';
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [researchMultiplier, setResearchMultiplier] = useState<number>(1);

  // Outline telemetry for SERP coverage & sources
  const [outlineInfo, setOutlineInfo] = useState<{
    coverage?: any;
    sections?: any[];
  } | null>(null);

  const summarizeSources = (sections?: any[]) => {
    if (!Array.isArray(sections)) return [];
    const map = new Map<string, any>();

    sections.forEach((section) => {
      const allSources = [
        ...(section.sources || []),
        ...((section.subsections || []).flatMap((sub: any) => sub.sources || []))
      ];

      allSources.forEach((src: any) => {
        if (!src?.link) return;
        const existing = map.get(src.link) || { ...src, count: 0 };
        existing.count += 1;
        map.set(src.link, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => (a.position || 99) - (b.position || 99)).slice(0, 5);
  };

  // Advanced persona / outline controls
  const [authorPersona, setAuthorPersona] = useState('');
  const [authorValues, setAuthorValues] = useState('');
  const [tone, setTone] = useState('專業但易懂');
  const [targetAudience, setTargetAudience] = useState('一般讀者');
  const [uniqueAngle, setUniqueAngle] = useState('');
  const [expectedOutline, setExpectedOutline] = useState('');
  const [personalExperience, setPersonalExperience] = useState('');

  // Auto-initialize project
  useEffect(() => {
    const initProject = async () => {
      const token = localStorage.getItem('auth_token');

      // 未登入模式：允許匿名生成（不綁 project_id）
      if (!token) {
        setCurrentProject(null as any);
        setInitializing(false);
        return;
      }

      // If we already have a current project, don't do anything
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
          try {
            // Create a default project
            const newProjectRes = await projectAPI.create({
              name: '我的專案',
              description: 'Default project for quick generation'
            });
            const newProject = newProjectRes.data.data;
            setProjects([newProject]);
            setCurrentProject(newProject);
          } catch (createError) {
            console.error('Failed to create default project:', createError);
            throw createError;
          }
        }
      } catch (error: any) {
        console.error('Failed to initialize project:', error);
        if (error.response?.status === 401 || error.status === 401) {
          setNotification({ type: 'error', message: '登入已過期，請重新登入' });
        } else {
          setNotification({ type: 'error', message: '專案初始化失敗，請重新整理頁面' });
        }
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

    const token = localStorage.getItem('auth_token');
    const useAnonymousMode = !token;
    const activeProjectId = currentProject?.id || null;

    if (!useAnonymousMode && !activeProjectId) {
      setNotification({ type: 'error', message: '系統初始化中，請稍後再試' });
      return;
    }

    setLoading(true);
    setOutlineInfo(null);
    setGenerationStatus('正在分析 Google 搜尋結果與競爭對手...');

    try {
      // Step 1: 先進行 SERP 分析，取得「別人寫了什麼」與「讀者問了什麼」
      let serpData = null;
      try {
        setGenerationStatus('正在分析 Google SERP 資料...');
        const serpRes = await researchAPI.analyzeKeyword(keyword, researchMultiplier);
        serpData = serpRes.data.data;
        console.log('✅ SERP 分析完成:', serpData);
      } catch (serpError) {
        console.warn('⚠️ SERP 分析失敗，將使用預設模式:', serpError);
        // 即使 SERP 失敗，仍繼續生成（但會是憑空想像模式）
      }

      const defaultSettings = {
        tone,
        target_audience: targetAudience,
        author_bio: authorPersona,
        author_values: authorValues,
        unique_angle: uniqueAngle,
        expected_outline: expectedOutline,
        personal_experience: personalExperience
      };

      setGenerationStatus('正在根據 SERP 資料與您的獨特觀點生成大綱...');
      const outlineRes = await articleAPI.generateOutline(
        keyword,
        useAnonymousMode ? null : activeProjectId,
        serpData,
        defaultSettings
      );
      const rawOutline = outlineRes.data.data;

      // 捕捉 SERP 覆蓋率與來源供前端展示
      setOutlineInfo({
        coverage: rawOutline?.serp_coverage,
        sections: rawOutline?.sections
      });

      if (!rawOutline || rawOutline.parse_error) {
        setNotification({ type: 'error', message: '大綱解析失敗，請重試' });
        setLoading(false);
        setGenerationStatus('');
        return;
      }

      setGenerationStatus('正在撰寫完整文章內容（預計 5-10 分鐘，請耐心等待）...');
      const articleRes = await articleAPI.generate(
        useAnonymousMode ? null : activeProjectId,
        null,
        rawOutline,
        defaultSettings
      );

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

  const topSources = summarizeSources(outlineInfo?.sections);

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

          {outlineInfo && (
            <div className="text-left bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">SERP 覆蓋度</p>
                <p className="text-xs text-gray-500">PAA / 前 5 名結果映射到大綱</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500">PAA 覆蓋</p>
                  <p className="font-semibold">{outlineInfo.coverage?.paa?.covered || 0} / {outlineInfo.coverage?.paa?.total || 0}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500">前 5 名標題覆蓋</p>
                  <p className="font-semibold">{outlineInfo.coverage?.top_results?.covered || 0} / {outlineInfo.coverage?.top_results?.total || 0}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-900">可能參考的權威來源</p>
                <ul className="space-y-1 text-sm text-gray-700">
                  {topSources.map((src) => (
                    <li key={src.link} className="flex items-start gap-2">
                      <span className="text-primary-600 font-semibold">#{src.position || '-'} </span>
                      <a href={src.link} className="hover:text-primary-700 underline" target="_blank" rel="noreferrer">
                        {src.title}
                      </a>
                    </li>
                  ))}
                  {topSources.length === 0 && (
                    <li className="text-xs text-gray-500">暫無來源資料</li>
                  )}
                </ul>
              </div>
            </div>
          )}
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

          <div className="w-full max-w-3xl flex items-center justify-center gap-3 text-sm text-gray-600">
            <label className="text-gray-600">Research 深度</label>
            <select
              value={researchMultiplier}
              onChange={(e) => setResearchMultiplier(Number(e.target.value))}
              className="rounded-lg border border-gray-200 px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={1}>x1（預設）</option>
              <option value={2}>x2</option>
              <option value={3}>x3</option>
              <option value={4}>x4</option>
            </select>
            <span className="text-xs text-gray-400">越高、研究越深入、越花時間</span>
          </div>

          {/* Advanced controls */}
          <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">進階設定</p>
                <p className="text-sm text-gray-500">提供作者人設、受眾與獨特觀點，生成更聚焦的內容</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {showAdvanced ? '收起' : '展開'}
              </button>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">作者人設 / 背景</label>
                  <input
                    type="text"
                    value={authorPersona}
                    onChange={(e) => setAuthorPersona(e.target.value)}
                    placeholder="例如：10 年資深營養師，強調科學實證"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">核心價值觀 / 風格</label>
                  <input
                    type="text"
                    value={authorValues}
                    onChange={(e) => setAuthorValues(e.target.value)}
                    placeholder="例如：科學、務實、可落地，避免誇大"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">目標受眾</label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="例如：投資新手、想要 3 步驟學會的上班族"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">口吻 / Tone</label>
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="例如：直白、具體、行動導向"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">獨特觀點 / 角度</label>
                  <input
                    type="text"
                    value={uniqueAngle}
                    onChange={(e) => setUniqueAngle(e.target.value)}
                    placeholder="例如：只分享可驗證的技巧，不講空話"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">期望大綱 / 重點</label>
                  <textarea
                    value={expectedOutline}
                    onChange={(e) => setExpectedOutline(e.target.value)}
                    placeholder="列出你想要的 H2/H3 重點，或必須涵蓋的步驟"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[72px]"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-gray-600">個人經驗 / 案例</label>
                  <textarea
                    value={personalExperience}
                    onChange={(e) => setPersonalExperience(e.target.value)}
                    placeholder="可加入你的真實經驗、失敗教訓、案例數據，讓內容更有深度"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[96px]"
                  />
                </div>
              </div>
            )}
          </div>

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
