import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Sparkles, X, MessageSquare, Image as ImageIcon, BarChart2, Loader2 } from 'lucide-react';
import { articleAPI } from '../../lib/api';

interface Gap {
    section_id: number;
    section_heading: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    suggestion: string;
}

interface ExperienceInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    gap: Gap | null;
    articleId: string;
    onSuccess: (updatedContent: any) => void;
}

export default function ExperienceInputModal({ isOpen, onClose, gap, articleId, onSuccess }: ExperienceInputModalProps) {
    const [userInput, setUserInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'text' | 'image' | 'data'>('text');

    if (!gap) return null;

    const handleSubmit = async () => {
        if (!userInput.trim()) return;

        try {
            setIsSubmitting(true);

            const response = await articleAPI.smartRewrite(
                articleId,
                gap.section_id,
                userInput,
                gap.section_heading
            );

            onSuccess(response.data.data);
            setUserInput('');
            onClose();
        } catch (error) {
            console.error('Failed to rewrite section:', error);
            // Ideally show toast error here
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

            <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                    <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                <h3 className="text-lg font-bold leading-6">
                                    經驗補強：{gap.section_heading}
                                </h3>
                            </div>
                            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-blue-900">AI 建議：</p>
                                    <p className="text-sm text-blue-800 mt-1">{gap.suggestion}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Tabs */}
                            <div className="flex gap-2 mb-4 border-b border-gray-100 pb-1">
                                <button
                                    onClick={() => setActiveTab('text')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'text'
                                        ? 'bg-gray-100 text-gray-900'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    個人觀點
                                </button>
                                <button
                                    disabled
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed opacity-60"
                                    title="尚未開放"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    上傳照片
                                </button>
                                <button
                                    disabled
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed opacity-60"
                                    title="尚未開放"
                                >
                                    <BarChart2 className="w-4 h-4" />
                                    實測數據
                                </button>
                            </div>

                            {/* Input Area */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        您的真實經驗 / 口語補充：
                                    </label>
                                    <textarea
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        placeholder="例如：我實際去過這家店，發現他們的招牌其實很不顯眼，很容易錯過..."
                                        className="w-full h-32 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-2 text-right">
                                        只需輸入口語化的心得，AI 會自動為您修潤並融入文章。
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !userInput.trim()}
                                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
                  ${isSubmitting || !userInput.trim()
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-sm'}
                `}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        AI 處理中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        開始智能重寫
                                    </>
                                )}
                            </button>
                        </div>
                    </Dialog.Panel>
                </div>
            </div>
        </Dialog>
    );
}
