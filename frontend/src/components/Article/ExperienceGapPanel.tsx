import { Sparkles } from 'lucide-react';

interface Gap {
    section_id: number;
    section_heading: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    suggestion: string;
    current_eeat_score: number;
    potential_eeat_boost: number;
}

interface ExperienceGapPanelProps {
    gaps: Gap[];
    loading: boolean;
    onFixGap: (gap: Gap) => void;
    onDetectGaps: () => void;
}

export default function ExperienceGapPanel({ gaps, loading, onFixGap, onDetectGaps }: ExperienceGapPanelProps) {
    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-20 bg-gray-100 rounded"></div>
                    <div className="h-20 bg-gray-100 rounded"></div>
                    <div className="h-20 bg-gray-100 rounded"></div>
                </div>
            </div>
        );
    }

    if (!gaps || gaps.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">智能經驗缺口偵測</h3>
                <p className="text-gray-600 mb-6 text-sm">
                    AI 可以協助您找出文章中缺乏「個人經驗」與「實證數據」的段落，並引導您進行補強，提升 E-E-A-T 分數。
                </p>
                <button
                    onClick={onDetectGaps}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    開始偵測缺口
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-24">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    經驗補強建議 ({gaps.length})
                </h3>
            </div>

            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-4 space-y-4">
                {gaps.map((gap, index) => (
                    <div
                        key={index}
                        className={`
              relative p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md
              ${gap.severity === 'high' ? 'border-red-100 bg-red-50/50 hover:border-red-200' :
                                gap.severity === 'medium' ? 'border-amber-100 bg-amber-50/50 hover:border-amber-200' :
                                    'border-green-100 bg-green-50/50 hover:border-green-200'}
            `}
                        onClick={() => onFixGap(gap)}
                    >
                        {/* Badge */}
                        <div className="flex justify-between items-start mb-2">
                            <span className={`
                text-xs font-bold px-2 py-0.5 rounded-full
                ${gap.severity === 'high' ? 'bg-red-100 text-red-700' :
                                    gap.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                        'bg-green-100 text-green-700'}
              `}>
                                {gap.severity === 'high' ? '嚴重缺口' : gap.severity === 'medium' ? '建議補充' : '優化建議'}
                            </span>
                            <span className="text-xs font-medium text-blue-600 flex items-center gap-1">
                                E-E-A-T +{gap.potential_eeat_boost}
                            </span>
                        </div>

                        <h4 className="text-sm font-bold text-gray-900 mb-1 line-clamp-1">{gap.section_heading}</h4>
                        <p className="text-xs text-gray-600 mb-3">{gap.description}</p>

                        <div className={`
              text-xs p-2 rounded border
              ${gap.severity === 'high' ? 'bg-white border-red-100 text-red-600' :
                                gap.severity === 'medium' ? 'bg-white border-amber-100 text-amber-600' :
                                    'bg-white border-green-100 text-green-600'}
            `}>
                            💡 建議：{gap.suggestion}
                        </div>

                        <button
                            className="mt-3 w-full py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                        >
                            立即補強
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
