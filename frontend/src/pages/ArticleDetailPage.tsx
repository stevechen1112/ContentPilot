import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { articleAPI } from '../lib/api';
import { useUIStore } from '../stores';

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setNotification } = useUIStore();
  
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<any>(null);
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) {
        setNotification({ type: 'error', message: '文章 ID 無效' });
        navigate('/');
        return;
      }

      try {
        setLoading(true);
        const response = await articleAPI.getById(id);
        const articleData = response.data.data;
        
        // 組合完整的 HTML 內容
        const content = articleData.content_draft || articleData.content;
        let fullHtml = '';
        
        if (content?.content) {
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

        setArticle(articleData);
        setHtmlContent(fullHtml);
      } catch (error: any) {
        console.error('Failed to fetch article:', error);
        setNotification({ type: 'error', message: '文章載入失敗' });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, navigate, setNotification]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!article || !htmlContent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">文章不存在或載入失敗</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Toolbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回首頁</span>
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>列印 / 匯出 PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <article className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Article Header with gradient background */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 md:px-12 pt-8 md:pt-12 pb-6">
            {/* Article Title */}
            {article.title && (
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                {article.title}
              </h1>
            )}

            {/* Article Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {article.keyword && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="font-medium">關鍵字:</span>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {article.keyword}
                  </span>
                </span>
              )}
              {article.created_at && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  生成時間: {new Date(article.created_at).toLocaleString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Article Body */}
          <div className="px-8 md:px-12 py-8 md:py-10">
            {/* Article HTML Content */}
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </article>
      </div>
    </div>
  );
}
