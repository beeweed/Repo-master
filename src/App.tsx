import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, KeyRound, AlertCircle, LogOut, Search, Trash2, ExternalLink, ShieldAlert, Loader2, CheckSquare, Square } from 'lucide-react';
import { GitHubService } from './services/githubService';
import { GitHubUser, GitHubRepository } from './types';

export default function App() {
  const [token, setToken] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [service, setService] = useState<GitHubService | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set());
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [deleteResult, setDeleteResult] = useState({ deletedCount: 0, errors: [] as string[] });
  
  // Use session storage to persist session temporarily across reloads during dev
  useEffect(() => {
    const savedToken = sessionStorage.getItem('github_token');
    if (savedToken) {
      handleConnect(savedToken);
    }
  }, []);

  const handleConnect = async (tokenToUse: string = token) => {
    if (!tokenToUse.trim()) {
      setError('Please enter a valid GitHub token.');
      return;
    }

    setIsConnecting(true);
    setError(null);
    
    try {
      const ghService = new GitHubService(tokenToUse);
      const ghUser = await ghService.getUser();
      
      setService(ghService);
      setUser(ghUser);
      sessionStorage.setItem('github_token', tokenToUse);
      
      // Fetch repos
      setIsLoadingRepos(true);
      const repos = await ghService.getRepositories(1, 100);
      setRepositories(repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to GitHub. Please check your token and scopes.');
      sessionStorage.removeItem('github_token');
    } finally {
      setIsConnecting(false);
      setIsLoadingRepos(false);
    }
  };

  const handleLogout = () => {
    setService(null);
    setUser(null);
    setRepositories([]);
    setToken('');
    setSelectedRepoIds(new Set());
    sessionStorage.removeItem('github_token');
  };

  const toggleSelectRepo = (id: number) => {
    setSelectedRepoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRepoIds.size === filteredRepos.length) {
      setSelectedRepoIds(new Set());
    } else {
      setSelectedRepoIds(new Set(filteredRepos.map(r => r.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (!service || !user) return;
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!service || !user) return;
    
    setShowConfirmModal(false);
    const reposToDelete = repositories.filter(r => selectedRepoIds.has(r.id));
    
    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: reposToDelete.length });
    
    const errors: string[] = [];
    let deletedCount = 0;

    for (const repo of reposToDelete) {
      try {
        await service.deleteRepository(repo.full_name);
        deletedCount++;
        setDeleteProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } catch (err) {
        errors.push(`Failed to delete ${repo.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Refresh repo list
    try {
      const updatedRepos = await service.getRepositories(1, 100);
      setRepositories(updatedRepos);
    } catch (err) {
      console.error("Failed to refresh repos", err);
    }

    setSelectedRepoIds(new Set());
    setIsDeleting(false);
    
    setDeleteResult({ deletedCount, errors });
    setShowResultModal(true);
  };

  const filteredRepos = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!service || !user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-neutral-800 p-4 rounded-full">
              <Github className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-white mb-2">GitHub Repo Manager</h1>
          <p className="text-neutral-400 text-center mb-8 text-sm">
            Bulk delete your old or unused GitHub repositories.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-neutral-300 mb-1.5 flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Personal Access Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
              <p className="text-xs text-neutral-500 mt-2 flex items-start gap-1">
                <ShieldAlert className="w-4 h-4 shrink-0 -mt-0.5" />
                <span>
                  Requires the <strong>repo</strong> and <strong>delete_repo</strong> scopes. Your token is only stored locally during your session.
                </span>
              </p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              onClick={() => handleConnect()}
              disabled={isConnecting || !token.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect to GitHub'
              )}
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
            <a 
              href="https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=GitHub+Repo+Manager" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
            >
              Generate a new token <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Github className="w-6 h-6 text-white" />
            <h1 className="font-semibold text-white hidden sm:block">Repo Manager</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pr-4 border-r border-neutral-800">
              <img src={user.avatar_url} alt={user.login} className="w-8 h-8 rounded-full border border-neutral-700" />
              <span className="text-sm font-medium hidden sm:block">{user.login}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Disconnect</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-neutral-600"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="text-sm text-neutral-400">
              {selectedRepoIds.size} / {filteredRepos.length} selected
            </div>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedRepoIds.size === 0 || isDeleting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 disabled:bg-neutral-900 disabled:text-neutral-600 border border-red-500/20 disabled:border-transparent px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting ({deleteProgress.current}/{deleteProgress.total})...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </>
              )}
            </button>
          </div>
        </div>

        {/* Repositories List */}
        {isLoadingRepos ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
            <p className="text-neutral-400">Fetching your repositories...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-20 border border-neutral-800 border-dashed rounded-2xl bg-neutral-900/30">
            <div className="bg-neutral-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-neutral-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No repositories found</h3>
            <p className="text-neutral-500">
              {searchQuery ? "Try adjusting your search query." : "You don't have any repositories yet."}
            </p>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-950/50 text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th scope="col" className="p-4 w-12">
                      <button onClick={toggleSelectAll} className="text-neutral-500 hover:text-white transition-colors">
                        {selectedRepoIds.size === filteredRepos.length && filteredRepos.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-indigo-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">Repository</th>
                    <th scope="col" className="px-4 py-3 font-medium">Visibility</th>
                    <th scope="col" className="px-4 py-3 font-medium">Last Updated</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  <AnimatePresence>
                    {filteredRepos.map((repo) => {
                      const isSelected = selectedRepoIds.has(repo.id);
                      return (
                        <motion.tr 
                          key={repo.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`hover:bg-neutral-800/50 transition-colors ${isSelected ? 'bg-indigo-500/5' : ''}`}
                          onClick={(e) => {
                            // Don't toggle if clicking the link
                            if ((e.target as HTMLElement).closest('a')) return;
                            toggleSelectRepo(repo.id);
                          }}
                        >
                          <td className="p-4 w-12 cursor-pointer">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-500" />
                            ) : (
                              <Square className="w-5 h-5 text-neutral-600" />
                            )}
                          </td>
                          <td className="px-4 py-4 min-w-[200px] cursor-pointer">
                            <div className="flex flex-col">
                              <span className="font-medium text-white truncate">{repo.name}</span>
                              {repo.description && (
                                <span className="text-xs text-neutral-500 truncate max-w-sm mt-0.5">{repo.description}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 cursor-pointer">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              repo.private 
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            }`}>
                              {repo.private ? 'Private' : 'Public'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-neutral-400 cursor-pointer">
                            {new Date(repo.updated_at).toLocaleDateString(undefined, { 
                              year: 'numeric', month: 'short', day: 'numeric' 
                            })}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <a 
                              href={repo.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-800"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View on GitHub
                            </a>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertCircle className="w-8 h-8" />
              <h2 className="text-xl font-bold text-white">Delete Repositories?</h2>
            </div>
            <p className="text-neutral-300 mb-6">
              You are about to permanently delete <strong>{selectedRepoIds.size}</strong> repositories. 
              This action <strong>CANNOT</strong> be undone. Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                Yes, delete them
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col"
          >
            <h2 className="text-xl font-bold text-white mb-4">Deletion Results</h2>
            <p className="text-neutral-300 mb-4">
              Successfully deleted: <strong>{deleteResult.deletedCount}</strong> repositories.
            </p>
            
            {deleteResult.errors.length > 0 && (
              <div className="flex-1 overflow-y-auto min-h-0 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <h3 className="text-red-400 font-medium mb-2 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Errors ({deleteResult.errors.length})
                </h3>
                <ul className="text-sm text-red-400/80 space-y-1 list-disc pl-4">
                  {deleteResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex justify-end pt-4 mt-auto">
              <button 
                onClick={() => setShowResultModal(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
