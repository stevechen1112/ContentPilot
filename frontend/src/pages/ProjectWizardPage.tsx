import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore, useUIStore } from '../stores';
import { projectAPI } from '../lib/api';
import { Rocket, ArrowRight, Plus, X } from 'lucide-react';

export default function ProjectWizardPage() {
  const navigate = useNavigate();
  const { addProject, setCurrentProject } = useProjectStore();
  const { setLoading, setNotification } = useUIStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    mainKeyword: '',
    relatedKeywords: [] as string[],
  });
  const [tempKeyword, setTempKeyword] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tempKeyword.trim()) {
      e.preventDefault();
      if (!formData.relatedKeywords.includes(tempKeyword.trim())) {
        setFormData(prev => ({
          ...prev,
          relatedKeywords: [...prev.relatedKeywords, tempKeyword.trim()]
        }));
      }
      setTempKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      relatedKeywords: prev.relatedKeywords.filter(k => k !== keyword)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create Project
      const projectRes = await projectAPI.create({
        name: formData.name,
        description: formData.description
      });

      const newProject = projectRes.data.data;
      addProject(newProject);
      setCurrentProject(newProject);

      // 2. Add Keywords
      const keywordList = [formData.mainKeyword, ...formData.relatedKeywords];
      await projectAPI.addKeywords(newProject.id, keywordList);

      setNotification({ type: 'success', message: '專案建立成功！' });
      navigate('/dashboard'); // Or to the project page
    } catch (error) {
      console.error('Failed to create project:', error);
      setNotification({ type: 'error', message: '建立專案失敗，請稍後再試。' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 mb-4">
          <Rocket className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">快速啟動新專案</h1>
        <p className="mt-2 text-gray-600">只需幾步，即可開始您的 SEO 內容創作之旅</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Project Info */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  專案名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="例如：2024 夏季旅遊攻略"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  專案描述
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="描述這個專案的目標受眾與主要內容..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">關鍵字設定</h3>

                <div className="mb-4">
                  <label htmlFor="mainKeyword" className="block text-sm font-medium text-gray-700 mb-1">
                    核心關鍵字 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="mainKeyword"
                    name="mainKeyword"
                    required
                    value={formData.mainKeyword}
                    onChange={handleInputChange}
                    placeholder="例如：日本旅遊"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">這將是我們進行 SERP 分析的主要依據</p>
                </div>

                <div>
                  <label htmlFor="relatedKeywords" className="block text-sm font-medium text-gray-700 mb-1">
                    相關關鍵字 (選填)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tempKeyword}
                      onChange={(e) => setTempKeyword(e.target.value)}
                      onKeyDown={handleAddKeyword}
                      placeholder="輸入後按 Enter 新增"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tempKeyword.trim()) {
                          setFormData(prev => ({
                            ...prev,
                            relatedKeywords: [...prev.relatedKeywords, tempKeyword.trim()]
                          }));
                          setTempKeyword('');
                        }
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {formData.relatedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.relatedKeywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="ml-2 text-primary-400 hover:text-primary-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <span>建立專案</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
