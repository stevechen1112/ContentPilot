import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore, useUIStore } from '../stores';
import { articleAPI } from '../lib/api';
import {
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  ChevronDown,
} from 'lucide-react';

interface ArticleSummary {
  id: string;
  title: string;
  status: 'draft' | 'review' | 'published' | string;
  quality_score: number | null;
  eeat_score: number | null;
  seo_score: number | null;
  keyword?: string;
  created_at: string;
  updated_at: string;
}

interface Statistics {
  total: string;
  drafts: string;
  in_review: string;
  published: string;
  avg_quality: string | null;
  avg_eeat: string | null;
  avg_seo: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  review: '審閱中',
  published: '已發佈',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
};

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score == null) return <span className="text-gray-400 text-xs">—</span>;
  const color =
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500';
  return (
    <span className={`text-sm font-semibold ${color}`} title={label}>
      {score}
    </span>
  );
}

export default function ArticleListPage() {
  const navigate = useNavigate();
  const { currentProject, projects, setCurrentProject } = useProjectStore();
  const { setNotification } = useUIStore();

  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 若尚無 currentProject，嘗試從 projects 陣列取第一個
  useEffect(() => {
    if (!currentProject && projects.length > 0) {
      setCurrentProject(projects[0]);
    }
  }, [currentProject, projects, setCurrentProject]);

  // 載入文章列表
  const loadArticles = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await articleAPI.getAll(currentProject.id, statusFilter || undefined);
      setArticles(res.data.data ?? []);
      setStats(res.data.statistics ?? null);
    } catch (err: any) {
      const msg = err.response?.data?.error || '無法載入文章列表';
      setNotification({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, statusFilter]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`確定要刪除「${title || '此文章'}」嗎？此操作無法復原。`)) return;
    setDeletingId(id);
    try {
      await articleAPI.delete(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      setNotification({ type: 'success', message: '文章已刪除' });
      // 更新統計
      if (stats) {
        setStats((s) =>
          s ? { ...s, total: String(Number(s.total) - 1) } : s
        );
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.error || '刪除失敗' });
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = articles.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.title || '').toLowerCase().includes(q) ||
      (a.keyword || '').toLowerCase().includes(q)
    );
  });

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 頁首 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">文章列表</h1>
          {currentProject && (
            <p className="text-sm text-gray-500 mt-0.5">
              專案：<span className="font-medium text-gray-700">{currentProject.name}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          生成新文章
        </button>
      </div>

      {/* 統計卡片 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '全部', value: stats.total, color: 'text-gray-900' },
            { label: '草稿', value: stats.drafts, color: 'text-gray-600' },
            { label: '審閱中', value: stats.in_review, color: 'text-yellow-600' },
            { label: '已發佈', value: stats.published, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-3xl font-bold ${color}`}>{value ?? '0'}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 篩選列 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 搜尋 */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋標題或關鍵字..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* 狀態篩選 */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-9 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部狀態</option>
            <option value="draft">草稿</option>
            <option value="review">審閱中</option>
            <option value="published">已發佈</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* 重新整理 */}
        <button
          onClick={loadArticles}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="重新載入"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">重新整理</span>
        </button>
      </div>

      {/* 文章表格 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && articles.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-50" />
            <p>載入中...</p>
          </div>
        ) : !currentProject ? (
          <div className="py-20 text-center text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">尚無選取的專案</p>
            <p className="text-sm mt-1">請先生成一篇文章以初始化專案</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">
              {searchQuery || statusFilter ? '找不到符合條件的文章' : '尚無文章'}
            </p>
            {!searchQuery && !statusFilter && (
              <button
                onClick={() => navigate('/')}
                className="mt-4 text-primary-600 hover:underline text-sm"
              >
                生成第一篇文章 →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">標題 / 關鍵字</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 hidden sm:table-cell">狀態</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 hidden md:table-cell">品質</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 hidden md:table-cell">E-E-A-T</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">SEO</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 hidden lg:table-cell">建立日期</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((article) => (
                <tr
                  key={article.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/article/${article.id}`)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-xs">
                      {article.title || '（未命名）'}
                    </p>
                    {article.keyword && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{article.keyword}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[article.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_LABEL[article.status] ?? article.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <ScoreBadge score={article.quality_score} label="品質分數" />
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <ScoreBadge score={article.eeat_score} label="E-E-A-T 分數" />
                  </td>
                  <td className="px-3 py-3 text-center hidden lg:table-cell">
                    <ScoreBadge score={article.seo_score} label="SEO 分數" />
                  </td>
                  <td className="px-3 py-3 text-center hidden lg:table-cell text-gray-400 text-xs">
                    {formatDate(article.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => navigate(`/article/${article.id}`)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="開啟文章"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(article.id, article.title)}
                        disabled={deletingId === article.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                        title="刪除文章"
                      >
                        {deletingId === article.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 底部資訊列 */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
            <span>
              顯示 {filtered.length} / {articles.length} 篇文章
            </span>
            {stats && (
              <span className="hidden sm:block">
                平均品質：{stats.avg_quality ?? '—'} <span className="mx-1">|</span> E-E-A-T：{stats.avg_eeat ?? '—'} <span className="mx-1">|</span> SEO：{stats.avg_seo ?? '—'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
