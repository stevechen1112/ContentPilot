import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProjectStore, useUIStore } from '../stores';
import { articleAPI } from '../lib/api';
import {
  Wand2,
  FileText,
  List,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Save
} from 'lucide-react';

// Types for Outline
interface OutlineSection {
  title: string;
  description: string;
  keywords?: string[];
  subsections?: string[];
}

interface Outline {
  title: string;
  description: string;
  sections: OutlineSection[];
}

export default function ArticleGenerationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentProject } = useProjectStore();
  const { setNotification } = useUIStore();

  const [step, setStep] = useState(1); // 1: Config, 2: Outline, 3: Generating
  const [loading, setLoading] = useState(false);

  // Step 1: Config
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [tone, setTone] = useState('專業但易懂');
  const [targetAudience, setTargetAudience] = useState('一般讀者');

  // Step 2: Outline
  const [outline, setOutline] = useState<Outline | null>(null);
  const [serpInsights, setSerpInsights] = useState<any>(null);

  // Step 3: Generation Status
  const [generationStatus, setGenerationStatus] = useState('');

  useEffect(() => {
    if (!currentProject) {
      setNotification({ type: 'error', message: '請先選擇專案' });
      navigate('/dashboard');
    }
  }, [currentProject, navigate, setNotification]);

  const handleGenerateOutline = async () => {
    if (!keyword.trim()) {
      setNotification({ type: 'error', message: '請輸入關鍵字' });
      return;
    }

    setLoading(true);
    try {
      const res = await articleAPI.generateOutline(
        keyword,
        currentProject?.id,
        null,
        { tone, target_audience: targetAudience }
      );

      const rawOutline = res.data.data.outline;

      if (rawOutline.parse_error) {
        setNotification({ type: 'error', message: '大綱解析失敗，請重試' });
        return;
      }

      // Map backend structure to frontend structure
      const mappedOutline = {
        title: rawOutline.title || '',
        description: rawOutline.meta_description || rawOutline.introduction?.hook || '',
        sections: Array.isArray(rawOutline.sections) ? rawOutline.sections.map((s: any) => ({
          title: s.heading || s.title || '未命名章節',
          description: Array.isArray(s.key_points) ? s.key_points.join('\n') : (s.description || ''),
          keywords: s.keywords || [],
          subsections: Array.isArray(s.subsections) ? s.subsections.map((sub: any) => sub.heading || sub) : []
        })) : []
      };

      setOutline(mappedOutline);
      setSerpInsights(res.data.data.serp_insights);
      setStep(2);
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: '大綱生成失敗' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateArticle = async () => {
    if (!outline || !currentProject) return;

    setStep(3);
    setLoading(true);
    setGenerationStatus('正在撰寫文章內容...');

    try {
      // Since backend doesn't support SSE for full article yet in this MVP phase (based on analysis),
      // we'll wait for the full response. In a real app, we'd use SSE or polling.
      const res = await articleAPI.generate(
        currentProject.id,
        null, // keywordId is optional if we just have the string
        outline,
        { tone, target_audience: targetAudience }
      );

      setNotification({ type: 'success', message: '文章生成成功！' });
      // Redirect to editor or list
      // Assuming the response contains the article ID
      const articleId = res.data.data.article_id;
      navigate(`/articles/${articleId}`);
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: '文章生成失敗' });
      setStep(2); // Go back to outline
    } finally {
      setLoading(false);
    }
  };

  const updateOutlineSection = (index: number, field: keyof OutlineSection, value: any) => {
    if (!outline) return;
    const newSections = [...outline.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setOutline({ ...outline, sections: newSections });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Stepper */}
      <div className="flex items-center justify-center mb-12">
        <div className={`flex items-center ${step >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
            ${step >= 1 ? 'border-primary-600 bg-primary-50' : 'border-gray-300'}`}>
            <Wand2 className="w-4 h-4" />
          </div>
          <span className="ml-2 font-medium">設定</span>
        </div>
        <div className={`w-16 h-0.5 mx-4 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`} />
        <div className={`flex items-center ${step >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
            ${step >= 2 ? 'border-primary-600 bg-primary-50' : 'border-gray-300'}`}>
            <List className="w-4 h-4" />
          </div>
          <span className="ml-2 font-medium">大綱</span>
        </div>
        <div className={`w-16 h-0.5 mx-4 ${step >= 3 ? 'bg-primary-600' : 'bg-gray-200'}`} />
        <div className={`flex items-center ${step >= 3 ? 'text-primary-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
            ${step >= 3 ? 'border-primary-600 bg-primary-50' : 'border-gray-300'}`}>
            <FileText className="w-4 h-4" />
          </div>
          <span className="ml-2 font-medium">生成</span>
        </div>
      </div>

      {/* Step 1: Configuration */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">文章生成設定</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目標關鍵字
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例如：2024 日本旅遊攻略"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文章語氣
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="專業但易懂">專業但易懂</option>
                  <option value="輕鬆幽默">輕鬆幽默</option>
                  <option value="學術嚴謹">學術嚴謹</option>
                  <option value="親切熱情">親切熱情</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目標受眾
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="一般讀者">一般讀者</option>
                  <option value="初學者">初學者</option>
                  <option value="專業人士">專業人士</option>
                  <option value="決策者">決策者</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleGenerateOutline}
              disabled={loading || !keyword}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <span>生成大綱</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Outline Review */}
      {step === 2 && outline && (
        <div className="space-y-6">
          {/* SERP Insights */}
          {serpInsights && (
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-3">SERP 分析洞察</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-600 mb-1">人們也問 (PAA)</p>
                  <ul className="list-disc list-inside text-sm text-blue-900">
                    {serpInsights.people_also_ask?.map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-blue-600 mb-1">相關搜尋</p>
                  <div className="flex flex-wrap gap-2">
                    {serpInsights.related_searches?.map((s: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-white rounded text-xs text-blue-800 border border-blue-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Outline Editor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">大綱預覽與編輯</h2>
              <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <RefreshCw className="w-4 h-4" />
                重新生成
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">文章標題</label>
                <input
                  type="text"
                  value={outline.title}
                  onChange={(e) => setOutline({ ...outline, title: e.target.value })}
                  className="w-full text-lg font-bold text-gray-900 border-b border-gray-200 focus:border-primary-500 focus:outline-none py-2"
                />
              </div>

              <div className="space-y-4">
                {outline.sections.map((section, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 group">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateOutlineSection(index, 'title', e.target.value)}
                          className="w-full font-medium text-gray-900 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-400"
                          placeholder="段落標題"
                        />
                        <textarea
                          value={section.description}
                          onChange={(e) => updateOutlineSection(index, 'description', e.target.value)}
                          className="w-full text-sm text-gray-600 bg-transparent border-none focus:ring-0 p-0 resize-none placeholder-gray-400"
                          rows={2}
                          placeholder="段落描述..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>返回設定</span>
              </button>
              <button
                onClick={handleGenerateArticle}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>確認並生成文章</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI 正在撰寫文章</h2>
          <p className="text-gray-500 mb-8">{generationStatus}</p>

          <div className="max-w-md mx-auto bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-primary-600 animate-pulse w-2/3" />
          </div>
          <p className="text-xs text-gray-400 mt-4">這可能需要 1-2 分鐘，請勿關閉視窗</p>
        </div>
      )}
    </div>
  );
}
