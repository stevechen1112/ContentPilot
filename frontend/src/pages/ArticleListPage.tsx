import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useProjectStore, useUIStore } from '../stores';
import { articleAPI } from '../lib/api';
import {
  FileText,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Loader2
} from 'lucide-react';

export default function ArticleListPage() {
  const { currentProject } = useProjectStore();
  const { setNotification } = useUIStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: articles, isLoading } = useQuery({
    queryKey: ['articles', currentProject?.id, statusFilter],
    queryFn: () => articleAPI.getAll(currentProject?.id, statusFilter === 'all' ? undefined : statusFilter),
    enabled: !!currentProject?.id,
    select: (res) => res.data.data,
  });

  const deleteMutation = useMutation({
    mutationFn: articleAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setNotification({ type: 'success', message: '文章已刪除' });
    },
    onError: () => {
      setNotification({ type: 'error', message: '刪除失敗' });
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm('確定要刪除這篇文章嗎？')) {
      deleteMutation.mutate(id);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">尚未選擇專案</h2>
        <p className="text-gray-500 mb-6">請先選擇或建立一個專案以管理文章</p>
        <Link
          to="/wizard"
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          建立新專案
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">文章列表</h1>
          <p className="text-gray-500 mt-1">管理專案 "{currentProject.name}" 的所有文章</p>
        </div>
        <Link
          to="/articles/new"
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>新增文章</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋文章標題..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">所有狀態</option>
            <option value="draft">草稿</option>
            <option value="generating">生成中</option>
            <option value="completed">已完成</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : articles?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">尚無文章</h3>
            <p className="text-gray-500 mt-1">開始您的第一篇 SEO 文章創作吧！</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">標題 / 關鍵字</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">建立時間</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {articles?.map((article: any) => (
                  <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{article.title || '未命名文章'}</p>
                          <p className="text-xs text-gray-500">{article.keyword || '無關鍵字'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${article.status === 'completed' ? 'bg-green-100 text-green-800' :
                          article.status === 'generating' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'}`}>
                        {article.status === 'completed' ? '已完成' :
                          article.status === 'generating' ? '生成中' : '草稿'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(article.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/articles/${article.id}`}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="編輯"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(article.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
