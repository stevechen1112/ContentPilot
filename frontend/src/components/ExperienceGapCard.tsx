import { AlertCircle, CheckCircle, AlertTriangle, Lightbulb, ChevronRight } from 'lucide-react';

interface ExperienceGapCardProps {
  gap: {
    section_id: number;
    section_heading: string;
    score: number;
    priority: string;
    level: 'high' | 'medium' | 'low';
    gap_type: string;
    current_issues: string[];
    guided_prompts: Array<{
      question: string;
      example: string;
      why: string;
    }>;
    enhancement_suggestions: string[];
  };
  onClick: () => void;
  isActive: boolean;
}

export default function ExperienceGapCard({ gap, onClick, isActive }: ExperienceGapCardProps) {
  const getPriorityColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-50 border-red-200 hover:border-red-300';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 hover:border-yellow-300';
      case 'low':
        return 'bg-green-50 border-green-200 hover:border-green-300';
      default:
        return 'bg-gray-50 border-gray-200 hover:border-gray-300';
    }
  };

  const getPriorityIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return null;
    }
  };

  const getPriorityLabel = (level: string) => {
    switch (level) {
      case 'high':
        return '高優先級';
      case 'medium':
        return '中優先級';
      case 'low':
        return '低優先級';
      default:
        return '';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all
        ${getPriorityColor(gap.level)}
        ${isActive ? 'ring-2 ring-primary-500 shadow-lg' : 'shadow-sm'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          {getPriorityIcon(gap.level)}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{gap.priority}</span>
              <span className="text-xs text-gray-500">{getPriorityLabel(gap.level)}</span>
            </div>
            <h4 className="font-semibold text-gray-900 mt-1 line-clamp-1">
              {gap.section_heading || `段落 ${gap.section_id + 1}`}
            </h4>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isActive ? 'rotate-90' : ''}`} />
      </div>

      {/* Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">體驗豐富度</span>
          <span className="font-semibold text-gray-900">{gap.score}/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              gap.level === 'high' ? 'bg-red-500' : gap.level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${gap.score}%` }}
          />
        </div>
      </div>

      {/* Gap Type */}
      <div className="mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs font-medium text-gray-700 border">
          <Lightbulb className="w-3 h-3" />
          {gap.gap_type}
        </span>
      </div>

      {/* Issues Preview */}
      {gap.current_issues && gap.current_issues.length > 0 && (
        <div className="text-xs text-gray-600">
          <span className="font-medium">問題：</span>
          {gap.current_issues[0]}
          {gap.current_issues.length > 1 && (
            <span className="text-gray-400"> +{gap.current_issues.length - 1} 項</span>
          )}
        </div>
      )}

      {/* Click Hint */}
      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center gap-1">
        <span>點擊查看引導式補充提示</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  );
}
