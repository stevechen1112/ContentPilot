import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProjectStore } from '../stores';
import { projectAPI } from '../lib/api';
import { FolderOpen, Plus, TrendingUp, FileText, CheckCircle } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { projects, setProjects, setCurrentProject } = useProjectStore();

  // 載入專案列表
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectAPI.getAll();
      return response.data.data;
    },
  });

  useEffect(() => {
    if (projectsData) {
      setProjects(projectsData);
      if (projectsData.length > 0 && !useProjectStore.getState().currentProject) {
        setCurrentProject(projectsData[0]);
      }
    }
  }, [projectsData, setProjects, setCurrentProject]);

  const stats = [
    {
      label: '總專案數',
      value: projects.length,
      icon: FolderOpen,
      color: 'bg-blue-500',
    },
    {
      label: '總文章數',
      value: projects.reduce((sum, p) => sum + (parseInt(p.article_count) || 0), 0),
      icon: FileText,
      color: 'bg-green-500',
    },
    {
      label: '已完成關鍵字',
      value: projects.reduce((sum, p) => sum + (parseInt(p.keyword_count) || 0), 0),
      icon: CheckCircle,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">儀表板</h1>
        <p className="text-gray-600">歡迎回來！這是你的內容創作概覽</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">我的專案</h2>
            <button
              onClick={() => navigate('/projects/new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新增專案</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {projects.length === 0 ? (
            <div className="p-12 text-center">
              <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">還沒有專案</h3>
              <p className="text-gray-600 mb-4">建立你的第一個專案，開始 AI 內容創作</p>
              <button
                onClick={() => navigate('/projects/new')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>建立專案</span>
              </button>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  setCurrentProject(project);
                  navigate(`/articles`);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">{project.industry}</p>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>{project.keyword_count || 0} 關鍵字</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="w-4 h-4" />
                        <span>{project.article_count || 0} 文章</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      建立於 {new Date(project.created_at).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
