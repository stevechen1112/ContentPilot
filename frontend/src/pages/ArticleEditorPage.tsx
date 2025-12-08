import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useArticleStore, useUIStore } from '../stores';
import { articleAPI } from '../lib/api';
import ExperienceGapCard from '../components/ExperienceGapCard';
import GuidedSupplementForm from '../components/GuidedSupplementForm';
import {
  Save,
  ArrowLeft,
  Wand2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';

export default function ArticleEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentArticle, setCurrentArticle, updateArticleSection } = useArticleStore();
  const { setNotification } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qualityScore, setQualityScore] = useState<any>(null);
  const [checkingQuality, setCheckingQuality] = useState(false);

  // S8 Experience Gap Detection
  const [experienceGaps, setExperienceGaps] = useState<any[]>([]);
  const [detectingGaps, setDetectingGaps] = useState(false);
  const [selectedGap, setSelectedGap] = useState<any>(null);
  const [rewritingWithExperience, setRewritingWithExperience] = useState(false);

  // Rewrite State
  const [rewritingSection, setRewritingSection] = useState<number | null>(null);
  const [rewritePrompt, setRewritePrompt] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;
      try {
        const res = await articleAPI.getById(id);
        setCurrentArticle(res.data.data);
      } catch (error) {
        console.error(error);
        setNotification({ type: 'error', message: '無法載入文章' });
        navigate('/articles');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, setCurrentArticle, navigate, setNotification]);

  const handleSave = async () => {
    if (!currentArticle || !id) return;
    setSaving(true);
    try {
      await articleAPI.update(id, {
        title: currentArticle.title,
        content_draft: currentArticle.content_draft
      });
      setNotification({ type: 'success', message: '儲存成功' });
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: '儲存失敗' });
    } finally {
      setSaving(false);
    }
  };

  const handleQualityCheck = async () => {
    if (!id || !currentArticle) return;
    setCheckingQuality(true);
    try {
      const keyword = currentArticle.keyword_id || 'default';
      const res = await articleAPI.comprehensiveQualityCheck(id, keyword);
      setQualityScore(res.data.data);
      setNotification({ type: 'success', message: '品質檢測完成' });
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: '檢測失敗' });
    } finally {
      setCheckingQuality(false);
    }
  };

  const handleDetectExperienceGaps = async () => {
    if (!id || !currentArticle) return;
    setDetectingGaps(true);
    try {
      const keyword = currentArticle.keyword_id || 'default';
      const res = await articleAPI.detectExperienceGaps(id, keyword);
      setExperienceGaps(res.data.data.gaps || []);
      setNotification({ 
        type: 'success', 
        message: `發現 ${res.data.data.statistics?.high_priority || 0} 個高優先級經驗缺口` 
      });
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: '檢測失敗' });
    } finally {
      setDetectingGaps(false);
    }
  };

  const handleSmartRewrite = async (userExperience: string) => {
    if (!selectedGap || !id) return;
    setRewritingWithExperience(true);
    try {
      const res = await articleAPI.smartRewrite(
        id,
        selectedGap.section_id,
        userExperience,
        selectedGap.section_heading
      );

      // Update the section with rewritten content
      updateArticleSection(selectedGap.section_id, { 
        html: res.data.data.rewritten_content,
        content: res.data.data.rewritten_content
      });

      setNotification({ type: 'success', message: 'AI 已成功融合你的經驗！' });
      setSelectedGap(null);

      // 重新檢測經驗缺口
      setTimeout(() => handleDetectExperienceGaps(), 1000);
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: '融合失敗' });
    } finally {
      setRewritingWithExperience(false);
    }
  };

  const handleRewrite = async (index: number) => {
    if (!currentArticle || !id) return;

    const section = (currentArticle.content_draft?.sections || currentArticle.content_draft?.content?.sections)?.[index];
    if (!section) return;

    setIsRewriting(true);
    try {
      const res = await articleAPI.rewriteSection(
        id,
        index,
        section.content,
        rewritePrompt || '請優化這段內容，使其更通順。'
      );

      // Update the section with new content
      updateArticleSection(index, { content: res.data.data.rewritten_content });
      setNotification({ type: 'success', message: '改寫成功' });
      setRewritingSection(null);
      setRewritePrompt('');
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: '改寫失敗' });
    } finally {
      setIsRewriting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!currentArticle) return null;

  const sections = currentArticle.content_draft?.sections || currentArticle.content_draft?.content?.sections || [];

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 flex gap-6 h-[calc(100vh-4rem)]">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/articles')}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={currentArticle.title}
              onChange={(e) => setCurrentArticle({ ...currentArticle, title: e.target.value })}
              className="text-lg font-bold bg-transparent border-none focus:ring-0 p-0 w-96"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDetectExperienceGaps}
              disabled={detectingGaps}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              {detectingGaps ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              經驗缺口檢測
            </button>
            <button
              onClick={handleQualityCheck}
              disabled={checkingQuality}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
            >
              {checkingQuality ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              品質檢測
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              儲存
            </button>
          </div>
        </div>

        {/* Editor Content */}


        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {sections.map((section: any, index: number) => (
            <div key={index} className="group relative border border-transparent hover:border-gray-200 rounded-lg p-4 transition-colors">
              {/* Section Toolbar */}
              <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button
                  onClick={() => setRewritingSection(index)}
                  className="p-1.5 text-gray-500 hover:text-primary-600 bg-white shadow-sm border border-gray-200 rounded-md"
                  title="AI 改寫"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={section.title || section.heading}
                onChange={(e) => updateArticleSection(index, { title: e.target.value, heading: e.target.value })}
                className="w-full text-xl font-bold text-gray-800 mb-4 border-none focus:ring-0 p-0"
              />

              <textarea
                value={section.html || section.content || ''}
                onChange={(e) => updateArticleSection(index, { html: e.target.value, content: e.target.value })}
                className="w-full min-h-[200px] text-gray-600 leading-relaxed border-none focus:ring-0 p-0 resize-none"
                placeholder="撰寫內容..."
              />

              {/* Rewrite Panel */}
              {rewritingSection === index && (
                <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <Wand2 className="w-5 h-5 text-primary-600 mt-1" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-primary-900 mb-2">AI 智能改寫</h4>
                      <textarea
                        value={rewritePrompt}
                        onChange={(e) => setRewritePrompt(e.target.value)}
                        placeholder="請輸入改寫指令，例如：『語氣更專業一點』、『擴充這段內容』..."
                        className="w-full text-sm p-2 border border-primary-200 rounded-md focus:ring-1 focus:ring-primary-500 mb-3"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setRewritingSection(null)}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-white rounded-md"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleRewrite(index)}
                          disabled={isRewriting}
                          className="px-3 py-1.5 text-xs text-white bg-primary-600 hover:bg-primary-700 rounded-md flex items-center gap-1"
                        >
                          {isRewriting && <Loader2 className="w-3 h-3 animate-spin" />}
                          開始改寫
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar: Experience Gaps & Quality Check */}
      <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-900">智能二修工作台</h3>
          <p className="text-xs text-gray-500 mt-1">經驗缺口檢測 + 品質分析</p>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {/* Experience Gaps Section */}
          {experienceGaps.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                經驗缺口 ({experienceGaps.length})
              </h4>
              <div className="space-y-3">
                {experienceGaps.map((gap: any) => (
                  <ExperienceGapCard
                    key={gap.section_id}
                    gap={gap}
                    onClick={() => setSelectedGap(gap.section_id === selectedGap?.section_id ? null : gap)}
                    isActive={gap.section_id === selectedGap?.section_id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Guided Supplement Form */}
          {selectedGap && (
            <GuidedSupplementForm
              gap={selectedGap}
              onSubmit={handleSmartRewrite}
              onClose={() => setSelectedGap(null)}
              isSubmitting={rewritingWithExperience}
            />
          )}

          {/* Quality Score Section */}
          {qualityScore && (
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                綜合品質報告
              </h4>
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className={`text-3xl font-bold mb-1 ${
                    qualityScore.overall_score >= 85 ? 'text-green-600' : 
                    qualityScore.overall_score >= 70 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {qualityScore.overall_score}
                  </div>
                  <div className="text-xs text-gray-500">綜合品質評分</div>
                  {qualityScore.pass_threshold ? (
                    <div className="mt-2 text-xs text-green-600 font-semibold">✅ 達標 (≥85分)</div>
                  ) : (
                    <div className="mt-2 text-xs text-red-600 font-semibold">❌ 未達標 (需≥85分)</div>
                  )}
                </div>

                {qualityScore.checks && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">E-E-A-T:</span>
                      <span className="font-semibold">{qualityScore.checks.eeat?.score || 0}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">原創性:</span>
                      <span className="font-semibold">{qualityScore.checks.originality?.score || 0}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SEO:</span>
                      <span className="font-semibold">{qualityScore.checks.seo?.score || 0}/100</span>
                    </div>
                  </div>
                )}

                {qualityScore.improvements && qualityScore.improvements.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">改進建議</h5>
                    <ul className="space-y-2">
                      {qualityScore.improvements.map((improvement: any, i: number) => (
                        <li key={i} className="text-xs border-l-2 pl-2 py-1" style={{
                          borderColor: improvement.priority?.includes('🔴') ? '#ef4444' : 
                                      improvement.priority?.includes('🟡') ? '#f59e0b' : '#10b981'
                        }}>
                          <div className="font-semibold">{improvement.priority} {improvement.category}</div>
                          <div className="text-gray-600 mt-1">{improvement.action}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {experienceGaps.length === 0 && !qualityScore && (
            <div className="text-center py-12 text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">點擊上方按鈕開始分析</p>
              <p className="text-xs mt-2">
                • 經驗缺口檢測：找出需要補充實際經驗的段落<br />
                • 品質檢測：獲取 E-E-A-T 綜合評分
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
