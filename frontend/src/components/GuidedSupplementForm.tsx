import { useState } from 'react';
import { Send, Lightbulb, X, Loader2 } from 'lucide-react';

interface GuidedSupplementFormProps {
  gap: {
    section_id: number;
    section_heading: string;
    guided_prompts: Array<{
      question: string;
      example: string;
      why: string;
    }>;
    enhancement_suggestions: string[];
  };
  onSubmit: (experience: string) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

export default function GuidedSupplementForm({ gap, onSubmit, onClose, isSubmitting }: GuidedSupplementFormProps) {
  const [userExperience, setUserExperience] = useState('');
  const [expandedPromptIndex, setExpandedPromptIndex] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userExperience.trim() || isSubmitting) return;
    await onSubmit(userExperience);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">補充實際經驗</h3>
          <p className="text-sm text-gray-600 mt-1">
            段落：{gap.section_heading}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          disabled={isSubmitting}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Guided Prompts */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h4 className="font-semibold text-gray-900">引導式提示問題</h4>
        </div>
        
        {gap.guided_prompts?.map((prompt, index) => (
          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedPromptIndex(expandedPromptIndex === index ? null : index)}
              className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <span className="font-medium text-gray-900">{prompt.question}</span>
              <span className="text-xs text-gray-500">
                {expandedPromptIndex === index ? '收起' : '展開範例'}
              </span>
            </button>
            
            {expandedPromptIndex === index && (
              <div className="px-4 py-3 bg-white space-y-3">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">範例</span>
                  <p className="text-sm text-gray-700 mt-1 italic">{prompt.example}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">為什麼重要</span>
                  <p className="text-sm text-gray-600 mt-1">{prompt.why}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Enhancement Suggestions */}
      {gap.enhancement_suggestions && gap.enhancement_suggestions.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 text-sm mb-2">💡 建議補充方向</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {gap.enhancement_suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit}>
        <label className="block mb-2">
          <span className="text-sm font-semibold text-gray-700">你的實際經驗</span>
          <span className="text-xs text-gray-500 ml-2">
            （AI 將自動融合到原文中）
          </span>
        </label>
        <textarea
          value={userExperience}
          onChange={(e) => setUserExperience(e.target.value)}
          placeholder="請分享你的實際操作經驗、遇到的問題、解決方案或具體數據... 越詳細越好"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          rows={6}
          disabled={isSubmitting}
        />
        
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500">
            建議至少 50 字以上，能提供具體案例或數據更佳
          </span>
          <button
            type="submit"
            disabled={!userExperience.trim() || isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 融合中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                提交並重寫
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
